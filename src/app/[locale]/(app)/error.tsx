"use client";

import { RouteError } from "@/shared/components/data/route-error";
import { CenteredPage } from "@/shared/components/shell/centered-page";
import { useReportError } from "@/shared/hooks/use-report-error";

// What catches an error of the connected space that the shell cannot hold: the
// ones its own layouts throw (the shell's and onboarding's). No shell is drawn
// around them, so the error stands alone, centered, as the sign-in pages do. It
// is reported once, for each error it is handed.
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useReportError(error);

  return (
    <CenteredPage>
      <RouteError error={error} retry={retry} />
    </CenteredPage>
  );
}
