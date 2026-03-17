"use server";

import { desc, eq } from "drizzle-orm";
import { upload } from "@/models/upload";
import { db } from "@/shared/lib/DB";

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
