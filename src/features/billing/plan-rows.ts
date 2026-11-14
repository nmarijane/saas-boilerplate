import { plan } from "@/models";
import { db } from "@/shared/lib/DB";
import { getPlanById, planRowOf } from "./plans";
import "server-only";

type Executor = Pick<typeof db, "insert">;

/**
 * Makes sure the `plan` row of a plan exists, from `PLANS`. A subscription
 * points at its plan by a foreign key: a database whose plans were not seeded
 * (or seeded without the free plan) would refuse every subscription, and every
 * cancellation back to free, after the provider had already acted. The seed
 * writes the same rows (`planRowOf`).
 */
export async function ensurePlanRow(planId: string, executor: Executor = db): Promise<void> {
  const config = getPlanById(planId);
  if (!config) {
    return;
  }

  await executor.insert(plan).values(planRowOf(config)).onConflictDoNothing({ target: plan.id });
}
