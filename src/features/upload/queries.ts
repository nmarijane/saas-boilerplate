import { desc, eq, sql } from "drizzle-orm";
import { upload } from "@/models/upload";
import { db } from "@/shared/lib/DB";
import { BYTES_PER_MEGABYTE } from "./units";
import "server-only";

export async function getFilesByOrg(orgId: string) {
  return db
    .select()
    .from(upload)
    .where(eq(upload.organizationId, orgId))
    .orderBy(desc(upload.createdAt));
}

export async function getFileById(id: string) {
  const [file] = await db
    .select()
    .from(upload)
    .where(eq(upload.id, id))
    .limit(1);
  return file ?? null;
}

/**
 * What a workspace's files weigh, in megabytes of a million bytes (the unit
 * the limits of the plans are written in), on one decimal. A workspace with no
 * file weighs nothing: zero, not null.
 */
export async function getStorageUsedMb(orgId: string): Promise<number> {
  const [row] = await db
    .select({
      bytes: sql<number>`COALESCE(SUM(${upload.size}), 0)`.mapWith(Number),
    })
    .from(upload)
    .where(eq(upload.organizationId, orgId));

  return Math.round(((row?.bytes ?? 0) / BYTES_PER_MEGABYTE) * 10) / 10;
}
