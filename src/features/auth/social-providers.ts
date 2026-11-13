import type { SocialProvider } from "./auth-flows";
import { auth } from "./auth";
import "server-only";

/** In the order of the buttons. */
const SUPPORTED: readonly SocialProvider[] = ["google", "github"];

/**
 * The providers that sign-in can use on this install. `auth.ts` is the one
 * place that decides: a provider is on when its keys are set (`enabled`), and
 * Better Auth drops the others, so that a click on their button would answer
 * 404 and do nothing. The pages ask here, and draw a button for each provider
 * that is on and for no other. A provider that is on but has no button here is
 * left out.
 */
export function enabledSocialProviders(): SocialProvider[] {
  const configured: Partial<Record<SocialProvider, { enabled?: unknown }>> =
    auth.options.socialProviders ?? {};

  return SUPPORTED.filter((provider) => configured[provider]?.enabled === true);
}
