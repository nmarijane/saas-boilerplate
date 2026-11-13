import { and, eq, isNotNull } from "drizzle-orm";
import { auth } from "@/features/auth/auth";
import { account } from "@/models/user";
import { db } from "@/shared/lib/DB";
import "server-only";

/** How long after signing in a session may still do what asks for a recent proof of who is there. */
const FRESH_SESSION_SECONDS = 5 * 60;

type Reauthentication =
  | "ok"
  /** The account has a password and none was given. */
  | "password-required"
  | "wrong-password"
  /** The account has no password (it signs in through a provider) and its session is not recent: signing in again is the proof. */
  | "recent-sign-in-required";

/**
 * Whether the person at the keyboard is the one the account belongs to, for an act that
 * cannot be undone: a session is a cookie, and a cookie can be someone else's. An account
 * with a password proves it with the password, asked again. One without a password (it
 * signs in through a provider) proves it with a session that was opened in the last few
 * minutes (`FRESH_SESSION_SECONDS`).
 */
export async function checkReauthentication(input: {
  userId: string;
  sessionCreatedAt: Date | string | undefined;
  password: string | undefined;
}): Promise<Reauthentication> {
  const [credential] = await db
    .select({ hash: account.password })
    .from(account)
    .where(and(eq(account.userId, input.userId), eq(account.providerId, "credential"), isNotNull(account.password)))
    .limit(1);

  if (!credential?.hash) {
    const openedAt = input.sessionCreatedAt ? new Date(input.sessionCreatedAt).getTime() : Number.NaN;

    return Date.now() - openedAt <= FRESH_SESSION_SECONDS * 1000 ? "ok" : "recent-sign-in-required";
  }

  if (!input.password) {
    return "password-required";
  }

  const { password } = await auth.$context;

  return (await password.verify({ hash: credential.hash, password: input.password })) ? "ok" : "wrong-password";
}

/** Whether the account has a password to ask for: what the page of the account says to the form. */
export async function hasPassword(userId: string): Promise<boolean> {
  const [credential] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential"), isNotNull(account.password)))
    .limit(1);

  return credential !== undefined;
}
