import { getLocale } from "next-intl/server";
import { redirect } from "@/shared/lib/i18n-navigation";
import "server-only";

/** The pages a guard sends someone to. */
type GuardTarget = "/sign-in" | "/dashboard" | "/onboarding";

/**
 * Sends the person to one of the pages a guard names, in the language of the
 * request. The proxy sets that language for pages and for server actions alike,
 * so the address leaves the server complete (`/fr/sign-in`): a bare path would
 * be redirected a second time, by the proxy, to add the language.
 */
export async function redirectTo(href: GuardTarget): Promise<never> {
  const locale = await getLocale();
  return redirect({ href, locale });
}
