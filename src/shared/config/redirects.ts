/**
 * The addresses the settings pages used to have, and where each one goes now.
 * A bookmark, an email or a notification that was written before the move still
 * lands on a page. The addresses are written without the language, as pages are
 * everywhere in the app: `legacyRedirects` adds the form that has one.
 *
 * `/settings` alone has no page (the tabs are the settings), so it goes to the
 * first tab, and for now only: it is temporary. The others are final: the
 * profile and the danger zone are one page, and the API page changed its name.
 *
 * This module imports nothing, not even from `@/`: `next.config.ts` reads it,
 * and the config is loaded before the aliases of the app exist.
 */
export const LEGACY_REDIRECTS = [
  { from: "/settings", to: "/settings/account", permanent: false },
  { from: "/settings/profile", to: "/settings/account", permanent: true },
  { from: "/settings/danger", to: "/settings/account", permanent: true },
  { from: "/settings/api", to: "/settings/developers", permanent: true },
] as const;

interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
}

/**
 * The redirects of `next.config.ts`, two for each old address: the address as
 * it is written, which the proxy then gives the language of the visitor, and the
 * address with one of the languages of the app in front, which keeps that language.
 * A language the app does not serve matches neither, and is left to the 404.
 */
export function legacyRedirects(locales: readonly string[]): Redirect[] {
  const language = `/:locale(${locales.join("|")})`;

  return LEGACY_REDIRECTS.flatMap(({ from, to, permanent }) => [
    { source: from, destination: to, permanent },
    { source: `${language}${from}`, destination: `/:locale${to}`, permanent },
  ]);
}
