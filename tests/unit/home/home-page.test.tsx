import type { ComponentProps, ReactElement, ReactNode } from "react";
import type { HomeView } from "@/features/app-shell";
import type { ShellRole, WorkspaceScope } from "@/shared/shell/contract";
import type { HomeTask, ShellQuota } from "@/shared/shell/view";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage, {
  generateMetadata,
} from "@/app/[locale]/(app)/(shell)/dashboard/page";
import { getHome, getShell } from "@/features/app-shell";
import { SectionBoundary } from "@/features/dashboard/components/section-boundary";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// What the page reaches for outside itself, replaced: the workspace of the
// person (taken from the session), what the shell reads for the home, the titles
// the shell gives a tab, the translator of the server (built from the message
// files, so the words are the real ones) and the navigation of next-intl (no Next router runs in a test).
const session = vi.hoisted(() => ({ requireWorkspace: vi.fn() }));
const intl = vi.hoisted(() => ({ locale: "en" as "en" | "fr" }));

vi.mock("@/features/auth/organization/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/organization/workspace")>()),
  requireWorkspace: session.requireWorkspace,
}));

vi.mock("@/features/app-shell", async () => {
  const { APP_NAME } = await import("@/shared/config/app");
  const { formatPageTitle } = await import("@/shared/shell/resolve");

  return {
    getHome: vi.fn(),
    getShell: vi.fn(),
    appPageMetadata: vi.fn(async (page: string) => ({
      title: { absolute: formatPageTitle({ page, context: "Acme", product: APP_NAME }) },
    })),
  };
});

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: en } = await import("@/locales/en.json");
  const { default: fr } = await import("@/locales/fr.json");
  const messages = { en, fr };
  interface Options { locale?: string; namespace?: string }

  return {
    getTranslations: async (options?: Options) => {
      const locale = options?.locale === "fr" ? "fr" : options?.locale === "en" ? "en" : intl.locale;
      return createTranslator({ locale, messages: messages[locale], namespace: options?.namespace as "home" });
    },
  };
});

vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) => createElement("a", { href, ...props }),
    usePathname: () => "/dashboard",
    useRouter: () => ({}),
    redirect: () => undefined,
  };
});

const ORG = "home-page-org";

function signIn(options: { name?: string; role?: ShellRole } = {}) {
  const { name = "Camille Laurent", role = "owner" } = options;
  const workspace = { id: ORG, name: "Acme", slug: "acme", role };
  session.requireWorkspace.mockResolvedValue({
    user: { id: "u1", name, email: "camille@example.com", image: null, isPlatformAdmin: false },
    workspace,
    workspaces: [workspace],
  });
}

function quota(id: string, overrides: Partial<ShellQuota> = {}): ShellQuota {
  return {
    id,
    label: id,
    used: 3,
    limit: 10,
    status: "ok",
    icon: <svg aria-hidden="true" />,
    tone: 1,
    upgradeHref: null,
    ...overrides,
  };
}

function task(id: string, done: boolean): HomeTask {
  return {
    id,
    label: `Label of ${id}`,
    icon: <svg aria-hidden="true" />,
    tone: 1,
    done,
    action: { href: `/${id}`, label: `Action of ${id}` },
  };
}

function home(overrides: Partial<HomeView> = {}): HomeView {
  return {
    quotas: [],
    tasks: [],
    tasksDone: 0,
    activity: [],
    sections: [],
    HomeAction: null,
    ...overrides,
  };
}

/** What the shell reads of the workspace for the page: the name of its plan. */
function plan(name: string | null) {
  vi.mocked(getShell).mockResolvedValue({
    view: { workspace: { id: ORG, name: "Acme", role: "owner", plan: name } },
  } as Awaited<ReturnType<typeof getShell>>);
}

function given(view: HomeView) {
  vi.mocked(getHome).mockResolvedValue(view);
}

const params = (locale: "en" | "fr" = "en") => Promise.resolve({ locale });

async function page(locale: "en" | "fr" = "en") {
  intl.locale = locale;
  return renderWithIntl(await HomePage({ params: params(locale) }), locale);
}

beforeEach(() => {
  vi.clearAllMocks();
  intl.locale = "en";
  signIn();
  plan("Pro");
  given(home());
});

describe("the home page", () => {
  it("reads the home of the workspace of the session, never one from the address", async () => {
    await page();

    const scope: WorkspaceScope = { orgId: ORG, userId: "u1", role: "owner" };
    expect(getHome).toHaveBeenCalledWith(scope);
    expect(session.requireWorkspace).toHaveBeenCalledOnce();
  });

  it("greets the person by their first name, under the one h1, with the home icon in a brand tile", async () => {
    const html = await page();

    expect(startTags(html, "h1")).toHaveLength(1);
    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Hello Camille");
    const header = html.slice(html.indexOf('data-slot="page-header"'), html.indexOf("</h1>"));
    const tile = startTags(header, "span").find((tag) => tag.includes('data-slot="icon-tile"'));
    expect(decodedClassesOf(tile ?? "")).toEqual(expect.arrayContaining(["bg-brand-tint", "size-14"]));
    expect(header).toContain("lucide-house");
  });

  it("greets without a name when there is none to give", async () => {
    signIn({ name: "   " });

    expect(textOf(elements(await page(), "h1")[0] ?? "")).toBe("Hello");
  });

  it("says the workspace and its plan under the title, or the workspace alone without a plan", async () => {
    expect(textOf(await page())).toContain("Acme · Pro plan");

    plan(null);
    const context = /<div data-slot="page-header-context"[^>]*>(.*?)<\/div>/.exec(await page())?.[1] ?? "";
    expect(textOf(context)).toBe("Acme");
  });

  it("puts the main action of the home in the header, and no other button there", async () => {
    given(home({ HomeAction: ({ scope }) => <button type="button">{`Create in ${scope.orgId}`}</button> }));
    const html = await page();
    const actions = html.slice(html.indexOf('data-slot="page-header-actions"'));

    expect(actions).toContain("Create in home-page-org");
    expect(elements(html, "button").map(textOf)).toEqual(["Create in home-page-org"]);
  });

  it("has no actions row without a main action", async () => {
    expect(await page()).not.toContain('data-slot="page-header-actions"');
  });

  it("sets the title of the tab through the shell", async () => {
    expect((await generateMetadata({ params: params("en") })).title).toEqual({
      absolute: "Home · Acme — SaaS Boilerplate",
    });
    expect((await generateMetadata({ params: params("fr") })).title).toEqual({
      absolute: "Accueil · Acme — SaaS Boilerplate",
    });
  });
});

describe("the quotas of the home", () => {
  it("draws one card per quota under a heading only a screen reader reads, two across and four from xl", async () => {
    given(home({ quotas: [quota("projects"), quota("members"), quota("storage"), quota("credits")] }));
    const html = await page();
    const [list = ""] = startTags(html, "ul");
    const heading = startTags(html, "h2").find((tag) => decodedClassesOf(tag).includes("sr-only"));

    expect(textOf(elements(html, "h2")[0] ?? "")).toBe("Usage");
    expect(heading).toBeDefined();
    expect(decodedClassesOf(list)).toEqual(
      expect.arrayContaining(["grid", "grid-cols-1", "gap-4", "sm:grid-cols-2", "xl:grid-cols-4"]),
    );
    expect(attribute(list, "role")).toBe("list");
    // One heading per card, in order, then the empty state of the activity under them
    expect(elements(html, "h3").map(textOf)).toEqual(["projects", "members", "storage", "credits", "No activity yet"]);
    expect(html.match(/data-slot="card"/g)).toHaveLength(4);
  });

  it("draws no row at all without a quota", async () => {
    const html = await page();

    expect(textOf(html)).not.toContain("Usage");
    expect(html).not.toContain('data-slot="card"');
    expect(startTags(html, "ul")).toHaveLength(0);
  });
});

describe("below the quotas", () => {
  // As `getHome` gives them: already in order
  const SECTIONS = [
    { id: "early", order: 10, Component: ({ scope }: { scope: WorkspaceScope }) => <p>{`section early of ${scope.orgId}`}</p> },
    { id: "late", order: 20, Component: () => <p>section late</p> },
  ];

  /** The boxes of the page, by the classes they carry. */
  const boxes = (html: string) => startTags(html, "div").map((tag) => ({ tag, classes: decodedClassesOf(tag) }));

  /** The grid that holds the blocks under the quotas, as its classes. */
  function gridOf(html: string): string[] {
    const grid = boxes(html).find(({ classes }) => classes.includes("grid") && classes.includes("gap-6"));

    expect(grid, "the grid under the quotas").toBeDefined();
    return grid?.classes ?? [];
  }

  /** What a box holds first, as words: which block it is the place of. */
  const holds = (html: string, tag: string) => textOf(html.slice(html.indexOf(tag) + tag.length));

  it("lays out, from lg, the sections then the activity on the left two thirds and the first steps on the right third", async () => {
    given(home({ sections: SECTIONS, tasks: [task("a", true), task("b", false)], tasksDone: 1 }));
    const classes = gridOf(await page());

    // One column to begin with, and a column that may shrink below its content
    expect(classes).toEqual(
      expect.arrayContaining(["grid-cols-1", "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]", "lg:items-start", "lg:grid-rows-[auto_1fr]"]),
    );
  });

  it("draws the sections in the order it is given, each one given the scope of the workspace", async () => {
    given(home({ sections: SECTIONS }));
    const text = textOf(await page());

    expect(text.indexOf("section early of home-page-org")).toBeGreaterThan(-1);
    expect(text.indexOf("section early of home-page-org")).toBeLessThan(text.indexOf("section late"));
  });

  /** The boundaries of the sections in a tree, in order, found by walking its children. */
  function boundariesIn(node: ReactNode): ReactElement<{ children: ReactElement }>[] {
    if (Array.isArray(node)) {
      return node.flatMap(boundariesIn);
    }
    if (!isValidElement<{ children?: ReactNode }>(node)) {
      return [];
    }

    return [
      ...(node.type === SectionBoundary ? [node as ReactElement<{ children: ReactElement }>] : []),
      ...boundariesIn(node.props.children),
    ];
  }

  // A section is a feature's, and one that throws must take its own place on the
  // page and no more: the page would otherwise go to the error boundary of the
  // route, and the quotas, the first steps and the other sections with it. The
  // boundary draws nothing of its own while nothing throws, so it is read in the
  // tree the page returns.
  it("puts each section in a boundary of its own, so that one that throws leaves the rest of the page", async () => {
    given(home({ sections: SECTIONS }));
    const tree = await HomePage({ params: params() });

    expect(boundariesIn(tree).map((boundary) => boundary.props.children.type)).toEqual(
      SECTIONS.map(({ Component }) => Component),
    );
  });

  it("orders the blocks sections, first steps, activity before lg, which is the order of the page", async () => {
    given(home({ sections: SECTIONS, tasks: [task("a", true), task("b", false)], tasksDone: 1 }));
    const text = textOf(await page());

    expect(text.indexOf("section early")).toBeLessThan(text.indexOf("First steps"));
    expect(text.indexOf("First steps")).toBeLessThan(text.indexOf("No activity yet"));
  });

  it("places each block in its column from lg: the first steps on the right across both rows, the sections and the activity on the left", async () => {
    given(home({ sections: SECTIONS, tasks: [task("a", true), task("b", false)], tasksDone: 1 }));
    const html = await page();
    const placed = boxes(html).filter(({ classes }) => classes.some((name) => name.startsWith("lg:col-start")));

    expect(placed).toHaveLength(3);
    const [sections, steps, activity] = placed;
    expect(holds(html, sections?.tag ?? "")).toMatch(/^section early/);
    expect(sections?.classes).toEqual(expect.arrayContaining(["lg:col-start-1", "lg:row-start-1"]));
    expect(holds(html, steps?.tag ?? "")).toMatch(/^First steps/);
    expect(steps?.classes).toEqual(expect.arrayContaining(["lg:col-start-2", "lg:row-start-1", "lg:row-span-2"]));
    expect(holds(html, activity?.tag ?? "")).toMatch(/^Activity/);
    expect(activity?.classes).toContain("lg:col-start-1");
    expect(activity?.classes).not.toContain("lg:row-start-1");
  });

  it("does not span two rows when there is no section beside the first steps: the activity is their row", async () => {
    given(home({ tasks: [task("a", false)], tasksDone: 0 }));
    const html = await page();
    const steps = boxes(html).find(({ classes }) => classes.includes("lg:col-start-2"));

    expect(steps?.classes).toContain("lg:row-start-1");
    expect(steps?.classes).not.toContain("lg:row-span-2");
    expect(gridOf(html)).not.toContain("lg:grid-rows-[auto_1fr]");
  });

  describe("when no feature tells the activity (null)", () => {
    const STEPS = { tasks: [task("a", true), task("b", false)], tasksDone: 1 };

    it("leaves the section out: no heading, no empty state, as it would say \"No activity yet\" for ever", async () => {
      given(home({ activity: null, sections: SECTIONS }));
      const html = await page();

      expect(textOf(html)).not.toContain("Activity");
      expect(textOf(html)).not.toContain("No activity yet");
      expect(html).not.toContain('data-slot="empty-state"');
      // The rest of the page is there
      expect(textOf(html)).toContain("section early of home-page-org");
    });

    it("still says that nothing has happened when a feature answered with no event ([])", async () => {
      given(home({ activity: [], sections: SECTIONS }));
      const html = await page();

      expect(textOf(elements(html, "h2").at(-1) ?? "")).toBe("Activity");
      expect(textOf(html)).toContain("No activity yet");
    });

    it("keeps the first steps on the right of the sections, on the same row, with no second row to span", async () => {
      given(home({ activity: null, sections: SECTIONS, ...STEPS }));
      const html = await page();
      const placed = boxes(html).filter(({ classes }) => classes.some((name) => name.startsWith("lg:col-start")));

      expect(gridOf(html)).toEqual(
        expect.arrayContaining(["lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]", "lg:items-start"]),
      );
      // One left block: no row 1fr under it, where the gap would leave a dead row
      expect(gridOf(html)).not.toContain("lg:grid-rows-[auto_1fr]");
      expect(placed).toHaveLength(2);
      const [sections, steps] = placed;
      expect(holds(html, sections?.tag ?? "")).toMatch(/^section early/);
      expect(sections?.classes).toEqual(expect.arrayContaining(["lg:col-start-1", "lg:row-start-1"]));
      expect(holds(html, steps?.tag ?? "")).toMatch(/^First steps/);
      expect(steps?.classes).toEqual(expect.arrayContaining(["lg:col-start-2", "lg:row-start-1"]));
      expect(steps?.classes).not.toContain("lg:row-span-2");
    });

    it("does not put the first steps alone in the right third, with the left two thirds empty: one column", async () => {
      given(home({ activity: null, ...STEPS }));
      const html = await page();

      expect(textOf(html)).toContain("First steps");
      expect(gridOf(html)).toContain("grid-cols-1");
      expect(gridOf(html)).not.toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
      expect(html).not.toContain("lg:col-start-2");
      expect(html).not.toContain("lg:row-span-2");
    });

    it("has nothing under the quotas but the sections, when there are no steps either", async () => {
      given(home({ activity: null, sections: SECTIONS }));
      const html = await page();

      expect(textOf(html)).toContain("section late");
      expect(textOf(html)).not.toContain("First steps");
      expect(gridOf(html)).not.toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
    });

    it("leaves the grid out when there is nothing to put in it, rather than an empty box that still takes its gap", async () => {
      given(home({ activity: null }));
      const html = await page();

      expect(boxes(html).some(({ classes }) => classes.includes("grid") && classes.includes("gap-6"))).toBe(false);
      expect(textOf(html)).not.toContain("Activity");
    });
  });

  it("makes the first steps disappear when all are done, and the blocks keep one column", async () => {
    given(home({ sections: SECTIONS, tasks: [task("a", true), task("b", true)], tasksDone: 2 }));
    const html = await page();

    expect(textOf(html)).not.toContain("First steps");
    expect(startTags(html, "ol")).toHaveLength(0);
    expect(html).not.toContain("lg:col-start-2");
    expect(html).not.toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
  });

  it("has no first steps block when no feature gives a step", async () => {
    const html = await page();

    expect(textOf(html)).not.toContain("First steps");
    expect(textOf(html)).toContain("No activity yet");
  });

  it("shows the activity in its own words when there is some, and an empty state when there is none", async () => {
    given(
      home({
        activity: [
          { id: "e1", action: "project.created", actorName: "Léa Martin", actorImage: null, values: { name: "Atlas" }, at: new Date() },
        ],
      }),
    );
    const html = await page();

    expect(textOf(html)).toContain("Léa Martin created Atlas");
    expect(html).not.toContain('data-slot="empty-state"');
  });

  it("speaks French", async () => {
    given(home({ quotas: [quota("projects")], tasks: [task("a", false)], tasksDone: 0 }));
    const html = await page("fr");

    expect(textOf(elements(html, "h1")[0] ?? "")).toBe("Bonjour Camille");
    expect(textOf(html)).toContain("Acme · Plan Pro");
    expect(textOf(html)).toContain("Utilisation");
    expect(textOf(html)).toContain("Premiers pas");
    expect(textOf(html)).toContain("0 sur 1");
    expect(textOf(html)).toContain("Aucune activité");
  });
});
