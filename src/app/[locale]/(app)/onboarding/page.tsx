import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { appPageMetadata } from "@/features/app-shell";
import { requireAuth } from "@/features/auth/guards";
import { getWorkspaceContext } from "@/features/auth/organization/workspace";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { redirect } from "@/shared/lib/i18n-navigation";

interface Props {
  params: Promise<{ locale: string }>;
}

// Someone who is onboarding has no workspace yet, so the title names the page
// and no workspace after it.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "onboarding" });

  return appPageMetadata(t("title"));
}

// The dashboard sends someone who has no workspace here (`requireWorkspace`, and the
// layout of the shell), so this page must not send them back: it sends to the
// dashboard only someone who has finished onboarding and has a workspace to land in.
// Someone who finished without one (the seeded admin, an owner who deleted their only
// workspace, a member who was removed) is onboarded again, from the workspace step:
// the name they gave is not asked for twice. Anyone else starts at the first step.
export default async function OnboardingPage({ params }: Props) {
  const [session, { workspace }] = await Promise.all([requireAuth(), getWorkspaceContext()]);
  const completed = session.user.onboardingCompleted === true;

  if (completed && workspace) {
    const { locale } = await params;
    redirect({ href: "/dashboard", locale });
  }

  return <OnboardingWizard startAt={completed ? "workspace" : "profile"} />;
}
