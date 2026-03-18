"use server";

import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { upload } from "@/models/upload";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { getStorageAdapter } from "./storage/adapter";
import { validateFile } from "./validation";

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File | null;
  const userId = formData.get("userId") as string | null;
  const orgId = formData.get("orgId") as string | null;

  if (!file || !userId || !orgId) {
    return { error: "Missing required fields" };
  }

  const validation = validateFile(file);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const id = generateId();
  const storageKey = `${orgId}/${id}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = await getStorageAdapter();

  await storage.put(storageKey, buffer, file.type);

  await db.insert(upload).values({
    id,
    userId,
    organizationId: orgId,
    filename: file.name,
    mimetype: file.type,
    size: file.size,
    storageKey,
  });

  revalidatePath("/");
  return { id, filename: file.name };
}

export async function deleteFile(uploadId: string) {
  const [record] = await db
    .select()
    .from(upload)
    .where(eq(upload.id, uploadId))
    .limit(1);

  if (!record) {
    return { error: "File not found" };
  }

  const storage = await getStorageAdapter();
  await storage.delete(record.storageKey);

  await db.delete(upload).where(eq(upload.id, uploadId));
  revalidatePath("/");
  return { success: true };
}
