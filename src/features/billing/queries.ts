import type { PlanSummary } from "@/shared/shell/contract";
import { inArray } from "drizzle-orm";
import { subscription } from "@/models";
import { db } from "@/shared/lib/DB";
import { planOfSubscription } from "./plans";
import "server-only";

/**
 * The plan of each of these workspaces, for the shell, read with one query
 * however many there are. Each workspace asked for is in the answer once, in the
 * order asked: one with no subscription, or whose plan is over or unknown, is on
 * the free plan (`planOfSubscription`). A workspace with several subscription
 * rows takes the first one, as `getSubscriptionForOrg` does.
 */
export async function getWorkspacePlans(orgIds: readonly string[]): Promise<Map<string, PlanSummary>> {
  const ids = [...new Set(orgIds)];
  const plans = new Map<string, PlanSummary>();
  if (ids.length === 0) {
    return plans;
  }

  const rows = await db
    .select({ organizationId: subscription.organizationId, planId: subscription.planId, status: subscription.status })
    .from(subscription)
    .where(inArray(subscription.organizationId, ids));
  const first = new Map<string, { planId: string; status: string }>();
  for (const row of rows) {
    if (!first.has(row.organizationId)) {
      first.set(row.organizationId, row);
    }
  }

  for (const id of ids) {
    const row = first.get(id);
    plans.set(id, planOfSubscription(row?.planId ?? "free", row?.status ?? "active"));
  }

  return plans;
}

/** The plan of one workspace: the batch of one. */
export async function getWorkspacePlan(orgId: string): Promise<PlanSummary> {
  const plans = await getWorkspacePlans([orgId]);

  return plans.get(orgId) ?? planOfSubscription("free", "active");
}
