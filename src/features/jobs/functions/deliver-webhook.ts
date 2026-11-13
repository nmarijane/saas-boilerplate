import { deliverWebhook } from "@/features/webhooks/service";
import { inngest } from "@/shared/lib/inngest/client";

export const deliverWebhookJob = inngest.createFunction(
  {
    id: "webhook/deliver",
    retries: 5,
    triggers: [{ event: "webhook/deliver" }],
  },
  async ({ event }) => {
    // A delivery that fails throws, so that Inngest runs it again
    await deliverWebhook(event.data as Parameters<typeof deliverWebhook>[0]);
  },
);
