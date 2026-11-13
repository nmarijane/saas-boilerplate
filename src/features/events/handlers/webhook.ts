import type { AppEvent, EventName } from "../types";
import type { DeliveryOptions } from "@/features/webhooks/service";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["events", "webhook"]);

/**
 * Events after which there is no endpoint left to deliver to: the rows of the
 * workspace go right after the event, and a job waiting in the queue would find
 * its endpoint gone (the delivery reads the endpoint when it runs, so that no
 * secret waits in the queue). They are delivered at once instead, before the
 * rows go, signed with the secret of each endpoint as the others are, and not
 * queued: see `deliverFinalEvent`.
 */
const FINAL_EVENTS: ReadonlySet<EventName> = new Set(["organization.deleted"]);

/** How long a final delivery waits for a receiver: the deletion of the workspace waits for it. */
const FINAL_DELIVERY_TIMEOUT_MS = 5000;

/**
 * Dispatches webhook deliveries for matching endpoints.
 *
 * Most events are queued (Inngest, with retries): the job carries which endpoint
 * and what happened, never the address or the secret. The final events
 * (`FINAL_EVENTS`) are delivered here and now, to every matching endpoint at
 * once, with a short time limit and no second try: a receiver can rely on the
 * event being signed like any other, sent at most once, before the workspace is
 * deleted; it cannot rely on getting it, since a receiver that is down when the
 * workspace is deleted will not be asked again (the workspace and its endpoints
 * are gone by then). With no queue configured the other events are skipped and
 * logged.
 */
export async function handleWebhook(event: AppEvent, options: DeliveryOptions = {}): Promise<void> {
  try {
    const { eq, and } = await import("drizzle-orm");
    const { webhookEndpoint } = await import("@/models/webhook");
    const { db } = await import("@/shared/lib/DB");
    const { matchEvent } = await import("@/features/webhooks/matching");

    const endpoints = await db
      .select({ id: webhookEndpoint.id, events: webhookEndpoint.events })
      .from(webhookEndpoint)
      .where(
        and(
          eq(webhookEndpoint.orgId, event.payload.orgId),
          eq(webhookEndpoint.active, true),
        ),
      );

    const matching = endpoints.filter((endpoint) => matchEvent(event.name, endpoint.events));
    const body = {
      event: event.name,
      data: event.payload,
      timestamp: event.timestamp.toISOString(),
    };

    if (FINAL_EVENTS.has(event.name)) {
      await Promise.all(matching.map((endpoint) => deliverFinalEvent(endpoint.id, event.name, body, options)));
      return;
    }

    const { inngest } = await import("@/shared/lib/inngest/client");
    for (const endpoint of matching) {
      await inngest.send({
        name: "webhook/deliver",
        data: { endpointId: endpoint.id, event: event.name, payload: body },
      });
    }
  } catch {
    logger.debug`Webhook handler skipped (Inngest not configured): ${event.name}`;
  }
}

/** One delivery of a final event: whatever happens to it is logged, and never stops the others or the deletion. */
async function deliverFinalEvent(
  endpointId: string,
  name: EventName,
  payload: Record<string, unknown>,
  options: DeliveryOptions,
): Promise<void> {
  try {
    const { deliverWebhook } = await import("@/features/webhooks/service");
    await deliverWebhook(
      { endpointId, event: name, payload },
      { timeoutMs: FINAL_DELIVERY_TIMEOUT_MS, ...options },
    );
  } catch (error) {
    logger.warn`Final webhook ${name} was not delivered to endpoint ${endpointId}: ${error}`;
  }
}
