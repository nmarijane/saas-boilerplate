import type {
  ActivityEntry,
  FeatureShell,
  HomeSection,
  PlanSummary,
  QuotaContribution,
  ShellRole,
  TaskContribution,
  WorkspaceScope,
} from "@/shared/shell/contract";
import type { ShellUser } from "@/shared/shell/view";
import { FolderIcon, KeyRoundIcon, UserPlusIcon } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHome } from "@/features/app-shell";
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

function context(role: ShellRole = "owner") {
  const acme = { id: "org-acme", name: "Acme", slug: "acme", role };
  vi.mocked(getWorkspaceContext).mockResolvedValue({
    user,
    workspace: acme,
    workspaces: [acme],
  });

  return { orgId: acme.id, userId: user.id, role } satisfies WorkspaceScope;
}

const pro: PlanSummary = { id: "pro", name: "Pro", limits: { projects: 50, members: 10 }, upgradeHref: "/settings/billing" };

function quota(id: string, usage: QuotaContribution["usage"], overrides: Partial<QuotaContribution> = {}): QuotaContribution {
  return { id, limitKey: id, labelKey: `quotas.${id}`, icon: FolderIcon, tone: 1, order: 10, usage, ...overrides };
}

function step(id: string, isDone: TaskContribution["isDone"], overrides: Partial<TaskContribution> = {}): TaskContribution {
  return {
    id,
    labelKey: `${id}.task`,
    icon: FolderIcon,
    tone: 1,
    order: 10,
    action: { href: `/${id}`, labelKey: `${id}.taskAction` },
    isDone,
    ...overrides,
  };
}

function entry(id: string): ActivityEntry {
  return { id, action: "project.created", actorName: "Léa", actorImage: null, values: {}, at: new Date("2026-11-03T10:00:00.000Z") };
}

const section = (id: string, order: number): HomeSection => ({ id, order, Component: () => null });

describe("getHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.features = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("the quotas", () => {
    it("takes the quotas of the shell, without reading anything again", async () => {
      const scope = context();
      const projects = vi.fn(async () => 12);
      const members = vi.fn(async () => 9);
      registry.features = [
        { id: "billing", plans: async (orgIds) => new Map(orgIds.map((id) => [id, pro] as const)) },
        { id: "projects", quotas: [quota("projects", projects)] },
        { id: "organization", quotas: [quota("members", members, { order: 20 })] },
      ];

      const home = await getHome(scope);

      expect(home.quotas.map(({ id, used, limit, status }) => ({ id, used, limit, status }))).toEqual([
        { id: "projects", used: 12, limit: 50, status: "ok" },
        { id: "members", used: 9, limit: 10, status: "warning" },
      ]);
      // The shell read each figure once for itself: the home asked for none
      expect(projects).toHaveBeenCalledOnce();
      expect(members).toHaveBeenCalledOnce();
      expect(home.quotas[0]).toMatchObject({ label: "t:quotas.projects", upgradeHref: "/settings/billing" });
    });

    it("gives the quotas of the workspace of the scope, and none for the scope of another one", async () => {
      const scope = context();
      registry.features = [
        { id: "billing", plans: async (orgIds) => new Map(orgIds.map((id) => [id, pro] as const)) },
        { id: "projects", quotas: [quota("projects", async () => 12)] },
      ];

      expect((await getHome(scope)).quotas.map(({ id }) => id)).toEqual(["projects"]);
      // The shell read the session's workspace: its figures are not those of another
      expect((await getHome({ ...scope, orgId: "org-globex" })).quotas).toEqual([]);
    });

    it("has none when the plan limits none of them", async () => {
      const scope = context();
      registry.features = [{ id: "projects", quotas: [quota("projects", async () => 1)] }];

      expect((await getHome(scope)).quotas).toEqual([]);
    });
  });

  describe("the first steps", () => {
    it("lists the steps in order, with their words, their icon and whether they are done", async () => {
      const scope = context();
      registry.features = [
        { id: "api-keys", tasks: [step("api-key", async () => false, { order: 30, tone: 2, icon: KeyRoundIcon })] },
        { id: "projects", tasks: [step("first-project", async () => true, { order: 10 })] },
        { id: "organization", tasks: [step("invite-team", async () => false, { order: 20, tone: 3, icon: UserPlusIcon })] },
      ];

      const home = await getHome(scope);

      expect(home.tasks.map(({ id, label, done, tone, action }) => ({ id, label, done, tone, action }))).toEqual([
        { id: "first-project", label: "t:first-project.task", done: true, tone: 1, action: { href: "/first-project", label: "t:first-project.taskAction" } },
        { id: "invite-team", label: "t:invite-team.task", done: false, tone: 3, action: { href: "/invite-team", label: "t:invite-team.taskAction" } },
        { id: "api-key", label: "t:api-key.task", done: false, tone: 2, action: { href: "/api-key", label: "t:api-key.taskAction" } },
      ]);
      expect(home.tasksDone).toBe(1);
    });

    it("draws each icon as <Icon aria-hidden=\"true\" />, like the rest of the shell", async () => {
      const scope = context();
      registry.features = [{ id: "projects", tasks: [step("first-project", async () => true)] }];

      const icon = (await getHome(scope)).tasks[0]?.icon;

      expect(isValidElement(icon)).toBe(true);
      if (!isValidElement<Record<string, unknown>>(icon)) return;
      expect(icon.type).toBe(FolderIcon);
      expect(icon.props["aria-hidden"]).toBe("true");
    });

    it("hides from a member the steps that need an admin, and shows them to an admin and an owner", async () => {
      const tasks: FeatureShell = {
        id: "mixed",
        tasks: [
          step("first-project", async () => false, { order: 10 }),
          step("invite-team", async () => false, { order: 20, minRole: "admin" }),
          step("api-key", async () => false, { order: 30, minRole: "admin" }),
        ],
      };
      registry.features = [tasks];

      expect((await getHome(context("member"))).tasks.map(({ id }) => id)).toEqual(["first-project"]);
      expect((await getHome(context("admin"))).tasks.map(({ id }) => id)).toEqual(["first-project", "invite-team", "api-key"]);
      expect((await getHome(context("owner"))).tasks.map(({ id }) => id)).toEqual(["first-project", "invite-team", "api-key"]);
    });

    it("does not even ask whether a step is done to someone who does not see it", async () => {
      const scope = context("member");
      const adminOnly = vi.fn(async () => true);
      registry.features = [{ id: "organization", tasks: [step("invite-team", adminOnly, { minRole: "admin" })] }];

      expect((await getHome(scope)).tasks).toEqual([]);
      expect(adminOnly).not.toHaveBeenCalled();
    });

    it("asks every step at the same time, with the scope of the workspace", async () => {
      const scope = context();
      const events: string[] = [];
      const given: WorkspaceScope[] = [];
      const slow = (id: string) => async (asked: WorkspaceScope) => {
        given.push(asked);
        events.push(`start ${id}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push(`end ${id}`);
        return true;
      };
      registry.features = [
        { id: "a", tasks: [step("a", slow("a"), { order: 10 })] },
        { id: "b", tasks: [step("b", slow("b"), { order: 20 })] },
        { id: "c", tasks: [step("c", slow("c"), { order: 30 })] },
      ];

      const home = await getHome(scope);

      // All three had started before the first one finished: none waited for another
      expect(events.slice(0, 3)).toEqual(["start a", "start b", "start c"]);
      expect(events).toHaveLength(6);
      expect(given).toEqual([scope, scope, scope]);
      expect(home.tasksDone).toBe(3);
    });

    it("drops the step whose loader fails, and only that one, saying so", async () => {
      const scope = context();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      registry.features = [
        {
          id: "mixed",
          tasks: [
            step("first-project", async () => true, { order: 10 }),
            step("invite-team", async () => {
              throw new Error("database is down");
            }, { order: 20 }),
            step("api-key", async () => false, { order: 30 }),
          ],
        },
      ];

      const home = await getHome(scope);

      expect(home.tasks.map(({ id }) => id)).toEqual(["first-project", "api-key"]);
      // What is counted is what is shown
      expect(home.tasksDone).toBe(1);
      expect(error).toHaveBeenCalledOnce();
      expect(String(error.mock.calls[0]?.[0])).toContain("invite-team");
    });

    it("keeps the first of two steps that share an id", async () => {
      const scope = context();
      const second = vi.fn(async () => true);
      registry.features = [
        { id: "one", tasks: [step("same", async () => false)] },
        { id: "two", tasks: [step("same", second)] },
      ];

      const home = await getHome(scope);

      expect(home.tasks).toHaveLength(1);
      expect(home.tasks[0]?.done).toBe(false);
      expect(second).not.toHaveBeenCalled();
    });
  });

  describe("the activity", () => {
    it("comes from the first feature that gives some, asked for the five latest of the workspace", async () => {
      const scope = context();
      const first = vi.fn(async (_scope: WorkspaceScope, _limit: number) => [entry("a1"), entry("a2")]);
      const second = vi.fn(async (_scope: WorkspaceScope, _limit: number) => [entry("b1")]);
      registry.features = [{ id: "bare" }, { id: "audit", activity: first }, { id: "other", activity: second }];

      const home = await getHome(scope);

      expect(home.activity?.map(({ id }) => id)).toEqual(["a1", "a2"]);
      expect(first).toHaveBeenCalledWith(scope, 5);
      expect(second).not.toHaveBeenCalled();
    });

    it("is empty, and still there, when the feature answers that nothing has happened yet: the home says so", async () => {
      const scope = context();
      registry.features = [{ id: "audit", activity: async () => [] }];

      expect((await getHome(scope)).activity).toEqual([]);
    });

    it("is left out (null) when no feature gives any: there is nothing to tell, and the home says nothing", async () => {
      const scope = context();
      registry.features = [{ id: "bare" }];

      expect((await getHome(scope)).activity).toBeNull();
    });

    it("is left out (null) when its loader fails, saying so, and the rest of the home stays", async () => {
      const scope = context();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      registry.features = [
        {
          id: "audit",
          activity: async () => {
            throw new Error("database is down");
          },
        },
        { id: "projects", tasks: [step("first-project", async () => true)] },
      ];

      const home = await getHome(scope);

      expect(home.activity).toBeNull();
      expect(home.tasks.map(({ id }) => id)).toEqual(["first-project"]);
      expect(error).toHaveBeenCalledOnce();
      expect(String(error.mock.calls[0]?.[0])).toContain("activity");
    });
  });

  describe("the sections and the main action", () => {
    it("gives the sections by order, whoever declares them, the first of two with the same id winning", async () => {
      const scope = context();
      const late = section("late", 30);
      const early = section("early", 10);
      const twin = section("early", 5);
      registry.features = [
        { id: "a", homeSections: [late, early] },
        { id: "b", homeSections: [twin, section("middle", 20)] },
      ];

      const home = await getHome(scope);

      expect(home.sections.map(({ id }) => id)).toEqual(["early", "middle", "late"]);
      expect(home.sections[0]).toBe(early);
    });

    it("takes the main action from the first feature of the registry that declares one", async () => {
      const scope = context();
      const first = () => null;
      const second = () => null;
      registry.features = [{ id: "bare" }, { id: "projects", HomeAction: first }, { id: "other", HomeAction: second }];

      expect((await getHome(scope)).HomeAction).toBe(first);
    });

    it("has no main action when no feature declares one", async () => {
      const scope = context();
      registry.features = [{ id: "bare" }];

      expect((await getHome(scope)).HomeAction).toBeNull();
    });
  });

  // The code of a feature can call a guard or `notFound()`: Next catches the errors it throws, higher up, to send the
  // person elsewhere, and a home that took one for a failure of the step or of the activity would be drawn for a
  // person who is on their way to the sign-in page.
  describe.each([
    ["a redirect (the session is gone)", () => redirect("/sign-in")],
    ["a not found", () => notFound()],
  ])("%s raised by a feature", (_, raise) => {
    it("is not taken for a first step that cannot be read", async () => {
      const scope = context();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      registry.features = [{ id: "projects", tasks: [step("first-project", async () => raise())] }];

      await expect(getHome(scope)).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_/) });
      expect(error).not.toHaveBeenCalled();
    });

    it("is not taken for the latest activity that cannot be read", async () => {
      const scope = context();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      registry.features = [{ id: "audit", activity: async () => raise() }];

      await expect(getHome(scope)).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_/) });
      expect(error).not.toHaveBeenCalled();
    });
  });

  it("is empty, and does not fail, when no feature gives anything", async () => {
    const scope = context();
    registry.features = [];

    expect(await getHome(scope)).toEqual({
      quotas: [],
      tasks: [],
      tasksDone: 0,
      activity: null,
      sections: [],
      HomeAction: null,
    });
  });
});
