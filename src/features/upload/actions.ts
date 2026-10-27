"use server";

import { Buffer } from "node:buffer";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireOrgRole } from "@/features/auth/guards";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { upload } from "@/models/upload";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { getStorageAdapter } from "./storage/adapter";
import { validateFile } from "./validation";

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File | null;
  const session = await requireAuth();
  const orgId = await getActiveOrgId();

  if (!file || !orgId) {
    return { error: "Missing required fields" };
  }
  await requireOrgRole(orgId, "member");

  const validation = validateFile(file);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const id = generateId();
  const storageKey = `${orgId}/${id}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = await getStorageAdapter();

  await storage.put(storageKey, buffer, file.type);

  await db.insert(upload).values({
    id,
    userId: session.user.id,
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
  const session = await requireAuth();
  const [record] = await db
    .select()
    .from(upload)
    .where(eq(upload.id, uploadId))
    .limit(1);

  if (!record) {
    return { error: "File not found" };
  }

  if (record.organizationId) {
    await requireOrgRole(record.organizationId, "member");
  } else if (record.userId !== session.user.id) {
    return { error: "File not found" };
  }

  const storage = await getStorageAdapter();
  await storage.delete(record.storageKey);

  await db
    .delete(upload)
    .where(
      and(
        eq(upload.id, uploadId),
        eq(upload.userId, record.userId),
      ),
    );
  revalidatePath("/");
  return { success: true };
}
