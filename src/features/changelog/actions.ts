"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/features/auth/guards";
import { changelogEntry } from "@/models/changelog";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

const changelogSchema = z.object({
  version: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  publishedAt: z.date().optional(),
});

export async function createChangelogEntry(
  input: z.infer<typeof changelogSchema>,
) {
  await requireAdmin();
  const parsed = changelogSchema.parse(input);

  await db.insert(changelogEntry).values({
    id: generateId(),
    ...parsed,
  });

  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
}

export async function updateChangelogEntry(
  entryId: string,
  input: Partial<z.infer<typeof changelogSchema>>,
) {
  await requireAdmin();

  await db
    .update(changelogEntry)
    .set(input)
    .where(eq(changelogEntry.id, entryId));

  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
}

export async function deleteChangelogEntry(entryId: string) {
  await requireAdmin();

  await db.delete(changelogEntry).where(eq(changelogEntry.id, entryId));

  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
}
