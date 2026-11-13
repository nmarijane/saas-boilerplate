import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavList } from "@/shared/components/shell/nav-list";
import {
  attribute,
  decodedClassesOf,
  decodeEntities,
  startTags,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { shellLink } from "../../helpers/shell";

// The locale-aware Link of next-intl is replaced: no Next router runs in a test. A plain anchor stands in for
// it, marked so that a test can tell it from the plain anchor of a link that
// leaves the app, and a variable stands in for the pathname.
const route = vi.hoisted(() => ({ pathname: "/projects" as string | null }));

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  const mark = { "data-locale-link": "" };
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...mark, ...props }),
    usePathname: () => route.pathname,
  };
});

beforeEach(() => {
  route.pathname = "/projects";
});

const HOME = shellLink("home", "/dashboard", "Home");
const PROJECTS = shellLink("projects", "/projects", "Projects");
// A link to the first settings page that stands for every page under /settings.
const SETTINGS = shellLink("settings", "/settings/account", "Settings", {
  match: "/settings",
});
const HELP = shellLink("help", "mailto:support@example.com", "Help");

const render = (
  items = [HOME, PROJECTS, SETTINGS, HELP],
  label = "Main",
  currentId?: string | null,
) =>
  renderWithIntl(
    <NavList items={items} label={label} currentId={currentId} />,
  );

/** The whole link whose label is exactly this text (the label is the `truncate` span: a link may carry more text, for assistive technology). */
function wholeLinkLabelled(html: string, label: string): string {
  const link = (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? []).find(
    (candidate) =>
      /<span class="truncate">([^<]*)<\/span>/.exec(candidate)?.[1] === label,
  );
  expect(link, `a link labelled ${label}`).toBeDefined();
  return link ?? "";
}

/** The start tag of the link whose label is exactly this text. */
function linkLabelled(html: string, label: string): string {
  return startTags(wholeLinkLabelled(html, label), "a")[0] ?? "";
}

/** The labels of the links that say `aria-current="page"`. */
function currentLabels(html: string): string[] {
  return (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [])
    .filter(
      (link) => attribute(startTags(link, "a")[0] ?? "", "aria-current") === "page",
    )
    .map((link) => /<span class="truncate">([^<]*)<\/span>/.exec(link)?.[1] ?? "");
}

describe("nav list", () => {
  describe("the current page", () => {
    it("marks the current page in the navigation", () => {
      const html = render();

      expect(attribute(linkLabelled(html, "Projects"), "aria-current")).toBe("page");
      expect(attribute(linkLabelled(html, "Home"), "aria-current")).toBeUndefined();
    });

    it("keeps a link current on the pages under it", () => {
      route.pathname = "/projects/p1/members";

      expect(attribute(linkLabelled(render(), "Projects"), "aria-current")).toBe("page");
    });

    it("reads `match` before `href`: Settings stays current on every settings page", () => {
      route.pathname = "/settings/team";
      const html = render();

      expect(attribute(linkLabelled(html, "Settings"), "aria-current")).toBe("page");
      // The link still goes where it says.
      expect(attribute(linkLabelled(html, "Settings"), "href")).toBe("/settings/account");
      expect(attribute(linkLabelled(html, "Projects"), "aria-current")).toBeUndefined();
    });

    it("stops at a whole segment: /projects is not the page of /projects-old", () => {
      route.pathname = "/projects-old";

      expect(render()).not.toContain("aria-current");
    });

    it("marks nothing off the pages of the list", () => {
      route.pathname = "/billing";

      expect(render()).not.toContain("aria-current");
    });

    it("marks nothing where there is no page", () => {
      route.pathname = null;

      expect(render()).not.toContain("aria-current");
    });

    it("keeps one link current at most: the most specific one wins", () => {
      const team = shellLink("team", "/settings/team", "Team");
      route.pathname = "/settings/team/invitations";
      const html = render([SETTINGS, team]);

      expect(attribute(linkLabelled(html, "Team"), "aria-current")).toBe("page");
      expect(attribute(linkLabelled(html, "Settings"), "aria-current")).toBeUndefined();
      expect(html.split('aria-current="page"')).toHaveLength(2);
    });

    it("keeps one link current when two stand for the same page", () => {
      const twin = shellLink("twin", "/projects", "Twin");
      const html = render([PROJECTS, twin]);

      expect(html.split('aria-current="page"')).toHaveLength(2);
      expect(attribute(linkLabelled(html, "Projects"), "aria-current")).toBe("page");
    });

    it("never marks a link that leaves the app, whatever its path", () => {
      route.pathname = "/projects";
      const lookalike = shellLink("docs", "https://example.com/projects", "Docs");
      const html = render([lookalike]);

      expect(html).not.toContain("aria-current");
    });
  });

  describe("when the menu names the current link", () => {
    it("marks a link only if it is the one the menu named, whatever the route says", () => {
      route.pathname = "/projects";

      expect(currentLabels(render(undefined, "Main", "home"))).toEqual(["Home"]);
    });

    it("marks nothing when the menu names no link, even on the page of one", () => {
      route.pathname = "/projects";

      expect(render(undefined, "Main", null)).not.toContain("aria-current");
    });

    it("marks nothing in a list that does not hold the link the menu named", () => {
      route.pathname = "/projects";

      expect(render([SETTINGS, HELP], "Secondary", "projects")).not.toContain(
        "aria-current",
      );
    });

    it("decides among its own links when the menu says nothing", () => {
      route.pathname = "/projects";

      expect(currentLabels(render())).toEqual(["Projects"]);
    });
  });

  describe("links that leave the app", () => {
    it("draws a link of the app with the locale-aware Link, and one that leaves it as a plain anchor", () => {
      const html = render();

      expect(linkLabelled(html, "Projects")).toContain("data-locale-link");
      expect(linkLabelled(html, "Help")).not.toContain("data-locale-link");
      expect(attribute(linkLabelled(html, "Help"), "href")).toBe(
        "mailto:support@example.com",
      );
    });

    it("opens a mailto link where it is, with no target", () => {
      const help = linkLabelled(render(), "Help");

      expect(attribute(help, "target")).toBeUndefined();
      expect(attribute(help, "rel")).toBeUndefined();
    });

    it("opens a web page in a new tab, cut off from this one", () => {
      const docs = linkLabelled(
        render([shellLink("docs", "https://example.com/help", "Docs")]),
        "Docs",
      );

      expect(attribute(docs, "target")).toBe("_blank");
      expect(attribute(docs, "rel")).toBe("noopener noreferrer");
      expect(docs).not.toContain("data-locale-link");
    });

    it("tells assistive technology that a web address opens a new tab, in words only it reads", () => {
      const html = render([shellLink("docs", "https://example.com/help", "Docs")]);
      const docs = wholeLinkLabelled(html, "Docs");

      expect(docs).toContain('<span class="sr-only">(opens in a new tab)</span>');
      // The words come after the label, inside the link, so that they are part of its name.
      expect(docs.indexOf("Docs</span>")).toBeLessThan(docs.indexOf("sr-only"));
    });

    it("says it in the language of the page", () => {
      const html = renderWithIntl(
        <NavList
          items={[shellLink("docs", "https://example.com/help", "Docs")]}
          label="Principale"
        />,
        "fr",
      );

      expect(decodeEntities(html)).toContain(
        '<span class="sr-only">(s\'ouvre dans un nouvel onglet)</span>',
      );
    });

    it("says nothing of a link that stays: a mailto link, a page of the app", () => {
      const html = render();

      expect(html).not.toContain("sr-only");
      expect(html).not.toContain("new tab");
    });

    it("takes a path that starts with two slashes for a web address, not a page of the app", () => {
      const cdn = linkLabelled(
        render([shellLink("cdn", "//cdn.example.com/help", "Help centre")]),
        "Help centre",
      );

      expect(cdn).not.toContain("data-locale-link");
      expect(attribute(cdn, "target")).toBeUndefined();
    });
  });

  describe("the rows", () => {
    it("names the navigation, a landmark among others", () => {
      const nav = startTags(render(undefined, "Main navigation"), "nav")[0] ?? "";

      expect(attribute(nav, "aria-label")).toBe("Main navigation");
    });

    it("lists the links, so that assistive technology counts them", () => {
      const html = render();

      expect(startTags(html, "ul")).toHaveLength(1);
      expect(attribute(startTags(html, "ul")[0] ?? "", "role")).toBe("list");
      expect(startTags(html, "li")).toHaveLength(4);
    });

    it("draws nothing for an empty list: no empty landmark", () => {
      expect(render([])).toBe("");
    });

    it("makes each row a 44 px target with the radius of a field", () => {
      const classes = decodedClassesOf(linkLabelled(render(), "Home"));

      expect(classes).toEqual(
        expect.arrayContaining([
          "min-h-11",
          "rounded-md",
          "gap-2.5",
          "font-medium",
        ]),
      );
    });

    it("dims the icon, and gives the current page an accent background, a heavier label and an icon in ink", () => {
      const classes = decodedClassesOf(linkLabelled(render(), "Home"));

      expect(classes).toEqual(
        expect.arrayContaining([
          "[&_svg]:size-5",
          "[&_svg]:text-ink-muted",
          "hover:bg-sidebar-hover",
          "aria-[current=page]:bg-sidebar-accent",
          "aria-[current=page]:font-semibold",
          "aria-[current=page]:[&_svg]:text-ink",
        ]),
      );
    });

    it("keeps the current page visible in forced-colors mode, with the highlight of the system", () => {
      const classes = decodedClassesOf(linkLabelled(render(), "Home"));

      expect(classes).toEqual(
        expect.arrayContaining([
          "forced-colors:aria-[current=page]:bg-[color:Highlight]",
          "forced-colors:aria-[current=page]:text-[color:HighlightText]",
          "forced-colors:aria-[current=page]:[&_svg]:text-[color:HighlightText]",
        ]),
      );
    });

    it("cuts a long label and keeps the icon", () => {
      const label = "A page whose name is far too long for a sidebar";
      const html = render([shellLink("long", "/long", label)]);
      const span = new RegExp(`<span\\b[^>]*>${label}</span>`).exec(html)?.[0] ?? "";

      expect(decodedClassesOf(span)).toContain("truncate");
      expect(html).toContain('data-icon="long"');
    });
  });

  describe("closing the menu", () => {
    /** The elements of a tree that is not mounted: components are not run, so a link stays a link. */
    function findElements(
      node: ReactNode,
      test: (props: Record<string, unknown>) => boolean,
    ): unknown[] {
      if (Array.isArray(node)) {
        return node.flatMap((child) => findElements(child, test));
      }
      if (!isValidElement(node)) {
        return [];
      }
      const props = node.props as Record<string, unknown>;
      return [
        ...(test(props) ? [node] : []),
        ...findElements(props.children as ReactNode, test),
      ];
    }

    it("tells the menu about a click on any of its links", () => {
      const onNavigate = vi.fn();
      const tree = NavList({
        items: [HOME, PROJECTS, HELP],
        label: "Main",
        onNavigate,
      });

      const wired = findElements(tree, (props) => props.onClick === onNavigate);

      expect(wired).toHaveLength(3);
    });

    it("has nothing to tell when no menu is listening", () => {
      const tree = NavList({ items: [HOME, PROJECTS], label: "Main" });

      expect(findElements(tree, (props) => props.onClick !== undefined)).toEqual([]);
    });
  });
});
