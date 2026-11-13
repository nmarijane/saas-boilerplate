import type { AppEvent, EventName } from "../types";
import { getLogger } from "@logtape/logtape";
import { eq } from "drizzle-orm";
import { notification } from "@/models/notification";
import { organization } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

const logger = getLogger(["events", "notification"]);

/**
 * The events that notify the owner of their workspace. A notification stores
 * the event as its type, with its workspace and the values its messages name:
 * its words are the messages `notifications.events.<name>`, drawn when it is
 * read, in the reader's language, as the activity of the home is. Each event
 * here has its messages in both languages (the event-bus test checks it).
 */
export const NOTIFIED_EVENTS: readonly EventName[] = [
  "payment.failed",
  "member.invited",
  "subscription.cancelled",
];

/** The details of an event that are text: what a message can name. A number, a flag or a structure is left out. */
function textValues(metadata: Record<string, unknown> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export async function handleNotification(event: AppEvent): Promise<void> {
  if (!NOTIFIED_EVENTS.includes(event.name)) return;

  try {
    const owner = await db.query.organizationMember?.findFirst({
      where: (m, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(m.organizationId, event.payload.orgId), eqOp(m.role, "owner")),
    });

    if (!owner) return;

    const [workspace] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, event.payload.orgId))
      .limit(1);

    await db.insert(notification).values({
      id: generateId(),
      userId: owner.userId,
      organizationId: event.payload.orgId,
      type: event.name,
      values: { ...textValues(event.payload.metadata), workspace: workspace?.name ?? "" },
    });
  } catch (error) {
    logger.error`Failed to create notification for ${event.name}: ${error}`;
  }
}
