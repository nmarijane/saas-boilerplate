"use client";

import type { ErrorInfo } from "next/error";
import { catchError } from "next/error";
import { ErrorState } from "@/shared/components/data/error-state";
import { useReportError } from "@/shared/hooks/use-report-error";

/**
 * What takes the place of a section of the home that threw: the error state, at
 * level two (the h1 is the header's), with its retry. The error is reported
 * once, for each error the boundary is handed, and never drawn.
 */
export function SectionFallback(_props: object, { error, retry }: ErrorInfo) {
  useReportError(error);

  return <ErrorState headingLevel={2} onRetry={retry} />;
}

// A boundary for one section of the home. The sections are the features', and
// the home is made to hold them side by side: one that throws takes its own
// place on the page, with a retry, and no more. Without it the error would go up
// to the boundary of the route, which replaces the whole page, the quotas, the
// first steps and the other sections with it. `catchError` is the boundary of
// Next for a part of a page: `retry` fetches the page again, and a navigation
// clears the error.
export const SectionBoundary = catchError(SectionFallback);
