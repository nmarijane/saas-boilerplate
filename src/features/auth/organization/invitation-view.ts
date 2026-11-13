// What the page of an invitation shows, as a plain function of what it read:
// the invitation and who is signed in. It holds no React, so that each state
// is tested with values.

interface InvitationRecord {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  workspaceName: string;
  inviterName: string;
}

type InvitationView =
  /** Expired, cancelled, answered already, or no invitation of that id: the link leads nowhere. */
  | { kind: "dead" }
  /** Nobody is signed in: the page explains, and offers to sign in or to sign up. */
  | { kind: "signedOut" }
  /** Someone is signed in with another address than the one invited: the page names both, and offers to switch accounts. */
  | { kind: "otherAccount"; invitedEmail: string; currentEmail: string }
  /** The invited person: the page names the workspace and who sent the invitation, with Accept and Decline. */
  | { kind: "invited"; invitationId: string; workspaceName: string; inviterName: string; role: "admin" | "member" };

/**
 * The state of the page. A dead link is dead for anyone, signed in or not. The
 * address is compared as Better Auth compares it, without case. Only the
 * person signed in with the invited address is told the workspace and the
 * inviter: the link of an e-mail can be forwarded.
 */
export function invitationView(
  invitation: InvitationRecord | null,
  viewer: { email: string } | null,
  now: Date,
): InvitationView {
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt.getTime() <= now.getTime()) {
    return { kind: "dead" };
  }

  if (!viewer) {
    return { kind: "signedOut" };
  }

  if (viewer.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return { kind: "otherAccount", invitedEmail: invitation.email, currentEmail: viewer.email };
  }

  return {
    kind: "invited",
    invitationId: invitation.id,
    workspaceName: invitation.workspaceName,
    inviterName: invitation.inviterName,
    role: invitation.role === "admin" ? "admin" : "member",
  };
}
