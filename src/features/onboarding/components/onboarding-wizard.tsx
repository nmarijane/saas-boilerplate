"use client";

import type { OnboardingStepId } from "@/features/onboarding/steps";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { useOnboarding } from "@/features/onboarding/hooks/use-onboarding";
import { ONBOARDING_STEPS } from "@/features/onboarding/steps";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { InviteStep } from "./invite-step";
import { ProfileStep } from "./profile-step";
import { WorkspaceStep } from "./workspace-step";

interface OnboardingWizardProps {
  /** The step the wizard opens at: the first, unless the person has done the ones before it. */
  startAt?: OnboardingStepId;
}

// The card of the sign-in pages, with the step as its one h1 and the sentence of the
// step under it, then where the person is (in words, and in a progress bar that has a
// name), then the step. The h1 changes with the step: a page that is the same
// document for three steps must say, to someone who cannot see the card change, which
// one they are at, so the focus goes to it when the step does (the button they pressed
// is gone with the step).
export function OnboardingWizard({ startAt = "profile" }: OnboardingWizardProps) {
  const t = useTranslations("onboarding");
  const {
    currentStep,
    stepId,
    canGoBack,
    position,
    goNext,
    goBack,
    complete,
    isCompleting,
    totalSteps,
  } = useOnboarding(startAt);
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(currentStep);

  useEffect(() => {
    if (shown.current !== currentStep) {
      shown.current = currentStep;
      heading.current?.focus();
    }
  }, [currentStep]);

  const { key } = ONBOARDING_STEPS[currentStep];
  const where = t("progress", { current: position, total: totalSteps });

  return (
    <AuthCard title={t(`${key}.title`)} description={t(`${key}.description`)} headingRef={heading}>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <p className="text-center text-meta text-ink-muted">{where}</p>
          <ProgressBar
            value={position}
            max={totalSteps}
            label={t("progressLabel")}
            valueText={where}
            tone="signature"
          />
        </div>
        {stepId === "profile" && <ProfileStep onComplete={goNext} />}
        {stepId === "workspace" && (
          <WorkspaceStep onComplete={goNext} onBack={canGoBack ? goBack : undefined} />
        )}
        {stepId === "invite" && (
          <InviteStep
            onComplete={complete}
            onBack={canGoBack ? goBack : undefined}
            isCompleting={isCompleting}
          />
        )}
      </div>
    </AuthCard>
  );
}
