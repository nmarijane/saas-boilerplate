import type { PlanSummary } from "@/shared/shell/contract";
import { BILLING_MIN_ROLE } from "./permissions";
import { effectivePlan, isPaidPlan, PLANS } from "./plans";

const UPGRADE_HREF = "/settings/billing";

/**
 * The plan a workspace is on, as the shell shows it, from its subscription. A
 * subscription gives its plan while it is live (`isLiveStatus`); a workspace
 * that never subscribed, or whose subscription is over, is on the free plan, as
 * is one whose plan the configuration no longer knows. The limits are those of
 * `PLANS`, where -1 is unlimited, and the plan last in `PLANS` has nothing above
 * it to upgrade to. The upgrade is offered to the roles that may take it, as the
 * billing page is. The shell, the limits, the credits and the billing page all
 * read the plan here, so that they cannot disagree.
 */
export function planOfSubscription(planId: string, status: string): PlanSummary {
  const plan = effectivePlan(planId, status);
  const highest = PLANS.at(-1);

  return {
    id: plan.id,
    name: plan.name,
    limits: { ...plan.limits },
    free: !isPaidPlan(plan),
    higher: PLANS.slice(PLANS.findIndex((p) => p.id === plan.id) + 1).map((p) => ({ name: p.name, limits: { ...p.limits } })),
    upgradeHref: plan.id === highest?.id ? null : UPGRADE_HREF,
    upgradeMinRole: BILLING_MIN_ROLE,
  };
}

