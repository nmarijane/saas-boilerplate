"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Reports an error that a boundary caught to the error reporter of the browser,
 * once for each error the boundary is handed: the same error, drawn again, is
 * not reported twice. It goes in an effect, which never runs on the server: what
 * a Server Component throws is reported there already, and this carries its
 * digest from the browser. What the error said is for the reporter, not the page.
 */
export function useReportError(error: unknown): void {
  useEffect(() => {
    captureException(error);
  }, [error]);
}
