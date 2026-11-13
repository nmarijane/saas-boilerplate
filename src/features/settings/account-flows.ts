import { unstable_rethrow } from "next/navigation";
import { reportHandledError } from "@/shared/utils/report-error";

// What the cards of the account page ask of the auth client, as plain functions
// that are given the client: a test calls them with a client that refuses or does
// not answer, and says which call was made (the interface cannot, in Node: it has
// no DOM to click in), as `project-flows.ts` does for the projects. Each card is
// the thin part that gives them the client of the app, or, in a story, one that
// answers what it is told to.
//
// The clients below are the part of the auth client that a card uses, written out
// as what a card reads of each answer. The app's own client is given where a card
// takes one by default, so the compiler checks that it fits.

/** What a call of the auth client answers, as far as these functions read it: an `error` when the server refuses. */
interface Answer {
  error: unknown;
}

/** The sessions of the person, as the auth client lists them: the token is what a session is revoked by. */
export interface SessionRecord {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
}

/** An account the person has linked: its id (what it is unlinked by) and the provider it comes from. */
export interface AccountRecord {
  id: string;
  providerId: string;
}

/** The providers a person can link, which the card lists. */
export type ProviderId = "google" | "github";

export interface SessionsClient {
  listSessions: () => Promise<{ data: SessionRecord[] | null; error: unknown }>;
  getSession: () => Promise<{
    data: { session: { token: string } } | null;
    error: unknown;
  }>;
  revokeSession: (input: { token: string }) => Promise<Answer>;
  /**
   * Ends every session but the one in use. The client has `revokeSessions` too,
   * which ends them all: it is not listed here, so that no card can call it.
   */
  revokeOtherSessions: () => Promise<Answer>;
}

export interface AccountsClient {
  listAccounts: () => Promise<{ data: AccountRecord[] | null; error: unknown }>;
  linkSocial: (input: {
    provider: ProviderId;
    callbackURL: string;
  }) => Promise<Answer>;
  unlinkAccount: (input: { accountId: string }) => Promise<Answer>;
}

export interface PasswordClient {
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions: boolean;
  }) => Promise<Answer>;
}

/**
 * Makes one call and says whether the server took it. A refusal (an `error` in
 * the answer) and a call that fails outright (the network) are both "no", and
 * the caller says so. A refusal is the person's to deal with (a wrong password),
 * not an error of the app. The call that fails is handled, not hidden: the error
 * reporter of the app still hears it. It never rejects.
 */
async function attempt(call: () => Promise<Answer>): Promise<boolean> {
  try {
    return !(await call()).error;
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);
    return false;
  }
}

/** Revokes one session, by its token. */
export function revokeSessionFlow(
  client: Pick<SessionsClient, "revokeSession">,
  token: string,
): Promise<boolean> {
  return attempt(() => client.revokeSession({ token }));
}

/** Revokes every session but the one in use: `revokeOtherSessions`, never `revokeSessions`, which ends the one in use as well. */
export function revokeOtherSessionsFlow(
  client: Pick<SessionsClient, "revokeOtherSessions">,
): Promise<boolean> {
  return attempt(() => client.revokeOtherSessions());
}

/**
 * Starts linking a provider. The person is brought back to the account page, the
 * one that holds the card (`/settings/profile` only redirects to it now). When the
 * server takes it the browser is on its way to the provider: it answers `true`
 * as the redirect starts, and the page is about to be left.
 */
export function linkProviderFlow(
  client: Pick<AccountsClient, "linkSocial">,
  provider: ProviderId,
): Promise<boolean> {
  return attempt(() =>
    client.linkSocial({ provider, callbackURL: "/settings/account" }),
  );
}

/** Unlinks an account, by the id of the account (Better Auth 1.7 finds nothing by the name of the provider). */
export function unlinkAccountFlow(
  client: Pick<AccountsClient, "unlinkAccount">,
  accountId: string,
): Promise<boolean> {
  return attempt(() => client.unlinkAccount({ accountId }));
}

/**
 * Changes the password: the current one and the new one. The other sessions of
 * the person end with the old password (`revokeOtherSessions`): a password is
 * often changed because someone else may have it, and a session they opened with
 * it would otherwise stay open, and be renewed each time it is used. The session
 * in use goes on, under a new token.
 */
export function changePasswordFlow(
  client: PasswordClient,
  passwords: { currentPassword: string; newPassword: string },
): Promise<boolean> {
  return attempt(() =>
    client.changePassword({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
      revokeOtherSessions: true,
    }),
  );
}
