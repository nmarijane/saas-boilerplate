// What the sign-in pages tell a person when the auth server refuses: a message
// in the language of the page, chosen by the code of the error (`error.code` in
// the answer of Better Auth). The sentence of the server is in English and is
// written for a developer: it is never shown. The table lists the codes the
// forms can meet; a refusal for too many requests has no code to list (below);
// any other code, or none, is the generic error of the app.
//
// A message is the full key of the message files ("auth.errors.invalidToken"),
// so that a form tells it with the translator that has no namespace.

export const AUTH_ERROR_KEYS = {
  INVALID_EMAIL_OR_PASSWORD: "auth.errors.invalidCredentials",
  EMAIL_NOT_VERIFIED: "auth.errors.emailNotVerified",
  USER_ALREADY_EXISTS: "auth.errors.userAlreadyExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "auth.errors.userAlreadyExists",
  INVALID_EMAIL: "auth.errors.invalidEmail",
  INVALID_TOKEN: "auth.errors.invalidToken",
  PASSWORD_TOO_SHORT: "auth.errors.passwordTooShort",
  PASSWORD_TOO_LONG: "auth.errors.passwordTooLong",
  // What a provider answers when the person cancels at its door
  ACCESS_DENIED: "auth.errors.accessDenied",
} as const;

type KnownCode = keyof typeof AUTH_ERROR_KEYS;

// A server that limits sign-in answers 429: Better Auth's limiter, in production, with a
// message and no code, and the proxy's limit on /api (src/proxy.ts) with a code of its own.
// It is the status that says it: the person is told to wait, as a wrong password is told
// to fix it.
const TOO_MANY_REQUESTS = 429;
const TOO_MANY_ATTEMPTS_KEY = "auth.errors.tooManyAttempts";

/** The key of a message the sign-in pages tell for an error of the auth server. */
export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[KnownCode] | typeof TOO_MANY_ATTEMPTS_KEY | "common.error";

// A table of the codes, read by own property: every object has properties of
// its own name (`constructor`, `toString`), and none of them is a code.
function isKnownCode(code: string | undefined): code is KnownCode {
  return code !== undefined && Object.hasOwn(AUTH_ERROR_KEYS, code);
}

/** The message to tell for an error of the auth client: only its code and its status are read, never its sentence. */
export function authErrorKey(error: { code?: string; status?: number } | null | undefined): AuthErrorKey {
  const code = error?.code;
  if (isKnownCode(code)) {
    return AUTH_ERROR_KEYS[code];
  }

  return error?.status === TOO_MANY_REQUESTS ? TOO_MANY_ATTEMPTS_KEY : "common.error";
}

/**
 * The message for the error a provider brings the person back with. When a
 * provider is cancelled or refuses, Better Auth redirects to the sign-in page with
 * `?error=<code>`, the code in the case the provider wrote it (`access_denied`):
 * it is looked up in the table of the codes, and the code itself is never shown.
 * `null` when there is no error to tell.
 */
export function oauthErrorKey(error: string | string[] | undefined): AuthErrorKey | null {
  const code = Array.isArray(error) ? error[0] : error;

  return code ? authErrorKey({ code: code.toUpperCase() }) : null;
}
