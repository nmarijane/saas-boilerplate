import type { ProjectStatus } from "./schemas";
import { and, count, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { project } from "@/models/project";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";
import "server-only";

// Every read takes the workspace the caller was checked against (the page's
// `requireWorkspace()`) and filters on it: an id from another workspace finds nothing.

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Display fields only. The creator is a left join: no name once that user is gone.
function selectSummaries() {
  return db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdByName: user.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })
    .from(project)
    .leftJoin(user, eq(project.createdBy, user.id));
}

// The column is plain text, and only the actions write it, with a PROJECT_STATUSES value.
function toSummary(row: Omit<ProjectSummary, "status"> & { status: string }): ProjectSummary {
  return { ...row, status: row.status as ProjectStatus };
}

/** How many projects a page of the list holds: four rows of three cards. */
export const PROJECTS_PAGE_SIZE = 12;

/**
 * One page of the projects of the workspace, the most recently changed first
 * (the first page, unless one is asked for). The list is read a page at a time: a
 * workspace can have as many projects as it likes, and no read has no end. The
 * order ends on the id, so that projects changed at the same moment (an import)
 * keep their place from one page to the next: none is repeated and none is
 * skipped. A page past the last is empty: the page that draws it decides what to
 * show instead (the last page).
 */
export async function listProjects(
  orgId: string,
  page = 1,
  pageSize = PROJECTS_PAGE_SIZE,
): Promise<ProjectSummary[]> {
  const rows = await selectSummaries()
    .where(eq(project.organizationId, orgId))
    .orderBy(desc(project.updatedAt), desc(project.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return rows.map(toSummary);
}

export async function getProject(orgId: string, projectId: string): Promise<ProjectSummary | null> {
  const [row] = await selectSummaries()
    .where(and(eq(project.organizationId, orgId), eq(project.id, projectId)))
    .limit(1);

  return row ? toSummary(row) : null;
}

/** How many projects a workspace has. The quota card, the first step and the list's pager ask in one render: a request counts them once. */
export const countProjects = cache(async (orgId: string): Promise<number> => {
  const [result] = await db
    .select({ count: count() })
    .from(project)
    .where(eq(project.organizationId, orgId));

  return result?.count ?? 0;
});

/** How many projects a workspace has, read fresh through `reader`: the figure the plan's limit is enforced with (`withPlanLimit`). */
export async function countProjectsFresh(orgId: string, reader: Pick<typeof db, "select"> = db): Promise<number> {
  const [result] = await reader.select({ count: count() }).from(project).where(eq(project.organizationId, orgId));

  return result?.count ?? 0;
}

export async function listRecentProjects(orgId: string, limit = 3): Promise<ProjectSummary[]> {
  const rows = await selectSummaries()
    .where(eq(project.organizationId, orgId))
    .orderBy(desc(project.updatedAt))
    .limit(limit);

  return rows.map(toSummary);
}
