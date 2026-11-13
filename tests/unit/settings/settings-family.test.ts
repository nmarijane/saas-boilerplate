import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The settings pages are one family: the same header (an icon tile, the title,
 * a context line), the same tabs under it, and a title in the tab of the
 * browser. A page that forgets one of the three is a page that looks like no
 * other, so each is read for what it must hold. The pages under the shell are
 * Server Components: the three are calls and tags in their source.
 */

const ROOT = resolve(import.meta.dirname, "../../..");
const SETTINGS = join(ROOT, "src/app/[locale]/(app)/(shell)/settings");

/** The pages of the family: one folder each under the settings. */
const PAGES = ["account", "team", "notifications", "developers", "billing"];

/** The settings pages that do not exist any more: their addresses are redirected (src/shared/config/redirects.ts). */
const GONE = ["profile", "danger", "api"];

function sourceOf(page: string): string {
  return readFileSync(join(SETTINGS, page, "page.tsx"), "utf-8");
}

describe("the settings pages", () => {
  it.each(PAGES)("give %s its header, its tabs and its title", (page) => {
    const source = sourceOf(page);

    expect(source).toContain("<PageHeader");
    expect(source).toContain("<SettingsNav");
    expect(source).toContain("appPageMetadata(");
  });

  it.each(PAGES)("put the tabs in the header of %s, where every page has them", (page) => {
    expect(sourceOf(page)).toMatch(/tabs=\{\s*<SettingsNav\s*\/>\s*\}/);
  });

  it.each(PAGES)("give %s one icon in its header, and the workspace it works in from the session", (page) => {
    const source = sourceOf(page);

    expect(source).toMatch(/icon=\{\w+Icon\}/);
    expect(source).toContain("requireWorkspace()");
  });

  // The pages draw their sections as cards with a level-two title, and the header holds the only h1:
  // tests/integration/settings-pages.test.tsx renders each page and counts them.
  it.each(PAGES)("leave the one h1 to the header of %s", (page) => {
    expect(sourceOf(page)).not.toMatch(/<h1\b/);
  });

  it("looks at the pages that exist", () => {
    for (const page of PAGES) {
      expect(existsSync(join(SETTINGS, page, "page.tsx")), page).toBe(true);
    }
  });

  // A page that is added to the settings without being added to the list above would be one
  // that no test of the family looks at.
  it("looks at every page of the settings, and at no other", () => {
    const folders = readdirSync(SETTINGS, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect([...folders].sort()).toEqual([...PAGES].sort());
  });

  it.each(GONE)("has no page of its own at /settings/%s any more", (page) => {
    expect(existsSync(join(SETTINGS, page, "page.tsx"))).toBe(false);
  });
});
