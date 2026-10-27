"use server";

import { and, eq } from "drizzle-orm";
import { aiFiles, aiRuns } from "@/models";
import { db } from "@/shared/lib/DB";

export async function getRunsByOrg(orgId: string) {
  return db.select().from(aiRuns).where(eq(aiRuns.organizationId, orgId));
}

export async function getRunById(id: string, orgId: string) {
  const [run] = await db
    .select()
    .from(aiRuns)
    .where(and(eq(aiRuns.id, id), eq(aiRuns.organizationId, orgId)))
    .limit(1);
  if (!run) return null;

  const files = await db
    .select()
    .from(aiFiles)
    .where(and(eq(aiFiles.runId, id), eq(aiFiles.organizationId, orgId)));

  return { run, files };
}
