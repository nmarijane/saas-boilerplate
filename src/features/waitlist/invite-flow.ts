import type { ActionResult } from "@/shared/lib/safe-action";
import { unstable_rethrow } from "next/navigation";
import { reportHandledError } from "@/shared/utils/report-error";

// What the button that invites someone from the waiting list does with the answer
// of the server, as a plain function: the server and the page are given, so that a
// test calls it with a server that refuses or does not answer (the interface
// cannot, in Node: it has no DOM to click in). The table is the thin part that
// gives it its hands, as `project-flows.ts` does for the projects.

type InviteAnswer = ActionResult<{ success: boolean }>;

export interface InviteDeps {
  /** `inviteFromWaitlist`: invites the entry, for a platform admin. */
  invite: (input: { entryId: string }) => Promise<InviteAnswer>;
  /** The button of this entry waits for the server (an id), or none does (null). */
  pending: (entryId: string | null) => void;
  /** The entry shows as invited at once: the page, read again, takes over. */
  invited: (entryId: string) => void;
  /** Reads the page again: the cards that count the invited and those who wait tell what changed. */
  refresh: () => void;
  /** Says the invitation was not sent (a toast). */
  failed: () => void;
}

/**
 * Invites the entry, shows it invited and reads the page again, and answers
 * whether it was invited. A refusal of the server and a call that fails
 * outright (the network) are both "no": the person is told, and nothing shows
 * as invited. The call that fails is handled, not hidden: the error reporter of
 * the app still hears it. The button stops waiting whatever happens.
 */
export async function inviteFlow(deps: InviteDeps, entryId: string): Promise<boolean> {
  deps.pending(entryId);
  try {
    let answer: InviteAnswer;
    try {
      answer = await deps.invite({ entryId });
    } catch (error) {
      unstable_rethrow(error);
      reportHandledError(error);
      deps.failed();
      return false;
    }
    if (!answer.success) {
      deps.failed();
      return false;
    }

    deps.invited(entryId);
    deps.refresh();
    return true;
  } finally {
    deps.pending(null);
  }
}
