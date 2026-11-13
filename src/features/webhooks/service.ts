import type { Resolver, Transport } from "./outbound";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { webhookDelivery, webhookEndpoint } from "@/models/webhook";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import { BlockedDestinationError, postJson } from "./outbound";
import "server-only";

// Internal operations of the delivery job (src/features/jobs/functions/deliver-webhook.ts).
// Never a server action: the job is trusted to pass what it delivers.

interface DeliveryAttempt {
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  responseBody: string | null;
  attemptNumber: number;
}

/**
 * Keeps an attempt to deliver an event in the log of its endpoint. An endpoint
 * that is gone (its workspace was deleted after the event was queued, as the
 * event that says so is) has no log left to keep it in: the attempt happened,
 * and failing for that would run the job again, and deliver the same event
 * once more for each retry. Any other failure is thrown.
 */
export async function recordDeliveryAttempt(attempt: DeliveryAttempt): Promise<void> {
  try {
    await db.insert(webhookDelivery).values({ id: generateId(), ...attempt });
  } catch (error) {
    const [endpoint] = await db
      .select({ id: webhookEndpoint.id })
      .from(webhookEndpoint)
      .where(eq(webhookEndpoint.id, attempt.endpointId))
      .limit(1);
    if (endpoint) {
      throw error;
    }
  }
}

/**
 * What the job is given to deliver an event: which endpoint, the event and its
 * body. Never the endpoint's address or its secret: an event waiting in the queue
 * is kept by the queue and shown in its dashboard, and a signing secret has no
 * business there. The job reads them from the endpoint's row when it runs.
 */
interface Delivery {
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  attempt?: number;
}

/** What a delivery can be told about how to reach the endpoint: the tests replace the network, a last delivery shortens the time limit. */
export interface DeliveryOptions {
  timeoutMs?: number;
  resolver?: Resolver;
  transport?: Transport;
  development?: boolean;
}

/** What became of a delivery that did not throw: it reached the endpoint, there was no endpoint to reach, or the address is not one to call. */
type DeliveryOutcome = "delivered" | "skipped" | "refused";

/**
 * Delivers an event to an endpoint, signed with its secret, and keeps the
 * attempt in its log. The endpoint is read from the database as it is now: one
 * that was deleted or switched off since the event was queued receives nothing
 * (`skipped`, and the job is done: there is nothing to try again). An address
 * the server must not call (`outbound.ts`) is `refused`, and logged as such: it
 * would be refused again, so the job is not run again either. A receiver that
 * refuses, or does not answer, makes it throw, so that the job is run again.
 */
export async function deliverWebhook(
  { endpointId, event, payload, attempt }: Delivery,
  options: DeliveryOptions = {},
): Promise<DeliveryOutcome> {
  const [endpoint] = await db
    .select({ url: webhookEndpoint.url, secret: webhookEndpoint.secret, active: webhookEndpoint.active })
    .from(webhookEndpoint)
    .where(eq(webhookEndpoint.id, endpointId))
    .limit(1);
  if (!endpoint?.active) {
    return "skipped";
  }

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", endpoint.secret).update(body).digest("hex");

  let statusCode: number | null = null;
  let responseBody: string | null = null;

  try {
    const reply = await postJson(
      endpoint.url,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": event,
        },
        body,
      },
      options,
    );

    statusCode = reply.status;
    responseBody = reply.body.slice(0, 1024);

    if (reply.status < 200 || reply.status >= 300) {
      throw new Error(`Webhook delivery failed: HTTP ${statusCode}`);
    }
  } catch (error) {
    await recordDeliveryAttempt({
      endpointId,
      event,
      payload,
      statusCode,
      responseBody: responseBody ?? (error instanceof Error ? error.message : "Unknown error"),
      attemptNumber: attempt ?? 1,
    });
    if (error instanceof BlockedDestinationError) {
      return "refused";
    }
    throw error;
  }

  await recordDeliveryAttempt({ endpointId, event, payload, statusCode, responseBody, attemptNumber: attempt ?? 1 });

  return "delivered";
}
