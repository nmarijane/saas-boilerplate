import { DEV_APP_URL } from "@/shared/config/app";

// The link of the reset e-mail carries the token in its address (`?token=`), and
// an address is kept: it stays in the history and on the screen, is read by
// browser extensions, and goes with the events of the error reporter; a token that
// the page read from it would be in the payload the server sends the browser, and in
// the router's history state. So the address is only ever the way in. The proxy
// (src/proxy.ts) takes the token out of it before the page is drawn: it keeps it in
// a short-lived HttpOnly cookie, and redirects to the same address without it. The
// page only learns that a token is waiting, and the form hands the new password to a
// server action (reset-password-action.ts), which reads the cookie on the server: the
// token is never in the page, in a script, or in a request that the page makes.

/** The cookie that holds the token between the link and the new password: HttpOnly, so no script reads it. */
export const RESET_TOKEN_COOKIE = "reset_token";

/** How long the token waits in the cookie: the time to choose a password, well within the hour the link lasts. */
export const RESET_TOKEN_MAX_AGE_SECONDS = 15 * 60;

/**
 * Where the cookie is sent: the reset page of the language, and nothing else. The form's server action posts to
 * that page, so the token travels with that one request and not with every request to the site for fifteen
 * minutes (and so not with every error that the reporter hears of). A `__Host-` name would need the path `/`,
 * which is what this avoids, so the name stays plain.
 */
export function resetTokenPath(locale: string): string {
  return `/${locale}/reset-password`;
}

/**
 * Whether the app is served over https, by the scheme of its own address (`BETTER_AUTH_URL`): configuration, not
 * a header, and what Better Auth uses for its own cookies. A `Secure` cookie is refused by a browser on plain
 * http (a production server reached over http, Safari on localhost), and the page would then say the link expired.
 */
function servedOverHttps(): boolean {
  try {
    // A variable set to nothing is unset, as everywhere else
    return new URL(process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || DEV_APP_URL).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The options of the cookie. `Lax`, not `Strict`: the link is followed from a mail, and a `Strict` cookie is not
 * sent on a redirect that a cross-site navigation started. `Secure` when the app is served over https.
 */
export function resetTokenCookieOptions(locale: string, secure = servedOverHttps()) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: resetTokenPath(locale),
    maxAge: RESET_TOKEN_MAX_AGE_SECONDS,
  } as const;
}
