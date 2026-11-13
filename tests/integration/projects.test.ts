import type { ProjectStatus } from "@/features/projects/schemas";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitEvent } from "@/features/events/emitter";
import { createProject, deleteProject, updateProject } from "@/features/projects/actions";
import { countProjects, getProject, listProjects, listRecentProjects, PROJECTS_PAGE_SIZE } from "@/features/projects/queries";
import { organization } from "@/models/organization";
import { project } from "@/models/project";
import { user } from "@/models/user";
import { seedOrg, seedProject, seedUser } from "../helpers/seed";
import { testDb } from "../setup";

/**
 * The guards are the mocked ones (tests/setup.ts): they let "test-user-1" into
 * any workspace with any role. What these tests pin is that every read and
 * write is scoped to the workspace named in the call, so an id from another
 * workspace finds nothing. The guards themselves are in server-action-guards.test.ts.
 */

const USER_ID = "test-user-1";
const ORG_A = "org-a";
const ORG_B = "org-b";

async function resetProjects() {
  await testDb.delete(project);
  await seedUser(USER_ID);
  await seedOrg(ORG_A);
  await seedOrg(ORG_B);
}

/** The stored row, to check what an action left behind. */
async function rowOf(id: string) {
  const [row] = await testDb.select().from(project).where(eq(project.id, id));
  return row;
}

describe("project queries", () => {
  beforeEach(resetProjects);

  it("lists the projects of a workspace, last updated first", async () => {
    await seedUser("pr-author", { name: "Ada Lovelace" });
    await seedProject(ORG_A, { id: "older", name: "Older", updatedAt: new Date("2026-01-10T09:00:00Z") });
    await seedProject(ORG_A, {
      id: "newer",
      name: "Newer",
      description: "The latest one",
      status: "active",
      createdBy: "pr-author",
      createdAt: new Date("2026-01-01T09:00:00Z"),
      updatedAt: new Date("2026-02-10T09:00:00Z"),
    });
    await seedProject(ORG_B, { id: "elsewhere", updatedAt: new Date("2026-03-10T09:00:00Z") });

    // Display fields only: neither the workspace id nor the creator's id leaves the query
    expect(await listProjects(ORG_A)).toEqual([
      {
        id: "newer",
        name: "Newer",
        description: "The latest one",
        status: "active",
        createdByName: "Ada Lovelace",
        createdAt: new Date("2026-01-01T09:00:00Z"),
        updatedAt: new Date("2026-02-10T09:00:00Z"),
      },
      {
        id: "older",
        name: "Older",
        description: null,
        status: "draft",
        createdByName: null,
        createdAt: expect.any(Date),
        updatedAt: new Date("2026-01-10T09:00:00Z"),
      },
    ]);
  });

  // The list is the entity people copy: a read that has no end is the first thing a big workspace would feel
  describe("a page of the list", () => {
    /**
     * `count` projects of the workspace, changed one minute apart: `row-00` is the newest. A second
     * workspace takes a prefix of its own: ids are unique, and a row that reuses an id is not written.
     */
    async function seedRows(count: number, orgId = ORG_A, prefix = "row") {
      const start = Date.UTC(2026, 0, 1);
      for (let index = 0; index < count; index += 1) {
        const id = `${prefix}-${String(index).padStart(2, "0")}`;
        await seedProject(orgId, { id, name: id, updatedAt: new Date(start + (count - index) * 60_000) });
      }
    }

    const idsOf = (summaries: { id: string }[]) => summaries.map((summary) => summary.id);

    it("holds twelve projects, and the first page is the one asked for when none is", async () => {
      await seedRows(30);

      expect(PROJECTS_PAGE_SIZE).toBe(12);
      expect(await listProjects(ORG_A)).toHaveLength(12);
      expect(idsOf(await listProjects(ORG_A))).toEqual(idsOf(await listProjects(ORG_A, 1)));
    });

    it("gives each page its own twelve, the most recently changed first, and the rest on the last", async () => {
      await seedRows(30);

      const pages = [await listProjects(ORG_A, 1), await listProjects(ORG_A, 2), await listProjects(ORG_A, 3)];

      expect(pages.map((summaries) => summaries.length)).toEqual([12, 12, 6]);
      expect(idsOf(pages.flat())).toEqual(Array.from({ length: 30 }, (_, index) => `row-${String(index).padStart(2, "0")}`));
    });

    it("takes the size of a page it is given", async () => {
      await seedRows(7);

      expect(idsOf(await listProjects(ORG_A, 2, 3))).toEqual(["row-03", "row-04", "row-05"]);
      expect(idsOf(await listProjects(ORG_A, 3, 3))).toEqual(["row-06"]);
    });

    it("gives nothing for a page past the last: the page decides what to show of it", async () => {
      await seedRows(5);

      expect(await listProjects(ORG_A, 2)).toEqual([]);
    });

    // Projects changed at the same moment (an import, a script) must not be repeated or lost from one page to the next
    it("keeps the order of projects changed at the same moment, so that no page repeats or skips one", async () => {
      const at = new Date("2026-01-01T09:00:00Z");
      for (let index = 0; index < 30; index += 1) {
        await seedProject(ORG_A, { id: `same-${String(index).padStart(2, "0")}`, updatedAt: at });
      }

      const seen = [
        ...idsOf(await listProjects(ORG_A, 1)),
        ...idsOf(await listProjects(ORG_A, 2)),
        ...idsOf(await listProjects(ORG_A, 3)),
      ];

      expect(seen).toHaveLength(30);
      expect(new Set(seen).size).toBe(30);
    });

    it("reads only the workspace it is given, whatever the page", async () => {
      await seedRows(14);
      await seedRows(14, ORG_B, "other");

      // Both workspaces hold projects: a page that did not filter would hold twelve here, and rows of the other
      expect(await countProjects(ORG_B)).toBe(14);
      expect(idsOf(await listProjects(ORG_A, 2))).toEqual(["row-12", "row-13"]);
      expect(idsOf(await listProjects(ORG_B, 2))).toEqual(["other-12", "other-13"]);
      expect(await countProjects(ORG_A)).toBe(14);
    });
  });

  it("never returns the project of another workspace", async () => {
    await seedProject(ORG_A, { id: "p1" });

    expect(await getProject(ORG_B, "p1")).toBeNull();
    expect(await listProjects(ORG_B)).toEqual([]);
    expect(await listRecentProjects(ORG_B)).toEqual([]);
    expect(await countProjects(ORG_B)).toBe(0);
    expect((await getProject(ORG_A, "p1"))?.id).toBe("p1");
  });

  it("counts and keeps the three most recent", async () => {
    // Inserted out of order: the order comes from updatedAt, not from the insertion
    await seedProject(ORG_A, { id: "p3", updatedAt: new Date("2026-01-03T09:00:00Z") });
    await seedProject(ORG_A, { id: "p1", updatedAt: new Date("2026-01-01T09:00:00Z") });
    await seedProject(ORG_A, { id: "p4", updatedAt: new Date("2026-01-04T09:00:00Z") });
    await seedProject(ORG_A, { id: "p2", updatedAt: new Date("2026-01-02T09:00:00Z") });
    await seedProject(ORG_B, { id: "elsewhere", updatedAt: new Date("2026-01-05T09:00:00Z") });

    expect(await countProjects(ORG_A)).toBe(4);
    expect((await listRecentProjects(ORG_A)).map((summary) => summary.id)).toEqual(["p4", "p3", "p2"]);
    expect((await listRecentProjects(ORG_A, 1)).map((summary) => summary.id)).toEqual(["p4"]);
  });
});

describe("project actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetProjects();
  });

  describe("createProject", () => {
    it("creates a draft with a trimmed name and records the creator", async () => {
      // The next/cache mock keeps calls across tests: only this action's calls count here
      vi.mocked(revalidatePath).mockClear();
      const result = await createProject({ organizationId: ORG_A, name: "  Atlas  " });

      const rows = await testDb.select().from(project);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        organizationId: ORG_A,
        name: "Atlas",
        description: null,
        status: "draft",
        createdBy: USER_ID,
      });
      expect(result).toEqual({ success: true, data: { id: rows[0].id } });
      expect(vi.mocked(emitEvent)).toHaveBeenCalledWith("project.created", {
        orgId: ORG_A,
        actorId: USER_ID,
        resourceType: "project",
        resourceId: rows[0].id,
        metadata: { name: "Atlas" },
      });
      // The list and the home page show projects: both are refreshed
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/projects");
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard");
    });

    it("takes the creator and the status from the server, whatever the input carries", async () => {
      // The forged creator exists, so a row that kept it would be accepted by the foreign key
      await seedUser("someone-else");

      // Not inputs of createProject, whatever the caller sends: a browser posts what it likes, and a variable is not
      // checked for excess fields as a literal is
      const forged = { organizationId: ORG_A, name: "Atlas", createdBy: "someone-else", status: "active" };
      const result = await createProject(forged);

      expect(result.success).toBe(true);
      const [row] = await testDb.select().from(project);
      expect(row).toMatchObject({ createdBy: USER_ID, status: "draft" });
    });

    it("refuses an empty or overlong name", async () => {
      for (const name of ["", "   ", "x".repeat(81)]) {
        const result = await createProject({ organizationId: ORG_A, name });

        expect(result).toMatchObject({ success: false, validationErrors: { name: expect.any(Array) } });
      }

      expect(await testDb.select().from(project)).toHaveLength(0);
      expect(vi.mocked(emitEvent)).not.toHaveBeenCalled();
    });

    it("holds the name to 80 characters and the description to 280", async () => {
      const atTheLimits = await createProject({ organizationId: ORG_A, name: "x".repeat(80), description: "y".repeat(280) });
      const overlong = await createProject({ organizationId: ORG_A, name: "Atlas", description: "y".repeat(281) });

      expect(atTheLimits.success).toBe(true);
      expect(overlong).toMatchObject({ success: false, validationErrors: { description: expect.any(Array) } });
      expect(await testDb.select().from(project)).toHaveLength(1);
    });

    it("stores an emptied description as no description", async () => {
      await createProject({ organizationId: ORG_A, name: "Atlas", description: "   " });

      const [row] = await testDb.select().from(project);
      expect(row.description).toBeNull();
    });
  });

  describe("updateProject", () => {
    it("changes the given fields, bumps updatedAt and emits project.updated", async () => {
      const before = new Date("2026-01-01T09:00:00Z");
      await seedProject(ORG_A, { id: "p1", name: "Atlas", description: "Old", updatedAt: before });

      const result = await updateProject({ organizationId: ORG_A, projectId: "p1", name: "  Atlas 2  ", status: "active" });

      expect(result.success).toBe(true);
      const row = await rowOf("p1");
      expect(row).toMatchObject({ name: "Atlas 2", description: "Old", status: "active" });
      expect(row.updatedAt.getTime()).toBeGreaterThan(before.getTime());
      expect(vi.mocked(emitEvent)).toHaveBeenCalledWith("project.updated", {
        orgId: ORG_A,
        actorId: USER_ID,
        resourceType: "project",
        resourceId: "p1",
        metadata: { name: "Atlas 2" },
      });
    });

    it("updates only a project of the given workspace", async () => {
      const updatedAt = new Date("2026-01-01T09:00:00Z");
      await seedProject(ORG_A, { id: "p1", name: "Atlas", updatedAt });

      // The caller is let into workspace B, but the project belongs to A
      const result = await updateProject({ organizationId: ORG_B, projectId: "p1", name: "Hijacked", status: "active" });

      expect(result.success).toBe(false);
      expect(await rowOf("p1")).toMatchObject({ name: "Atlas", status: "draft", updatedAt });
      expect(vi.mocked(emitEvent)).not.toHaveBeenCalled();
    });

    it("reports a project that does not exist", async () => {
      const result = await updateProject({ organizationId: ORG_A, projectId: "missing", name: "Atlas" });

      expect(result.success).toBe(false);
      expect(vi.mocked(emitEvent)).not.toHaveBeenCalled();
    });

    it("clears the description when it is emptied and keeps it when it is not sent", async () => {
      await seedProject(ORG_A, { id: "p1", description: "Keep me" });

      await updateProject({ organizationId: ORG_A, projectId: "p1", name: "Renamed" });
      expect((await rowOf("p1")).description).toBe("Keep me");

      for (const emptied of [null, "", "   "]) {
        await testDb.update(project).set({ description: "Something" }).where(eq(project.id, "p1"));
        await updateProject({ organizationId: ORG_A, projectId: "p1", description: emptied });

        expect((await rowOf("p1")).description).toBeNull();
      }
    });

    it("refuses an empty name and an unknown status", async () => {
      await seedProject(ORG_A, { id: "p1", name: "Atlas" });

      const emptyName = await updateProject({ organizationId: ORG_A, projectId: "p1", name: "  " });
      // "archived" is not one of PROJECT_STATUSES, whatever the caller sends: what arrives is a string
      const sent: string = "archived";
      const unknownStatus = await updateProject({ organizationId: ORG_A, projectId: "p1", status: sent as ProjectStatus });

      expect(emptyName.success).toBe(false);
      expect(unknownStatus.success).toBe(false);
      expect(await rowOf("p1")).toMatchObject({ name: "Atlas", status: "draft" });
    });
  });

  describe("deleteProject", () => {
    it("deletes a project", async () => {
      await seedProject(ORG_A, { id: "p1", name: "Atlas" });
      await seedProject(ORG_A, { id: "p2" });

      const result = await deleteProject({ organizationId: ORG_A, projectId: "p1" });

      expect(result.success).toBe(true);
      expect(await rowOf("p1")).toBeUndefined();
      expect(await rowOf("p2")).toBeDefined();
      expect(vi.mocked(emitEvent)).toHaveBeenCalledWith("project.deleted", {
        orgId: ORG_A,
        actorId: USER_ID,
        resourceType: "project",
        resourceId: "p1",
        metadata: { name: "Atlas" },
      });
    });

    it("deletes only a project of the given workspace", async () => {
      await seedProject(ORG_A, { id: "p1" });

      // The caller is let into workspace B, but the project belongs to A
      const result = await deleteProject({ organizationId: ORG_B, projectId: "p1" });

      expect(result.success).toBe(false);
      expect(await rowOf("p1")).toBeDefined();
      expect(vi.mocked(emitEvent)).not.toHaveBeenCalled();
    });
  });
});

// What the database does on delete. The rules are the migration's: tests/setup.ts applies its SQL.
describe("project foreign keys", () => {
  beforeEach(resetProjects);

  it("deletes the projects of a workspace along with it", async () => {
    await seedOrg("org-doomed");
    await seedProject("org-doomed", { id: "goes" });
    await seedProject(ORG_B, { id: "stays" });

    await testDb.delete(organization).where(eq(organization.id, "org-doomed"));

    expect(await testDb.select({ id: project.id }).from(project)).toEqual([{ id: "stays" }]);
  });

  it("keeps a project when its creator is deleted, without a creator", async () => {
    await seedUser("pr-author", { name: "Ada Lovelace" });
    await seedProject(ORG_A, { id: "p1", createdBy: "pr-author" });
    expect(await getProject(ORG_A, "p1")).toMatchObject({ createdByName: "Ada Lovelace" });

    await testDb.delete(user).where(eq(user.id, "pr-author"));

    expect(await rowOf("p1")).toMatchObject({ id: "p1", createdBy: null });
    expect(await getProject(ORG_A, "p1")).toMatchObject({ id: "p1", createdByName: null });
  });
});
