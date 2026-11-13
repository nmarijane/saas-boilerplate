import type { AuthErrorKey } from "./auth-errors";
import { unstable_rethrow } from "next/navigation";
import { getPathname } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { AUTH_ERROR_KEYS, authErrorKey } from "./auth-errors";
import { isPasswordStrong } from "./password-rules";
import { signInTarget } from "./post-sign-in";
import { verifiedAddress } from "./verification";

// What the sign-in pages ask of the auth client, as plain functions that are
// given the client: a test calls them with a client that refuses or does not
// answer, and says which call was made (the forms cannot, in Node: it has no DOM
// to click in), as `settings/account-flows.ts` does for the account page. Each
// form is the thin part that gives them the client of the app, or, in a story,
// one that answers what it is told to.
//
// The clients below are the part of the auth client that a form uses, written
// out as what a form reads of each answer. The app's own client is given where a
// form takes one by default, so the compiler checks that it fits.

/**
 * What a call of the auth client answers, as far as the flows read it: an
 * `error` when the server refuses, and the `code` of the refusal in it, with
 * the `status` of the response (a limiter answers 429 and no code). Its
 * `message` is a sentence in English for a developer, which no flow tells.
 */
interface Answer {
  error?: { code?: string; message?: string; status?: number } | null;
}

export interface SignInClient {
  signIn: {
    email: (input: { email: string; password: string }) => Promise<Answer>;
  };
  sendVerificationEmail: (input: {
    email: string;
    callbackURL: string;
    /** How the request goes: the form asks for the link with no cookies (`credentials: "omit"`). */
    fetchOptions?: { credentials?: "omit" };
  }) => Promise<Answer>;
}

/** The providers the sign-in pages have a button for. */
export type SocialProvider = "google" | "github";

export interface SocialSignInClient {
  signIn: {
    social: (input: {
      provider: SocialProvider;
      callbackURL: string;
      errorCallbackURL: string;
    }) => Promise<Answer>;
  };
}

export interface SignUpClient {
  signUp: {
    email: (input: {
      name: string;
      email: string;
      password: string;
      callbackURL: string;
    }) => Promise<Answer>;
  };
}

export interface PasswordResetClient {
  requestPasswordReset: (input: {
    email: string;
    redirectTo: string;
  }) => Promise<Answer>;
  resetPassword: (input: {
    newPassword: string;
    token: string;
  }) => Promise<Answer>;
}

/** The message the form tells when a flow did not go through: a key of the message files, from their root. */
export type FlowMessageKey = AuthErrorKey | "auth.passwordTooWeak";

export type FlowResult =
  | { ok: true }
  | { ok: false; messageKey: FlowMessageKey };

/**
 * Makes one call and says whether the server took it, and if not, which message
 * to tell. A refusal (an `error` in the answer) is told by its code. A call that
 * fails outright (the network) is told by the generic error, and it is handled,
 * not hidden: the error reporter of the app still hears it. A refusal is the
 * person's to deal with (a wrong password), not an error of the app, so the
 * reporter does not hear it. It never rejects.
 */
async function attempt(call: () => Promise<Answer>): Promise<FlowResult> {
  try {
    const { error } = await call();

    return error ? { ok: false, messageKey: authErrorKey(error) } : { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    reportHandledError(error);

    return { ok: false, messageKey: "common.error" };
  }
}

/**
 * Signs in with an email and a password: those two, which are all the server
 * is given. The server refuses an address that is not verified yet, and only
 * when the password is the right one: the form then sends the link that
 * verifies it, itself. The link the server would send has no way back (a
 * sign-in does not say where it came from, and `sendOnSignIn` is off), and
 * this one comes back to the verify page of the language of the form, with the
 * page that sent the person here (an invitation, in `callbackUrl`), as the
 * link of sign-up does: nothing is asked for by anyone who does not know the
 * password, and what the server tells of an address stays what it was. The
 * request goes without the cookies of the browser: the server refuses a link for
 * an address other than the one of the session it holds (EMAIL_MISMATCH), and a
 * browser on which someone else is still signed in holds theirs. When the link
 * cannot be sent, the person is told why, and not that it is on its way.
 */
export async function signInFlow(
  client: SignInClient,
  input: { email: string; password: string; locale: string; callbackUrl?: string },
): Promise<FlowResult> {
  const signedIn = await attempt(() =>
    client.signIn.email({ email: input.email, password: input.password }),
  );
  if (signedIn.ok || signedIn.messageKey !== AUTH_ERROR_KEYS.EMAIL_NOT_VERIFIED) {
    return signedIn;
  }

  const sent = await attempt(() =>
    client.sendVerificationEmail({
      email: input.email,
      callbackURL: verifiedAddress(getPathname({ href: "/verify-email", locale: input.locale }), input.callbackUrl),
      fetchOptions: { credentials: "omit" },
    }),
  );

  return sent.ok ? signedIn : sent;
}

/**
 * Starts signing in with a provider. When the server takes it the browser is on
 * its way to the provider, and the call answers as the redirect starts. The
 * client does not throw when the server refuses (a provider that is off is a
 * 404): it answers `{ data, error }`, and the refusal is told like any other.
 * The person is brought back to the page they asked for when there is one (the
 * proxy puts it in `callbackUrl`, and only a path of the app counts), and to the
 * dashboard otherwise, in the language of the page. When the provider is cancelled
 * or refuses, they are brought back to the sign-in page of that language, which
 * tells it (Better Auth adds `?error=<code>`): with no `errorCallbackURL` it would
 * be a page of Better Auth, with no way back.
 */
export function socialSignInFlow(
  client: SocialSignInClient,
  input: { provider: SocialProvider; locale: string; callbackUrl?: string },
): Promise<FlowResult> {
  const target = signInTarget(input.callbackUrl);

  return attempt(() =>
    client.signIn.social({
      provider: input.provider,
      callbackURL: getPathname({ href: target.href, locale: target.locale ?? input.locale }),
      errorCallbackURL: getPathname({ href: "/sign-in", locale: input.locale }),
    }),
  );
}

/**
 * Creates the account: a name, an email and a password. The server sends the
 * email that verifies the address, and its link comes back to the verify page of
 * the language of the form: the person may open it in a browser that has no
 * memory of that language, and every path of the app carries its locale. A page
 * that sent the person to sign up (an invitation, in `callbackUrl`) goes with
 * the link, so that signing in leads back to it.
 */
export function signUpFlow(
  client: SignUpClient,
  input: { name: string; email: string; password: string; locale: string; callbackUrl?: string },
): Promise<FlowResult> {
  return attempt(() =>
    client.signUp.email({
      name: input.name,
      email: input.email,
      password: input.password,
      callbackURL: verifiedAddress(getPathname({ href: "/verify-email", locale: input.locale }), input.callbackUrl),
    }),
  );
}

/**
 * Asks for the email that holds the link to a new password. The link leads back
 * to the reset page, in the language the person asked in: they may open it in a
 * browser that has no memory of that language, and every path of the app
 * carries its locale. The sign-in page, where the link used to lead, ignores
 * the token that Better Auth puts in the address.
 */
export function requestPasswordResetFlow(
  client: Pick<PasswordResetClient, "requestPasswordReset">,
  input: { email: string; locale: string },
): Promise<FlowResult> {
  return attempt(() =>
    client.requestPasswordReset({
      email: input.email,
      redirectTo: getPathname({ href: "/reset-password", locale: input.locale }),
    }),
  );
}

/**
 * Sets the new password, with the token of the link. It does not sign the
 * person in: they sign in with the password they have just chosen. A password
 * that fails a rule of the strength meter (the one sign-up asks) is not sent:
 * the flow refuses it, with the message the form tells under the field.
 */
export async function resetPasswordFlow(
  client: Pick<PasswordResetClient, "resetPassword">,
  input: { newPassword: string; token: string },
): Promise<FlowResult> {
  if (!isPasswordStrong(input.newPassword)) {
    return { ok: false, messageKey: "auth.passwordTooWeak" };
  }

  return attempt(() =>
    client.resetPassword({
      newPassword: input.newPassword,
      token: input.token,
    }),
  );
}
