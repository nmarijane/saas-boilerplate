import type { LimitContribution, PlanSummary } from "@/shared/shell/contract";
import { and, asc, eq } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { getServerSession } from "@/features/auth/guards";
import { organization, organizationMember, user } from "@/models";
import { PlanLimitError } from "@/shared/lib/action-refusal";
import { db } from "@/shared/lib/DB";
import { env } from "@/shared/lib/env";
import { ROLE_HIERARCHY } from "@/shared/types";
import "server-only";

// The limits of the plan of a workspace, enforced on the server. What the plan
// allows comes from the first feature that gives plans (billing), and what the
// workspace holds from the features that create things (`limits` of their
// `shell.ts`), so that this file imports neither: removing billing leaves
// everything unlimited, removing a feature leaves its limit unchecked.
//
// A page that shows a lock is a courtesy; this is the check. An action that
// creates something asks it before it writes, and a refused one throws a
// `PlanLimitError`, which `safeAction` hands to the page as a typed error.

// The registry is read when a limit is checked, not when this file loads: the
// features it lists import the actions that call this file
async function installedFeatures() {
  return (await import("@/features/registry")).FEATURES;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The plan of a workspace, from the first feature that gives plans; null when no feature does. */
export async function getPlanSummary(orgId: string): Promise<PlanSummary | null> {
  const provider = (await installedFeatures()).find((feature) => feature.plans)?.plans;
  if (!provider) {
    return null;
  }

  return (await provider([orgId])).get(orgId) ?? null;
}

async function counterFor(limitKey: string): Promise<LimitContribution | undefined> {
  for (const feature of await installedFeatures()) {
    const found = feature.limits?.find((limit) => limit.limitKey === limitKey);
    if (found) {
      return found;
    }
  }

  return undefined;
}

/**
 * Where the person who is refused can change the plan: the link of the plan when
 * their role may take it, none otherwise (the page then tells them to ask), as the
 * shell does for its own upgrade link.
 */
async function upgradeHrefFor(orgId: string, plan: PlanSummary): Promise<string | null> {
  if (!plan.upgradeHref || !plan.upgradeMinRole) {
    return plan.upgradeHref;
  }

  try {
    const session = await getServerSession();
    if (!session) {
      return null;
    }
    const [member] = await db
      .select({ role: organizationMember.role })
      .from(organizationMember)
      .where(and(eq(organizationMember.organizationId, orgId), eq(organizationMember.userId, session.user.id)))
      .limit(1);

    return member && ROLE_HIERARCHY[member.role] >= ROLE_HIERARCHY[plan.upgradeMinRole] ? plan.upgradeHref : null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

function refusal(plan: PlanSummary, href: string | null, key: string, limit: number, used: number) {
  return new PlanLimitError({
    key,
    limit,
    used,
    planId: plan.id,
    planName: plan.name,
    includedIn: includedIn(plan, key, limit),
    upgradeHref: href,
  });
}

/**
 * Whether a workspace may hold `adding` more of what `limitKey` counts: it
 * throws a `PlanLimitError` when the plan does not allow it. No plan, no limit
 * under that key, or -1 (unlimited) allows it. `reader` is the transaction that
 * holds the workspace, when there is one.
 */
async function check(orgId: string, limitKey: string, adding: number, reader: Pick<typeof db, "select">, plan: PlanSummary | null, href: string | null) {
  const limit = plan?.limits[limitKey];
  const counter = await counterFor(limitKey);
  if (!plan || limit === undefined || limit < 0 || !counter) {
    return;
  }

  const used = await counter.used(orgId, reader);
  if (used + adding > limit) {
    throw refusal(plan, href, limitKey, limit, used);
  }
}

/**
 * Checks the limit, then runs `work` in the same transaction that holds the
 * workspace (its row is locked until `work` returns): two creations at once are
 * counted one after the other, so that the last one that fits is the last one
 * that is allowed. `work` writes with the transaction it is given. `adding` is
 * in the unit of the limit (one project, the megabytes of a file).
 */
export async function withPlanLimit<T>(
  orgId: string,
  limitKey: string,
  adding: number,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const plan = await getPlanSummary(orgId);
  // Read before the transaction: a single connection (the local database) is held by it
  const href = plan ? await upgradeHrefFor(orgId, plan) : null;

  return db.transaction(async (tx) => {
    await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, orgId)).for("update");
    await check(orgId, limitKey, adding, tx, plan, href);

    return work(tx);
  });
}

/**
 * The same check without the lock, for what is created by a call that cannot
 * join a transaction (an invitation is written by Better Auth, which has its own
 * connection). The limit is checked when the invitation is sent and again when it
 * is accepted, so that the members of a workspace never go past it.
 */
export async function assertWithinPlan(
  orgId: string,
  limitKey: string,
  adding = 1,
  /** Counts something other than the feature's own figure: the members of a workspace that someone joins, whose invitation already holds a seat. */
  count?: () => Promise<number>,
): Promise<void> {
  const plan = await getPlanSummary(orgId);
  const href = plan ? await upgradeHrefFor(orgId, plan) : null;
  const limit = plan?.limits[limitKey];
  if (!count || !plan || limit === undefined || limit < 0) {
    await check(orgId, limitKey, adding, db, plan, href);
    return;
  }

  const used = await count();
  if (used + adding > limit) {
    throw refusal(plan, href, limitKey, limit, used);
  }
}

/**
 * Whether a person may own one more workspace on the free plan: the free
 * credits are granted to each workspace, so one person cannot make a free
 * workspace as often as they like. `MAX_FREE_WORKSPACES` (1 by default) says how
 * many; a workspace that pays is not counted. The page that is refused leads to
 * the plans: the way to a second workspace is to make the first one paid.
 */
export async function assertFreeWorkspaceRoom(userId: string): Promise<void> {
  const free = await ownedFreeWorkspaces(userId);
  if (free.length >= maxFreeWorkspaces()) {
    throw freeWorkspacesRefusal(free[0]?.plan, free.length);
  }
}

type OwnedFree = { id: string; plan: PlanSummary }[];

/** The workspaces a person owns that are on the free plan, the oldest first (the same order for everyone who asks). */
async function ownedFreeWorkspaces(userId: string): Promise<OwnedFree> {
  const provider = (await installedFeatures()).find((feature) => feature.plans)?.plans;
  if (!provider) {
    return [];
  }

  const owned = await db
    .select({ id: organizationMember.organizationId })
    .from(organizationMember)
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .where(and(eq(organizationMember.userId, userId), eq(organizationMember.role, "owner")))
    .orderBy(asc(organization.createdAt), asc(organization.id));
  const plans = await provider(owned.map(({ id }) => id));

  return owned.flatMap(({ id }) => {
    const plan = plans.get(id);
    return plan?.free === true ? [{ id, plan }] : [];
  });
}

// Read with its default: where the environment is not validated (a build, a test run), the schema's default is not applied
function maxFreeWorkspaces(): number {
  const max = Number(env.MAX_FREE_WORKSPACES ?? 1);

  return Number.isInteger(max) && max >= 0 ? max : 1;
}

function freeWorkspacesRefusal(plan: PlanSummary | undefined, used: number) {
  return new PlanLimitError({
    key: "workspaces",
    limit: maxFreeWorkspaces(),
    used,
    planId: plan?.id ?? "",
    planName: plan?.name ?? "",
    // The way to a second workspace is a paid plan on the first: the lowest one above the free plan is named
    includedIn: plan?.higher?.[0]?.name ?? null,
    upgradeHref: "/settings/billing",
  });
}

/**
 * Settles the cap of free workspaces once a workspace is written. Better Auth
 * writes it on its own connection, so a count made before cannot see a creation
 * that is happening at the same time. After the write, under a lock of the
 * person's row, the free workspaces they own are counted: when there are more
 * than the cap, the one that was just made goes (it has nothing in it), and the
 * person is told why. Settlements of one person take the lock one after the
 * other, so each counts what the one before left: exactly the cap is left, and
 * no creation is judged by its date. The plans are read before the lock (a
 * single connection, the local database, is held by it): a workspace that
 * pays is not counted, one that is not known yet is new, so free.
 */
export async function settleFreeWorkspaces(userId: string, createdOrgId: string): Promise<void> {
  const provider = (await installedFeatures()).find((feature) => feature.plans)?.plans;
  if (!provider) {
    return;
  }

  const known = await ownedWorkspaceIds(db, userId);
  const plans = await provider(known);
  const paid = new Set(known.filter((id) => plans.get(id)?.free !== true));
  const plan = known.map((id) => plans.get(id)).find((candidate) => candidate?.free === true);

  const over = await db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    const free = (await ownedWorkspaceIds(tx, userId)).filter((id) => !paid.has(id));
    if (free.length <= maxFreeWorkspaces() || !free.includes(createdOrgId)) {
      return false;
    }

    await tx.delete(organization).where(eq(organization.id, createdOrgId));
    return true;
  });

  if (over) {
    throw freeWorkspacesRefusal(plan, maxFreeWorkspaces());
  }
}

/** The workspaces a person owns, from this connection (the transaction that holds the lock, or the pool). */
async function ownedWorkspaceIds(connection: Pick<typeof db, "select">, userId: string): Promise<string[]> {
  const owned = await connection
    .select({ id: organizationMember.organizationId })
    .from(organizationMember)
    .where(and(eq(organizationMember.userId, userId), eq(organizationMember.role, "owner")));

  return owned.map(({ id }) => id);
}

/** Where a workspace stands against one limit of its plan, without refusing anything: what a page needs to lock a button before it is pressed. */
interface LimitStatus {
  /** The plan allows no more of it. */
  reached: boolean;
  /** -1 when unlimited, or when there is no plan to say. */
  limit: number;
  used: number;
  planName: string | null;
  /** The lowest plan that allows more of it: what the lock says the feature is included in. Null when none does. */
  includedIn: string | null;
  /** Where the plan is changed, when there is a plan above. */
  upgradeHref: string | null;
}

/** The lowest plan above `plan` that allows more of a limit than `limit` (or any, when unlimited). */
function includedIn(plan: PlanSummary, limitKey: string, limit: number): string | null {
  const better = plan.higher?.find((above) => {
    const allowed = above.limits[limitKey];
    return allowed !== undefined && (allowed < 0 || allowed > limit);
  });

  return better?.name ?? null;
}

export async function getLimitStatus(orgId: string, limitKey: string, adding = 1): Promise<LimitStatus> {
  const plan = await getPlanSummary(orgId);
  const limit = plan?.limits[limitKey];
  const counter = await counterFor(limitKey);
  if (!plan || limit === undefined || limit < 0 || !counter) {
    return { reached: false, limit: -1, used: 0, planName: plan?.name ?? null, includedIn: null, upgradeHref: plan ? await upgradeHrefFor(orgId, plan) : null };
  }

  const used = await counter.used(orgId, db);

  return {
    reached: used + adding > limit,
    limit,
    used,
    planName: plan.name,
    includedIn: includedIn(plan, limitKey, limit),
    upgradeHref: await upgradeHrefFor(orgId, plan),
  };
}
