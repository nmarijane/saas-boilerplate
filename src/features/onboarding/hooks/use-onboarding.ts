"use client";

import type { OnboardingStepId } from "@/features/onboarding/steps";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { ONBOARDING_STEPS, TOTAL_STEPS } from "@/features/onboarding/steps";
import { toast } from "@/shared/components/ui/sonner";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";

/**
 * The state of the wizard: the step it is at, and how to move. It starts at
 * `startAt`: someone who has done onboarding and has no workspace to land in (an
 * owner who deleted their only workspace, the seeded admin) is asked for one, not
 * for the name they gave long ago, and has nothing to go back to before it.
 */
export function useOnboarding(startAt: OnboardingStepId = "profile") {
  const t = useTranslations("common");
  const first = ONBOARDING_STEPS.findIndex(({ id }) => id === startAt);
  const [currentStep, setCurrentStep] = useState(first);
  const [isCompleting, setIsCompleting] = useState(false);
  const router = useRouter();

  const stepId: OnboardingStepId = ONBOARDING_STEPS[currentStep].id;
  const canGoBack = currentStep > first;

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > first) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep, first]);

  // Better Auth answers `{ data, error }` and does not throw on a refusal: the
  // refusal is raised, so that the person is not sent on as if it had worked
  const complete = useCallback(async () => {
    setIsCompleting(true);
    try {
      const { error } = await authClient.updateUser({
        onboardingCompleted: true,
      } as Record<string, unknown>);
      if (error) {
        throw new Error(error.message ?? error.statusText);
      }
      router.push("/dashboard");
    } catch (error) {
      toast.error(t("error"));
      reportHandledError(error);
      setIsCompleting(false);
    }
  }, [router, t]);

  return {
    currentStep,
    stepId,
    canGoBack,
    /** The step the person is at, counted from 1. */
    position: currentStep + 1,
    goNext,
    goBack,
    complete,
    isCompleting,
    totalSteps: TOTAL_STEPS,
  };
}
