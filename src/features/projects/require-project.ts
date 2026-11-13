import { notFound } from "next/navigation";
import { cache } from "react";
import {
  requireWorkspace,
  scopeOf,
} from "@/features/auth/organization/workspace";
import { getProject } from "./queries";
import "server-only";

/**
 * The project of a page under /projects/[projectId], with the scope it was read
 * for. The workspace is the one of the session, never a parameter of the URL,
 * so an id from another workspace finds nothing: it is a 404, as one that does
 * not exist, and says nothing of the other workspace. The layout, the page and
 * its metadata render side by side and each ask, and the answer is read once
 * per request.
 */
export const requireProject = cache(async (projectId: string) => {
  const context = await requireWorkspace();
  const project = await getProject(context.workspace.id, projectId);
  if (!project) {
    notFound();
  }

  return { scope: scopeOf(context), project };
});
