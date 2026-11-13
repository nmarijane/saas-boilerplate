import type { createApiKeyAction } from "@/features/api-keys/actions";

type Answer = Awaited<ReturnType<typeof createApiKeyAction>>;

/**
 * The key a creation made. The action answers a request it refuses instead of
 * throwing (`{ error }`), so a test that expects a key asks for it here, and fails
 * with the reason when the creation was refused.
 */
export function madeKey(answer: Answer) {
  if ("error" in answer) {
    throw new Error(`The key was not made: ${answer.error}`);
  }

  return answer;
}
