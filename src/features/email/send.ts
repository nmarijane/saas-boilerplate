import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { transporter } from "./transporter";

interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
}

export async function sendEmail({ to, subject, template }: SendEmailOptions) {
  const html = await render(template);
  const text = await render(template, { plainText: true });

  return transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "noreply@example.com",
    to,
    subject,
    html,
    text,
  });
}
