import type { LimitInfo } from "./action-refusal";
import { getLogger } from "@logtape/logtape";
import { notFound, unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ActionRefusal, PlanLimitError } from "./action-refusal";

const logger = getLogger(["safe-action"]);

/** What `notFound()` throws: Next's own sample of it, so that its format is not written down here. */
const NOT_FOUND_DIGEST = (() => {
  try {
    notFound();
  } catch (error) {
    const { digest } = error as { digest?: unknown };
    return typeof digest === "string" ? digest : undefined;
  }
})();

/** Whether an error is the one `notFound()` throws, or wraps it: `unstable_rethrow` looks through `cause` as well. */
function isNotFound(error: unknown, depth = 0): boolean {
  if (NOT_FOUND_DIGEST === undefined || typeof error !== "object" || error === null || depth > 8) {
    return false;
  }

  return ("digest" in error && error.digest === NOT_FOUND_DIGEST) || ("cause" in error && isNotFound(error.cause, depth + 1));
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; validationErrors?: Record<string, string[]>; limit?: LimitInfo };

export async function safeAction<T>(
  fn: () => Promise<T>,
  errorMessage = "An unexpected error occurred",
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    // `redirect()` throws an error that Next itself catches, higher up, to send
    // the person elsewhere (as do the errors of dynamic rendering): it is not a
    // failure of the action, and is handed on. `notFound()` is not: an action is
    // called from a click, and Next gives its rejection to the caller, which no
    // boundary reads (the page of a not found is drawn only for a rejection that
    // a render throws, a form or a transition, and a click that hands it on shows
    // nothing at all), so it is a refusal, like any other.
    if (!isNotFound(error)) {
      unstable_rethrow(error);
    }

    if (error instanceof ZodError) {
      const validationErrors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const path = issue.path.join(".");
        validationErrors[path] ??= [];
        validationErrors[path].push(issue.message);
      }
      return { success: false, error: "Validation failed", validationErrors };
    }

    // A refusal the action means to give is an answer, not a failure: it is told, not logged
    if (error instanceof PlanLimitError) {
      return { success: false, error: error.code, limit: error.limit };
    }
    if (error instanceof ActionRefusal) {
      return { success: false, error: error.code };
    }

    logger.error`Server action failed: ${error}`;
    return { success: false, error: errorMessage };
  }
}
