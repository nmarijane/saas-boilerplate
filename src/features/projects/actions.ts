"use server";

import type { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireRole } from "@/features/auth/guards";
import { emitEvent } from "@/features/events/emitter";
import { withPlanLimit } from "@/features/plan-limits";
import { project } from "@/models/project";
import { db } from "@/shared/lib/DB";
import { safeAction } from "@/shared/lib/safe-action";
import { generateId } from "@/shared/utils/helpers";
import { DELETE_MIN_ROLE } from "./permissions";
import { createProjectSchema, deleteProjectSchema, updateProjectSchema } from "./schemas";

// The workspace comes from the input, and requireRole checks the caller belongs
// to it. The actor comes from the session, never from the input. Every write
// filters on the workspace and the id together, so an id from another
// workspace matches nothing.

// An emptied description is stored as null, not as an empty string. Not sent
// (undefined) stays undefined: the column keeps its value.
function orNull(text: string | null | undefined) {
  return text === undefined ? undefined : text || null;
}

// The pages that show projects: the list, and the home page (recent ones, quota).
function revalidateProjects() {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function createProject(input: z.infer<typeof createProjectSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = createProjectSchema.parse(input);
    const { session } = await requireRole(parsed.organizationId, "member");
    const id = generateId();

    // The plan's limit is checked with the workspace held, in the transaction that writes the row
    await withPlanLimit(parsed.organizationId, "projects", 1, async (tx) => {
      await tx.insert(project).values({
        id,
        organizationId: parsed.organizationId,
        name: parsed.name,
        description: orNull(parsed.description),
        status: "draft",
        createdBy: session.user.id,
      });
    });

    await emitEvent("project.created", {
      orgId: parsed.organizationId,
      actorId: session.user.id,
      resourceType: "project",
      resourceId: id,
      metadata: { name: parsed.name },
    });

    revalidateProjects();
    return { id };
  }, "Failed to create project");
}

export async function updateProject(input: z.infer<typeof updateProjectSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = updateProjectSchema.parse(input);
    const { session } = await requireRole(parsed.organizationId, "member");

    const [updated] = await db
      .update(project)
      .set({
        name: parsed.name,
        description: orNull(parsed.description),
        status: parsed.status,
        updatedAt: new Date(),
      })
      .where(and(eq(project.organizationId, parsed.organizationId), eq(project.id, parsed.projectId)))
      .returning();

    if (!updated) {
      throw new Error("Project not found");
    }

    await emitEvent("project.updated", {
      orgId: parsed.organizationId,
      actorId: session.user.id,
      resourceType: "project",
      resourceId: parsed.projectId,
      metadata: { name: updated.name },
    });

    revalidateProjects();
  }, "Failed to update project");
}

export async function deleteProject(input: z.infer<typeof deleteProjectSchema>) {
  return safeAction(async () => {
    await requireAuth();
    const parsed = deleteProjectSchema.parse(input);
    const { session } = await requireRole(parsed.organizationId, DELETE_MIN_ROLE);

    const [deleted] = await db
      .delete(project)
      .where(and(eq(project.organizationId, parsed.organizationId), eq(project.id, parsed.projectId)))
      .returning();

    if (!deleted) {
      throw new Error("Project not found");
    }

    await emitEvent("project.deleted", {
      orgId: parsed.organizationId,
      actorId: session.user.id,
      resourceType: "project",
      resourceId: parsed.projectId,
      metadata: { name: deleted.name },
    });

    revalidateProjects();
  }, "Failed to delete project");
}
