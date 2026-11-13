import { unstable_rethrow } from "next/navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { earliestEnd, startOfDay } from "./expiry";

// What the dialog that creates a key does with the answer of the server, as a
// plain function: the server and the page are given, so that a test calls it
// with a server that refuses or does not answer (the interface cannot, in Node:
// it has no DOM to click in). The dialog is the thin part that gives it its
// hands, as `project-flows.ts` does for the projects.

/**
 * `createApiKeyAction`: makes the key for an admin of the workspace, and answers
 * with it: the one time it is told. A request it refuses (an end that is not
 * after today, by the clock of the server) is answered with the reason, in the
 * words of the dialog and the language of the request.
 */
export type CreateKey = (
  orgId: string,
  input: { name: string; scopes: string[]; expiresAt?: Date },
) => Promise<{ key: string } | { error: string }>;

interface CreateKeyDeps {
  create: CreateKey;
  /** Reads the page again: the list behind the dialog tells the key that now exists. */
  refresh: () => void;
  /** The clock: the earliest end of a key is told from it, when the key is asked for. */
  now: () => Date;
}

interface NewKey {
  orgId: string;
  name: string;
  scopes: string[];
  /** What a date field holds: `2026-12-31`, or nothing when the key has no end. */
  expires: string;
}

/**
 * How a creation ended: the key exists (to show once), its end is not after
 * today by the clock of the page (nothing was sent), the server refused it with
 * its reason (its clock is not the page's, near midnight UTC), or the server did
 * not make it. A `past` end carries the first day that is taken when the key was
 * sent, which is not always the one the dialog offered when it opened: it may
 * have stayed open across midnight (UTC).
 */
export type CreateKeyOutcome =
  | { outcome: "created"; key: string }
  | { outcome: "past"; earliest: string }
  | { outcome: "refused"; error: string }
  | { outcome: "failed" };

/**
 * The first day the dialog offers, once a send has been answered: the day an end
 * that was refused as past was checked against, which the message names and the
 * field offers as its minimum; unchanged for any other answer.
 */
export function earliestAfter(current: string, outcome: CreateKeyOutcome): string {
  return outcome.outcome === "past" ? outcome.earliest : current;
}

/**
 * Checks the end of the key, makes it, reads the page again, and hands the key
 * to the dialog, which shows it. An end that is today or before, by the clock at
 * the moment of the send, is `past` (with the first day that is taken, which the
 * dialog names) and never reaches the server. A server that answers with a reason has `refused`:
 * the dialog shows the reason under the end and keeps what was typed, and
 * nothing is reported, as the person has only to pick another day. A call that
 * fails outright (the network, a server that does not answer) is `failed`: the
 * dialog keeps what was typed and says so, and the call is handled, not hidden:
 * the error reporter of the app still hears it. The key is in no message and in
 * no log: it goes from the answer to the dialog and nowhere else, and nothing
 * that happens after the server has made it takes it from there: a page that
 * cannot be read again is told to the reporter, and the key is still shown.
 */
export async function createKeyFlow(
  deps: CreateKeyDeps,
  input: NewKey,
): Promise<CreateKeyOutcome> {
  const earliest = earliestEnd(deps.now());
  if (input.expires !== "" && input.expires < earliest) {
    return { outcome: "past", earliest };
  }

  let answer: Awaited<ReturnType<CreateKey>>;
  try {
    answer = await deps.create(input.orgId, {
      name: input.name.trim(),
      scopes: input.scopes,
      expiresAt: input.expires ? startOfDay(input.expires) : undefined,
    });
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
    return { outcome: "failed" };
  }

  if ("error" in answer) {
    return { outcome: "refused", error: answer.error };
  }

  try {
    deps.refresh();
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
  }

  return { outcome: "created", key: answer.key };
}
