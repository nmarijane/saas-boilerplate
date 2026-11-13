import type { ActionResult } from "@/shared/lib/safe-action";
import { unstable_rethrow } from "next/navigation";

// What the page of an invitation does with the answer of the server, as a plain
// function: the server and the page are given, so that a test calls it with a
// server that refuses or does not answer (the interface cannot, in Node: it has
// no DOM to click in), as `invite-member.ts` does for the invitation dialog.

/** How an answer ended: the person joined, said no, or the server did not take it. */
type InvitationOutcome = "accepted" | "declined" | "failed";

interface AnswerInvitationDeps {
  /** `acceptInvitation`: joins the workspace, which becomes the active one. */
  accept: (input: { invitationId: string }) => Promise<ActionResult<unknown>>;
  /** `declineInvitation`. */
  decline: (input: { invitationId: string }) => Promise<ActionResult<unknown>>;
  /** Goes to the home of the workspace that was joined, and reads the app again. */
  goHome: () => void;
  /** Tells the person that their answer was not taken (a toast). */
  fail: (choice: "accept" | "decline") => void;
  /** Hears an error that was handled: handled is not hidden. */
  report: (error: unknown) => void;
}

/**
 * Sends the answer of the person. Once they accept, they go to the home, which
 * is the home of the workspace they joined: the session has it as the active
 * one by then. Once they decline, the page says so, and they stay. A refusal of
 * the server, and a call that fails outright, leave the page as it was and are
 * told; the second is reported too.
 */
export async function answerInvitation(
  deps: AnswerInvitationDeps,
  invitationId: string,
  choice: "accept" | "decline",
): Promise<InvitationOutcome> {
  try {
    const answer = await (choice === "accept" ? deps.accept : deps.decline)({ invitationId });
    if (!answer.success) {
      deps.fail(choice);
      return "failed";
    }
  } catch (error) {
    unstable_rethrow(error);
    deps.report(error);
    deps.fail(choice);
    return "failed";
  }

  if (choice === "decline") {
    return "declined";
  }

  deps.goHome();
  return "accepted";
}
