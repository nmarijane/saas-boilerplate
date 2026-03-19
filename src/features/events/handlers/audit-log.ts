import type { AppEvent } from "../types";
import { auditLog } from "@/models/audit-log";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

export async function handleAuditLog(event: AppEvent): Promise<void> {
  await db.insert(auditLog).values({
    id: generateId(),
    orgId: event.payload.orgId,
    actorId: event.payload.actorId ?? null,
    action: event.name,
    resourceType: event.payload.resourceType,
    resourceId: event.payload.resourceId,
    metadata: event.payload.metadata ?? null,
    ipAddress: event.payload.ip ?? null,
    userAgent: event.payload.userAgent ?? null,
  });
}
