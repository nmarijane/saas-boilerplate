import { z } from "zod";
import { deliverWebhook } from "@/features/webhooks/service";
import { inngest } from "@/shared/lib/inngest/client";

// What the handler of events queues (events/handlers/webhook.ts): which endpoint,
// the event and its body. Not the address and not the secret, which the delivery
// reads from the endpoint's row.
const deliverySchema = z.object({
  endpointId: z.string().min(1).max(100),
  event: z.string().min(1).max(100),
  payload: z.record(z.string(), z.unknown()),
});

export const deliverWebhookJob = inngest.createFunction(
  {
    id: "webhook/deliver",
    retries: 5,
    triggers: [{ event: "webhook/deliver" }],
  },
  async ({ event, attempt }) => {
    // A delivery that fails throws, so that Inngest runs it again
    await deliverWebhook({ ...deliverySchema.parse(event.data), attempt: attempt + 1 });
  },
);
