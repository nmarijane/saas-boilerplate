import type { ReactNode } from "react";
import type { FeatureShell, PlanSummary, QuotaContribution, WorkspaceScope } from "@/shared/shell/contract";
import type { ShellUser } from "@/shared/shell/view";
import { FolderIcon, HouseIcon, UsersIcon } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appPageMetadata, getShell } from "@/features/app-shell";
import { getWorkspaceContext } from "@/features/auth/organization/workspace";

// The registry is the list of the real features; here it is a list the test sets.
const registry = vi.hoisted(() => ({ features: [] as FeatureShell[] }));

vi.mock("@/features/registry", () => ({
  get FEATURES() {
    return registry.features;
  },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => `t:${key}`,
}));

// Only the context is faked: `scopeOf` stays the real one.
vi.mock("@/features/auth/organization/workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/organization/workspace")>()),
  getWorkspaceContext: vi.fn(),
}));

const user: ShellUser = {
  id: "u1",
  name: "Camille Laurent",
  email: "camille@example.com",
  image: null,
  isPlatformAdmin: false,
};
const acme = { id: "org-acme", name: "Acme", slug: "acme", role: "owner" as const };
const globex = { id: "org-globex", name: "Globex", slug: "globex", role: "member" as const };

function context(overrides: Partial<Awaited<ReturnType<typeof getWorkspaceContext>>> = {}) {
  vi.mocked(getWorkspaceContext).mockResolvedValue({
    user,
    workspace: acme,
    workspaces: [acme, globex],
    ...overrides,
  });
}

const pro: PlanSummary = { id: "pro", name: "Pro", limits: { projects: 50, members: 10 }, upgradeHref: "/settings/billing" };

/** A plan provider that puts every workspace asked for on this plan. */
const plansOf = (plan: PlanSummary) => async (orgIds: readonly string[]) => new Map(orgIds.map((id) => [id, plan] as const));

const home: FeatureShell = {
  id: "dashboard",
  nav: [{ id: "home", section: "main", href: "/dashboard", labelKey: "shell.nav.home", icon: HouseIcon, order: 10 }],
};

function quotaFeature(id: string, usage: QuotaContribution["usage"]): FeatureShell {
  return {
    id,
    quotas: [{ id, limitKey: id, labelKey: `quotas.${id}`, icon: FolderIcon, tone: 1, order: 10, usage }],
  };
}

describe("the shell data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.features = [];
    context();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("takes out the quota whose loader fails, and only that one, saying so", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    registry.features = [
      home,
      { id: "billing", plans: plansOf(pro) },
      quotaFeature("projects", async () => 12),
      quotaFeature("members", async () => {
        throw new Error("database is down");
      }),
    ];

    const { view } = await getShell();

    expect(view.quotas.map(({ id }) => id)).toEqual(["projects"]);
    expect(view.quotas[0]).toMatchObject({ label: "t:quotas.projects", used: 12, limit: 50, status: "ok" });
    expect(view.nav.main.map(({ id }) => id)).toEqual(["home"]);
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0]?.[0])).toContain("members");
  });

  it("leaves the plan empty when the plan provider fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const usage = vi.fn(async () => 1);
    registry.features = [
      home,
      {
        id: "billing",
        plans: async () => {
          throw new Error("stripe is down");
        },
      },
      quotaFeature("projects", usage),
    ];

    const { view } = await getShell();

    expect(view.workspace?.plan).toBeNull();
    expect(view.workspaces.map(({ plan }) => plan)).toEqual([null, null]);
    // No plan, no known limit: no quota is shown. The usage was counted while the plans were read, so it is not waited for.
    expect(view.quotas).toEqual([]);
    expect(error).toHaveBeenCalled();
    expect(view.nav.main.map(({ id }) => id)).toEqual(["home"]);
  });

  it("shows a workspace the provider has no plan for without one, and keeps the plan of the others", async () => {
    registry.features = [
      home,
      { id: "billing", plans: async (orgIds) => new Map(orgIds.filter((id) => id !== globex.id).map((id) => [id, pro] as const)) },
    ];

    const { view } = await getShell();

    expect(view.workspaces.map(({ id, plan }) => [id, plan])).toEqual([
      [acme.id, "Pro"],
      [globex.id, null],
    ]);
  });

  it("asks the first plan provider of the registry once, for every workspace, and reads the usage of the active workspace only", async () => {
    const first = vi.fn(async (orgIds: readonly string[]) => new Map(orgIds.map((id) => [id, pro] as const)));
    const second = vi.fn(async (orgIds: readonly string[]) => new Map(orgIds.map((id) => [id, { ...pro, id: "free", name: "Free" }] as const)));
    const usage = vi.fn(async (_scope: WorkspaceScope) => 7);
    registry.features = [
      { id: "billing", plans: first },
      { id: "other", plans: second },
      quotaFeature("projects", usage),
    ];

    const { view } = await getShell();

    expect(first.mock.calls).toEqual([[[acme.id, globex.id]]]);
    expect(second).not.toHaveBeenCalled();
    expect(usage).toHaveBeenCalledOnce();
    expect(usage).toHaveBeenCalledWith({ orgId: acme.id, userId: user.id, role: "owner" });
    expect(view.workspace?.plan).toBe("Pro");
  });

  it("reads the usage while the plans are being read, not after", async () => {
    let releasePlans: (plans: Map<string, PlanSummary>) => void = () => {};
    const plansRead = new Promise<Map<string, PlanSummary>>((resolve) => {
      releasePlans = resolve;
    });
    const usage = vi.fn(async (_scope: WorkspaceScope) => 12);
    registry.features = [{ id: "billing", plans: () => plansRead }, quotaFeature("projects", usage)];

    const shell = getShell();
    await vi.waitFor(() => expect(usage).toHaveBeenCalledOnce());
    // The plans are still being read: the usage did not wait for them
    releasePlans(new Map([[acme.id, pro]]));

    expect((await shell).view.quotas[0]).toMatchObject({ id: "projects", used: 12, limit: 50 });
  });

  it("counts a quota whatever the plan, and shows it only when the plan states its limit", async () => {
    const projects = vi.fn(async (_scope: WorkspaceScope) => 3);
    const members = vi.fn(async (_scope: WorkspaceScope) => 2);
    const onlyProjects: PlanSummary = { ...pro, limits: { projects: 5 } };
    registry.features = [
      { id: "billing", plans: plansOf(onlyProjects) },
      quotaFeature("projects", projects),
      quotaFeature("members", members),
    ];

    const { view } = await getShell();

    expect(members).toHaveBeenCalledOnce();
    expect(view.quotas.map(({ id }) => id)).toEqual(["projects"]);
  });

  it("counts no quota when no feature gives plans: none could be shown", async () => {
    const usage = vi.fn(async (_scope: WorkspaceScope) => 1);
    registry.features = [home, quotaFeature("projects", usage)];

    const { view } = await getShell();

    expect(usage).not.toHaveBeenCalled();
    expect(view.quotas).toEqual([]);
  });

  it("reads nothing about a workspace for a user who has none", async () => {
    const plans = vi.fn(plansOf(pro));
    const usage = vi.fn(async () => 1);
    context({ user: { ...user, isPlatformAdmin: true }, workspace: null, workspaces: [] });
    registry.features = [home, { id: "billing", plans }, quotaFeature("projects", usage)];

    const { view } = await getShell();

    expect(plans).not.toHaveBeenCalled();
    expect(usage).not.toHaveBeenCalled();
    expect(view.workspace).toBeNull();
    expect(view.quotas).toEqual([]);
    expect(view.nav.main.map(({ id }) => id)).toEqual(["home"]);
  });

  // The address of the administration (/admin) sends to the first page of this section: a platform admin who
  // has made no workspace (the one of the seed, who is sent to the onboarding) must find it, or /admin is a 404
  it("gives a platform admin who has no workspace the pages of the administration", async () => {
    const admin: FeatureShell = {
      id: "admin",
      nav: [{ id: "users", section: "admin", href: "/admin/users", labelKey: "admin.users", icon: UsersIcon, order: 10 }],
    };
    context({ user: { ...user, isPlatformAdmin: true }, workspace: null, workspaces: [] });
    registry.features = [home, admin];

    const { view } = await getShell();

    expect(view.workspace).toBeNull();
    expect(view.nav.admin.map(({ id, href }) => [id, href])).toEqual([["users", "/admin/users"]]);
  });

  it("gives someone who is not a platform admin none of the pages of the administration, with a workspace or without", async () => {
    const admin: FeatureShell = {
      id: "admin",
      nav: [{ id: "users", section: "admin", href: "/admin/users", labelKey: "admin.users", icon: UsersIcon, order: 10 }],
    };
    registry.features = [home, admin];

    context();
    expect((await getShell()).view.nav.admin).toEqual([]);

    context({ workspace: null, workspaces: [] });
    expect((await getShell()).view.nav.admin).toEqual([]);
  });

  it("renders each icon as <Icon aria-hidden=\"true\" />", async () => {
    registry.features = [home];

    const { view } = await getShell();

    const icon = view.nav.main[0]?.icon;
    expect(isValidElement(icon)).toBe(true);
    if (!isValidElement<Record<string, unknown>>(icon)) return;
    expect(icon.type).toBe(HouseIcon);
    expect(icon.props["aria-hidden"]).toBe("true");
  });

  it("translates the labels with the root translator and names the product", async () => {
    registry.features = [home];

    const { view } = await getShell();

    expect(view.nav.main[0]?.label).toBe("t:shell.nav.home");
    expect(view.productName).toBe("SaaS Boilerplate");
    expect(view.nav.secondary.map(({ id, href }) => [id, href])).toEqual([["help", "mailto:support@example.com"]]);
  });

  it("gathers the providers, the notifications and the sidebar actions in registry order", async () => {
    const ProviderA = ({ children }: { children: ReactNode }) => children;
    const ProviderB = ({ children }: { children: ReactNode }) => children;
    const BellA = () => null;
    const BellB = () => null;
    const ActionA = () => null;
    const ActionB = () => null;
    const ActionC = () => null;
    registry.features = [
      { id: "one", Provider: ProviderA, Notifications: BellA, SidebarActions: [ActionA] },
      { id: "bare" },
      { id: "two", Provider: ProviderB, Notifications: BellB, SidebarActions: [ActionB, ActionC] },
    ];

    const shell = await getShell();

    expect(shell.Providers).toEqual([ProviderA, ProviderB]);
    expect(shell.Notifications).toBe(BellA);
    expect(shell.SidebarActions).toEqual([ActionA, ActionB, ActionC]);
  });

  it("has no notifications, providers or actions when no feature gives any", async () => {
    registry.features = [home];

    const shell = await getShell();

    expect(shell.Providers).toEqual([]);
    expect(shell.Notifications).toBeNull();
    expect(shell.SidebarActions).toEqual([]);
  });
});

// A feature that is asked for its plan or its usage runs code of its own, which can call a guard or `notFound()`: the
// errors that Next throws for these are caught by Next, higher up, to send the person elsewhere. A loader that took
// one for a failure of its feature would draw the shell with no plan and no quota, for a person who is on their way
// to the sign-in page.
describe.each([
  ["a redirect (the session is gone)", () => redirect("/sign-in")],
  ["a not found", () => notFound()],
])("%s raised by a feature", (_, raise) => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.features = [];
    context();
  });

  it("is not taken for a plan that cannot be read: the shell does not go on without it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    registry.features = [home, { id: "billing", plans: async () => raise() }];

    await expect(getShell()).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_/) });
    expect(error).not.toHaveBeenCalled();
  });

  it("is not taken for a quota whose usage cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    registry.features = [home, { id: "billing", plans: plansOf(pro) }, quotaFeature("projects", async () => raise())];

    await expect(getShell()).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_/) });
    expect(error).not.toHaveBeenCalled();
  });
});

describe("the page metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.features = [];
    context();
  });

  it("titles the page with the workspace, and keeps it out of the search engines", async () => {
    const metadata = await appPageMetadata("Projects");

    expect(metadata.title).toEqual({ absolute: "Projects · Acme — SaaS Boilerplate" });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("prefers the context it is given to the workspace", async () => {
    const metadata = await appPageMetadata("Settings", { context: "Atlas" });

    expect(metadata.title).toEqual({ absolute: "Settings · Atlas — SaaS Boilerplate" });
  });

  it("drops the context without a workspace", async () => {
    context({ workspace: null, workspaces: [] });
    const metadata = await appPageMetadata("Users");

    expect(metadata.title).toEqual({ absolute: "Users — SaaS Boilerplate" });
  });
});
