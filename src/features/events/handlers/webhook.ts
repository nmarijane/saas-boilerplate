import type { AppEvent } from "../types";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["events", "webhook"]);

/**
 * Dispatches webhook deliveries for matching endpoints.
 * Uses Inngest for async delivery with retry -- wired in Lot 2.
 * Before Inngest is set up, this is a no-op that logs the event.
 */
export async function handleWebhook(event: AppEvent): Promise<void> {
  try {
    const { inngest } = await import("@/shared/lib/inngest/client");
    const { eq, and } = await import("drizzle-orm");
    const { webhookEndpoint } = await import("@/models/webhook");
    const { db } = await import("@/shared/lib/DB");

    const endpoints = await db
      .select()
      .from(webhookEndpoint)
      .where(
        and(
          eq(webhookEndpoint.orgId, event.payload.orgId),
          eq(webhookEndpoint.active, true),
        ),
      );

    const { matchEvent } = await import("@/features/webhooks/matching");

    for (const endpoint of endpoints) {
      if (matchEvent(event.name, endpoint.events)) {
        await inngest.send({
          name: "webhook/deliver",
          data: {
            endpointId: endpoint.id,
            url: endpoint.url,
            secret: endpoint.secret,
            event: event.name,
            payload: {
              event: event.name,
              data: event.payload,
              timestamp: event.timestamp.toISOString(),
            },
          },
        });
      }
    }
  } catch {
    logger.debug`Webhook handler skipped (Inngest not configured): ${event.name}`;
  }
}
