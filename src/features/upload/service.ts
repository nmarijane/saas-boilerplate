import type { UploadRefusal } from "./refusals";
import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getUserOrganizations } from "@/features/auth/organization/queries";
import { assertWithinPlan, withPlanLimit } from "@/features/plan-limits";
import { upload } from "@/models/upload";
import { PlanLimitError } from "@/shared/lib/action-refusal";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { getStorageAdapter } from "./storage/adapter";
import { BYTES_PER_MEGABYTE } from "./units";
import { storageSafeName, validateFile } from "./validation";
import "server-only";

// Internal operations. uploadFile is called by POST /api/upload, which sets
// userId and orgId from the session: never expose it as a server action.

function planRefusal(error: PlanLimitError): UploadRefusal {
  return { code: "PLAN_LIMIT", values: { limit: error.limit.limit, plan: error.limit.planName } };
}

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

  // A workspace whose plan has no room left is refused before its bytes are stored
  const megabytes = file.size / BYTES_PER_MEGABYTE;
  try {
    await assertWithinPlan(orgId, "storage", megabytes);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof PlanLimitError) {
      return { error: planRefusal(error) };
    }
    throw error;
  }

  const id = generateId();
  const storageKey = `${orgId}/${id}-${storageSafeName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = await getStorageAdapter();

  await storage.put(storageKey, buffer, file.type);

  // The limit is counted again with the workspace held, in the transaction that writes the row: two
  // files that arrive together are counted one after the other. A file that no longer fits is taken back out
  try {
    await withPlanLimit(orgId, "storage", megabytes, async (tx) => {
      await tx.insert(upload).values({
        id,
        userId,
        organizationId: orgId,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        storageKey,
      });
    });
  } catch (error) {
    unstable_rethrow(error);
    await storage.delete(storageKey);
    if (error instanceof PlanLimitError) {
      return { error: planRefusal(error) };
    }
    throw error;
  }

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
