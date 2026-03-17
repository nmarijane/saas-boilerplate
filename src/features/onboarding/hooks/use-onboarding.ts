"use client";

import type { OnboardingStepId } from "@/features/onboarding/steps";
import { useCallback, useState } from "react";
import { authClient } from "@/features/auth/auth-client";
import { ONBOARDING_STEPS, TOTAL_STEPS } from "@/features/onboarding/steps";
import { useRouter } from "@/shared/lib/i18n-navigation";

export function useOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const router = useRouter();

  const stepId: OnboardingStepId = ONBOARDING_STEPS[currentStep].id;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const complete = useCallback(async () => {
    setIsCompleting(true);
    try {
      await authClient.updateUser({
        onboardingCompleted: true,
      } as Record<string, unknown>);
      router.push("/dashboard");
    } catch {
      setIsCompleting(false);
    }
  }, [router]);

  return {
    currentStep,
    stepId,
    isFirstStep,
    isLastStep,
    progress,
    goNext,
    goBack,
    complete,
    isCompleting,
    totalSteps: TOTAL_STEPS,
  };
}
