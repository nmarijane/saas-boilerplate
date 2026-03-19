import type { EventName, EventPayload } from "./types";
import { getLogger } from "@logtape/logtape";
import { handleAuditLog } from "./handlers/audit-log";
import { handleNotification } from "./handlers/notification";
import { handleWebhook } from "./handlers/webhook";

const logger = getLogger(["events"]);

/**
 * Emit an application event. This is the single entry point for all event handling.
 *
 * - Audit log: synchronous, errors propagate to caller
 * - Webhook delivery: async (via Inngest), errors logged but don't block
 * - Notifications: synchronous, errors logged but don't block
 */
export async function emitEvent(name: EventName, payload: EventPayload): Promise<void> {
  const event = { name, payload, timestamp: new Date() };

  // Audit log is critical -- errors propagate
  await handleAuditLog(event);

  // Webhooks are non-critical -- errors are logged
  handleWebhook(event).catch((error: unknown) => {
    logger.error`Webhook handler failed for ${name}: ${error}`;
  });

  // Notifications are non-critical -- errors are logged
  handleNotification(event).catch((error: unknown) => {
    logger.error`Notification handler failed for ${name}: ${error}`;
  });
}
