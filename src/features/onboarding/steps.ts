// The steps, in order: `id` is where the wizard can start, `key` the messages of the step
// (`onboarding.<key>.title` and `.description`). The second is the workspace: the word
// of the whole app, which Better Auth calls an organization.
export const ONBOARDING_STEPS = [
  { id: "profile", key: "profile" },
  { id: "workspace", key: "workspace" },
  { id: "invite", key: "invite" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;
