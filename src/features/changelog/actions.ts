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

const entryIdSchema = z.string().min(1).max(100);

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
  const id = entryIdSchema.parse(entryId);
  const parsed = changelogSchema.partial().parse(input);

  await db
    .update(changelogEntry)
    .set(parsed)
    .where(eq(changelogEntry.id, id));

  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
}

export async function deleteChangelogEntry(entryId: string) {
  await requireAdmin();
  const id = entryIdSchema.parse(entryId);

  await db.delete(changelogEntry).where(eq(changelogEntry.id, id));

  revalidatePath("/admin/changelog");
  revalidatePath("/changelog");
}
