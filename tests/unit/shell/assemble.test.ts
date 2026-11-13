import type { FeatureShell, PlanSummary } from "@/shared/shell/contract";
import type { ShellUser } from "@/shared/shell/view";
import {
  CircleHelpIcon,
  CreditCardIcon,
  FolderIcon,
  HouseIcon,
  SlidersHorizontalIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { assembleShellView, shellRedirect } from "@/shared/shell/assemble";

type Input = Parameters<typeof assembleShellView>[0];

const user: ShellUser = {
  id: "u1",
  name: "Camille Laurent",
  email: "camille@example.com",
  image: null,
  isPlatformAdmin: false,
};
const platformAdmin: ShellUser = { ...user, isPlatformAdmin: true };
const acme = { id: "org-acme", name: "Acme", role: "owner" as const };
const globex = { id: "org-globex", name: "Globex", role: "member" as const };

const proPlan: PlanSummary = {
  id: "pro",
  name: "Pro",
  limits: { projects: 50 },
  upgradeHref: "/settings/billing",
};

const dashboard: FeatureShell = {
  id: "dashboard",
  nav: [
    { id: "home", section: "main", href: "/dashboard", labelKey: "shell.nav.home", icon: HouseIcon, order: 10 },
  ],
};

const projects: FeatureShell = {
  id: "projects",
  nav: [
    { id: "projects", section: "main", href: "/projects", labelKey: "projects.nav", icon: FolderIcon, order: 20 },
  ],
  quotas: [
    {
      id: "projects",
      limitKey: "projects",
      labelKey: "quotas.projects",
      icon: FolderIcon,
      tone: 1,
      order: 10,
      usage: async () => 0,
    },
  ],
};

const settings: FeatureShell = {
  id: "settings",
  nav: [
    {
      id: "settings",
      section: "secondary",
      href: "/settings/account",
      match: "/settings",
      labelKey: "shell.nav.settings",
      icon: SlidersHorizontalIcon,
      order: 10,
    },
  ],
  settings: [
    { id: "account", href: "/settings/account", labelKey: "settings.nav.account", icon: UserIcon, order: 10 },
  ],
  account: [
    { id: "account", href: "/settings/account", labelKey: "account.links.account", icon: UserIcon, order: 10 },
  ],
};

const team: FeatureShell = {
  id: "organization",
  settings: [
    { id: "team", href: "/settings/team", labelKey: "settings.nav.team", icon: UsersIcon, order: 20 },
  ],
};

const billing: FeatureShell = {
  id: "billing",
  plans: async (orgIds) => new Map(orgIds.map((id) => [id, proPlan] as const)),
  settings: [
    { id: "billing", href: "/settings/billing", labelKey: "settings.nav.billing", icon: CreditCardIcon, order: 30 },
  ],
  account: [
    { id: "billing", href: "/settings/billing", labelKey: "account.links.billing", icon: CreditCardIcon, order: 20 },
  ],
};

const developers: FeatureShell = {
  id: "api-keys",
  settings: [
    {
      id: "developers",
      href: "/settings/developers",
      labelKey: "settings.nav.developers",
      icon: UsersIcon,
      order: 40,
      minRole: "admin",
    },
  ],
};

const admin: FeatureShell = {
  id: "admin",
  nav: [
    { id: "users", section: "admin", href: "/admin/users", labelKey: "admin.users", icon: UsersIcon, order: 10 },
  ],
};

function assemble(overrides: Partial<Input> = {}) {
  return assembleShellView({
    snapshot: { user, workspace: acme, workspaces: [acme, globex] },
    features: [dashboard, projects, settings, team, billing],
    t: (key) => `t:${key}`,
    plans: new Map(),
    usage: new Map(),
    productName: "Acme Cloud",
    helpUrl: null,
    renderIcon: () => null,
    ...overrides,
  });
}

const ids = (links: { id: string }[]) => links.map(({ id }) => id);

describe("assembling the shell view", () => {
  it("draws each feature's entries in its section, in order", () => {
    // The registry order is not the display order: `order` decides.
    const view = assemble({
      features: [projects, admin, settings, dashboard],
      snapshot: { user: platformAdmin, workspace: acme, workspaces: [acme] },
    });

    expect(view.nav.main).toEqual([
      { id: "home", href: "/dashboard", label: "t:shell.nav.home", icon: null },
      { id: "projects", href: "/projects", label: "t:projects.nav", icon: null },
    ]);
    expect(view.nav.secondary).toEqual([
      { id: "settings", href: "/settings/account", label: "t:shell.nav.settings", icon: null, match: "/settings" },
    ]);
    expect(view.nav.admin).toEqual([
      { id: "users", href: "/admin/users", label: "t:admin.users", icon: null },
    ]);
    expect(view.settings).toEqual([
      { id: "account", href: "/settings/account", label: "t:settings.nav.account", icon: null },
    ]);
    expect(view.account).toEqual([
      { id: "account", href: "/settings/account", label: "t:account.links.account", icon: null },
    ]);
  });

  it("renders each icon through renderIcon", () => {
    const renderIcon = vi.fn(() => "icon");

    const view = assemble({ features: [dashboard, projects], renderIcon });

    expect(renderIcon).toHaveBeenCalledWith(HouseIcon);
    expect(renderIcon).toHaveBeenCalledWith(FolderIcon);
    expect(view.nav.main.map(({ icon }) => icon)).toEqual(["icon", "icon"]);
  });

  it("orders the settings tabs and the account links by order, across features", () => {
    const view = assemble({ features: [billing, team, settings] });

    expect(ids(view.settings)).toEqual(["account", "team", "billing"]);
    expect(ids(view.account)).toEqual(["account", "billing"]);
  });

  it("leaves out the admin section for an owner who is not a platform admin", () => {
    const features = [dashboard, admin];

    expect(assemble({ features }).nav.admin).toEqual([]);

    const withWorkspace = assemble({
      features,
      snapshot: { user: platformAdmin, workspace: acme, workspaces: [acme] },
    });
    expect(ids(withWorkspace.nav.admin)).toEqual(["users"]);

    // A platform admin keeps the section while they have no workspace.
    const withoutWorkspace = assemble({
      features,
      snapshot: { user: platformAdmin, workspace: null, workspaces: [] },
    });
    expect(ids(withoutWorkspace.nav.admin)).toEqual(["users"]);
  });

  it("adds Help only when a help URL is set", () => {
    const status: FeatureShell = {
      id: "status",
      nav: [
        { id: "status", section: "secondary", href: "/status", labelKey: "status.nav", icon: HouseIcon, order: 30 },
      ],
    };
    const features = [settings, status];
    const renderIcon = vi.fn(() => null);

    expect(ids(assemble({ features, helpUrl: null }).nav.secondary)).toEqual(["settings", "status"]);

    const view = assemble({ features, helpUrl: "mailto:support@example.com", renderIcon });

    // Help is the 20th entry of the secondary navigation: between the two.
    expect(view.nav.secondary).toEqual([
      expect.objectContaining({ id: "settings" }),
      { id: "help", href: "mailto:support@example.com", label: "t:shell.nav.help", icon: null },
      expect.objectContaining({ id: "status" }),
    ]);
    expect(renderIcon).toHaveBeenCalledWith(CircleHelpIcon);
    expect(view.nav.main).toEqual([]);
  });

  it("names each workspace's plan, or none without a plan provider", () => {
    const plans = new Map([[acme.id, proPlan]]);

    const view = assemble({ plans });

    expect(view.workspace).toEqual({ ...acme, plan: "Pro" });
    expect(view.workspaces).toEqual([
      { ...acme, plan: "Pro" },
      { ...globex, plan: null },
    ]);

    const without = assemble({ features: [dashboard, settings], plans: new Map() });
    expect(without.workspace?.plan).toBeNull();
    expect(without.workspaces.map(({ plan }) => plan)).toEqual([null, null]);
  });

  it("drops the entries of a feature that is not installed", () => {
    const plans = new Map([[acme.id, proPlan]]);
    const usage = new Map([["projects", 10]]);

    const installed = assemble({ features: [dashboard, projects, settings, billing], plans, usage });
    expect(ids(installed.settings)).toContain("billing");
    expect(ids(installed.account)).toContain("billing");
    expect(installed.workspace?.plan).toBe("Pro");
    expect(ids(installed.quotas)).toEqual(["projects"]);

    // Without billing nobody loads a plan, so there is no plan and no quota.
    const withoutBilling = assemble({ features: [dashboard, projects, settings], plans: new Map(), usage });
    expect(ids(withoutBilling.settings)).not.toContain("billing");
    expect(ids(withoutBilling.account)).not.toContain("billing");
    expect(withoutBilling.workspace?.plan).toBeNull();
    expect(withoutBilling.quotas).toEqual([]);

    // A quota goes with its own feature, whatever limits the plan names.
    const withoutProjects = assemble({ features: [dashboard, settings, billing], plans, usage });
    expect(withoutProjects.quotas).toEqual([]);
    expect(ids(withoutProjects.nav.main)).toEqual(["home"]);
  });

  it("sends a member without a workspace to onboarding, and lets a platform admin in", () => {
    const lost = { workspace: null, user };

    expect(shellRedirect(lost)).toBe("/onboarding");
    expect(shellRedirect({ ...lost, user: platformAdmin })).toBeNull();
    expect(
      shellRedirect({ workspace: { ...acme, plan: null }, user }),
    ).toBeNull();
  });
});

describe("the workspace of the view", () => {
  it("takes the role of the active workspace to filter the entries", () => {
    const features = [settings, team, developers];

    const asOwner = assemble({ features, snapshot: { user, workspace: acme, workspaces: [acme, globex] } });
    const asMember = assemble({ features, snapshot: { user, workspace: globex, workspaces: [acme, globex] } });

    expect(ids(asOwner.settings)).toEqual(["account", "team", "developers"]);
    expect(ids(asMember.settings)).toEqual(["account", "team"]);
  });

  it("takes the quotas from the active workspace only", () => {
    const plans = new Map<string, PlanSummary>([
      [acme.id, { ...proPlan, limits: { projects: 50 }, upgradeHref: "/settings/billing" }],
      [globex.id, { id: "free", name: "Free", limits: { projects: 3 }, upgradeHref: null }],
    ]);
    const usage = new Map([["projects", 40]]);

    const inAcme = assemble({ features: [projects], plans, usage });
    expect(inAcme.quotas).toEqual([
      {
        id: "projects",
        label: "t:quotas.projects",
        used: 40,
        limit: 50,
        status: "warning",
        icon: null,
        tone: 1,
        upgradeHref: "/settings/billing",
      },
    ]);

    const inGlobex = assemble({
      features: [projects],
      snapshot: { user, workspace: globex, workspaces: [acme, globex] },
      plans,
      usage,
    });
    expect(inGlobex.quotas).toEqual([
      expect.objectContaining({ id: "projects", used: 40, limit: 3, status: "limit", upgradeHref: null }),
    ]);
  });

  // A role that may not change the plan is not offered the way to do it: the plan
  // names the lowest role that may (billing asks an admin), and the quota cards of
  // anyone below it have no Upgrade link.
  it("offers the upgrade of a quota only from the role the plan names", () => {
    const team = { id: "org-team", name: "Team", role: "admin" as const };
    const plans = new Map<string, PlanSummary>(
      [acme, globex, team].map(({ id }) => [id, { ...proPlan, upgradeMinRole: "admin" as const }]),
    );
    const usage = new Map([["projects", 40]]);
    const upgradeOf = (workspace: typeof acme | typeof globex | typeof team) =>
      assemble({
        features: [projects],
        snapshot: { user, workspace, workspaces: [acme, globex, team] },
        plans,
        usage,
      }).quotas.map(({ upgradeHref }) => upgradeHref);

    expect(upgradeOf(acme)).toEqual(["/settings/billing"]);
    expect(upgradeOf(team)).toEqual(["/settings/billing"]);
    expect(upgradeOf(globex)).toEqual([null]);
    // A plan that names no role offers it to everyone, as before
    expect(assemble({
      features: [projects],
      snapshot: { user, workspace: globex, workspaces: [acme, globex] },
      plans: new Map([[globex.id, proPlan]]),
      usage,
    }).quotas.map(({ upgradeHref }) => upgradeHref)).toEqual(["/settings/billing"]);
  });

  it("draws no quota without a workspace", () => {
    const view = assemble({
      features: [dashboard, projects],
      snapshot: { user: platformAdmin, workspace: null, workspaces: [] },
      plans: new Map([[acme.id, proPlan]]),
      usage: new Map([["projects", 1]]),
    });

    expect(view.quotas).toEqual([]);
    expect(view.workspace).toBeNull();
    expect(view.workspaces).toEqual([]);
    expect(ids(view.nav.main)).toEqual(["home", "projects"]);
  });

  it("leaves out a quota whose usage could not be read", () => {
    const view = assemble({ features: [projects], plans: new Map([[acme.id, proPlan]]), usage: new Map() });

    expect(view.quotas).toEqual([]);
  });

  it("carries the unit of a quota and keeps -1 as unlimited", () => {
    const storage: FeatureShell = {
      id: "upload",
      quotas: [
        {
          id: "storage",
          limitKey: "storage",
          labelKey: "quotas.storage",
          unit: "megabyte",
          icon: FolderIcon,
          tone: 4,
          order: 30,
          usage: async () => 0,
        },
      ],
    };
    const plans = new Map([[acme.id, { ...proPlan, limits: { storage: -1 } }]]);

    const view = assemble({ features: [storage], plans, usage: new Map([["storage", 3200]]) });

    expect(view.quotas).toEqual([
      expect.objectContaining({ id: "storage", unit: "megabyte", used: 3200, limit: -1, status: "unlimited", tone: 4 }),
    ]);
  });

  it("passes the product name and the user through", () => {
    const view = assemble();

    expect(view.productName).toBe("Acme Cloud");
    expect(view.user).toBe(user);
  });
});
