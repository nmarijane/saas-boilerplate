"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiTools, solutionAssignments } from "@/models";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { requirePlatformAdmin } from "./guards";

const toolSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["form", "chat"]),
  category: z.string().max(100).optional(),
});

export async function createToolAction(input: z.infer<typeof toolSchema>) {
  await requirePlatformAdmin();
  const parsed = toolSchema.parse(input);
  const id = generateId();
  await db.insert(aiTools).values({ id, ...parsed });
  revalidatePath("/platform");
  return { id };
}

export async function setToolStatusAction(
  toolId: string,
  status: "draft" | "published" | "archived",
) {
  await requirePlatformAdmin();
  const parsed = z.enum(["draft", "published", "archived"]).parse(status);
  await db
    .update(aiTools)
    .set({ status: parsed, updatedAt: new Date() })
    .where(eq(aiTools.id, toolId));
  revalidatePath("/platform");
}

export async function assignSolutionAction(
  solutionId: string,
  organizationId: string,
) {
  await requirePlatformAdmin();
  await db
    .insert(solutionAssignments)
    .values({ id: generateId(), solutionId, organizationId })
    .onConflictDoUpdate({
      target: [
        solutionAssignments.solutionId,
        solutionAssignments.organizationId,
      ],
      set: { status: "active", updatedAt: new Date() },
    });
  revalidatePath("/platform");
}
