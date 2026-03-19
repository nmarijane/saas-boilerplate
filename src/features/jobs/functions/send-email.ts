import type { ReactElement } from "react";
import { inngest } from "@/shared/lib/inngest/client";

export const sendEmailJob = inngest.createFunction(
  {
    id: "jobs/send-email",
    retries: 3,
    triggers: [{ event: "jobs/send-email" }],
  },
  async ({ event }) => {
    const { sendEmail } = await import("@/features/email/send");
    const data = event.data as {
      to: string;
      subject: string;
      templateName: string;
      templateProps: Record<string, unknown>;
    };

    // Dynamic template import
    const templates = (await import(
      "@/features/email/templates"
    )) as unknown as Record<
      string,
      (props: Record<string, unknown>) => ReactElement
    >;
    const Template = templates[data.templateName];
    if (!Template)
      throw new Error(`Unknown email template: ${data.templateName}`);

    await sendEmail({
      to: data.to,
      subject: data.subject,
      template: Template(data.templateProps),
    });
  },
);
