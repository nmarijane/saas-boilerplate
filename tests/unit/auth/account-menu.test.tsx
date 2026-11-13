import type { ComponentProps } from "react";
import type { ShellQuota, ShellUser, ShellWorkspace } from "@/shared/shell/view";
import { describe, expect, it, vi } from "vitest";
import {
  AccountMenu,
  AccountSummary,
} from "@/features/auth/components/account-menu";
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
import { USER, WORKSPACE } from "../../helpers/shell";

// What the menu reaches for outside itself, replaced: the navigation of
// next-intl (the Link is a plain anchor), and
// the auth client (no network, no session).
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
    useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
    usePathname: () => "/dashboard",
  };
});
vi.mock("@/features/auth/auth-client", () => ({
  authClient: { signOut: vi.fn(), organization: { setActive: vi.fn() } },
}));
vi.mock("@/features/auth/organization/actions", () => ({
  createOrganization: vi.fn(),
}));

type Locale = "en" | "fr";

const OTHER: ShellWorkspace = { id: "org_2", name: "Atelier Sud", role: "admin", plan: "Team" };

function quota(
  id: string,
  status: ShellQuota["status"],
  used: number,
  limit: number,
  extra: Partial<ShellQuota> = {},
): ShellQuota {
  return {
    id,
    label: `Quota ${id}`,
    used,
    limit,
    status,
    icon: <svg aria-hidden="true" />,
    tone: 1,
    upgradeHref: null,
    ...extra,
  };
}

function renderMenu(
  props: Partial<ComponentProps<typeof AccountMenu>> = {},
  locale: Locale = "en",
): string {
  return renderWithIntl(
    <AccountMenu
      user={USER}
      workspace={WORKSPACE}
      workspaces={[WORKSPACE, OTHER]}
      links={[]}
      quotas={[]}
      {...props}
    />,
    locale,
  );
}

function renderSummary(
  props: Partial<ComponentProps<typeof AccountSummary>> = {},
  locale: Locale = "en",
): string {
  return renderWithIntl(
    <AccountSummary user={USER} workspace={WORKSPACE} quotas={[]} {...props} />,
    locale,
  );
}

/** The trigger of the menu: its one button. */
function triggerOf(html: string): string {
  const [button = ""] = elements(html, "button");
  return button;
}

describe("account menu", () => {
  describe("the trigger", () => {
    it("names the person and their role, the name cut when it is long", () => {
      const trigger = triggerOf(renderMenu());

      expect(textOf(trigger)).toContain("Camille Laurent");
      expect(textOf(trigger)).toContain("Owner");
      expect(decodedClassesOf(tagSaying(trigger, "span", "Camille Laurent"))).toContain("truncate");
    });

    it("says that it opens a menu, and that it is closed", () => {
      const [tag = ""] = startTags(renderMenu(), "button");

      expect(attribute(tag, "aria-haspopup")).toBe("menu");
      expect(attribute(tag, "aria-expanded")).toBe("false");
      expect(attribute(tag, "type")).toBe("button");
    });

    it("is a row of 52 px, as wide as the sidebar, with no border of its own", () => {
      const classes = decodedClassesOf(startTags(renderMenu(), "button")[0] ?? "");

      expect(classes).toEqual(expect.arrayContaining(["min-h-13", "w-full"]));
      expect(classes).not.toContain("border");
      expect(triggerOf(renderMenu())).toContain("lucide-chevrons-up-down");
    });

    it("gives the e-mail where there is no workspace to give a role", () => {
      const trigger = triggerOf(renderMenu({ workspace: null, workspaces: [] }));

      expect(textOf(trigger)).toContain("camille@example.com");
      expect(textOf(trigger)).not.toContain("Owner");
    });

    it("speaks French", () => {
      expect(textOf(triggerOf(renderMenu({}, "fr")))).toContain("Propriétaire");
    });

    it("draws a tile of initials, tinted from the id of the person, when there is no photo", () => {
      // The seed is the id: it is not the tone of the name.
      expect(toneOf(USER.id)).not.toBe(toneOf(USER.name));
      const tile = startTags(triggerOf(renderMenu()), "span").find((tag) =>
        tag.includes('data-slot="initial-tile"'),
      );

      expect(decodedClassesOf(tile ?? "")).toEqual(
        expect.arrayContaining([`bg-tone-${toneOf(USER.id)}`, "size-8"]),
      );
      expect(textOf(triggerOf(renderMenu()))).toContain("CL");
    });

    it("draws the avatar of 32 px when there is a photo, with the tile behind it until it loads", () => {
      const user: ShellUser = { ...USER, image: "https://example.com/camille.png" };
      const trigger = triggerOf(renderMenu({ user }));
      const [avatar = ""] = startTags(trigger, "span").filter((tag) => tag.includes('data-slot="avatar"'));

      expect(decodedClassesOf(avatar)).toContain("size-8");
      // The photo is not loaded in a static render: what shows is the fallback.
      expect(trigger).toContain('data-slot="initial-tile"');
    });

    it("falls back on the e-mail for a person with no name", () => {
      const trigger = triggerOf(
        renderMenu({ user: { ...USER, name: "  " }, workspace: null, workspaces: [] }),
      );

      expect(textOf(trigger)).toContain("camille@example.com");
      expect(textOf(trigger)).not.toContain("?");
    });

    it("cuts a name and an e-mail that are too long for the row", () => {
      const html = renderMenu({
        user: {
          ...USER,
          name: "Jean-Baptiste de la Fontaine-Beaumarchais-Montmorency",
        },
        workspace: null,
        workspaces: [],
      });
      const trigger = triggerOf(html);
      const column = startTags(trigger, "span").find((span) => decodedClassesOf(span).includes("min-w-0"));

      expect(column).toBeDefined();
      expect(
        decodedClassesOf(tagSaying(trigger, "span", "Jean-Baptiste de la Fontaine-Beaumarchais-Montmorency")),
      ).toContain("truncate");
      expect(decodedClassesOf(tagSaying(trigger, "span", "camille@example.com"))).toContain("truncate");
    });
  });
});

describe("account summary", () => {
  it("names the person and gives their e-mail", () => {
    const html = renderSummary();

    expect(textOf(html)).toContain("Camille Laurent");
    expect(textOf(html)).toContain("camille@example.com");
    expect(decodedClassesOf(tagSaying(html, "p", "Camille Laurent"))).toContain("truncate");
    expect(decodedClassesOf(tagSaying(html, "p", "camille@example.com"))).toContain("truncate");
  });

  it("falls back on the e-mail for a person with no name, and does not say it twice", () => {
    const html = renderSummary({ user: { ...USER, name: "" } });

    expect(html.split("camille@example.com")).toHaveLength(2);
  });

  it("shows the plan line only with a plan", () => {
    expect(textOf(renderSummary())).toContain("Pro plan");
    expect(textOf(renderSummary({ workspace: { ...WORKSPACE, plan: null } }))).not.toContain("plan");
    expect(textOf(renderSummary({ workspace: null }))).not.toContain("plan");
  });

  it("names the workspace the plan is of", () => {
    expect(textOf(renderSummary())).toContain("Studio Nord");
  });

  it("keeps the plan in sight when the name of the workspace is long: the name is cut, the plan never", () => {
    const name = "Association des amis du jardin partagé de la rue Victor-Hugo";
    const html = renderSummary({ workspace: { ...WORKSPACE, name, plan: "Enterprise" } });
    const plan = decodedClassesOf(tagSaying(html, "span", "Enterprise plan"));
    const [row = ""] = startTags(html, "p").filter((tag) => decodedClassesOf(tag).includes("flex"));

    expect(decodedClassesOf(tagSaying(html, "span", name))).toContain("truncate");
    expect(plan).toContain("shrink-0");
    expect(plan).not.toContain("truncate");
    // The row can shrink below its text, which is what lets the name be cut.
    expect(decodedClassesOf(row)).toContain("min-w-0");
  });

  it("separates the name from the plan with a dot that assistive technology skips", () => {
    const html = renderSummary();

    expect(html).toContain('<span aria-hidden="true">·</span>');
  });

  it("carries the id it is given, for the menu to be described by it", () => {
    const html = renderSummary({ id: "summary-1" });
    const [root = ""] = startTags(html, "div");

    expect(attribute(root, "id")).toBe("summary-1");
    expect(attribute(startTags(renderSummary(), "div")[0] ?? "", "id")).toBeUndefined();
  });

  it("speaks French", () => {
    expect(textOf(renderSummary({}, "fr"))).toContain("Plan Pro");
  });

  describe("the quotas", () => {
    const OK = quota("members", "ok", 3, 50);
    const WARNING = quota("storage", "warning", 41, 50);
    const LIMIT = quota("credits", "limit", 100, 100);

    it("details only the quotas that need attention, the one at its limit first", () => {
      const html = renderSummary({ quotas: [OK, WARNING, LIMIT] });
      const bars = startTags(html, "div").filter((tag) => attribute(tag, "role") === "progressbar");

      expect(bars.map((bar) => attribute(bar, "aria-label"))).toEqual([
        "Quota credits",
        "Quota storage",
      ]);
      expect(html).not.toContain("Quota members");
    });

    it("draws nothing for them when nothing needs attention", () => {
      const html = renderSummary({ quotas: [OK, quota("seats", "unlimited", 9, -1)] });

      expect(html).not.toContain("progressbar");
      expect(html).not.toContain("Running low");
      expect(html).not.toContain("Limit reached");
    });

    it("draws the bars for the eye only: a menu owns items, and the figures and the state say it in words", () => {
      const html = renderSummary({ quotas: [WARNING, LIMIT] });
      // What is outside every aria-hidden element (the hidden div, the bar, its fill): what assistive technology reads.
      const read = html.replaceAll(/<div aria-hidden="true">[\s\S]*?<\/div><\/div><\/div>/g, "");

      expect(html.match(/<div aria-hidden="true">/g)).toHaveLength(2);
      expect(read).not.toContain("progressbar");
      expect(textOf(read)).toContain("41 of 50");
      expect(textOf(read)).toContain("Running low");
      expect(textOf(read)).toContain("100 of 100");
      expect(textOf(read)).toContain("Limit reached");
    });

    it("draws no list or other role a menu may not own", () => {
      const html = renderSummary({ quotas: [WARNING, LIMIT] });

      expect(html).not.toContain("<ul");
      expect(html).not.toContain('role="list"');
    });

    it("tells how much is used, in figures and in a sentence for assistive technology", () => {
      const html = renderSummary({ quotas: [WARNING] });
      const [bar = ""] = startTags(html, "div").filter((tag) => attribute(tag, "role") === "progressbar");

      expect(textOf(html)).toContain("41 of 50");
      expect(attribute(bar, "aria-valuetext")).toBe("41 of 50 used");
      expect(attribute(bar, "aria-valuenow")).toBe("41");
      expect(attribute(bar, "aria-valuemax")).toBe("50");
    });

    it("says the state in words: running low, or the limit reached", () => {
      const html = renderSummary({ quotas: [WARNING, LIMIT] });

      expect(textOf(html)).toContain("Running low");
      expect(textOf(html)).toContain("Limit reached");
      expect(renderSummary({ quotas: [WARNING] })).not.toContain("Limit reached");
      expect(renderSummary({ quotas: [LIMIT] })).not.toContain("Running low");
    });

    it("writes a quota in its unit, so that a figure is never bare", () => {
      const html = renderSummary({
        quotas: [quota("storage", "warning", 4200, 5000, { unit: "megabyte" })],
      });
      const [bar = ""] = startTags(html, "div").filter((tag) => attribute(tag, "role") === "progressbar");

      expect(textOf(html)).toContain("4,200 MB of 5,000 MB");
      expect(attribute(bar, "aria-valuetext")).toBe("4,200 MB of 5,000 MB used");
    });

    it("speaks French", () => {
      const html = renderSummary({ quotas: [WARNING, LIMIT] }, "fr");
      const [bar = ""] = startTags(html, "div").filter((tag) => attribute(tag, "role") === "progressbar");

      expect(textOf(html)).toContain("Bientôt épuisé");
      expect(textOf(html)).toContain("Limite atteinte");
      expect(textOf(html)).toContain("41 sur 50");
      expect(attribute(bar, "aria-valuetext")).toBe("100 sur 100 utilisés");
    });

    it("cuts a long label and keeps the figures beside it", () => {
      const label = "Monthly credits of the assistant, topped up on the first of the month";
      const html = renderSummary({ quotas: [quota("credits", "warning", 41, 50, { label })] });

      expect(decodedClassesOf(tagSaying(html, "span", label))).toContain("truncate");
    });
  });
});
