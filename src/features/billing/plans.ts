// The plans of the product, and the only place their prices, limits and trials
// are written: the pricing page, the billing page, the checkout, the limits, the
// monthly credits and the seed all read them from here. The module is plain, so
// that a Server Component and a client component both import it; the Stripe
// price ids are secrets of the deployment and live in `price-ids.ts`. It imports
// nothing at run time: the seed and the demo (scripts run from any folder, where
// the `@/` alias does not resolve) read it too.

/** How often a subscription is billed. */
export type BillingInterval = "monthly" | "yearly";

export const BILLING_INTERVALS: readonly BillingInterval[] = ["monthly", "yearly"];

/** The plan that every workspace is on until it pays, and the one it falls back to. */
export const FREE_PLAN_ID = "free";

export interface PlanConfig {
  id: string;
  /** The name of the plan in the product: a proper noun, the same in every language. */
  name: string;
  /** Used when the messages have no `billing.plans.<id>.description`. */
  description: string;
  /** In the major unit of `BILLING_CURRENCY` (29 is 29 dollars): what the Stripe prices of the catalog charge. */
  price: Record<BillingInterval, number>;
  features: Record<string, boolean>;
  /** What a workspace may hold. -1 is unlimited. `aiCredits` is also what the plan grants each month. */
  limits: Record<string, number>;
  /** The plan the pricing page recommends, and the one the free trial starts. */
  highlighted?: boolean;
  /** Days of free trial on a first subscription; none when absent or 0. */
  trialDays?: number;
}

export const PLANS: PlanConfig[] = [
  {
    id: FREE_PLAN_ID,
    name: "Free",
    description: "For individuals getting started",
    price: { monthly: 0, yearly: 0 },
    features: {
      basicAnalytics: true,
      emailSupport: true,
      apiAccess: false,
      prioritySupport: false,
      customBranding: false,
      advancedAnalytics: false,
      aiChat: true,
    },
    limits: {
      members: 1,
      projects: 3,
      storage: 100, // MB
      aiCredits: 100,
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing teams",
    price: { monthly: 29, yearly: 290 },
    features: {
      basicAnalytics: true,
      emailSupport: true,
      apiAccess: true,
      prioritySupport: true,
      customBranding: false,
      advancedAnalytics: true,
      aiChat: true,
    },
    limits: {
      members: 10,
      projects: 50,
      storage: 10_000, // MB
      aiCredits: 5000,
    },
    highlighted: true,
    trialDays: 14,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    price: { monthly: 99, yearly: 990 },
    features: {
      basicAnalytics: true,
      emailSupport: true,
      apiAccess: true,
      prioritySupport: true,
      customBranding: true,
      advancedAnalytics: true,
      aiChat: true,
    },
    limits: {
      members: -1, // unlimited
      projects: -1,
      storage: -1,
      aiCredits: -1,
    },
  },
];

export function getPlanById(planId: string): PlanConfig | undefined {
  return PLANS.find((p) => p.id === planId);
}

/** The free plan, when the product has one: a project may sell paid plans only. */
export function findFreePlan(): PlanConfig | undefined {
  return getPlanById(FREE_PLAN_ID);
}

/** The plan a workspace is on when it has no live subscription: the free plan, or the cheapest one of a product with no free plan. */
export function getFreePlan(): PlanConfig {
  return findFreePlan() ?? PLANS.toSorted((a, b) => a.price.monthly - b.price.monthly)[0]!;
}

/** Whether a plan is sold: it has a price. */
export function isPaidPlan(plan: PlanConfig): boolean {
  return plan.price.monthly > 0 || plan.price.yearly > 0;
}

/** The plans that can be bought, in the order of `PLANS`. */
export function getPaidPlans(): PlanConfig[] {
  return PLANS.filter(isPaidPlan);
}

/** The plan the pricing page recommends: the one marked `highlighted`, or the first paid one. */
export function getRecommendedPlan(): PlanConfig | undefined {
  return PLANS.find((p) => p.highlighted && isPaidPlan(p)) ?? getPaidPlans()[0];
}

/**
 * What the yearly price saves against twelve months at the monthly one, in
 * whole percent (290 against 12 x 29 saves 17). It is read from the plan, never
 * written by hand: the toggle of the pricing page says what the prices say.
 */
export function yearlySavingsPercent(plan: PlanConfig): number {
  const twelveMonths = plan.price.monthly * 12;
  if (twelveMonths <= 0 || plan.price.yearly <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((1 - plan.price.yearly / twelveMonths) * 100));
}

/** The largest saving of the paid plans: what the toggle of the pricing page announces. */
export function bestYearlySavingsPercent(): number {
  return Math.max(0, ...getPaidPlans().map(yearlySavingsPercent));
}

/** A plan and an interval read from an address, a cookie or a form: they are checked here, and null when either is not one. */
export function parsePlanChoice(
  planId: unknown,
  interval: unknown,
): { planId: string; interval: BillingInterval } | null {
  const plan = typeof planId === "string" ? getPlanById(planId) : undefined;
  const chosen = BILLING_INTERVALS.find((candidate) => candidate === interval);
  if (!plan || !isPaidPlan(plan) || !chosen) {
    return null;
  }

  return { planId: plan.id, interval: chosen };
}

/** Whether `candidatePlanId` is above `currentPlanId`: the plans are listed from the lowest to the highest. */
export function isUpgrade(currentPlanId: string, candidatePlanId: string): boolean {
  const index = (id: string) => PLANS.findIndex((p) => p.id === id);
  return index(candidatePlanId) > index(currentPlanId);
}

/**
 * The statuses of a subscription that give its plan. `past_due` keeps the plan
 * while the payment provider retries the payment (the person is told, on the
 * billing page and by e-mail); `unpaid`, `canceled`, `incomplete` and the
 * others fall back to the free plan.
 */
const LIVE_STATUSES: readonly string[] = ["active", "trialing", "past_due"];

export function isLiveStatus(status: string): boolean {
  return LIVE_STATUSES.includes(status);
}

/** The configuration of the plan a subscription gives (see `planOfSubscription`). */
export function effectivePlan(planId: string, status: string): PlanConfig {
  return (isLiveStatus(status) ? getPlanById(planId) : undefined) ?? getFreePlan();
}

/** The row of the `plan` table that stands for a plan of `PLANS`: its price is in cents. The seed and the lazy insert (`ensurePlanRow`) write the same row. */
export function planRowOf(config: PlanConfig) {
  return {
    id: config.id,
    name: config.name,
    stripePriceId: null,
    features: config.features,
    limits: config.limits,
    price: Math.round(config.price.monthly * 100),
  };
}
