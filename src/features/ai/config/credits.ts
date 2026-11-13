/** The id of the quota that counts a workspace's credits (the shell's, and the plan's `aiCredits` limit): the assistant looks it up to know where the person may get more. */
export const AI_CREDITS_QUOTA_ID = "ai-credits";

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