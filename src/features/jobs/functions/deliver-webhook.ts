import { createHmac } from "node:crypto";
import { webhookDelivery } from "@/models/webhook";
import { db } from "@/shared/lib/DB";
import { inngest } from "@/shared/lib/inngest/client";
import { generateId } from "@/shared/utils/helpers";

export const deliverWebhookJob = inngest.createFunction(
  {
    id: "webhook/deliver",
    retries: 5,
    triggers: [{ event: "webhook/deliver" }],
  },
  async ({ event }) => {
    const {
      endpointId,
      url,
      secret,
      event: eventName,
      payload,
      attempt,
    } = event.data as {
      endpointId: string;
      url: string;
      secret: string;
      event: string;
      payload: Record<string, unknown>;
      attempt?: number;
    };

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
          "X-Webhook-Event": eventName,
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
      await db.insert(webhookDelivery).values({
        id: generateId(),
        endpointId,
        event: eventName,
        payload,
        statusCode,
        responseBody:
          responseBody ??
          (error instanceof Error ? error.message : "Unknown error"),
        attemptNumber: attempt ?? 1,
      });
      throw error; // Re-throw so Inngest retries
    }

    // Log successful delivery
    await db.insert(webhookDelivery).values({
      id: generateId(),
      endpointId,
      event: eventName,
      payload,
      statusCode,
      responseBody,
      attemptNumber: attempt ?? 1,
    });
  },
);
