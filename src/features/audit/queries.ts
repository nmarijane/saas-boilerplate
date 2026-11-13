import type { EventName } from "@/features/events/types";
import type { ActivityEntry } from "@/shared/shell/contract";
import { and, desc, eq, notInArray } from "drizzle-orm";

import { auditLog } from "@/models/audit-log";
import { user } from "@/models/user";
import { db } from "@/shared/lib/DB";
import "server-only";

/** How many events the admin list holds: the log has no end, so a list of this many may be the latest of more. */
export const AUDIT_LOG_LIMIT = 50;

export async function getAuditLogs(limit = AUDIT_LOG_LIMIT) {
  return db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

// What the home leaves out of the latest events of a workspace: one line per
// message sent to the assistant or per credit taken would bury what the team
// did, and a flag or the waiting list belongs to the platform, not to the
// workspace. Typed as event names, so that renaming one is an error here and
// not an event that quietly comes back into the list. The one list of them: the
// tests that need to know which events are told derive it from here.
export const NOISY_ACTIONS: readonly EventName[] = [
  "ai.message_sent",
  "ai.credits_consumed",
  "feature_flag.updated",
  "waitlist.joined",
  "waitlist.invited",
];

/** The details of an event that are text: what a sentence can name (`{name}`). A number, a flag or a structure is left out. */
function textEntries(metadata: Record<string, unknown> | null): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/**
 * The latest events of a workspace, newest first, for the home: each with the
 * name and the picture of who did it (nothing once that person's account is
 * gone, or for an event nobody did, such as a payment) and the text details of
 * what was done. Only this workspace's rows are read.
 */
export async function getWorkspaceActivity(
  orgId: string,
  limit = 5,
): Promise<ActivityEntry[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      metadata: auditLog.metadata,
      at: auditLog.createdAt,
      actorName: user.name,
      actorImage: user.image,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(and(eq(auditLog.orgId, orgId), notInArray(auditLog.action, [...NOISY_ACTIONS])))
    // Two events of the same instant keep one order from one read to the next.
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit);

  return rows.map(({ metadata, ...row }) => ({
    ...row,
    values: textEntries(metadata),
  }));
}
