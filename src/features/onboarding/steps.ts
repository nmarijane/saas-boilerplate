export const ONBOARDING_STEPS = [
  { id: "profile", key: "step1" },
  { id: "organization", key: "step2" },
  { id: "invite", key: "step3" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;
