import { lt } from "drizzle-orm";
import { auditLog } from "@/models/audit-log";
import { db } from "@/shared/lib/DB";
import { inngest } from "@/shared/lib/inngest/client";

export const purgeAuditLogsJob = inngest.createFunction(
  {
    id: "audit/purge",
    triggers: [{ cron: "0 3 * * *" }], // Daily at 3 AM
  },
  async () => {
    const retentionDays = Number(
      process.env.AUDIT_LOG_RETENTION_DAYS ?? "90",
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await db
      .delete(auditLog)
      .where(lt(auditLog.createdAt, cutoff));

    return { purged: (result as unknown as { rowCount?: number }).rowCount ?? 0 };
  },
);
