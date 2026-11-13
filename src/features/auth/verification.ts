import { keptCallbackUrl } from "./post-sign-in";

// Where the link of a verification e-mail comes back to. Better Auth checks the
// token of the link, then redirects to the `callbackURL` it was given (to `/`,
// the marketing site and signed out, when it was given none), with `error=` added
// when the link is dead. The app gives it the verify page, which says that the
// address is verified: a person who has just followed the link has nowhere else to
// learn that it worked. `verified=1` is what tells the page the link was a good one:
// Better Auth adds nothing on success.

const VERIFIED_SEARCH = "?verified=1";

/**
 * The address the link comes back to: the verify page, under a language when
 * the caller knows it (`/fr/verify-email`). A person who signed up from a page
 * that asked for it (an invitation) is sent back to it once they sign in: the
 * verify page passes `callbackUrl` on to the sign-in page, when signing in would
 * follow it (`keptCallbackUrl`).
 */
export function verifiedAddress(path = "/verify-email", callbackUrl?: string): string {
  const kept = keptCallbackUrl(callbackUrl);

  return kept
    ? `${path}${VERIFIED_SEARCH}&callbackUrl=${encodeURIComponent(kept)}`
    : `${path}${VERIFIED_SEARCH}`;
}

/**
 * The link to put in a verification e-mail, from the one Better Auth made. A
 * caller that said where the link comes back to (the sign-up form and the
 * sign-in form know the language of the person, and the page they came from)
 * keeps it. A request that says nothing (a client of the API that asks for the
 * link) gets one that would go to `/`, the marketing site, signed out: it goes
 * to the verify page instead, which a language is found for from the person's
 * browser.
 */
export function verificationLink(url: string): string {
  let link: URL;
  try {
    link = new URL(url);
  } catch {
    return url;
  }

  const callback = link.searchParams.get("callbackURL");
  if (callback === null || callback === "/") {
    link.searchParams.set("callbackURL", verifiedAddress());
  }

  return link.toString();
}
