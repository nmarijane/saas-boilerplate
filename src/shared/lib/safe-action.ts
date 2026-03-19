import { getLogger } from "@logtape/logtape";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";

const logger = getLogger(["safe-action"]);

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; validationErrors?: Record<string, string[]> };

export async function safeAction<T>(
  fn: () => Promise<T>,
  errorMessage = "An unexpected error occurred",
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    // Next.js redirect() throws a special error that must be re-thrown
    if (isRedirectError(error)) {
      throw error;
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

    logger.error`Server action failed: ${error}`;
    return { success: false, error: errorMessage };
  }
}
