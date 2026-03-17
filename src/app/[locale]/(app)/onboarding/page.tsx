import { redirect } from "next/navigation";
import { requireAuth } from "@/features/auth/guards";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await requireAuth();

  if (!session) {
    redirect("/sign-in");
  }

  if ((session.user as Record<string, unknown>).onboardingCompleted) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
