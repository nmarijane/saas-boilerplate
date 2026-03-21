export const CREDIT_PLANS: Record<string, number> = {
  free: 100,
  pro: 5000,
  enterprise: -1, // unlimited
};

export function getCreditAllocation(planId: string): number {
  return CREDIT_PLANS[planId] ?? CREDIT_PLANS.free;
}

export function isUnlimitedCredits(planId: string): boolean {
  return getCreditAllocation(planId) === -1;
}