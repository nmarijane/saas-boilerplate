"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/auth/guards";
import { featureFlag } from "@/models/feature-flag";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { invalidateFlagCache } from "./helpers";

const flagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).default(""),
  enabled: z.boolean().default(false),
  rules: z.array(z.object({
    type: z.enum(["plan", "org"]),
    value: z.string(),
  })).default([]),
});

export async function createFeatureFlag(input: z.infer<typeof flagSchema>) {
  await requireAdmin();
  const parsed = flagSchema.parse(input);

  await db.insert(featureFlag).values({
    id: generateId(),
    ...parsed,
  });

  revalidatePath("/admin/features");
}

export async function updateFeatureFlag(
  flagId: string,
  input: Partial<z.infer<typeof flagSchema>>,
) {
  await requireAdmin();

  const flag = await db.query.featureFlag.findFirst({
    where: eq(featureFlag.id, flagId),
  });

  if (!flag) throw new Error("Feature flag not found");

  await db
    .update(featureFlag)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(featureFlag.id, flagId));

  invalidateFlagCache(flag.key);
  revalidatePath("/admin/features");
}

export async function deleteFeatureFlag(flagId: string) {
  await requireAdmin();

  const flag = await db.query.featureFlag.findFirst({
    where: eq(featureFlag.id, flagId),
  });

  await db.delete(featureFlag).where(eq(featureFlag.id, flagId));

  if (flag) invalidateFlagCache(flag.key);
  revalidatePath("/admin/features");
}

export async function toggleFeatureFlag(flagId: string, enabled: boolean) {
  return updateFeatureFlag(flagId, { enabled });
}
