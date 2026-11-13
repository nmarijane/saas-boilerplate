import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUserOrganizations } from "@/features/auth/organization/queries";
import { upload } from "@/models/upload";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { getStorageAdapter } from "./storage/adapter";
import { storageSafeName, validateFile } from "./validation";
import "server-only";

// Internal operations. uploadFile is called by POST /api/upload, which sets
// userId and orgId from the session: never expose it as a server action.

export async function uploadFile(formData: FormData) {
  const file = formData.get("file");
  const userId = formData.get("userId");
  const orgId = formData.get("orgId");

  if (!file || typeof file === "string" || typeof userId !== "string" || !userId || typeof orgId !== "string" || !orgId) {
    return { error: "Missing required fields" };
  }

  const validation = validateFile(file);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const id = generateId();
  const storageKey = `${orgId}/${id}-${storageSafeName(file.name)}`;
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

/** A file is readable and deletable by its uploader and by the members of its organization. */
export async function canAccessUpload(
  file: { userId: string; organizationId: string | null },
  userId: string,
): Promise<boolean> {
  if (file.userId === userId) return true;

  if (file.organizationId) {
    const orgs = await getUserOrganizations(userId);
    return orgs.some((org) => org.id === file.organizationId);
  }

  return false;
}

/**
 * Deletes the files of a workspace that is being deleted: each object from the
 * storage, then its row. The rows would outlive the workspace otherwise (they
 * lose their workspace, not their uploader), and the objects with them. One at
 * a time, so that a storage that fails halfway leaves the rows of the files it
 * still holds, for the next try. It throws when the storage refuses: the
 * workspace is kept.
 */
export async function deleteWorkspaceFiles(orgId: string): Promise<void> {
  const files = await db
    .select({ id: upload.id, storageKey: upload.storageKey })
    .from(upload)
    .where(eq(upload.organizationId, orgId));
  if (files.length === 0) {
    return;
  }

  const storage = await getStorageAdapter();
  for (const file of files) {
    await storage.delete(file.storageKey);
    await db.delete(upload).where(eq(upload.id, file.id));
  }
}
