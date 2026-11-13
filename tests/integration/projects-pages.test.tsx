import type { ComponentProps } from "react";
import type { ShellRole } from "@/shared/shell/contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage, { generateMetadata as listMetadata } from "@/app/[locale]/(app)/(shell)/projects/(list)/page";
import ProjectLayout from "@/app/[locale]/(app)/(shell)/projects/[projectId]/layout";
import ProjectOverviewPage, {
  generateMetadata as overviewMetadata,
} from "@/app/[locale]/(app)/(shell)/projects/[projectId]/page";
import ProjectSettingsPage, {
  generateMetadata as settingsMetadata,
} from "@/app/[locale]/(app)/(shell)/projects/[projectId]/settings/page";
import { appPageMetadata } from "@/features/app-shell";
import { RecentProjects } from "@/features/projects/components/recent-projects";
import { project } from "@/models/project";
import { attribute, decodedClassesOf, elements, startTags, tagSaying, textOf } from "../helpers/html";
import { renderWithIntl } from "../helpers/intl";
import { seedOrg, seedProject, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

// What the pages reach for outside themselves, replaced: the workspace of the
// person (the page takes it from the session), the way Next.js ends a render at
// a 404 or a redirect (by throwing), the titles the shell gives a tab, the
// translator of the server (built from the message files, so the words are the
// real ones) and the navigation of next-intl (no Next router runs in a test).
// The projects themselves are read from the in-memory database.
const session = vi.hoisted(() => ({ requireWorkspace: vi.fn() }));
const route = vi.hoisted(() => ({ pathname: "/projects" }));
const intl = vi.hoisted(() => ({ locale: "en" as "en" | "fr" }));

vi.mock("@/features/auth/organization/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/organization/workspace")>()),
  requireWorkspace: session.requireWorkspace,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  },
}));

vi.mock("@/features/app-shell", async () => {
  // The title the shell gives a tab, by its own rule: the page, then the context
  // (the workspace, Acme here, unless the page gives one), then the product.
  const { APP_NAME } = await import("@/shared/config/app");
  const { formatPageTitle } = await import("@/shared/shell/resolve");

  return {
    appPageMetadata: vi.fn(async (page: string, options?: { context?: string }) => ({
      title: { absolute: formatPageTitle({ page, context: options?.context ?? "Acme", product: APP_NAME }) },
    })),
  };
});

vi.mock("next-intl/server", async () => {
  const { createFormatter, createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");
  const messages = { en, fr };
  type Locale = keyof typeof messages;
  // The pages ask for the words of the projects, and for nothing else
  type Options = "projects" | { locale?: string; namespace?: "projects" };

  const localeOf = (options?: Options): Locale => {
    const asked = typeof options === "object" ? options.locale : undefined;
    return asked === "fr" || asked === "en" ? asked : intl.locale;
  };

  return {
    getTranslations: async (options?: Options) =>
      createTranslator({
        locale: localeOf(options),
        messages: messages[localeOf(options)],
        namespace: typeof options === "string" ? options : options?.namespace,
      }),
    getFormatter: async (options?: Options) => createFormatter({ locale: localeOf(options), timeZone: "UTC" }),
  };
});

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    useRouter: () => ({ push: () => {}, refresh: () => {} }),
    usePathname: () => route.pathname,
  };
});

const USER = "test-user-1";
const ORG = "pages-org";
const OTHER_ORG = "pages-other-org";

function signIn(role: ShellRole = "owner") {
  const workspace = { id: ORG, name: "Acme", slug: "acme", role };
  session.requireWorkspace.mockResolvedValue({
    user: { id: USER, name: "Test User", email: "test@test.com", image: null, isPlatformAdmin: false },
    workspace,
    workspaces: [workspace],
  });
}

const params = (projectId = "p1", locale: "en" | "fr" = "en") => Promise.resolve({ locale, projectId });

beforeEach(async () => {
  vi.mocked(appPageMetadata).mockClear();
  route.pathname = "/projects";
  intl.locale = "en";
  signIn();
  await testDb.delete(project);
  await seedUser(USER);
  await seedOrg(ORG);
  await seedOrg(OTHER_ORG);
  await seedProject(ORG, {
    id: "p1",
    name: "Atlas",
    description: "The first one",
    status: "active",
    createdBy: USER,
    createdAt: new Date("2026-10-01T09:00:00.000Z"),
    updatedAt: new Date("2026-11-03T10:00:00.000Z"),
  });
  await seedProject(OTHER_ORG, { id: "foreign", name: "Elsewhere" });
});

describe("the list of projects", () => {
  const page = async (locale: "en" | "fr" = "en", pageParam?: string) =>
    renderWithIntl(
      await ProjectsPage({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve(pageParam === undefined ? {} : { page: pageParam }),
      }),
      locale,
    );

  it("heads the page with a folder, the title and how many projects the workspace has", async () => {
    await seedProject(ORG, { id: "p2", name: "Borealis" });
    const html = await page();

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Projects");
    expect(textOf(html)).toContain("2 projects");
    expect(startTags(html, "h1")).toHaveLength(1);
    expect(html).toContain('data-slot="icon-tile"');
  });

  it("shows the projects of this workspace as cards, and none of another", async () => {
    await seedProject(ORG, { id: "p2", name: "Borealis", updatedAt: new Date("2026-11-03T11:00:00.000Z") });
    const html = await page();

    // Last updated first, and the project of the other workspace is not here
    expect(startTags(html, "a").map((tag) => attribute(tag, "href"))).toEqual(["/projects/p2", "/projects/p1"]);
    expect(textOf(html)).not.toContain("Elsewhere");
  });

  it("offers one New project button, in the header, once there are projects: no empty state", async () => {
    const html = await page();

    expect(elements(html, "button").map(textOf)).toEqual(["New project"]);
    expect(html).toContain('data-slot="page-header-actions"');
    expect(html).not.toContain('data-slot="empty-state"');
  });

  it("offers one New project button, in the empty state, while there is none: the header has none", async () => {
    await testDb.delete(project);
    const html = await page();

    expect(textOf(html)).toContain("0 projects");
    expect(elements(html, "button").map(textOf)).toEqual(["New project"]);
    expect(html).toContain('data-slot="empty-state"');
    expect(html).not.toContain('data-slot="page-header-actions"');
    expect(html).not.toContain('role="list"');
  });

  // The list is bounded: twelve cards a page, with links to the pages round it, as the waiting list of the admin has
  describe("when there are more projects than a page holds", () => {
    /** `count` more projects, changed one minute apart after Atlas: `m-00` is the newest, and the list has `count + 1`. */
    async function seedMore(count: number) {
      const start = Date.UTC(2026, 10, 3, 12, 0, 0);
      for (let index = 0; index < count; index += 1) {
        const id = `m-${String(index).padStart(2, "0")}`;
        await seedProject(ORG, { id, name: `Project ${id}`, updatedAt: new Date(start + (count - index) * 60_000) });
      }
    }

    const cardsOf = (html: string) => startTags(html, "a").map((tag) => attribute(tag, "href")).filter((href) => /^\/projects\/[^?]/.test(href ?? ""));
    const pagerOf = (html: string) =>
      elements(html, "a")
        .filter((link) => /Previous page|Next page|Page précédente|Page suivante/.test(textOf(link)))
        .map((link) => [textOf(link), attribute(startTags(link, "a")[0] ?? "", "href")]);
    const newest = (from: number, count: number) => Array.from({ length: count }, (_, index) => `/projects/m-${String(from + index).padStart(2, "0")}`);

    it("draws the first twelve, says how many there are in all, and links to the next page", async () => {
      await seedMore(24);
      const html = await page();

      expect(cardsOf(html)).toEqual(newest(0, 12));
      // The header counts the projects of the workspace, not those of the page
      expect(textOf(html)).toContain("25 projects");
      expect(textOf(html)).toContain("Page 1 of 3");
      expect(pagerOf(html)).toEqual([["Next page", "/projects?page=2"]]);
    });

    it("draws the page the address asks for, with a link to the page before and to the one after", async () => {
      await seedMore(24);
      const html = await page("en", "2");

      expect(cardsOf(html)).toEqual(newest(12, 12));
      expect(textOf(html)).toContain("Page 2 of 3");
      // The first page has no page in its address
      expect(pagerOf(html)).toEqual([
        ["Previous page", "/projects"],
        ["Next page", "/projects?page=3"],
      ]);
    });

    it("draws what is left on the last page, with a link back only", async () => {
      await seedMore(24);
      const html = await page("en", "3");

      expect(cardsOf(html)).toEqual(["/projects/p1"]);
      expect(textOf(html)).toContain("Page 3 of 3");
      expect(pagerOf(html)).toEqual([["Previous page", "/projects?page=2"]]);
    });

    it("draws the last page for a page past it, and not an empty page that says Page 99 of 3", async () => {
      await seedMore(24);
      const html = await page("en", "99");

      expect(cardsOf(html)).toEqual(["/projects/p1"]);
      expect(textOf(html)).toContain("Page 3 of 3");
      expect(textOf(html)).not.toContain("Page 99");
      expect(html).not.toContain('data-slot="empty-state"');
    });

    it.each(["abc", "0", "-3", "1.5x", "", "9".repeat(30)])("draws the first page for the address ?page=%s", async (garbage) => {
      await seedMore(24);
      const html = await page("en", garbage);

      expect(cardsOf(html)).toEqual(newest(0, 12));
      expect(textOf(html)).toContain("Page 1 of 3");
    });

    it("draws no pager for twelve projects, and one for thirteen", async () => {
      await seedMore(11);
      expect(textOf(await page())).not.toContain("Page 1 of");
      expect(pagerOf(await page())).toEqual([]);

      await seedProject(ORG, { id: "thirteenth", name: "Thirteenth" });
      const html = await page();
      expect(textOf(html)).toContain("Page 1 of 2");
      expect(pagerOf(html)).toEqual([["Next page", "/projects?page=2"]]);
    });

    it("speaks French", async () => {
      await seedMore(24);
      const html = await page("fr", "2");

      expect(textOf(html)).toContain("Page 2 sur 3");
      expect(pagerOf(html)).toEqual([
        ["Page précédente", "/projects"],
        ["Page suivante", "/projects?page=3"],
      ]);
    });

    it("keeps the button that creates a project in the header, whatever the page", async () => {
      await seedMore(24);

      expect(elements(await page("en", "3"), "button").map(textOf)).toEqual(["New project"]);
    });
  });

  it("speaks French, with the plural of French", async () => {
    const html = await page("fr");

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Projets");
    expect(textOf(html)).toContain("1 projet");
    expect(textOf(html)).not.toContain("1 projets");
    expect(elements(html, "button").map(textOf)).toEqual(["Nouveau projet"]);
  });

  it("gives the tab its title through the shell, in the language of the page", async () => {
    const english = await listMetadata({ params: Promise.resolve({ locale: "en" }) });
    const french = await listMetadata({ params: Promise.resolve({ locale: "fr" }) });

    expect(english.title).toEqual({ absolute: "Projects · Acme — SaaS Boilerplate" });
    expect(french.title).toEqual({ absolute: "Projets · Acme — SaaS Boilerplate" });
  });
});

describe("the layout of a project", () => {
  const layout = async (projectId = "p1", locale: "en" | "fr" = "en") =>
    renderWithIntl(await ProjectLayout({ children: <p>the page</p>, params: params(projectId, locale) }), locale);

  it("heads the project with the trail from the list, its name, its description and its status", async () => {
    const html = await layout();
    const [trail = ""] = elements(html, "nav");
    const [crumbs = ""] = elements(html, "ol");

    expect(attribute(startTags(trail, "nav")[0] ?? "", "aria-label")).toBe("Breadcrumb");
    // The list is a link; the project, the page we are on, is not
    expect(startTags(crumbs, "a").map((tag) => attribute(tag, "href"))).toEqual(["/projects"]);
    expect(textOf(crumbs)).toBe("ProjectsAtlas");
    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Atlas");
    expect(startTags(html, "h1")).toHaveLength(1);
    expect(textOf(html)).toContain("The first one");
    // The meta of the header is the status
    expect(textOf(/data-slot="entity-header-meta"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "")).toBe("Active");
  });

  it("leaves out the description a project has not got", async () => {
    await testDb.update(project).set({ description: null });

    expect(await layout()).not.toContain('data-slot="entity-header-description"');
  });

  it("has two tabs, Overview on the project itself and Settings under it, named for the project", async () => {
    route.pathname = "/projects/p1";
    const html = await layout();
    const [tabs = ""] = elements(html, "nav").filter((nav) => nav.includes('data-slot="tab-links"'));
    const links = startTags(tabs, "a");

    expect(attribute(startTags(tabs, "nav")[0] ?? "", "aria-label")).toBe("Project");
    expect(links.map((tag) => attribute(tag, "href"))).toEqual(["/projects/p1", "/projects/p1/settings"]);
    expect(elements(tabs, "a").map(textOf)).toEqual(["Overview", "Settings"]);
    // Overview is the current tab on its own page only (`exact`)
    expect(attribute(links[0] ?? "", "aria-current")).toBe("page");
    expect(attribute(links[1] ?? "", "aria-current")).toBeUndefined();
  });

  it("moves the current mark to Settings on the settings page", async () => {
    route.pathname = "/projects/p1/settings";
    const html = await layout();
    const [tabs = ""] = elements(html, "nav").filter((nav) => nav.includes('data-slot="tab-links"'));
    const links = startTags(tabs, "a");

    expect(attribute(links[0] ?? "", "aria-current")).toBeUndefined();
    expect(attribute(links[1] ?? "", "aria-current")).toBe("page");
  });

  it("draws the page under the header", async () => {
    const html = await layout();

    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("<p>the page</p>"));
  });

  it("is a 404 for a project that does not exist, and for one of another workspace", async () => {
    await expect(layout("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(layout("foreign")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("speaks French", async () => {
    route.pathname = "/projects/p1";
    const html = await layout("p1", "fr");

    expect(textOf(html)).toContain("Projets");
    expect(textOf(html)).toContain("Actif");
    expect(elements(html, "a").map(textOf)).toEqual(expect.arrayContaining(["Vue d'ensemble", "Réglages"]));
    expect(attribute(startTags(html, "nav").find((tag) => tag.includes("Projet")) ?? "", "aria-label")).toBe("Projet");
  });
});

describe("the overview of a project", () => {
  const overview = async (projectId = "p1", locale: "en" | "fr" = "en") =>
    renderWithIntl(await ProjectOverviewPage({ params: params(projectId, locale) }), locale);

  it("lists the details in a card whose title is a second-level heading", async () => {
    const html = await overview();
    const [title = ""] = elements(html, "h2");
    const rows = elements(html, "li");

    expect(textOf(title)).toBe("Details");
    expect(tagSaying(html, "h2", "Details")).toContain('data-slot="card-title"');
    // Who, then when: days, with no time of day (no time zone is configured, so the hour would be the server's)
    expect(rows.map(textOf)).toEqual(["Created byTest User", "CreatedOct 1, 2026", "ModifiedNov 3, 2026"]);
    expect(textOf(html)).not.toMatch(/\d:\d\d/);
  });

  it("says the status once: in the header, with no row of the details for it", async () => {
    // The page as the app draws it: the layout, then the overview under its header
    const html = renderWithIntl(
      await ProjectLayout({ children: await ProjectOverviewPage({ params: params() }), params: params() }),
    );
    const rows = elements(html, "li").filter((row) => row.includes('data-slot="list-row"'));

    expect(html.match(/data-slot="status-dot"/g)).toHaveLength(1);
    expect(textOf(/data-slot="entity-header-meta"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "")).toBe("Active");
    expect(rows.map(textOf)).toEqual(["Created byTest User", "CreatedOct 1, 2026", "ModifiedNov 3, 2026"]);
  });

  it("gives the dates in a time element, whole, for machines", async () => {
    const html = await overview();

    expect(startTags(html, "time").map((tag) => attribute(tag, "dateTime"))).toEqual([
      "2026-10-01T09:00:00.000Z",
      "2026-11-03T10:00:00.000Z",
    ]);
  });

  it("says so when the person who created the project is gone", async () => {
    await testDb.update(project).set({ createdBy: null });
    const html = await overview();

    expect(elements(html, "li").map(textOf)).toContain("Created byUnknown");
  });

  it("makes room for what the project holds: a state with a second-level heading and no button", async () => {
    const html = await overview();
    const [state = ""] = html.match(/<div[^>]*data-slot="empty-state"[\s\S]*$/) ?? [];

    expect(elements(html, "h2").map(textOf)).toEqual(["Details", "Nothing here yet"]);
    expect(state).not.toBe("");
    expect(startTags(html, "button")).toHaveLength(0);
  });

  it("is a 404 for a project of another workspace", async () => {
    await expect(overview("foreign")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("titles the first tab with the name of the project alone", async () => {
    const metadata = await overviewMetadata({ params: params() });

    expect(vi.mocked(appPageMetadata)).toHaveBeenCalledExactlyOnceWith("Atlas");
    expect(metadata.title).toEqual({ absolute: "Atlas · Acme — SaaS Boilerplate" });
    await expect(overviewMetadata({ params: params("foreign") })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("speaks French", async () => {
    const html = await overview("p1", "fr");

    expect(elements(html, "li").map(textOf)).toEqual(["Créé parTest User", "Créé le1 oct. 2026", "Modifié le3 nov. 2026"]);
  });
});

describe("the settings of a project", () => {
  const settings = async (projectId = "p1", locale: "en" | "fr" = "en") =>
    renderWithIntl(await ProjectSettingsPage({ params: params(projectId, locale) }), locale);

  it("puts the form of the project in a General card, with what it holds now", async () => {
    const html = await settings();

    expect(textOf(elements(html, "h2")[0] ?? "")).toBe("General");
    expect(attribute(startTags(html, "input")[0] ?? "", "value")).toBe("Atlas");
    expect(html).toContain(">The first one</textarea>");
    expect(textOf(elements(html, "button").find((button) => button.includes('aria-pressed="true"')) ?? "")).toBe("Active");
  });

  it.each(["owner", "admin"] as const)("offers the zone that deletes the project to the %s of the workspace", async (role) => {
    signIn(role);
    const html = await settings();

    expect(textOf(html)).toContain("it can't be undone.");
    expect(elements(html, "button").map(textOf)).toContain("Delete project");
    expect(decodedClassesOf(startTags(html, "div").find((tag) => tag.includes("bg-danger-bg")) ?? "")).toContain("border-danger");
  });

  it("hides that zone from a member, who may edit the project but not delete it", async () => {
    signIn("member");
    const html = await settings();

    expect(textOf(html)).not.toContain("it can't be undone.");
    expect(elements(html, "button").map(textOf)).not.toContain("Delete project");
    // The form is still there
    expect(elements(html, "button").map(textOf)).toContain("Save");
  });

  it("is a 404 for a project of another workspace", async () => {
    await expect(settings("foreign")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("titles the tab by what it is, under the project: Settings · Atlas", async () => {
    const metadata = await settingsMetadata({ params: params() });

    // The tab is the page and the project is the context, where the workspace would be
    expect(vi.mocked(appPageMetadata)).toHaveBeenCalledExactlyOnceWith("Settings", { context: "Atlas" });
    expect(metadata.title).toEqual({ absolute: "Settings · Atlas — SaaS Boilerplate" });
  });

  it("titles the tab in the language of the page, with the name of the tab as the tabs are labelled", async () => {
    const metadata = await settingsMetadata({ params: params("p1", "fr") });

    expect(metadata.title).toEqual({ absolute: "Réglages · Atlas — SaaS Boilerplate" });
    await expect(settingsMetadata({ params: params("foreign") })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("tells the two tabs of a project apart in the browser", async () => {
    const overview = await overviewMetadata({ params: params() });
    const settingsTab = await settingsMetadata({ params: params() });

    expect(overview.title).not.toEqual(settingsTab.title);
  });

  it("speaks French", async () => {
    const html = await settings("p1", "fr");

    expect(textOf(elements(html, "h2")[0] ?? "")).toBe("Général");
    expect(elements(html, "button").map(textOf)).toEqual(expect.arrayContaining(["Enregistrer", "Supprimer le projet"]));
  });
});

describe("the recent projects of the home", () => {
  const recent = async (locale: "en" | "fr" = "en") => {
    intl.locale = locale;
    return renderWithIntl(await RecentProjects({ scope: { orgId: ORG, userId: USER, role: "member" } }), locale);
  };

  it("lists the three latest projects of the workspace, newest first, under a second-level heading", async () => {
    await seedProject(ORG, { id: "p2", name: "Borealis", updatedAt: new Date("2026-11-01T10:00:00.000Z") });
    await seedProject(ORG, { id: "p3", name: "Cirrus", updatedAt: new Date("2026-11-02T10:00:00.000Z") });
    await seedProject(ORG, { id: "p4", name: "Drizzle", updatedAt: new Date("2026-10-01T10:00:00.000Z") });
    const html = await recent();

    expect(textOf(elements(html, "h2")[0] ?? "")).toBe("Recent projects");
    // The three latest: Atlas (Nov 3), Cirrus (Nov 2), Borealis (Nov 1); and none of the other workspace
    expect(startTags(html, "a").map((tag) => attribute(tag, "href"))).toEqual([
      "/projects",
      "/projects/p1",
      "/projects/p3",
      "/projects/p2",
    ]);
    expect(textOf(html)).not.toContain("Elsewhere");
  });

  it("lays its cards out by the width of its own block, not of the window: two from 448 px, three from 672 px", async () => {
    const html = await recent();
    const [section = ""] = startTags(html, "section");
    const [list = ""] = startTags(html, "ul");

    // The block is a container, so that the same cards have two columns beside the first steps (the two thirds of the page) and three on the full width
    expect(decodedClassesOf(section)).toContain("@container");
    expect(decodedClassesOf(list)).toEqual(
      expect.arrayContaining(["grid", "grid-cols-1", "@md:grid-cols-2", "@2xl:grid-cols-3"]),
    );
    // None of the window's own breakpoints: they would answer to a width that is not the block's
    expect(decodedClassesOf(list).filter((name) => /^(?:sm|md|lg|xl|2xl):grid-cols/.test(name))).toEqual([]);
  });

  it("links to all the projects, in words that say where it goes", async () => {
    const html = await recent();
    const [link = ""] = elements(html, "a");

    expect(attribute(startTags(link, "a")[0] ?? "", "href")).toBe("/projects");
    expect(textOf(link)).toBe("View all projects");
    // Alone on its line: a target of 44 px
    expect(decodedClassesOf(startTags(link, "a")[0] ?? "")).toContain("tap-target");
  });

  it("says so when the workspace has no project yet", async () => {
    await testDb.delete(project);
    const html = await recent();

    expect(textOf(html)).toContain("Projects you create will show up here.");
    expect(html).not.toContain('role="list"');
  });

  it("speaks French", async () => {
    const html = await recent("fr");

    expect(textOf(elements(html, "h2")[0] ?? "")).toBe("Projets récents");
    expect(textOf(elements(html, "a")[0] ?? "")).toBe("Voir tous les projets");
  });
});
