import type {
  FeatureShell,
  NavContribution,
  PlanSummary,
  QuotaContribution,
  Viewer,
} from "@/shared/shell/contract";
import type { QuotaStatus } from "@/shared/shell/view";
import { HouseIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  collectEntries,
  firstNameOf,
  formatPageTitle,
  isActivePath,
  isVisible,
  needsAttention,
  quotasToRead,
  resolveNav,
  resolveQuota,
  splitTabBar,
} from "@/shared/shell/resolve";

const owner: Viewer = { role: "owner", isPlatformAdmin: false };
const admin: Viewer = { role: "admin", isPlatformAdmin: false };
const member: Viewer = { role: "member", isPlatformAdmin: false };
const noWorkspace: Viewer = { role: null, isPlatformAdmin: false };
const platformAdmin: Viewer = { role: null, isPlatformAdmin: true };

function navEntry(
  id: string,
  overrides: Partial<NavContribution> = {},
): NavContribution {
  return {
    id,
    section: "main",
    href: `/${id}`,
    labelKey: `nav.${id}`,
    icon: HouseIcon,
    order: 10,
    ...overrides,
  };
}

const projectsQuota: QuotaContribution = {
  id: "projects",
  limitKey: "projects",
  labelKey: "quotas.projects",
  icon: HouseIcon,
  tone: 1,
  order: 10,
  usage: async () => 0,
};

function planWith(limits: Partial<Record<string, number>>): PlanSummary {
  return { id: "pro", name: "Pro", limits, upgradeHref: "/settings/billing" };
}

describe("roles", () => {
  it("hides an entry below its minimum role", () => {
    expect(isVisible({ minRole: "admin" }, member)).toBe(false);
    expect(isVisible({ minRole: "admin" }, admin)).toBe(true);
    expect(isVisible({ minRole: "admin" }, owner)).toBe(true);
    expect(isVisible({ minRole: "owner" }, admin)).toBe(false);
    expect(isVisible({ minRole: "member" }, member)).toBe(true);
  });

  it("hides an entry with a minimum role from someone without a workspace", () => {
    expect(isVisible({ minRole: "member" }, noWorkspace)).toBe(false);
    expect(isVisible({ minRole: "admin" }, noWorkspace)).toBe(false);
  });

  it("shows an entry with no minimum role to everyone, even without a workspace", () => {
    expect(isVisible({}, member)).toBe(true);
    expect(isVisible({}, noWorkspace)).toBe(true);
  });

  it("shows the admin section to platform admins only", () => {
    expect(isVisible({ section: "admin" }, owner)).toBe(false);
    expect(isVisible({ section: "admin" }, noWorkspace)).toBe(false);
    expect(isVisible({ section: "admin" }, platformAdmin)).toBe(true);
    expect(isVisible({ section: "main" }, owner)).toBe(true);

    const features: FeatureShell[] = [
      {
        id: "admin",
        nav: [navEntry("users", { section: "admin" }), navEntry("home")],
      },
    ];
    expect(resolveNav(features, owner).admin).toEqual([]);
    expect(resolveNav(features, platformAdmin).admin.map(({ id }) => id)).toEqual(["users"]);
  });

  it("still asks an admin entry for its minimum role", () => {
    const entry = { section: "admin", minRole: "owner" } as const;

    expect(isVisible(entry, { role: "admin", isPlatformAdmin: true })).toBe(false);
    expect(isVisible(entry, { role: "owner", isPlatformAdmin: true })).toBe(true);
  });
});

describe("collecting entries", () => {
  it("keeps the first of two entries with the same id, then sorts by order", () => {
    const first = [
      { id: "a", order: 30, from: "first" },
      { id: "b", order: 10, from: "first" },
    ];
    const second = [
      { id: "a", order: 5, from: "second" },
      { id: "c", order: 20, from: "second" },
    ];

    expect(collectEntries([first, undefined, second], owner)).toEqual([
      { id: "b", order: 10, from: "first" },
      { id: "c", order: 20, from: "second" },
      { id: "a", order: 30, from: "first" },
    ]);
  });

  it("keeps the order of the registry between entries of the same order", () => {
    const lists = [
      [{ id: "x", order: 10 }],
      [{ id: "y", order: 10 }, { id: "z", order: 10 }],
    ];

    expect(collectEntries(lists, owner).map(({ id }) => id)).toEqual(["x", "y", "z"]);
  });

  it("leaves out what the viewer may not see", () => {
    const list = [
      { id: "open", order: 10 },
      { id: "team", order: 20, minRole: "admin" as const },
    ];

    expect(collectEntries([list], member).map(({ id }) => id)).toEqual(["open"]);
    expect(collectEntries([list], admin).map(({ id }) => id)).toEqual(["open", "team"]);
  });

  it("draws nothing from no list", () => {
    expect(collectEntries([], owner)).toEqual([]);
    expect(collectEntries([undefined, []], owner)).toEqual([]);
  });

  it("does not change the lists it reads", () => {
    const list = [{ id: "b", order: 20 }, { id: "a", order: 10 }];

    collectEntries([list], owner);

    expect(list.map(({ id }) => id)).toEqual(["b", "a"]);
  });
});

describe("resolving the navigation", () => {
  it("puts each entry in its section, sorted by order", () => {
    const features: FeatureShell[] = [
      { id: "one", nav: [navEntry("late", { order: 30 }), navEntry("tools", { section: "secondary" })] },
      { id: "two", nav: [navEntry("early", { order: 10 })] },
    ];

    const nav = resolveNav(features, owner);

    expect(nav.main.map(({ id }) => id)).toEqual(["early", "late"]);
    expect(nav.secondary.map(({ id }) => id)).toEqual(["tools"]);
    expect(nav.admin).toEqual([]);
  });

  it("skips a feature that declares no navigation", () => {
    expect(resolveNav([{ id: "bare" }], owner)).toEqual({ main: [], secondary: [], admin: [] });
  });
});

describe("quotas", () => {
  it("drops a quota without a known limit", () => {
    expect(resolveQuota(projectsQuota, 3, null)).toBeNull();
    expect(resolveQuota(projectsQuota, 3, planWith({ members: 5 }))).toBeNull();
  });

  it("reads -1 as unlimited", () => {
    expect(resolveQuota(projectsQuota, 120, planWith({ projects: -1 }))).toMatchObject({
      used: 120,
      limit: -1,
      status: "unlimited",
    });
  });

  it("warns from 80 % and stops at the limit", () => {
    const statusAt = (used: number, limit: number) =>
      resolveQuota(projectsQuota, used, planWith({ projects: limit }))?.status;

    expect(statusAt(39, 50)).toBe("ok");
    expect(statusAt(40, 50)).toBe("warning");
    expect(statusAt(49, 50)).toBe("warning");
    expect(statusAt(50, 50)).toBe("limit");
    expect(statusAt(80, 50)).toBe("limit");
    expect(statusAt(0, 0)).toBe("limit");
    expect(statusAt(4, 0)).toBe("limit");
  });

  it("keeps what the entry declares and drops its loader", () => {
    const resolved = resolveQuota(
      { ...projectsQuota, unit: "megabyte", tone: 4, order: 30 },
      3,
      planWith({ projects: 10 }),
    );

    expect(resolved).toEqual({
      id: "projects",
      limitKey: "projects",
      labelKey: "quotas.projects",
      icon: HouseIcon,
      unit: "megabyte",
      tone: 4,
      order: 30,
      used: 3,
      limit: 10,
      status: "ok",
    });
    expect(resolved).not.toHaveProperty("usage");
  });

  it("puts reached limits before warnings", () => {
    const quota = (id: string, status: QuotaStatus) => ({ id, status });

    expect(
      needsAttention([quota("a", "warning"), quota("b", "ok"), quota("c", "limit")]).map(({ id }) => id),
    ).toEqual(["c", "a"]);
  });

  it("keeps the order of entry inside each group, and ignores what is fine", () => {
    const quota = (id: string, status: QuotaStatus) => ({ id, status });

    expect(
      needsAttention([
        quota("a", "warning"),
        quota("b", "limit"),
        quota("c", "unlimited"),
        quota("d", "limit"),
        quota("e", "warning"),
        quota("f", "ok"),
      ]).map(({ id }) => id),
    ).toEqual(["b", "d", "a", "e"]);
    expect(needsAttention([quota("a", "ok"), quota("b", "unlimited")])).toEqual([]);
  });
});

describe("which quotas are read", () => {
  const quota = (id: string, order: number): QuotaContribution => ({
    ...projectsQuota,
    id,
    limitKey: id,
    order,
  });
  const features: FeatureShell[] = [
    { id: "one", quotas: [quota("storage", 30), quota("projects", 10)] },
    { id: "bare" },
    { id: "two", quotas: [quota("members", 20)] },
  ];

  it("keeps the quotas the plan limits, in order, whichever feature declares them", () => {
    const plan = planWith({ projects: 50, members: 10, storage: 1000 });

    expect(quotasToRead(features, owner, plan).map(({ id }) => id)).toEqual(["projects", "members", "storage"]);
  });

  it("leaves out a quota the plan does not name: it is not shown, so it is not counted", () => {
    const plan = planWith({ projects: 50 });

    expect(quotasToRead(features, owner, plan).map(({ id }) => id)).toEqual(["projects"]);
  });

  it("reads none without a plan", () => {
    expect(quotasToRead(features, owner, null)).toEqual([]);
  });

  it("keeps a quota that has no limit: it is shown, as unlimited", () => {
    expect(quotasToRead(features, owner, planWith({ projects: -1 })).map(({ id }) => id)).toEqual(["projects"]);
  });

  it("keeps the first of two quotas that share an id", () => {
    const first = { ...quota("projects", 10), labelKey: "first" };
    const second = { ...quota("projects", 5), labelKey: "second" };

    expect(
      quotasToRead([{ id: "a", quotas: [first] }, { id: "b", quotas: [second] }], owner, planWith({ projects: 5 })),
    ).toEqual([first]);
  });

  it("keeps what the entry declares, loader included: it is what is read", () => {
    const [read] = quotasToRead(features, owner, planWith({ projects: 50 }));

    expect(read).toBe(features[0]?.quotas?.[1]);
    expect(read?.usage).toBeTypeOf("function");
  });
});

describe("words", () => {
  it("formats a tab title", () => {
    expect(
      formatPageTitle({ page: "Projects", context: "Acme", product: "SaaS Boilerplate" }),
    ).toBe("Projects · Acme — SaaS Boilerplate");
    expect(formatPageTitle({ page: "Projects", product: "SaaS Boilerplate" })).toBe(
      "Projects — SaaS Boilerplate",
    );
  });

  it("leaves the context out when it is empty", () => {
    expect(formatPageTitle({ page: "Home", context: null, product: "App" })).toBe("Home — App");
    expect(formatPageTitle({ page: "Home", context: "", product: "App" })).toBe("Home — App");
    expect(formatPageTitle({ page: "Home", context: "  ", product: "App" })).toBe("Home — App");
  });

  it("finds a first name", () => {
    expect(firstNameOf("  Camille  Laurent ")).toBe("Camille");
    expect(firstNameOf("Camille")).toBe("Camille");
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf("   ")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf(undefined)).toBeNull();
  });
});

describe("paths", () => {
  it("matches a path and its children only", () => {
    expect(isActivePath("/settings/team", "/settings")).toBe(true);
    expect(isActivePath("/settings", "/settings")).toBe(true);
    expect(isActivePath("/dashboard", "/dashboard")).toBe(true);
    expect(isActivePath("/settings-old", "/settings")).toBe(false);
    expect(isActivePath("/settings", "/settings/team")).toBe(false);
    expect(isActivePath("/projects", "/dashboard")).toBe(false);
  });

  it("takes the root for the root page alone", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/dashboard", "/")).toBe(false);
  });

  it("ignores a trailing slash, a query and a fragment", () => {
    expect(isActivePath("/settings/", "/settings")).toBe(true);
    expect(isActivePath("/settings/team", "/settings/")).toBe(true);
    expect(isActivePath("/settings/team", "/settings?tab=1")).toBe(true);
    expect(isActivePath("/settings", "/settings#top")).toBe(true);
  });
});

describe("the tab bar", () => {
  it("keeps four tabs and sends the rest to More", () => {
    expect(splitTabBar([1, 2, 3, 4, 5, 6])).toEqual({
      tabs: [1, 2, 3, 4],
      overflow: [5, 6],
    });
  });

  it("sends nothing to More when everything fits", () => {
    expect(splitTabBar([1, 2, 3])).toEqual({ tabs: [1, 2, 3], overflow: [] });
    expect(splitTabBar([])).toEqual({ tabs: [], overflow: [] });
  });

  it("takes the number of tabs from its second argument", () => {
    expect(splitTabBar([1, 2, 3, 4, 5], 2)).toEqual({
      tabs: [1, 2],
      overflow: [3, 4, 5],
    });
  });
});
