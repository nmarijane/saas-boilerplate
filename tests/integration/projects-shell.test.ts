import type { WorkspaceScope } from "@/shared/shell/contract";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewProjectButton } from "@/features/projects/components/new-project-button";
import { RecentProjects } from "@/features/projects/components/recent-projects";
import { projectsShell } from "@/features/projects/shell";
import { FEATURES } from "@/features/registry";
import { project } from "@/models/project";
import { seedOrg, seedProject, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

// Loading the shell loads the components it mounts, and with them the
// locale-aware navigation of next-intl, which no Next router runs for in a test.
// A stand-in gives them the names they import. Nothing is rendered here.
vi.mock("@/shared/lib/i18n-navigation", () => ({
  Link: () => null,
  getPathname: () => "",
  redirect: () => undefined,
  usePathname: () => "",
  useRouter: () => ({}),
}));

const ORG = "shell-org";
const OTHER_ORG = "shell-other-org";

function scopeOf(orgId: string, role: WorkspaceScope["role"] = "owner"): WorkspaceScope {
  return { orgId, userId: "test-user-1", role };
}

/** The one entry of a list the shell declares. */
function only<T>(entries: T[] | undefined): T {
  expect(entries).toHaveLength(1);
  return entries?.[0] as T;
}

describe("the shell of the projects", () => {
  beforeEach(async () => {
    await testDb.delete(project);
    await seedUser("test-user-1");
    await seedOrg(ORG);
    await seedOrg(OTHER_ORG);
  });

  it("counts the projects and marks the first step done once one exists", async () => {
    const quota = only(projectsShell.quotas);
    const task = only(projectsShell.tasks);

    expect(await quota.usage(scopeOf(ORG))).toBe(0);
    expect(await task.isDone(scopeOf(ORG))).toBe(false);

    await seedProject(ORG);

    expect(await quota.usage(scopeOf(ORG))).toBe(1);
    expect(await task.isDone(scopeOf(ORG))).toBe(true);
  });

  it("counts the projects of the workspace in the scope, and no other", async () => {
    await seedProject(OTHER_ORG);
    await seedProject(OTHER_ORG);
    await seedProject(ORG);

    expect(await only(projectsShell.quotas).usage(scopeOf(ORG))).toBe(1);
    expect(await only(projectsShell.quotas).usage(scopeOf(OTHER_ORG))).toBe(2);
    // The first step is done for the workspace that has a project, not for the one that has not
    await testDb.delete(project);
    await seedProject(OTHER_ORG);
    expect(await only(projectsShell.tasks).isDone(scopeOf(ORG))).toBe(false);
  });

  it("adds Projects to the main navigation, after Home and before the assistant", () => {
    expect(projectsShell.id).toBe("projects");
    expect(only(projectsShell.nav)).toMatchObject({
      id: "projects",
      section: "main",
      href: "/projects",
      labelKey: "projects.nav",
      order: 20,
    });
  });

  it("counts the projects against the limit of the plan, whose key is projects", () => {
    expect(only(projectsShell.quotas)).toMatchObject({
      id: "projects",
      limitKey: "projects",
      labelKey: "quotas.projects",
      tone: 1,
      order: 10,
    });
  });

  it("asks for a first project, on the page of the projects, from any role", () => {
    const task = only(projectsShell.tasks);

    expect(task).toMatchObject({
      id: "first-project",
      labelKey: "projects.task",
      tone: 1,
      order: 10,
      action: { href: "/projects", labelKey: "projects.taskAction" },
    });
    expect(task.minRole).toBeUndefined();
  });

  it("gives the home the recent projects, and a button to create one in the workspace of the scope", async () => {
    expect(only(projectsShell.homeSections)).toMatchObject({ id: "recent-projects", order: 10, Component: RecentProjects });

    const action = await projectsShell.HomeAction?.({ scope: scopeOf(ORG) });
    expect(action).toEqual(createElement(NewProjectButton, { orgId: ORG }));
  });

  it("sits in the registry right after the dashboard", () => {
    expect(FEATURES.slice(0, 2).map(({ id }) => id)).toEqual(["dashboard", "projects"]);
  });
});
