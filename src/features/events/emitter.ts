import type { EventName, EventPayload } from "./types";
import { getLogger } from "@logtape/logtape";
import { handleAuditLog } from "./handlers/audit-log";
import { handleNotification } from "./handlers/notification";
import { handleWebhook } from "./handlers/webhook";

const logger = getLogger(["events"]);

interface EmitOptions {
  /**
   * Waits until the deliveries to the webhooks are queued before it returns.
   * For an event whose rows go right after it (the deletion of a workspace,
   * whose endpoints go in cascade): the endpoints are read while they exist.
   * The delivery itself stays async.
   */
  awaitWebhooks?: boolean;
}

/**
 * Emit an application event. This is the single entry point for all event handling.
 *
 * - Audit log: synchronous, errors propagate to caller
 * - Webhook delivery: async (via Inngest), errors logged but don't block
 * - Notifications: synchronous, errors logged but don't block
 */
export async function emitEvent(
  name: EventName,
  payload: EventPayload,
  options: EmitOptions = {},
): Promise<void> {
  const event = { name, payload, timestamp: new Date() };

  // Audit log is critical -- errors propagate
  await handleAuditLog(event);

  // Webhooks are non-critical -- errors are logged
  const webhooks = handleWebhook(event).catch((error: unknown) => {
    logger.error`Webhook handler failed for ${name}: ${error}`;
  });

  // Notifications are non-critical -- errors are logged
  handleNotification(event).catch((error: unknown) => {
    logger.error`Notification handler failed for ${name}: ${error}`;
  });

  if (options.awaitWebhooks) {
    await webhooks;
  }
}
