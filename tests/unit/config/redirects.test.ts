import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_REDIRECTS, legacyRedirects } from "@/shared/config/redirects";

/**
 * The settings pages were moved (`/settings/profile` and `/settings/danger` are
 * one page now, `/settings/api` became `/settings/developers`, and `/settings`
 * has no page of its own): the old addresses are redirected, with and without
 * the language, so that a bookmark, an email or a notification that points at
 * one still lands on a page. They live in a plain module because `next.config.ts`
 * reads them, and the config can import nothing from `@/`.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const SHELL = join(ROOT, "src/app/[locale]/(app)/(shell)");

/**
 * Whether Next.js would run a redirect for this path: the `source` is matched
 * with the library Next.js itself compiles redirects with. It ships no types,
 * so the one function used here is typed by hand.
 */
const { match } = createRequire(import.meta.url)(
  "next/dist/compiled/path-to-regexp",
) as {
  match: (source: string) => (path: string) => false | { params: Record<string, string> };
};

function redirectFor(locales: readonly string[], path: string) {
  return legacyRedirects(locales).find(({ source }) => match(source)(path) !== false);
}

describe("legacyRedirects", () => {
  it("redirects the old settings addresses, with and without a locale", () => {
    const r = legacyRedirects(["en", "fr"]);

    expect(r).toContainEqual({ source: "/settings/profile", destination: "/settings/account", permanent: true });
    expect(r).toContainEqual({ source: "/:locale(en|fr)/settings/api", destination: "/:locale/settings/developers", permanent: true });
    expect(r.find((x) => x.source === "/settings")?.permanent).toBe(false);
  });

  it("gives every old address both forms, the plain one first", () => {
    const r = legacyRedirects(["en", "fr"]);

    expect(r).toHaveLength(LEGACY_REDIRECTS.length * 2);
    expect(r.map(({ source }) => source)).toEqual(
      LEGACY_REDIRECTS.flatMap(({ from }) => [from, `/:locale(en|fr)${from}`]),
    );
  });

  it("keeps /settings temporary and the pages that were merged or renamed permanent", () => {
    expect(Object.fromEntries(LEGACY_REDIRECTS.map(({ from, permanent }) => [from, permanent]))).toEqual({
      "/settings": false,
      "/settings/profile": true,
      "/settings/danger": true,
      "/settings/api": true,
    });
  });

  it("follows the locales it is given, and keeps the language of the address", () => {
    const r = legacyRedirects(["en", "fr", "de"]);

    expect(r).toContainEqual({
      source: "/:locale(en|fr|de)/settings/danger",
      destination: "/:locale/settings/account",
      permanent: true,
    });
  });

  it("only points at pages that exist", () => {
    for (const { to } of LEGACY_REDIRECTS) {
      expect(existsSync(join(SHELL, to, "page.tsx")), `${to} has no page`).toBe(true);
    }
  });

  it("leaves no page behind an old address", () => {
    for (const { from } of LEGACY_REDIRECTS) {
      expect(existsSync(join(SHELL, from, "page.tsx")), `${from} still has a page`).toBe(false);
    }
  });

  it("runs for each old address, in any language, and only for those", () => {
    const locales = ["en", "fr"];

    expect(redirectFor(locales, "/settings")?.destination).toBe("/settings/account");
    expect(redirectFor(locales, "/settings/profile")?.destination).toBe("/settings/account");
    expect(redirectFor(locales, "/settings/danger")?.destination).toBe("/settings/account");
    expect(redirectFor(locales, "/settings/api")?.destination).toBe("/settings/developers");
    expect(redirectFor(locales, "/fr/settings")?.destination).toBe("/:locale/settings/account");
    expect(redirectFor(locales, "/fr/settings/api")?.destination).toBe("/:locale/settings/developers");
    expect(match("/:locale(en|fr)/settings/api")("/fr/settings/api")).toMatchObject({ params: { locale: "fr" } });
  });

  // A redirect whose source also matched its own destination would send the
  // browser round in circles: no page that exists is an old address.
  it("never catches a page that exists, or a language it does not serve", () => {
    const locales = ["en", "fr"];

    for (const path of [
      ...LEGACY_REDIRECTS.map(({ to }) => to),
      ...LEGACY_REDIRECTS.map(({ to }) => `/en${to}`),
      "/settings/team",
      "/fr/settings/notifications",
      "/settings/billing",
      "/settings/account/anything",
      "/dashboard",
      "/de/settings/api",
    ]) {
      expect(redirectFor(locales, path), path).toBeUndefined();
    }
  });
});
