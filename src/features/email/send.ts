import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { getAppLogger } from "@/shared/lib/logger";
import { hasSmtpConfig, transporter } from "./transporter";

const logger = getAppLogger("email");

interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
}

export async function sendEmail({ to, subject, template }: SendEmailOptions) {
  const html = await render(template);
  const text = await render(template, { plainText: true });

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "noreply@example.com",
    to,
    subject,
    html,
    text,
  });

  if (!hasSmtpConfig) {
    logger.info`[${subject}] → ${to}`;
    // jsonTransport stores the full email in the envelope
    const raw = (info as unknown as Record<string, unknown>).message;
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw) as { text?: string };
      if (parsed.text) {
        logger.info`${parsed.text}`;
      }
    }
  }

  return info;
}
