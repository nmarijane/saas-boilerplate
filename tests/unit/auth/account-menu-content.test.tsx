import type { ComponentProps } from "react";
import type { ShellQuota, ShellWorkspace } from "@/shared/shell/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { groups, reset, rows } from "../../helpers/fake-dropdown-menu";
import {
  attribute,
  decodedClassesOf,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";
import { shellLink, USER, WORKSPACE } from "../../helpers/shell";

// The content of the menu is drawn in a portal, which a static render leaves
// out. The primitives are replaced by stand-ins that draw each part in place and
// keep what choosing a row does (helpers/fake-dropdown-menu.tsx), so that what
// the menu holds, and what its rows do, can be read here. What Radix does with
// them (opening, focus, arrow keys) is the work of the stories.
//
// Replaced as well: the navigation of next-intl (no Next router runs in a test),
// the query of the page, the theme, the auth client and the toast.
const nav = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  pathname: "/projects",
  search: "",
}));
const auth = vi.hoisted(() => ({ signOut: vi.fn(), setActive: vi.fn() }));
const theme = vi.hoisted(() => ({
  current: "dark" as string | undefined,
  setTheme: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/shared/components/ui/dropdown-menu", () =>
  import("../../helpers/fake-dropdown-menu"),
);
vi.mock("@/shared/lib/i18n-navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...props }: ComponentProps<"a">) =>
      createElement("a", { href, ...props }),
    useRouter: () => nav,
    usePathname: () => nav.pathname,
  };
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: theme.current, setTheme: theme.setTheme }),
}));
vi.mock("@/features/auth/auth-client", () => ({
  authClient: {
    signOut: auth.signOut,
    organization: { setActive: auth.setActive },
  },
}));
vi.mock("@/shared/components/ui/sonner", () => ({ toast }));

const OTHER: ShellWorkspace = { id: "org_2", name: "Atelier Sud", role: "admin", plan: "Team" };
const LINKS = [
  shellLink("account", "/settings/account", "Account"),
  shellLink("billing", "/settings/billing", "Billing"),
];
const STORAGE: ShellQuota = {
  id: "storage",
  label: "Storage",
  used: 41,
  limit: 50,
  status: "warning",
  icon: <svg aria-hidden="true" />,
  tone: 1,
  upgradeHref: null,
};

function render(props: Partial<ComponentProps<typeof AccountMenu>> = {}): string {
  reset();
  return renderWithIntl(
    <AccountMenu
      user={USER}
      workspace={WORKSPACE}
      workspaces={[WORKSPACE, OTHER]}
      links={LINKS}
      quotas={[]}
      {...props}
    />,
  );
}

/** What choosing the row with these words does. */
function choose(label: string) {
  const row = rows.find((candidate) => candidate.label.includes(label));
  expect(row, `a row that reads "${label}"`).toBeDefined();
  row?.onSelect?.(new Event("select"));
}

/** The group of radio rows that holds this value. */
function groupOf(item: string) {
  const group = groups.find((candidate) => candidate.items.includes(item));
  expect(group, `a group with "${item}"`).toBeDefined();
  return group;
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.pathname = "/projects";
  nav.search = "";
  theme.current = "dark";
  auth.signOut.mockResolvedValue({ data: { success: true }, error: null });
  auth.setActive.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the content of the account menu", () => {
  it("is described by its summary, so that what runs low is read with the menu", () => {
    const html = render({ quotas: [STORAGE] });
    const [menu = ""] = startTags(html, "div").filter((tag) => attribute(tag, "role") === "menu");
    const id = attribute(menu, "aria-describedby");

    expect(id).toBeTruthy();
    // The element with that id is the summary: the person, the plan, the figures and the state.
    const start = html.indexOf(`<div id="${id}"`);
    expect(start).toBeGreaterThan(-1);
    const summary = textOf(html.slice(start, html.indexOf('role="separator"')));

    expect(summary).toContain("Camille Laurent");
    expect(summary).toContain("Pro plan");
    expect(summary).toContain("41 of 50");
    expect(summary).toContain("Running low");
  });

  it("lists the links of the features, then theme, language and the switch of workspace, and ends with sign out", () => {
    render();
    const labels = rows.map(({ label }) => label);

    expect(labels.slice(0, 5)).toEqual([
      "Account",
      "Billing",
      "Theme",
      "Language",
      "Switch workspace",
    ]);
    expect(labels.at(-1)).toBe("Sign out");
  });

  it("offers to switch workspace only to someone who has more than one", () => {
    render({ workspaces: [WORKSPACE] });

    expect(rows.map(({ label }) => label)).not.toContain("Switch workspace");
  });

  it("keeps its rows 44 px high, where the shared row is 40", () => {
    const html = render();
    const menuRows = startTags(html, "div")
      .concat(startTags(html, "a"))
      .filter((tag) => attribute(tag, "role") === "menuitem");

    expect(menuRows.length).toBeGreaterThanOrEqual(7);
    for (const row of menuRows) {
      expect(decodedClassesOf(row)).toContain("min-h-11");
    }
  });

  describe("language", () => {
    it("lists the languages of the routing, each under its own name", () => {
      const html = render();

      expect(groupOf("fr")?.items).toEqual(["en", "fr"]);
      expect(groupOf("fr")?.value).toBe("en");
      expect(html).toContain(">English<");
      expect(html).toContain(">Français<");
      // Each is read in its own language.
      expect(startTags(html, "div").some((tag) => attribute(tag, "lang") === "fr")).toBe(true);
    });

    it("replaces the page with the same page in the other language", () => {
      render();

      groupOf("fr")?.onValueChange("fr");

      expect(nav.replace).toHaveBeenCalledExactlyOnceWith("/projects", { locale: "fr" });
    });

    it("keeps the query of the page, filters and all", () => {
      nav.search = "tab=billing&x=1&x=2";
      render();

      groupOf("fr")?.onValueChange("fr");

      expect(nav.replace).toHaveBeenCalledExactlyOnceWith("/projects?tab=billing&x=1&x=2", {
        locale: "fr",
      });
    });

    it("ignores a language the app does not have", () => {
      render();

      groupOf("fr")?.onValueChange("de");

      expect(nav.replace).not.toHaveBeenCalled();
    });
  });

  describe("theme", () => {
    it("offers light, dark and the one of the device, with the current one chosen", () => {
      render();

      expect(groupOf("system")?.items).toEqual(["light", "dark", "system"]);
      expect(groupOf("system")?.value).toBe("dark");
    });

    it("chooses the one of the device until next-themes knows better", () => {
      theme.current = undefined;
      render();

      expect(groupOf("system")?.value).toBe("system");
    });

    it("hands the choice to next-themes", () => {
      render();

      groupOf("system")?.onValueChange("light");

      expect(theme.setTheme).toHaveBeenCalledExactlyOnceWith("light");
    });
  });

  describe("sign out", () => {
    it("ends the session, then goes to the sign-in page and refreshes", async () => {
      render();

      choose("Sign out");

      await vi.waitFor(() => expect(nav.refresh).toHaveBeenCalledOnce());
      expect(nav.push).toHaveBeenCalledExactlyOnceWith("/sign-in");
      const [signedOut = 0] = auth.signOut.mock.invocationCallOrder;
      const [pushed = 0] = nav.push.mock.invocationCallOrder;
      const [refreshed = 0] = nav.refresh.mock.invocationCallOrder;
      expect(signedOut).toBeLessThan(pushed);
      expect(pushed).toBeLessThan(refreshed);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("stays on the page and says so when the server refuses: the person is still signed in", async () => {
      const report = vi.fn();
      vi.stubGlobal("reportError", report);
      auth.signOut.mockResolvedValue({
        data: null,
        error: { message: "Session expired", status: 401, statusText: "Unauthorized" },
      });
      render();

      choose("Sign out");

      await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
      expect(nav.push).not.toHaveBeenCalled();
      expect(nav.refresh).not.toHaveBeenCalled();
      expect(report).toHaveBeenCalledOnce();
    });

    it("stays on the page and says so when the call fails outright", async () => {
      auth.signOut.mockRejectedValue(new Error("Failed to fetch"));
      render();

      choose("Sign out");

      await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
      expect(nav.push).not.toHaveBeenCalled();
      expect(nav.refresh).not.toHaveBeenCalled();
    });
  });

  describe("switch workspace", () => {
    it("switches to another workspace: the session first, then its home", async () => {
      render();

      choose("Atelier Sud");

      await vi.waitFor(() => expect(nav.refresh).toHaveBeenCalledOnce());
      expect(auth.setActive).toHaveBeenCalledExactlyOnceWith({ organizationId: "org_2" });
      expect(nav.push).toHaveBeenCalledExactlyOnceWith("/dashboard");
    });

    it("goes nowhere for the workspace the person is in", () => {
      render();

      choose("Studio Nord");

      expect(auth.setActive).not.toHaveBeenCalled();
      expect(nav.push).not.toHaveBeenCalled();
    });
  });
});
