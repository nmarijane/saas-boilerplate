import { serve } from "inngest/next";
import {
  deliverWebhookJob,
  purgeAuditLogsJob,
  sendEmailJob,
} from "@/features/jobs";
import { inngest } from "@/shared/lib/inngest/client";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendEmailJob, deliverWebhookJob, purgeAuditLogsJob],
});
