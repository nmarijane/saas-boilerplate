import type {PlanConfig} from "./plans";
import { eq } from "drizzle-orm";
import { ensureMonthlyAllocation } from "@/features/ai/service";
import { subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { effectivePlan, getFreePlan, isPaidPlan  } from "./plans";
import "server-only";

/** Where the subscription of a workspace stands, as the billing page tells it. */
export interface BillingOverview {
  plan: PlanConfig;
  /** The status the provider gave it ("active", "trialing", "past_due"...); "active" for a workspace that never paid. */
  status: string;
  /** A paid plan with a subscription at the provider: what "Change plan", the invoices and the portal are for. */
  subscribed: boolean;
  interval: "monthly" | "yearly" | null;
  /** When the period that is paid for ends: the renewal, or the end of the plan when it is cancelled. */
  periodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
}

export async function getBillingOverview(orgId: string): Promise<BillingOverview> {
  const row = await db.query.subscription.findFirst({ where: eq(subscription.organizationId, orgId) });
  const plan = row ? effectivePlan(row.planId, row.status) : getFreePlan();
  const subscribed = isPaidPlan(plan) && Boolean(row?.stripeSubscriptionId);

  return {
    plan,
    status: row?.status ?? "active",
    subscribed,
    interval: subscribed ? (row?.billingInterval === "year" ? "yearly" : "monthly") : null,
    periodEnd: subscribed ? (row?.currentPeriodEnd ?? null) : null,
    trialEnd: subscribed && row?.status === "trialing" ? (row.trialEnd ?? null) : null,
    cancelAtPeriodEnd: subscribed && (row?.cancelAtPeriodEnd ?? false),
    stripeCustomerId: row?.stripeCustomerId ?? null,
  };
}

/** What the credits of the workspace stand at (the monthly grant is made here, at the first use of the month). */
export async function getCredits(orgId: string) {
  return ensureMonthlyAllocation(orgId);
}
