import type { ComponentProps } from "react";
import type { AppShellProps } from "@/shared/components/shell/app-shell";
import type { FeatureShell } from "@/shared/shell/contract";
import type { ShellView } from "@/shared/shell/view";
import { UsersIcon } from "lucide-react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { AppShell } from "@/shared/components/shell/app-shell";
import { ShellLogo } from "@/shared/components/shell/logo";
import { SettingsNav } from "@/shared/components/shell/settings-nav";
import {
  ShellProvider,
  useShell,
} from "@/shared/components/shell/shell-context";
import { ShellMenu } from "@/shared/components/shell/sidebar";
import { SkipLink } from "@/shared/components/shell/skip-link";
import { assembleShellView } from "@/shared/shell/assemble";
import { attribute, decodedClassesOf, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { shellLink, shellView, USER } from "../../helpers/shell";

// The locale-aware Link of next-intl is replaced: no Next router runs in a test. A plain anchor stands in for
// it, marked so that a test can tell it from the plain anchor of a link that
// leaves the app, and a variable stands in for the pathname.
const route = vi.hoisted(() => ({ pathname: "/projects" }));

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement: h } = await import("react");
  const mark = { "data-locale-link": "" };
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      h("a", { href, ...mark, ...props }),
    usePathname: () => route.pathname,
    useRouter: () => ({ refresh: () => {} }),
  };
});

beforeEach(() => {
  route.pathname = "/projects";
});

type Slots = Partial<Omit<AppShellProps, "children">>;

function render({
  locale = "en",
  ...slots
}: Slots & { locale?: "en" | "fr" } = {}): string {
  return renderWithIntl(
    <AppShell
      view={shellView()}
      workspaceSwitcher={<span data-fake="switcher">switcher</span>}
      accountMenu={<span data-fake="account">account</span>}
      notifications={<span data-fake="bell">bell</span>}
      sidebarActions={<span data-fake="action">action</span>}
      {...slots}
    >
      <h1>Page</h1>
    </AppShell>,
    locale,
  );
}

/** Every element of this name, from its start tag to its end tag (none of those asked for nests in itself). */
function elements(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?</${name}>`, "g")) ?? [];
}

/** What a piece of markup says, its tags left out. */
function textOf(markup: string): string {
  return markup.replaceAll(/<[^>]*>/g, "");
}

/** The first element of this name that carries this class, whole. */
function withClass(html: string, name: string, className: string): string {
  const found = elements(html, name).find((element) =>
    decodedClassesOf(startTags(element, name)[0] ?? "").includes(className),
  );
  expect(found, `a <${name}> with ${className}`).toBeDefined();
  return found ?? "";
}

/** The start tag of the first element of this name whose text is exactly `text`. */
function tagOfText(markup: string, name: string, text: string): string {
  const found = elements(markup, name).find((element) => textOf(element) === text);
  expect(found, `a <${name}> that reads "${text}"`).toBeDefined();
  return startTags(found ?? "", name)[0] ?? "";
}

/** The text of the links of a piece of markup that say `aria-current="page"`. */
function currentLinks(markup: string): string[] {
  return elements(markup, "a")
    .filter(
      (link) => attribute(startTags(link, "a")[0] ?? "", "aria-current") === "page",
    )
    .map(textOf);
}

const sidebarOf = (html: string) => elements(html, "aside")[0] ?? "";
const headerOf = (html: string) => elements(html, "header")[0] ?? "";
const tabBarOf = (html: string) => withClass(html, "nav", "xs:hidden");

/** Six pages in the main navigation: two more than a tab bar has room for. */
const SIX_PAGES = [
  shellLink("home", "/dashboard", "Home"),
  shellLink("projects", "/projects", "Projects"),
  shellLink("assistant", "/ai", "Assistant"),
  shellLink("reports", "/reports", "Reports"),
  shellLink("activity", "/activity", "Activity"),
  shellLink("people", "/people", "People"),
];

function withMain(main: ShellView["nav"]["main"]): ShellView {
  const view = shellView();
  return { ...view, nav: { ...view.nav, main } };
}

describe("app shell", () => {
  describe("the frame", () => {
    it("starts with a skip link to the main content", () => {
      const html = render();
      const [first] = startTags(html, "a");
      const [main] = startTags(html, "main");

      expect(attribute(first ?? "", "href")).toBe("#main-content");
      expect(textOf(elements(html, "a")[0] ?? "")).toBe("Skip to content");
      expect(attribute(main ?? "", "id")).toBe("main-content");
      expect(attribute(main ?? "", "tabindex")).toBe("-1");
    });

    it("marks the shell for its scroll padding", () => {
      const [root] = startTags(render(), "div");

      // Present, whatever its value: global.css selects on `[data-shell]`.
      expect(attribute(root ?? "", "data-shell")).toBeDefined();
    });

    it("keeps the page in a 1120 px column, with margins that grow with the screen", () => {
      const html = render();
      const main = elements(html, "main")[0] ?? "";
      const column = startTags(main, "div")[0] ?? "";

      expect(decodedClassesOf(column)).toEqual(
        expect.arrayContaining([
          "mx-auto",
          "w-full",
          "max-w-280",
          "px-4",
          "py-6",
          "xs:px-6",
          "xs:py-8",
          "lg:px-10",
          "lg:py-10",
        ]),
      );
      expect(textOf(main)).toBe("Page");
    });

    it("hands its view to the pages under it", () => {
      function Probe() {
        return <p>{useShell().productName}</p>;
      }
      const html = renderWithIntl(
        <AppShell
          view={shellView({ productName: "Orbit" })}
          workspaceSwitcher={null}
          accountMenu={null}
        >
          <Probe />
        </AppShell>,
      );

      expect(elements(html, "main")[0]).toContain("<p>Orbit</p>");
    });
  });

  describe("the sidebar", () => {
    it("draws the sidebar at 248 px from 1024 px", () => {
      const [aside] = startTags(render(), "aside");

      expect(decodedClassesOf(aside ?? "")).toEqual(
        expect.arrayContaining(["w-62", "hidden", "lg:flex"]),
      );
    });

    it("sticks to the height of the screen and scrolls inside", () => {
      const [aside] = startTags(render(), "aside");

      expect(decodedClassesOf(aside ?? "")).toEqual(
        expect.arrayContaining([
          "sticky",
          "top-0",
          "h-dvh",
          "overflow-y-auto",
          "bg-sidebar",
          "border-r",
          "border-sidebar-border",
        ]),
      );
    });

    it("stacks the logo and the bell, the workspace, the navigation, the actions and the account, in that order", () => {
      const view = shellView({
        nav: {
          ...shellView().nav,
          admin: [shellLink("users", "/admin/users", "Users")],
        },
      });
      const aside = sidebarOf(render({ view }));
      const at = (needle: string) => {
        const index = aside.indexOf(needle);
        expect(index, needle).toBeGreaterThanOrEqual(0);
        return index;
      };
      const order = [
        at(">Example</span>"),
        at('data-fake="bell"'),
        at('data-fake="switcher"'),
        at('aria-label="Main navigation"'),
        at('aria-label="Administration"'),
        at('aria-label="Secondary navigation"'),
        at('data-fake="action"'),
        at('data-fake="account"'),
      ];

      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it("draws the account under a hairline, at the foot", () => {
      const aside = sidebarOf(render());
      const foot = /<div class="([^"]*)"><span data-fake="account">/.exec(aside)?.[1];

      expect(decodedClassesOf(`<div class="${foot}">`)).toEqual(
        expect.arrayContaining(["border-t", "border-sidebar-border"]),
      );
    });

    it("draws the admin section for platform admins only", () => {
      // The assembly decides who sees the admin entries; the shell draws what it is given.
      const adminFeature: FeatureShell = {
        id: "admin",
        nav: [
          {
            id: "users",
            section: "admin",
            href: "/admin/users",
            labelKey: "admin.users",
            icon: UsersIcon,
            order: 10,
          },
        ],
      };
      const viewOf = (isPlatformAdmin: boolean) =>
        assembleShellView({
          snapshot: {
            user: { ...USER, isPlatformAdmin },
            workspace: { id: "org_1", name: "Studio Nord", role: "member" },
            workspaces: [],
          },
          features: [adminFeature],
          t: (key) => key,
          plans: new Map(),
          usage: new Map(),
          productName: "Example",
          helpUrl: null,
          renderIcon: (icon) => createElement(icon, { "aria-hidden": "true" }),
        });

      const asAdmin = sidebarOf(render({ view: viewOf(true) }));
      const asMember = sidebarOf(render({ view: viewOf(false) }));

      expect(textOf(asAdmin)).toContain("Administration");
      expect(asAdmin).toContain('href="/admin/users"');
      expect(textOf(asMember)).not.toContain("Administration");
      expect(asMember).not.toContain("/admin/users");
    });

    it("marks one link current across the whole menu: a main page under /settings beats Settings", () => {
      route.pathname = "/settings/team";
      const view = shellView({
        nav: {
          main: [
            shellLink("home", "/dashboard", "Home"),
            shellLink("team", "/settings/team", "Team"),
          ],
          // Settings stands for every page under /settings: on its own it would be current here too.
          secondary: shellView().nav.secondary,
          admin: [],
        },
      });
      const html = render({ view });

      expect(currentLinks(sidebarOf(html))).toEqual(["Team"]);
      // The tab bar names the same one: it is a tab.
      expect(currentLinks(tabBarOf(html))).toEqual(["Team"]);
    });

    it("marks one link current across the lists even when it is in the admin or the secondary one", () => {
      route.pathname = "/settings/team";
      const view = shellView({
        nav: {
          main: [shellLink("settings-home", "/settings", "Settings home")],
          secondary: [shellLink("team", "/settings/team", "Team")],
          admin: [],
        },
      });
      const html = render({ view });

      // The secondary link is the more specific: the main one is not marked, nor is any tab.
      expect(currentLinks(sidebarOf(html))).toEqual(["Team"]);
      expect(currentLinks(tabBarOf(html))).toEqual([]);
    });

    it("renders without a workspace", () => {
      const view = shellView({ workspace: null, workspaces: [] });
      const html = render({ view });
      const aside = sidebarOf(html);

      expect(aside).toContain('aria-label="Main navigation"');
      expect(aside).toContain('href="/dashboard"');
      expect(textOf(aside)).toContain("Home");
    });
  });

  describe("the menu of the drawer", () => {
    const menu = (props: Partial<ComponentProps<typeof ShellMenu>> = {}) =>
      renderWithIntl(
        <ShellMenu
          view={shellView()}
          workspaceSwitcher={<span data-fake="switcher">switcher</span>}
          accountMenu={<span data-fake="account">account</span>}
          currentId={null}
          {...props}
        />,
      );

    it("marks the link the shell names, and no other, whatever the route says", () => {
      route.pathname = "/projects";

      expect(currentLinks(menu({ currentId: "assistant" }))).toEqual(["Assistant"]);
    });

    it("marks nothing when the shell names no link, even on the page of one", () => {
      route.pathname = "/projects";

      expect(currentLinks(menu({ currentId: null }))).toEqual([]);
    });

    it("lists every page of the main navigation: the drawer is where the pages behind More are", () => {
      const html = menu({ view: withMain(SIX_PAGES) });
      const main = elements(html, "nav").find((nav) =>
        nav.includes('aria-label="Main navigation"'),
      );

      expect(elements(main ?? "", "a").map(textOf)).toEqual([
        "Home",
        "Projects",
        "Assistant",
        "Reports",
        "Activity",
        "People",
      ]);
    });
  });

  describe("the header", () => {
    it("shows Menu between 480 and 1024 px only", () => {
      const html = render();
      const header = headerOf(html);
      const menu = decodedClassesOf(tagOfText(header, "button", "Menu"));

      // Only the header is there below 1024 px, and Menu only from 480 px.
      expect(decodedClassesOf(startTags(header, "header")[0] ?? "")).toContain(
        "lg:hidden",
      );
      expect(menu).toEqual(expect.arrayContaining(["hidden", "xs:inline-flex"]));
      // `inline-flex` beside `hidden` would show it below 480 px as well.
      expect(menu).not.toContain("inline-flex");
    });

    it("sticks to the top, under the page's own controls", () => {
      const header = startTags(headerOf(render()), "header")[0] ?? "";

      expect(decodedClassesOf(header)).toEqual(
        expect.arrayContaining([
          "sticky",
          "top-0",
          "z-30",
          "h-14",
          "bg-sidebar",
          "border-b",
          "border-sidebar-border",
        ]),
      );
    });

    it("opens a dialog with Menu", () => {
      const menu = tagOfText(headerOf(render()), "button", "Menu");

      expect(attribute(menu, "aria-haspopup")).toBe("dialog");
      expect(attribute(menu, "aria-expanded")).toBe("false");
      expect(attribute(menu, "type")).toBe("button");
    });

    it("keeps the logo and the bell where Menu is hidden", () => {
      const header = headerOf(render());

      expect(textOf(header)).toContain("Example");
      expect(header).toContain('href="/dashboard"');
      expect(header).toContain('data-fake="bell"');
      // The logo comes before the bell.
      expect(header.indexOf("Example")).toBeLessThan(
        header.indexOf('data-fake="bell"'),
      );
    });
  });

  describe("the tab bar", () => {
    it("keeps at most five tabs, More included", () => {
      const bar = tabBarOf(render({ view: withMain(SIX_PAGES) }));
      const links = startTags(bar, "a");
      const buttons = startTags(bar, "button");

      expect(links.map((tag) => attribute(tag, "href"))).toEqual([
        "/dashboard",
        "/projects",
        "/ai",
        "/reports",
      ]);
      expect(buttons).toHaveLength(1);
      expect(attribute(buttons[0] ?? "", "aria-haspopup")).toBe("dialog");
      expect(textOf(elements(bar, "button")[0] ?? "")).toBe("More");
    });

    it("cuts long tab labels", () => {
      const long = "A label too long for a fifth of a phone";
      const bar = tabBarOf(
        render({
          view: withMain([
            shellLink("home", "/dashboard", "Home"),
            shellLink("long", "/long", long),
          ]),
        }),
      );

      for (const label of ["Home", long, "More"]) {
        expect(decodedClassesOf(tagOfText(bar, "span", label)), label).toContain(
          "truncate",
        );
      }
    });

    it("marks the tab of the current page, and only that one", () => {
      const bar = tabBarOf(render());
      const current = elements(bar, "a")
        .filter((link) => attribute(startTags(link, "a")[0] ?? "", "aria-current") === "page")
        .map(textOf);

      expect(current).toEqual(["Projects"]);
    });

    it("marks no tab when the current page is behind More", () => {
      route.pathname = "/people";
      const bar = tabBarOf(render({ view: withMain(SIX_PAGES) }));

      expect(bar).not.toContain("aria-current");
    });

    it("marks no tab when the current page is behind More, even under the path of a tab", () => {
      route.pathname = "/projects/archive";
      const bar = tabBarOf(
        render({
          view: withMain([
            shellLink("home", "/dashboard", "Home"),
            shellLink("projects", "/projects", "Projects"),
            shellLink("assistant", "/ai", "Assistant"),
            shellLink("reports", "/reports", "Reports"),
            // The fifth page: it has no tab, and it is more specific than Projects.
            shellLink("archive", "/projects/archive", "Archive"),
          ]),
        }),
      );

      expect(bar).not.toContain("aria-current");
    });

    it("says what More opens, without claiming to be open", () => {
      const more = tagOfText(
        tabBarOf(render()),
        "button",
        "More",
      );

      expect(attribute(more, "aria-haspopup")).toBe("dialog");
      expect(attribute(more, "aria-expanded")).toBe("false");
      expect(attribute(more, "type")).toBe("button");
    });

    it("sits at the bottom, over a hairline and above the safe area, from 0 to 480 px", () => {
      const nav = startTags(tabBarOf(render()), "nav")[0] ?? "";

      expect(decodedClassesOf(nav)).toEqual(
        expect.arrayContaining([
          "sticky",
          "bottom-0",
          "z-30",
          "grid",
          "xs:hidden",
          "border-t",
          "border-sidebar-border",
          "bg-sidebar",
          "pb-[calc(0.5rem+env(safe-area-inset-bottom))]",
        ]),
      );
      expect(attribute(nav, "aria-label")).toBe("Main navigation");
    });

    it("has five columns when it is full, and shares the width among fewer tabs", () => {
      const columns = (main: ShellView["nav"]["main"]) =>
        decodedClassesOf(startTags(tabBarOf(render({ view: withMain(main) })), "nav")[0] ?? "").filter(
          (name) => name.startsWith("grid-cols-"),
        );

      expect(columns(SIX_PAGES)).toEqual(["grid-cols-5"]);
      expect(columns(SIX_PAGES.slice(0, 3))).toEqual(["grid-cols-4"]);
      expect(columns(SIX_PAGES.slice(0, 1))).toEqual(["grid-cols-2"]);
      expect(columns([])).toEqual(["grid-cols-1"]);
    });

    it("draws the icon of a tab at 22 px, and a 2 px mark over the current one", () => {
      const bar = tabBarOf(render());
      const current = elements(bar, "a").find(
        (link) => attribute(startTags(link, "a")[0] ?? "", "aria-current") === "page",
      );
      const classes = decodedClassesOf(startTags(current ?? "", "a")[0] ?? "");

      expect(classes).toEqual(
        expect.arrayContaining([
          "[&_svg]:size-5.5",
          "text-caption",
          "aria-[current=page]:before:h-0.5",
          "aria-[current=page]:text-ink",
        ]),
      );
    });
  });

  describe("a tab that leaves the app", () => {
    it("tells assistive technology that a web address opens a new tab", () => {
      const bar = tabBarOf(
        render({
          view: withMain([
            shellLink("home", "/dashboard", "Home"),
            shellLink("docs", "https://example.com/docs", "Docs"),
          ]),
        }),
      );
      const [home, docs] = elements(bar, "a");

      expect(docs).toContain('<span class="sr-only">(opens in a new tab)</span>');
      expect(attribute(startTags(docs ?? "", "a")[0] ?? "", "target")).toBe("_blank");
      expect(home).not.toContain("sr-only");
    });
  });

  describe("the tab bar in forced-colors mode", () => {
    it("keeps the mark of the current tab: a background that is not a system color is dropped there", () => {
      const bar = tabBarOf(render());
      const tab = decodedClassesOf(startTags(bar, "a")[0] ?? "");

      expect(tab).toContain(
        "forced-colors:aria-[current=page]:before:bg-[color:Highlight]",
      );
    });
  });

  describe("the slots", () => {
    it("draws the bell in the sidebar and in the header, and the other slots once", () => {
      const html = render();
      const count = (needle: string) => html.split(needle).length - 1;

      expect(count('data-fake="bell"')).toBe(2);
      expect(count('data-fake="switcher"')).toBe(1);
      expect(count('data-fake="account"')).toBe(1);
      expect(count('data-fake="action"')).toBe(1);
    });

    it("draws no bell and no action when no feature gives one", () => {
      const html = render({ notifications: undefined, sidebarActions: undefined });

      expect(html).not.toContain('data-fake="bell"');
      expect(html).not.toContain('data-fake="action"');
      expect(sidebarOf(html)).toContain('aria-label="Secondary navigation"');
    });
  });

  describe("in French", () => {
    it("speaks the language of the page", () => {
      const html = render({ locale: "fr" });

      expect(textOf(elements(html, "a")[0] ?? "")).toBe("Aller au contenu");
      expect(textOf(elements(headerOf(html), "button")[0] ?? "")).toBe("Menu");
      expect(textOf(elements(tabBarOf(html), "button")[0] ?? "")).toBe("Plus");
      expect(sidebarOf(html)).toContain('aria-label="Navigation principale"');
      expect(sidebarOf(html)).toContain('aria-label="Navigation secondaire"');
    });
  });
});

describe("the logo", () => {
  it("is a link home, named after the product", () => {
    const html = renderWithIntl(<ShellLogo productName="Orbit" />);
    const [link] = startTags(html, "a");

    expect(attribute(link ?? "", "href")).toBe("/dashboard");
    expect(textOf(html)).toBe("Orbit");
    // The mark is a picture: the name next to it is what says who it is.
    expect(html).toContain('aria-hidden="true"');
  });

  it("goes where it is told", () => {
    const html = renderWithIntl(<ShellLogo productName="Orbit" href="/" />);

    expect(attribute(startTags(html, "a")[0] ?? "", "href")).toBe("/");
  });

  it("is no link when it has nowhere to go", () => {
    const html = renderWithIntl(<ShellLogo productName="Orbit" href={null} />);

    expect(startTags(html, "a")).toEqual([]);
    expect(textOf(html)).toBe("Orbit");
  });

  it("cuts a long product name", () => {
    const html = renderWithIntl(
      <ShellLogo productName="A product name that goes on and on" />,
    );

    expect(
      decodedClassesOf(tagOfText(html, "span", "A product name that goes on and on")),
    ).toContain("truncate");
  });
});

describe("the skip link", () => {
  it("points at the main content, and reads in the language of the page", () => {
    expect(renderWithIntl(<SkipLink />)).toContain('href="#main-content"');
    expect(textOf(renderWithIntl(<SkipLink />, "fr"))).toBe(
      fr.shell.skipToContent,
    );
    expect(textOf(renderWithIntl(<SkipLink />))).toBe(en.shell.skipToContent);
  });

  it("points at another target when it is told to", () => {
    expect(renderWithIntl(<SkipLink targetId="page" />)).toContain(
      'href="#page"',
    );
  });

  it("keeps the focus ring of the project: it has no shadow of its own to take its place", () => {
    const classes = decodedClassesOf(
      startTags(renderWithIntl(<SkipLink />), "a")[0] ?? "",
    );

    expect(classes).toContain("focus-visible:focus-ring");
    // A shadow utility is in a later layer than the ring every link gets, and would replace it.
    expect(classes.filter((name) => /(?:^|:)shadow/.test(name))).toEqual([]);
  });

  it("stays out of sight until it has the focus, then shows over the sticky bars", () => {
    const classes = decodedClassesOf(startTags(renderWithIntl(<SkipLink />), "a")[0] ?? "");

    expect(classes).toEqual(
      expect.arrayContaining(["absolute", "-top-24", "focus:top-4", "z-40", "min-h-11"]),
    );
  });
});

describe("the settings navigation", () => {
  it("links the settings pages of the view, as tabs", () => {
    route.pathname = "/settings/team";
    const html = renderWithIntl(
      <ShellProvider view={shellView()}>
        <SettingsNav />
      </ShellProvider>,
    );
    const nav = startTags(html, "nav")[0] ?? "";
    const links = elements(html, "a");

    expect(attribute(nav, "aria-label")).toBe("Settings");
    expect(links.map(textOf)).toEqual(["Account", "Team"]);
    expect(
      links.map((link) => attribute(startTags(link, "a")[0] ?? "", "aria-current")),
    ).toEqual([undefined, "page"]);
  });

  it("is named in the language of the page", () => {
    const html = renderWithIntl(
      <ShellProvider view={shellView()}>
        <SettingsNav />
      </ShellProvider>,
      "fr",
    );

    expect(attribute(startTags(html, "nav")[0] ?? "", "aria-label")).toBe(
      fr.settings.navLabel,
    );
  });

  it("draws nothing when no feature gives a settings page", () => {
    const html = renderWithIntl(
      <ShellProvider view={shellView({ settings: [] })}>
        <SettingsNav />
      </ShellProvider>,
    );

    expect(html).toBe("");
  });
});

describe("the shell context", () => {
  it("fails with a clear message outside the shell", () => {
    function Probe() {
      useShell();
      return null;
    }

    expect(() => renderWithIntl(<Probe />)).toThrow(/inside the app shell/);
  });
});
