import * as Sentry from "@sentry/nextjs";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import "server-only";

/**
 * Sends what the person is waiting for the answer of, after the answer. The mail
 * of a verification or of a password reset goes out when the request has been
 * answered (`after`), so that the answer takes as long whether a mail was sent or
 * not: an address with an account and one without would otherwise be told apart by
 * the time they take (a mail takes hundreds of milliseconds, a lookup that finds
 * nobody takes none). A mail that fails is logged and sent to the error reporter,
 * and nobody is told: whoever asks again gets the same answer.
 *
 * Outside a request (a script, a test calling Better Auth directly) there is no
 * answer to be late for, and `after` refuses: the mail is then awaited.
 */
export async function sendAfterResponse(send: () => Promise<unknown>): Promise<void> {
  const run = async () => {
    try {
      await send();
    } catch (error) {
      unstable_rethrow(error);
      // Reported as well as logged: the request that asked for the mail was answered long ago, so nothing else
      // would tell that the credentials of the mail server expired, and the person was told to check their mail
      console.error("An e-mail could not be sent", error);
      Sentry.captureException(error);
    }
  };

  try {
    after(run);
  } catch {
    await run();
  }
}
