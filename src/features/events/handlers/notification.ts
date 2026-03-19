import type { AppEvent } from "../types";
import { getLogger } from "@logtape/logtape";
import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

const logger = getLogger(["events", "notification"]);

/**
 * Map of events to notification config.
 * Only events listed here generate notifications.
 */
const NOTIFICATION_MAP: Record<string, { title: string; body: string; type: string }> = {
  "payment.failed": {
    title: "Payment failed",
    body: "Your subscription payment has failed. Please update your payment method.",
    type: "billing",
  },
  "member.invited": {
    title: "New member invited",
    body: "A new team member has been invited to your organization.",
    type: "info",
  },
  "subscription.cancelled": {
    title: "Subscription cancelled",
    body: "Your subscription has been cancelled.",
    type: "billing",
  },
};

export async function handleNotification(event: AppEvent): Promise<void> {
  const config = NOTIFICATION_MAP[event.name];
  if (!config) return;

  try {
    const owner = await db.query.organizationMember?.findFirst({
      where: (m, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(m.organizationId, event.payload.orgId), eqOp(m.role, "owner")),
    });

    if (!owner) return;

    await db.insert(notification).values({
      id: generateId(),
      userId: owner.userId,
      title: config.title,
      body: config.body,
      type: config.type,
    });
  } catch (error) {
    logger.error`Failed to create notification for ${event.name}: ${error}`;
  }
}
