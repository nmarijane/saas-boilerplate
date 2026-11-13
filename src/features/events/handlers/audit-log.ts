import type { AppEvent, EventName } from "../types";
import { auditLog } from "@/models/audit-log";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

/**
 * The events the platform keeps, written with no workspace: the deletion of a
 * workspace takes the workspace's own log with it (its rows go in cascade, as
 * the deletion promises), and the entry that says who deleted it, and which,
 * must outlive it for the admins of the platform. The workspace stays named by
 * the resource and by the name in the metadata.
 */
const PLATFORM_EVENTS: readonly EventName[] = ["organization.deleted"];

export async function handleAuditLog(event: AppEvent): Promise<void> {
  await db.insert(auditLog).values({
    id: generateId(),
    orgId: PLATFORM_EVENTS.includes(event.name) ? null : event.payload.orgId,
    actorId: event.payload.actorId ?? null,
    action: event.name,
    resourceType: event.payload.resourceType,
    resourceId: event.payload.resourceId,
    metadata: event.payload.metadata ?? null,
    ipAddress: event.payload.ip ?? null,
    userAgent: event.payload.userAgent ?? null,
  });
}
