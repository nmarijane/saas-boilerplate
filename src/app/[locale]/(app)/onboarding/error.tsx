"use client";

import { RouteError } from "@/shared/components/data/route-error";
import { useReportError } from "@/shared/hooks/use-report-error";

// What catches an error of the onboarding page: it takes the place of the page,
// in the column of the layout, under its logo. It is reported once, for each
// error it is handed.
export default function OnboardingError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useReportError(error);

  return <RouteError error={error} retry={retry} />;
}
