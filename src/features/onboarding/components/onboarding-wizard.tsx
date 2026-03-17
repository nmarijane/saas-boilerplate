"use client";

import { useTranslations } from "next-intl";
import { useOnboarding } from "@/features/onboarding/hooks/use-onboarding";
import { ONBOARDING_STEPS } from "@/features/onboarding/steps";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { InviteStep } from "./invite-step";
import { OrganizationStep } from "./organization-step";
import { ProfileStep } from "./profile-step";

export function OnboardingWizard() {
  const t = useTranslations("onboarding");
  const {
    currentStep,
    stepId,
    progress,
    goNext,
    goBack,
    complete,
    isCompleting,
    totalSteps,
  } = useOnboarding();

  const stepLabel = t(ONBOARDING_STEPS[currentStep].key);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>
            {currentStep + 1} / {totalSteps} — {stepLabel}
          </CardDescription>
          <div className="mt-4 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {stepId === "profile" && <ProfileStep onComplete={goNext} />}
          {stepId === "organization" && (
            <OrganizationStep onComplete={goNext} onBack={goBack} />
          )}
          {stepId === "invite" && (
            <InviteStep
              onComplete={complete}
              onBack={goBack}
              isCompleting={isCompleting}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
