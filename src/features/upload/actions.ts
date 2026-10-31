"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/features/auth/guards";
import { upload } from "@/models/upload";
import { db } from "@/shared/lib/DB";
import { canAccessUpload } from "./service";
import { getStorageAdapter } from "./storage/adapter";

const uploadIdSchema = z.string().min(1).max(100);

export async function deleteFile(uploadId: string) {
  const session = await requireAuth();
  const id = uploadIdSchema.parse(uploadId);

  const [record] = await db
    .select()
    .from(upload)
    .where(eq(upload.id, id))
    .limit(1);

  if (!record) {
    return { error: "File not found" };
  }

  if (!(await canAccessUpload(record, session.user.id))) {
    return { error: "Forbidden" };
  }

  const storage = await getStorageAdapter();
  await storage.delete(record.storageKey);

  await db.delete(upload).where(eq(upload.id, id));
  revalidatePath("/");
  return { success: true };
}
