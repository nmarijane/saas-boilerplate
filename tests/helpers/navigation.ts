import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

/**
 * A stand-in for the localized `redirect` of `@/shared/lib/i18n-navigation`, for
 * the tests that replace that module: it throws as the real one does (Next's own
 * `redirect`), to the address next-intl would give, with the language in front. A
 * stand-in that returned would let a guard that "sent the person away" go on, and
 * the action would run for somebody who is not signed in.
 */
export function localizedRedirect({ href, locale }: { href: string; locale: string }): never {
  return redirect(`/${locale}${href}`);
}

/** Where a call that redirects sent the caller; fails if it did not redirect. */
export async function redirectOf(call: Promise<unknown>): Promise<string> {
  const error = await call.then(() => undefined, (rejection: unknown) => rejection);
  if (!isRedirectError(error)) {
    throw new Error(`Expected the call to redirect, got: ${String(error)}`);
  }

  return getURLFromRedirectError(error);
}
