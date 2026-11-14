import { and, eq, sql } from "drizzle-orm";
import { getPlanSummary } from "@/features/plan-limits";
import { aiCreditLedger, aiFreeCreditGrant } from "@/models/ai";
import { organization, organizationMember  } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { FALLBACK_MONTHLY_CREDITS } from "./config/credits";
import { periodOf, readCredits } from "./queries";
import "server-only";

// Internal operations, called by billing webhooks, jobs and the chat route.
// Never a server action: anyone could otherwise credit any organization.
//
// The credits of a workspace are two buckets in one ledger. The plan grants its
// monthly credits as an `allocation`, which does not carry over: it counts in its
// calendar month (UTC) alone. A pack that was bought is a `pack`, which never
// expires. What is spent comes out of the allocation first, then out of the packs.

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What the credits of a workspace stand at. */
export interface CreditState {
  /** The plan has no cap on credits: nothing is counted or debited. */
  unlimited: boolean;
  /** What the plan grants in the period; 0 when unlimited. */
  monthly: number;
  /** What is left of the month's allocation. */
  allocation: number;
  /** What is left of the credits that were bought. */
  packs: number;
  /** `allocation + packs`: what the next answer can spend. */
  total: number;
}

const UNLIMITED: CreditState = { unlimited: true, monthly: 0, allocation: 0, packs: 0, total: 0 };

/** What the plan of a workspace grants each month; -1 when it is unlimited. */
export async function monthlyCreditsOf(orgId: string): Promise<number> {
  const plan = await getPlanSummary(orgId);

  return plan?.limits.aiCredits ?? FALLBACK_MONTHLY_CREDITS;
}

/**
 * Grants the allocation of the month, at the first use in it (UTC). It is lazy,
 * so that it works for a yearly plan (the provider tells once a year), without a
 * scheduler, and for a workspace on the free plan that nobody bills; and
 * idempotent: the ledger holds one allocation per workspace and month (a unique
 * index), and two requests that arrive together grant it once. When the plan
 * rose since the grant (an upgrade in the month) the difference is added, so
 * that a month never grants more than the highest plan of the month, however
 * often the plan goes up and down. Nothing carries over: last month's rows are
 * not in this month's sum.
 */
export async function ensureMonthlyAllocation(orgId: string, now = new Date()): Promise<CreditState> {
  const monthly = await monthlyCreditsOf(orgId);
  if (monthly < 0) {
    return UNLIMITED;
  }

  const period = periodOf(now);
  // No plan at all (no feature gives plans) is the free allowance too: the fallback is counted per owner, as the free plan's is
  const summary = await getPlanSummary(orgId);
  const free = summary === null || summary.free === true;
  let credits = await readCredits(orgId, period);
  if (credits.granted < monthly) {
    // Under a lock on the workspace, so that the check and the grant are one step
    await db.transaction(async (tx) => {
      await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, orgId)).for("update");
      const { granted } = await readCredits(orgId, period, tx);
      if (granted >= monthly) {
        return;
      }

      // The free credits are the owner's, once a month, not each workspace's: the grant is recorded for the owner
      // (a row that outlives the workspace), so that deleting a free workspace and making another gives nothing again
      if (free && granted === 0 && !(await claimFreeGrant(tx, orgId, period))) {
        return;
      }

      await tx
        .insert(aiCreditLedger)
        .values({
          id: generateId(),
          organizationId: orgId,
          amount: monthly - granted,
          reason: granted === 0 ? "plan_allocation" : "plan_change",
          bucket: "allocation",
          period,
        })
        .onConflictDoNothing();
    });
    credits = await readCredits(orgId, period);
  }

  const allocation = Math.max(0, credits.allocation);
  const packs = Math.max(0, credits.packs);

  return { unlimited: false, monthly, allocation, packs, total: allocation + packs };
}

/**
 * Records the free allocation of a month for the owner of the workspace. True when
 * this workspace is the one that has it (it was recorded now, or before for it);
 * false when the owner had it already for another workspace, one that may be gone.
 */
async function claimFreeGrant(tx: Transaction, orgId: string, period: string): Promise<boolean> {
  const [owner] = await tx
    .select({ userId: organizationMember.userId })
    .from(organizationMember)
    .where(and(eq(organizationMember.organizationId, orgId), eq(organizationMember.role, "owner")))
    .limit(1);
  if (!owner) {
    return true;
  }

  const inserted = await tx.insert(aiFreeCreditGrant).values({ userId: owner.userId, period, organizationId: orgId }).onConflictDoNothing().returning();
  if (inserted.length > 0) {
    return true;
  }
  const [recorded] = await tx
    .select({ organizationId: aiFreeCreditGrant.organizationId })
    .from(aiFreeCreditGrant)
    .where(and(eq(aiFreeCreditGrant.userId, owner.userId), eq(aiFreeCreditGrant.period, period)))
    .limit(1);

  return recorded?.organizationId === orgId;
}

/**
 * Takes `cost` credits out of a workspace, inside the transaction that holds its
 * row: the allocation first, then the packs, never below zero (an answer that
 * costs more than is left takes what is left). A debit is a row per bucket it
 * takes from. Answers the credits taken.
 */
export async function debitCredits(tx: Transaction, orgId: string, cost: number, referenceId: string, now = new Date()): Promise<number> {
  const period = periodOf(now);
  const credits = await readCredits(orgId, period, tx);
  const fromAllocation = Math.min(cost, Math.max(0, credits.allocation));
  const fromPacks = Math.min(cost - fromAllocation, Math.max(0, credits.packs));

  const rows = [
    { amount: fromAllocation, bucket: "allocation", period },
    { amount: fromPacks, bucket: "pack", period: null },
  ].filter((row) => row.amount > 0);
  for (const row of rows) {
    await tx.insert(aiCreditLedger).values({
      id: generateId(),
      organizationId: orgId,
      amount: -row.amount,
      reason: "usage",
      referenceId,
      bucket: row.bucket,
      period: row.period,
    });
  }

  return fromAllocation + fromPacks;
}

/**
 * Credits a pack that was bought, once: the pack row of a checkout session is
 * unique in the ledger, so a webhook delivered twice adds nothing. True when
 * this call is the one that credited it.
 */
export async function addPackCredits(orgId: string, credits: number, checkoutSessionId: string): Promise<boolean> {
  const inserted = await db
    .insert(aiCreditLedger)
    .values({
      id: generateId(),
      organizationId: orgId,
      amount: credits,
      reason: "credit_pack",
      referenceId: checkoutSessionId,
      bucket: "pack",
    })
    .onConflictDoNothing()
    .returning();

  return inserted.length > 0;
}

/** An adjustment by the operator, in a bucket: a gift of credits, or a correction. */
export async function adjustCredits(orgId: string, amount: number, reason = "admin_adjustment") {
  await db.insert(aiCreditLedger).values({
    id: generateId(),
    organizationId: orgId,
    amount,
    reason,
    bucket: "pack",
  });
}

/** The credits of the month's allocation that the workspace has spent: what the quota of the shell counts. */
export async function allocationUsed(orgId: string, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ used: sql<number>`COALESCE(SUM(-${aiCreditLedger.amount}), 0)`.mapWith(Number) })
    .from(aiCreditLedger)
    .where(
      and(
        eq(aiCreditLedger.organizationId, orgId),
        eq(aiCreditLedger.bucket, "allocation"),
        eq(aiCreditLedger.period, periodOf(now)),
        sql`${aiCreditLedger.amount} < 0`,
      ),
    );

  return row?.used ?? 0;
}
