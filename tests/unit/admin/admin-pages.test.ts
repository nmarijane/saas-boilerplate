import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as lucide from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { FEATURES } from "@/features/registry";

/**
 * The admin pages are one family: the same header (an icon tile, the title, a
 * count when the true total is cheap to give), one card of data, and a title in
 * the tab of the browser. A page that forgets one of them looks like no other,
 * so each is read for what it must hold. The pages under the shell are Server
 * Components: the rules are calls and tags in their source, and what they do
 * once drawn is checked by tests/integration/admin-pages.test.tsx.
 */

// Loading the registry loads each shell, and with it the components the shell
// mounts. The locale-aware navigation of next-intl is replaced (no Next router runs
// in a test): a stand-in gives those components the names they import. Nothing is rendered.
vi.mock("@/shared/lib/i18n-navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({}),
}));

const ROOT = resolve(import.meta.dirname, "../../..");
const ADMIN = join(ROOT, "src/app/[locale]/(app)/(shell)/admin");

/**
 * The pages of the family: one folder each under the admin, read from the disk
 * so that a page that is added is looked at, and one that a removed feature took
 * with it is not asked for.
 */
const PAGES = readdirSync(ADMIN, { recursive: true, encoding: "utf8" })
  .map((file) => file.split("\\").join("/"))
  .filter((file) => file.endsWith("/page.tsx"))
  .map((file) => dirname(file))
  .sort();

/** The source of a page as written, comments included. */
function rawSourceOf(page: string): string {
  return readFileSync(join(ADMIN, page, "page.tsx"), "utf-8");
}

/**
 * What a page runs: its source without the comments, which may talk about the
 * catch or the count they explain the lack of, and which no rule is met by.
 */
function sourceOf(page: string): string {
  return rawSourceOf(page)
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^\s*\/\/.*$/gm, "");
}

describe("the admin pages", () => {
  // The scan has to find the pages, or it checks nothing
  it("looks at pages", () => {
    expect(PAGES.length).toBeGreaterThan(0);
  });

  it.each(PAGES)("give %s a header with its icon, and a title", (page) => {
    const source = sourceOf(page);

    expect(source).toContain("<PageHeader");
    expect(source).toMatch(/icon=\{\w+Icon\}/);
    expect(source).toContain("appPageMetadata(");
  });

  it.each(PAGES)("title the tab of %s \"<page> · Admin\", through the shell and not through the public metadata", (page) => {
    const source = sourceOf(page);

    expect(source).toMatch(
      /appPageMetadata\(\s*t\("\w+"\),\s*\{\s*context:\s*t\("title"\)\s*\}\s*\)/,
    );
    expect(source).not.toContain("generatePageMetadata");
    // The shell's title already says the page stays out of search; a description would be the public kind
    expect(source).not.toMatch(/\bdescription:/);
  });

  it.each(PAGES)("leave the one h1 to the header of %s", (page) => {
    expect(sourceOf(page)).not.toMatch(/<h1\b/);
  });
});

describe("the guard of the admin pages", () => {
  it("keeps admin pages behind the admin guard", () => {
    expect(readFileSync(join(ADMIN, "layout.tsx"), "utf-8")).toContain(
      "await requireAdmin()",
    );
  });

  // A layout is not run again on every navigation inside it: a page that relied
  // on the layout would be open to anyone who got there from another admin page.
  it.each(PAGES)("asks it again, as the first thing %s does", (page) => {
    expect(sourceOf(page)).toMatch(
      /export default async function \w+\([^)]*\)\s*\{\s*await requireAdmin\(\);/,
    );
  });
});

describe("a query of an admin page that fails", () => {
  // `try { ... } catch { // DB might not be ready }` drew an empty table that
  // said there was nothing, when the database had failed: the route's error
  // boundary tells the truth, so no page catches.
  it.each(PAGES)("is not caught by %s", (page) => {
    expect(sourceOf(page)).not.toMatch(/\bcatch\b/);
    expect(rawSourceOf(page)).not.toContain("DB might not be ready");
  });
});

describe("the icon of an admin page", () => {
  const entries = FEATURES.flatMap((feature) => feature.nav ?? []).filter(
    ({ href }) => href.startsWith("/admin/"),
  );

  // The scan has to find the entries of the sidebar's admin section, or it checks nothing
  it("finds the entries of the admin section of the navigation", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  // The header and the sidebar name one place: the icon that points to it is the icon that opens it.
  it.each(entries.map((entry) => [entry.href, entry] as const))(
    "is the icon of its entry in the navigation: %s",
    (href, entry) => {
      const page = href.split("/")[2] ?? "";
      const name = /icon=\{(\w+)\}/.exec(sourceOf(page))?.[1] ?? "";
      const icon = (lucide as Record<string, unknown>)[name];

      expect(icon, `${href} passes ${name || "no icon"} to its header`).toBeDefined();
      expect(icon, `${href} passes ${name} to its header`).toBe(entry.icon);
    },
  );
});
