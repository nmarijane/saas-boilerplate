import type { ComponentProps } from "react";
import type { ShellWorkspace } from "@/shared/shell/view";
import { describe, expect, it, vi } from "vitest";
import {
  WORKSPACE_SEARCH_MIN,
  WorkspaceList,
  WorkspaceSwitcher,
} from "@/features/auth/organization/components/workspace-switcher";
import { toneOf } from "@/shared/components/ui/initial-tile";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  tagSaying,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// What the switcher reaches for outside itself, replaced: the navigation of
// next-intl (no Next router runs in a test), the auth client (no network, no
// session) and the server action that creates a workspace.
vi.mock("@/shared/lib/i18n-navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/features/auth/auth-client", () => ({
  authClient: { organization: { setActive: vi.fn() } },
}));
vi.mock("@/features/auth/organization/actions", () => ({
  createOrganization: vi.fn(),
}));

const ACME: ShellWorkspace = { id: "org_1", name: "Acme", role: "owner", plan: "Pro" };
const NORD: ShellWorkspace = { id: "org_2", name: "Studio Nord", role: "admin", plan: "Team" };
const SUD: ShellWorkspace = { id: "org_3", name: "Atelier Sud", role: "member", plan: null };

/** `count` workspaces, the first one the person's. */
function workspaces(count: number): ShellWorkspace[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `org_${index + 1}`,
    name: `Workspace ${index + 1}`,
    role: "member",
    plan: "Free",
  }));
}

type Locale = "en" | "fr";

function renderSwitcher(
  props: Partial<ComponentProps<typeof WorkspaceSwitcher>> = {},
  locale: Locale = "en",
): string {
  return renderWithIntl(
    <WorkspaceSwitcher workspaces={[ACME, NORD, SUD]} activeId="org_1" {...props} />,
    locale,
  );
}

function renderList(
  props: Partial<ComponentProps<typeof WorkspaceList>> = {},
  locale: Locale = "en",
): string {
  return renderWithIntl(
    <WorkspaceList
      workspaces={[ACME, NORD, SUD]}
      activeId="org_1"
      pendingId={null}
      onSelect={() => {}}
      onCreate={() => {}}
      {...props}
    />,
    locale,
  );
}

/** The trigger of the switcher: its one button. */
function triggerOf(html: string): string {
  const [button = ""] = elements(html, "button");
  return button;
}

/** The rows of the list, whole: a row holds no `div` of its own. */
function rowsOf(html: string): string[] {
  return html.match(/<div [^>]*role="option"[^>]*>[\s\S]*?<\/div>/g) ?? [];
}

describe("workspace switcher", () => {
  describe("the trigger", () => {
    it("shows the active workspace, its name in bold and cut, and its plan", () => {
      const trigger = triggerOf(renderSwitcher());

      expect(textOf(trigger)).toContain("Acme");
      expect(textOf(trigger)).toContain("Pro plan");
      expect(decodedClassesOf(tagSaying(trigger, "span", "Acme"))).toEqual(
        expect.arrayContaining(["truncate", "font-semibold"]),
      );
    });

    // How big the row is, and how wide, is measured in a browser by the `Default` story of the switcher: a
    // static render has no layout to measure.
    it("is one button, one stop of the tab: the whole row opens the list", () => {
      const buttons = startTags(renderSwitcher(), "button");

      expect(buttons).toHaveLength(1);
      expect(attribute(buttons[0] ?? "", "tabindex")).toBeUndefined();
      expect(attribute(buttons[0] ?? "", "disabled")).toBeUndefined();
    });

    it("says that it opens a dialog, and that it is closed", () => {
      const [tag = ""] = startTags(renderSwitcher(), "button");

      expect(attribute(tag, "aria-haspopup")).toBe("dialog");
      expect(attribute(tag, "aria-expanded")).toBe("false");
      expect(attribute(tag, "type")).toBe("button");
    });

    it("carries the chevrons that tell it can be changed, hidden from assistive technology: the name says it", () => {
      const chevrons = startTags(triggerOf(renderSwitcher()), "svg").find((svg) => svg.includes("lucide-chevrons-up-down"));

      expect(chevrons).toBeDefined();
      expect(attribute(chevrons ?? "", "aria-hidden")).toBe("true");
    });

    it("tints the tile from the id of the workspace, so that a rename does not repaint it", () => {
      // org_1 and "Acme" are not in the same tone: the id is the seed.
      expect(toneOf("org_1")).not.toBe(toneOf("Acme"));
      const tile = startTags(triggerOf(renderSwitcher()), "span").find((span) =>
        span.includes('data-slot="initial-tile"'),
      );

      expect(decodedClassesOf(tile ?? "")).toEqual(
        expect.arrayContaining([`bg-tone-${toneOf("org_1")}`, "size-8"]),
      );
      expect(textOf(triggerOf(renderSwitcher()))).toContain("A");
    });

    it("gives the role when the workspace has no plan", () => {
      const trigger = triggerOf(renderSwitcher({ activeId: "org_3" }));

      expect(textOf(trigger)).toContain("Atelier Sud");
      expect(textOf(trigger)).toContain("Member");
      expect(textOf(trigger)).not.toContain("plan");
    });

    it("speaks French", () => {
      const trigger = triggerOf(renderSwitcher({}, "fr"));

      expect(textOf(trigger)).toContain("Plan Pro");
      expect(textOf(triggerOf(renderSwitcher({ activeId: "org_3" }, "fr")))).toContain("Membre");
    });

    it("cuts a name of 60 characters instead of letting it out of the row", () => {
      const name = "Association des amis du jardin partagé de la rue Victor-Hugo";
      const html = renderSwitcher({
        workspaces: [{ ...ACME, name }],
        activeId: "org_1",
      });

      expect(name).toHaveLength(60);
      expect(decodedClassesOf(tagSaying(html, "span", name))).toContain("truncate");
      // The column that holds the name can shrink below its text, which is what lets it be cut.
      const column = startTags(html, "span").find((span) => decodedClassesOf(span).includes("min-w-0"));
      expect(column).toBeDefined();
    });

    it("offers to create a workspace when the person has none", () => {
      const trigger = triggerOf(renderSwitcher({ workspaces: [], activeId: null }));
      const [tag = ""] = startTags(renderSwitcher({ workspaces: [], activeId: null }), "button");

      expect(textOf(trigger)).toContain("Create workspace");
      expect(textOf(trigger)).not.toContain("plan");
      // It opens the creation, which is a dialog.
      expect(attribute(tag, "aria-haspopup")).toBe("dialog");
      expect(attribute(tag, "aria-expanded")).toBe("false");
    });

    it("offers to create one in French too", () => {
      expect(
        textOf(triggerOf(renderSwitcher({ workspaces: [], activeId: null }, "fr"))),
      ).toContain("Créer un espace");
    });
  });
});

describe("workspace list", () => {
  it("searches from six workspaces only", () => {
    expect(WORKSPACE_SEARCH_MIN).toBe(6);

    const five = renderList({ workspaces: workspaces(5) });
    const six = renderList({ workspaces: workspaces(6) });

    expect(five).not.toContain("<input");
    expect(five).not.toContain("Search workspaces");
    expect(six).toContain("<input");
    expect(attribute(startTags(six, "input")[0] ?? "", "placeholder")).toBe(
      "Search workspaces",
    );
  });

  it("makes the search field as tall as its band, 44 px, so that all of the band can be tapped", () => {
    const [field = ""] = startTags(renderList({ workspaces: workspaces(6) }), "input");
    const classes = decodedClassesOf(field);

    expect(classes).toContain("min-h-11");
    expect(classes).not.toContain("h-10");
  });

  it("reads the field in the language of the page", () => {
    expect(
      attribute(
        startTags(renderList({ workspaces: workspaces(6) }, "fr"), "input")[0] ?? "",
        "placeholder",
      ),
    ).toBe("Rechercher un espace");
  });

  it("has no message for an empty search where there is no search", () => {
    expect(renderList({ workspaces: workspaces(5) })).not.toContain("No workspace found");
  });

  it("marks the current workspace, in the markup and for assistive technology", () => {
    const current = rowsOf(renderList()).filter((row) => row.includes("data-current"));

    expect(current).toHaveLength(1);
    expect(textOf(current[0] ?? "")).toContain("Acme");
    expect(textOf(current[0] ?? "")).toContain("Current workspace");
    expect(current[0]).toContain("lucide-check");
    // Said once: no other row has the words or the tick.
    expect(renderList().split("Current workspace")).toHaveLength(2);
    expect(renderList().split("lucide-check")).toHaveLength(2);
  });

  it("marks nothing as current when no workspace is active", () => {
    const html = renderList({ activeId: null });

    expect(html).not.toContain("data-current");
    expect(html).not.toContain("Current workspace");
  });

  it("shows each workspace with its tile, its name and its plan, or its role", () => {
    const rows = rowsOf(renderList());
    const [acme = "", nord = "", sud = ""] = rows;

    expect(rows.filter((row) => row.includes('data-slot="initial-tile"'))).toHaveLength(3);
    expect(textOf(acme)).toContain("Pro plan");
    expect(textOf(nord)).toContain("Studio Nord");
    expect(textOf(nord)).toContain("Team plan");
    expect(textOf(sud)).toContain("Member");
  });

  it("cuts the names and keeps the rows 44 px high", () => {
    const html = renderList();

    for (const row of rowsOf(html).slice(0, 3)) {
      expect(decodedClassesOf(startTags(row, "div")[0] ?? "")).toContain("min-h-11");
    }
    expect(decodedClassesOf(tagSaying(html, "span", "Studio Nord"))).toContain("truncate");
  });

  it("ends with the row that creates a workspace, which is no workspace: no tile, never current", () => {
    const rows = rowsOf(renderList());
    const last = rows.at(-1) ?? "";

    expect(rows).toHaveLength(4);
    expect(textOf(last)).toContain("Create workspace");
    expect(last).toContain("lucide-plus");
    // Not a workspace: it is neither marked current nor given a tile of initials.
    expect(last).not.toContain("data-current");
    expect(last).not.toContain('data-slot="initial-tile"');
  });

  it("names the list for assistive technology", () => {
    const html = renderList();
    const list = startTags(html, "div").find((tag) => attribute(tag, "role") === "listbox") ?? "";

    expect(attribute(list, "aria-label")).toBe("Switch workspace");
  });

  it("says which workspace is being switched to, and holds the others until it is done", () => {
    const rows = rowsOf(renderList({ pendingId: "org_2" }));
    const [acme = "", nord = "", sud = "", create = ""] = rows;
    const disabled = (row: string) => attribute(startTags(row, "div")[0] ?? "", "aria-disabled");

    expect(nord).toContain('role="status"');
    expect(rows.filter((row) => row.includes('role="status"'))).toHaveLength(1);
    expect(disabled(nord)).toBe("false");
    for (const row of [acme, sud, create]) {
      expect(disabled(row)).toBe("true");
    }
  });

  it("holds nothing while no switch is running", () => {
    for (const row of rowsOf(renderList({ pendingId: null }))) {
      expect(attribute(startTags(row, "div")[0] ?? "", "aria-disabled")).toBe("false");
    }
  });
});
