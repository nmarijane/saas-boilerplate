import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Where the pages of the connected space live. The shell is a route group:
 * `(app)/(shell)/` holds the pages that sit inside it (home, assistant,
 * settings, admin) and onboarding stays beside it, outside the shell, since a
 * person with no workspace has nothing to navigate yet. The group names are
 * not part of the URL, so none of this moves a page.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const LOCALE = join(ROOT, "src/app/[locale]");
const APP = join(LOCALE, "(app)");
const SHELL = join(APP, "(shell)");

/** The paths of the `page.tsx` files under a folder, relative to it. */
function pagesUnder(folder: string): string[] {
  return readdirSync(folder, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => file.split("\\").join("/"))
    .sort();
}

describe("the routes of the connected space", () => {
  it("puts every page under the shell, onboarding and the pages of payment aside", () => {
    const pages = pagesUnder(APP);

    expect(pages.length).toBeGreaterThan(0);
    expect(
      pages.filter(
        (page) => !page.startsWith("(shell)/") && !page.startsWith("onboarding/") && !page.startsWith("(pay)/"),
      ),
    ).toEqual([]);
  });

  it.each(["dashboard", "ai", "settings", "admin"])(
    "keeps /%s inside the shell",
    (segment) => {
      expect(pagesUnder(SHELL).some((page) => page.startsWith(`${segment}/`))).toBe(
        true,
      );
    },
  );

  it("keeps onboarding outside the shell, with a layout of its own", () => {
    expect(existsSync(join(APP, "onboarding/page.tsx"))).toBe(true);
    expect(existsSync(join(APP, "onboarding/layout.tsx"))).toBe(true);
    expect(existsSync(join(SHELL, "onboarding"))).toBe(false);
  });

  it("draws the shell once, in the layout of the group", () => {
    expect(existsSync(join(SHELL, "layout.tsx"))).toBe(true);
    // The two layouts that drew a sidebar each are gone.
    expect(existsSync(join(APP, "layout.tsx"))).toBe(false);
    expect(existsSync(join(LOCALE, "(admin)"))).toBe(false);
  });

  it("guards the admin pages with a layout of their own", () => {
    expect(existsSync(join(SHELL, "admin/layout.tsx"))).toBe(true);
  });

  it("leaves no page of the old places", () => {
    for (const old of ["dashboard", "ai", "settings"]) {
      expect(existsSync(join(APP, old)), `(app)/${old}`).toBe(false);
    }
  });
});

describe("the layout components", () => {
  const LAYOUT = join(ROOT, "src/shared/components/layout");

  it.each(["sidebar", "header", "breadcrumb"])(
    "no longer has the %s the shell replaced",
    (name) => {
      expect(existsSync(join(LAYOUT, `${name}.tsx`))).toBe(false);
    },
  );

  it.each(["theme-toggle", "footer"])(
    "keeps %s, which the public pages use",
    (name) => {
      expect(existsSync(join(LAYOUT, `${name}.tsx`))).toBe(true);
    },
  );
});
