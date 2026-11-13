import { notFound, redirect } from "next/navigation";

/**
 * The errors that Next throws to end a render, a page or an action somewhere
 * else: `redirect()` (the session is gone, the role is too low) and `notFound()`.
 * Next catches them higher up and sends the person where they belong, so a
 * `catch` must hand them on and never take one for a failure of its own. They are
 * the real ones, thrown by Next itself, as they are in the app.
 */

/** What `redirect()` throws when a guard finds the session gone. */
export const SESSION_GONE = thrownBy(() => redirect("/sign-in"));

/** What `notFound()` throws. */
export const NOT_FOUND = thrownBy(() => notFound());

/** Both, to run a case over: `describe.each(FRAMEWORK_ERRORS)("%s ...", (_, error) => ...)`. */
export const FRAMEWORK_ERRORS = [
  ["a redirect (the session is gone)", SESSION_GONE],
  ["a not found", NOT_FOUND],
] as const;

/** The error a call throws. */
function thrownBy(call: () => never): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }

  throw new Error("the call did not throw");
}

/** What a promise came to: the error it rejected with, or "resolved". Never rejects, so that a test says which error. */
export async function outcomeOf(call: Promise<unknown>): Promise<unknown> {
  return call.then(
    () => "resolved",
    (error: unknown) => error,
  );
}
