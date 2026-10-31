"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/auth/guards";
import { featureFlag } from "@/models/feature-flag";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { invalidateFlagCache } from "./helpers";

const flagFields = {
  key: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500),
  enabled: z.boolean(),
  rules: z.array(z.object({
    type: z.enum(["plan", "org"]),
    value: z.string(),
  })),
};

const flagSchema = z.object({
  ...flagFields,
  description: flagFields.description.default(""),
  enabled: flagFields.enabled.default(false),
  rules: flagFields.rules.default([]),
});

// No defaults here: with Zod 4, partial() would still apply them and reset omitted fields.
const flagUpdateSchema = z.object(flagFields).partial();

const flagIdSchema = z.string().min(1).max(100);

export async function createFeatureFlag(input: z.infer<typeof flagSchema>) {
  await requireAdmin();
  const parsed = flagSchema.parse(input);

  await db.insert(featureFlag).values({
    id: generateId(),
    ...parsed,
  });

  revalidatePath("/admin/features");
}

async function applyFlagUpdate(
  flagId: string,
  input: z.infer<typeof flagUpdateSchema>,
) {
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

export async function updateFeatureFlag(
  flagId: string,
  input: z.infer<typeof flagUpdateSchema>,
) {
  await requireAdmin();
  return applyFlagUpdate(flagIdSchema.parse(flagId), flagUpdateSchema.parse(input));
}

export async function deleteFeatureFlag(flagId: string) {
  await requireAdmin();
  const id = flagIdSchema.parse(flagId);

  const flag = await db.query.featureFlag.findFirst({
    where: eq(featureFlag.id, id),
  });

  await db.delete(featureFlag).where(eq(featureFlag.id, id));

  if (flag) invalidateFlagCache(flag.key);
  revalidatePath("/admin/features");
}

export async function toggleFeatureFlag(flagId: string, enabled: boolean) {
  await requireAdmin();
  return applyFlagUpdate(flagIdSchema.parse(flagId), { enabled: z.boolean().parse(enabled) });
}
