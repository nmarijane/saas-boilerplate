"use client";

import { RouteError } from "@/shared/components/data/route-error";
import { useReportError } from "@/shared/hooks/use-report-error";

// What catches an error of a page under the shell: it takes the place of the
// page, in the content of the shell, which stays drawn around it, so that the
// navigation is still there. It is reported once, for each error it is handed.
export default function ShellError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useReportError(error);

  return <RouteError error={error} retry={retry} />;
}
