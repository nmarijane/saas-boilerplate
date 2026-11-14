/** The id of the quota that counts a workspace's credits (the shell's, and the plan's `aiCredits` limit): the assistant looks it up to know where the person may get more. */
export const AI_CREDITS_QUOTA_ID = "ai-credits";

/**
 * What a workspace is granted each month when no plan says (a project that
 * removed billing keeps its assistant metered). With billing, the plan decides:
 * `limits.aiCredits` of the plan in `src/features/billing/plans.ts`, where -1 is
 * unlimited.
 */
export const FALLBACK_MONTHLY_CREDITS = 100;
