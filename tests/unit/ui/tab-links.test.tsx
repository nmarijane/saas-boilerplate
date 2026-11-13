import type { ComponentProps } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TabLinks } from "@/shared/components/ui/tab-links";
import { tabStripStyles, tabStyles } from "@/shared/components/ui/tab-strip";
import { attribute, classesOf, startTags, tokens } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// The locale-aware Link of next-intl is replaced: no Next router runs in a test. A plain anchor stands in for the Link, and a variable for the
// pathname, which every test sets.
const route = vi.hoisted(() => ({ pathname: null as string | null }));

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
    usePathname: () => route.pathname,
  };
});

beforeEach(() => {
  route.pathname = "/projects/p1/settings";
});

const ITEMS = [
  { href: "/projects/p1", label: "Overview", exact: true },
  { href: "/projects/p1/settings", label: "Settings" },
];

const render = (props: Partial<ComponentProps<typeof TabLinks>> = {}) =>
  renderWithIntl(<TabLinks label="Project" items={ITEMS} {...props} />);

/** The start tag of the link that carries this label. */
function linkLabelled(html: string, label: string): string {
  return new RegExp(`<a[^>]*>${label}</a>`).exec(html)?.[0] ?? "";
}

describe("tab links", () => {
  describe("the current tab", () => {
    it("marks the current tab", () => {
      const html = render();

      expect(attribute(linkLabelled(html, "Settings"), "aria-current")).toBe(
        "page",
      );
      expect(
        attribute(linkLabelled(html, "Overview"), "aria-current"),
      ).toBeUndefined();
    });

    it("marks an exact tab on its own page only", () => {
      route.pathname = "/projects/p1";
      const html = render();

      expect(attribute(linkLabelled(html, "Overview"), "aria-current")).toBe(
        "page",
      );
      expect(
        attribute(linkLabelled(html, "Settings"), "aria-current"),
      ).toBeUndefined();
    });

    it("keeps a tab current on the pages under it", () => {
      route.pathname = "/projects/p1/settings/members";
      const html = render();

      expect(attribute(linkLabelled(html, "Settings"), "aria-current")).toBe(
        "page",
      );
      expect(
        attribute(linkLabelled(html, "Overview"), "aria-current"),
      ).toBeUndefined();
    });

    it("marks no tab on a page that is none of them", () => {
      route.pathname = "/projects/p1/activity";

      expect(render()).not.toContain("aria-current");
    });

    it("marks no tab where the pathname is unknown, as outside the app", () => {
      route.pathname = null;

      expect(render()).not.toContain("aria-current");
    });

    it("marks one tab at most, and says `page`", () => {
      const marked = render().match(/aria-current="[^"]*"/g);

      expect(marked).toEqual(['aria-current="page"']);
    });

    it("marks the link and not its item: the link is what a screen reader lands on", () => {
      const html = render();

      expect(
        startTags(html, "li").some((tag) => tag.includes("aria-current")),
      ).toBe(false);
    });
  });

  describe("its navigation", () => {
    it("names its navigation", () => {
      const html = render({ label: "Project" });
      const nav = startTags(html, "nav");

      expect(nav).toHaveLength(1);
      expect(attribute(nav[0] ?? "", "aria-label")).toBe("Project");
    });

    it("is a list in the navigation, with one item and one link per tab", () => {
      const html = render();

      expect(html).toMatch(
        /^<nav [^>]*><ul [^>]*>(?:<li[^>]*><a [^>]*>[^<]*<\/a><\/li>){2}<\/ul><\/nav>$/,
      );
    });

    it("keeps the list role, which Safari drops from a list with no bullets", () => {
      expect(attribute(startTags(render(), "ul")[0] ?? "", "role")).toBe(
        "list",
      );
    });

    it("draws real links to the pages, in the order given, and no button", () => {
      const html = render();
      const links = startTags(html, "a");

      expect(links.map((tag) => attribute(tag, "href"))).toEqual([
        "/projects/p1",
        "/projects/p1/settings",
      ]);
      expect(startTags(html, "button")).toHaveLength(0);
      expect(html).not.toContain('role="tab');
    });

    it("writes each label as it is given", () => {
      const html = render({
        items: [{ href: "/a", label: "Facturation et paiements" }],
      });

      expect(html).toContain(">Facturation et paiements</a>");
    });

    it("draws nothing inside the list for no tab, and keeps the navigation named", () => {
      const html = render({ items: [] });

      expect(startTags(html, "li")).toHaveLength(0);
      expect(attribute(startTags(html, "nav")[0] ?? "", "aria-label")).toBe(
        "Project",
      );
    });

    it("puts the class of the caller on the navigation", () => {
      const nav = startTags(render({ className: "mt-6" }), "nav")[0] ?? "";

      expect(classesOf(nav)).toContain("mt-6");
    });
  });

  describe("its look", () => {
    const strip = () => startTags(render(), "ul")[0] ?? "";
    const link = () => linkLabelled(render(), "Settings");
    const inactive = () => linkLabelled(render(), "Overview");

    it("draws its list and its links from the strip it shares with Tabs, so that the two look alike", () => {
      // Static markup writes `&`, `>` and `'` of a class as entities.
      const decoded = (classes: string[]) =>
        classes.map((name) =>
          name
            .replaceAll("&amp;", "&")
            .replaceAll("&gt;", ">")
            .replaceAll("&#x27;", "'"),
        );

      expect(decoded(classesOf(strip()))).toEqual(
        expect.arrayContaining(tokens(tabStripStyles)),
      );
      expect(decoded(classesOf(link()))).toEqual(
        expect.arrayContaining(tokens(tabStyles)),
      );
    });

    it("scrolls sideways, with no scrollbar, when the links do not fit", () => {
      expect(classesOf(strip())).toEqual(
        expect.arrayContaining(["overflow-x-auto", "[scrollbar-width:none]"]),
      );
    });

    it("makes each link 44 px high, and never shrinks it below its label", () => {
      expect(classesOf(link())).toEqual(
        expect.arrayContaining([
          "h-11",
          "min-w-11",
          "shrink-0",
          "whitespace-nowrap",
        ]),
      );
    });

    it("writes the current link in ink and the others in muted ink", () => {
      expect(classesOf(link())).toContain("aria-[current=page]:text-ink");
      expect(classesOf(inactive())).toContain("text-ink-muted");
    });

    it("draws the current line in the brand color at the bottom of the link, as Tabs does", () => {
      const classes = classesOf(link());

      expect(classes).toEqual(
        expect.arrayContaining([
          "after:absolute",
          "after:bottom-0",
          "after:h-0.5",
          "after:bg-brand",
          "after:opacity-0",
          "aria-[current=page]:after:opacity-100",
          "forced-colors:after:bg-[color:Highlight]",
        ]),
      );
    });

    it("keeps the focus ring inside the link: the strip scrolls, and a scrolling box clips a ring drawn outside", () => {
      const classes = classesOf(link());

      for (const name of [
        "focus-visible:outline-solid",
        "focus-visible:outline-2",
        "focus-visible:-outline-offset-2",
        "focus-visible:outline-ring",
        "focus-visible:shadow-none",
      ]) {
        expect(classes).toContain(name);
      }
      expect(classes).not.toContain("focus-visible:focus-ring");
    });

    it("never keys its marks off data-state, which a link does not carry", () => {
      expect(classesOf(link()).join(" ")).not.toContain("data-[state=active]");
    });
  });

  describe("its source", () => {
    const source = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../src/shared/components/ui/tab-links.tsx",
      ),
      "utf-8",
    );

    it("is a client component: it reads the pathname and reaches into the DOM", () => {
      expect(source.startsWith('"use client"')).toBe(true);
    });

    it("links with the locale-aware Link, so that the language of the page is kept", () => {
      expect(source).toContain('from "@/shared/lib/i18n-navigation"');
      expect(source).not.toContain('from "next/link"');
      expect(source).not.toContain('from "next/navigation"');
    });
  });
});
