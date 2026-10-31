import { desc } from "drizzle-orm";

import { auditLog } from "@/models/audit-log";
import { db } from "@/shared/lib/DB";
import "server-only";

export async function getAuditLogs(limit = 50) {
  return db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
