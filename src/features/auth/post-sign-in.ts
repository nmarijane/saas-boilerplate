import { isAppPath } from "@/shared/components/shell/nav-row";
import { routing } from "@/shared/lib/i18n-routing";

// Where signing in leads. The proxy sends a visitor who has no session to the
// sign-in page with the page they asked for in `callbackUrl`, a path with its
// language (`/fr/projects/abc`), so that they land there. The parameter comes
// from the address bar: it is whatever anyone put in a link.

const DASHBOARD = "/dashboard";
// The origin a path is resolved against to read it as a browser would: any other
// origin in the result is a path that leaves the app
const ORIGIN = "http://app.invalid";

interface SignInTarget {
  /** A path of the app with no language in front, with its query and fragment. */
  href: string;
  /** The language the path was written in, when it carried one: otherwise the language of the page. */
  locale?: string;
}

/** The page a `callbackUrl` asks for, when it is a path of the app; null for anything else. */
function readTarget(callbackUrl: string | null | undefined): SignInTarget | null {
  if (!callbackUrl || !isAppPath(callbackUrl)) {
    return null;
  }

  const { pathname, search, hash } = new URL(callbackUrl, ORIGIN);
  const [, first = "", ...rest] = pathname.split("/");
  const locale = routing.locales.find((candidate) => candidate === first);
  const href = `${locale ? `/${rest.join("/")}` : pathname}${search}${hash}`;

  if (!isAppPath(href)) {
    return null;
  }

  return locale ? { href, locale } : { href };
}

/**
 * The page that signing in leads to: the one that was asked for when it is a
 * path of the app (`isAppPath`: not a web address, not `//host`, not a scheme),
 * with the language its path carries, and the dashboard otherwise. The path is
 * checked again once the language is taken off, since what is left must not be
 * one that a browser reads as another host (`/fr//evil.example`).
 */
export function signInTarget(callbackUrl: string | null | undefined): SignInTarget {
  return readTarget(callbackUrl) ?? { href: DASHBOARD };
}

/** The page to come back to, when signing in would follow it (`signInTarget`); null for anything else. */
export function keptCallbackUrl(callbackUrl: string | null | undefined): string | null {
  return callbackUrl && readTarget(callbackUrl) ? callbackUrl : null;
}

/**
 * A page of the sign-in family (`/sign-in`, `/sign-up`) that keeps the page to
 * come back to, when signing in would follow it: the pages that offer each
 * other, and the verify page, pass it on. Anything else is dropped, and the page
 * is given bare.
 */
export function withCallbackUrl(path: string, callbackUrl: string | null | undefined): string {
  const kept = keptCallbackUrl(callbackUrl);

  return kept ? `${path}?callbackUrl=${encodeURIComponent(kept)}` : path;
}
