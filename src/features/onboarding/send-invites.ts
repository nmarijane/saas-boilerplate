import type { InviteOutcome } from "@/features/auth/organization/invite-member";
import type { AssignableRole } from "@/features/auth/organization/permissions";
import type { ActionResult } from "@/shared/lib/safe-action";
import { inviteMemberFlow } from "@/features/auth/organization/invite-member";

// What the invite step of onboarding does with the rows it was filled in, as a
// plain function: the server is given, so that a test calls it with a server that
// refuses or does not answer. Each filled row goes through the same flow as the
// Team page's dialog (`inviteMemberFlow`): the address is checked, a refusal of the
// server (`{ success: false }`) and a call that fails outright are both a failure,
// and the errors Next throws to send the person elsewhere are handed on.

interface InviteRow {
  email: string;
  role: AssignableRole;
}

interface SendInvitesDeps {
  /** `inviteMember`: sends the invitation, and answers `{ success: false }` when it refuses. */
  invite: (input: { orgId: string; email: string; role: AssignableRole; locale: string }) => Promise<ActionResult<unknown>>;
}

interface SendInvitesResult {
  /** How many invitations went. */
  sent: number;
  /** The filled rows that did not go, in their order: they stay in the list so that the person can correct them. */
  kept: InviteRow[];
  /** Why some stayed: the server did not take them (the other problem, an address that is none, is reported when only that happened). Null when everything went. */
  problem: "failed" | "invalid" | "limit" | null;
}

/**
 * Sends each filled row, all at the same time. A row with no address at all is an
 * empty row, not a mistake: it is left out. Every other row either went (and is
 * gone from the list) or is kept with the reason: a failure of the server is told
 * before an address that is not one, as the person can do nothing about the first.
 */
export async function sendInvites(
  deps: SendInvitesDeps,
  input: { orgId: string; locale: string; rows: readonly InviteRow[] },
): Promise<SendInvitesResult> {
  const filled = input.rows.filter((row) => row.email.trim() !== "");
  const outcomes: InviteOutcome[] = await Promise.all(
    filled.map((row) =>
      inviteMemberFlow(
        { invite: deps.invite, notify: () => {} },
        { orgId: input.orgId, email: row.email, role: row.role, locale: input.locale },
      ),
    ),
  );

  const kept = filled.filter((_, index) => outcomes[index] !== "invited");
  const problem = outcomes.includes("limit") ? "limit" : outcomes.includes("failed") ? "failed" : outcomes.includes("invalid") ? "invalid" : null;

  return { sent: outcomes.length - kept.length, kept, problem };
}
