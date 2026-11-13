import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { webhookDelivery, webhookEndpoint } from "@/models/webhook";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
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

/** What the job is given to deliver an event: the endpoint as it was when the event was queued, and the body. */
interface Delivery {
  endpointId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
  attempt?: number;
}

/**
 * Delivers an event to an endpoint, signed with its secret, and keeps the
 * attempt in its log. A receiver that refuses, or does not answer, makes it
 * throw, so that the job is run again, whatever became of the endpoint: the
 * event was not delivered. One that answers is delivered once: an endpoint that
 * went with its workspace since the event was queued only has no log to keep it
 * in (`recordDeliveryAttempt`).
 */
export async function deliverWebhook({
  endpointId,
  url,
  secret,
  event,
  payload,
  attempt,
}: Delivery): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  let statusCode: number | null = null;
  let responseBody: string | null = null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    statusCode = response.status;
    responseBody = (await response.text()).slice(0, 1024);

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: HTTP ${statusCode}`);
    }
  } catch (error) {
    await recordDeliveryAttempt({
      endpointId,
      event,
      payload,
      statusCode,
      responseBody:
        responseBody ??
        (error instanceof Error ? error.message : "Unknown error"),
      attemptNumber: attempt ?? 1,
    });
    throw error;
  }

  await recordDeliveryAttempt({
    endpointId,
    event,
    payload,
    statusCode,
    responseBody,
    attemptNumber: attempt ?? 1,
  });
}
