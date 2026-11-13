import type { AssignableRole } from "./permissions";
import type { ActionResult } from "@/shared/lib/safe-action";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { reportHandledError } from "@/shared/utils/report-error";

// What the invitation dialog does with the answer of the server, as a plain
// function: the server and the page are given, so that a test calls it with a
// server that refuses or does not answer (the interface cannot, in Node: it has
// no DOM to click in). The dialog is the thin part that gives it its hands, as
// `create-workspace.ts` does for the workspaces.

const emailSchema = z.email();

/** How an invitation ended: it is on its way, the address is not one (nothing was sent), or the server did not take it. */
export type InviteOutcome = "invited" | "invalid" | "failed";

interface InviteMemberDeps {
  /** `inviteMember`: sends the invitation, and refuses when the caller may not invite or the input is wrong. */
  invite: (input: {
    orgId: string;
    email: string;
    role: AssignableRole;
    locale: string;
  }) => Promise<ActionResult<unknown>>;
  /** Says the invitation is on its way (a toast): once it is, and not before. */
  notify: (email: string) => void;
}

/**
 * Checks the address, sends the invitation, and says so. An address that is not
 * one is `invalid` and never reaches the server. A refusal of the server and a
 * call that fails outright (the network) are both `failed`: the dialog keeps what
 * was typed and says so. The call that fails is handled, not hidden: the error
 * reporter of the app still hears it. Nothing is said before the server has
 * taken the invitation. The language of the page goes with it: the e-mail's link
 * opens the invitation in it.
 */
export async function inviteMemberFlow(
  deps: InviteMemberDeps,
  input: { orgId: string; email: string; role: AssignableRole; locale: string },
): Promise<InviteOutcome> {
  const email = input.email.trim();
  if (!emailSchema.safeParse(email).success) {
    return "invalid";
  }

  try {
    const answer = await deps.invite({ orgId: input.orgId, email, role: input.role, locale: input.locale });
    if (!answer.success) {
      return "failed";
    }
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
    return "failed";
  }

  deps.notify(email);
  return "invited";
}
