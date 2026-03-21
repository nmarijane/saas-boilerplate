import nodemailer from "nodemailer";
import { getAppLogger } from "@/shared/lib/logger";

const logger = getAppLogger("email");

const hasSmtpConfig = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

function createTransporter() {
  if (hasSmtpConfig) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Dev fallback: JSON transport — no network, emails logged to console
  logger.warn("No SMTP configured — emails will be logged to console only");
  return nodemailer.createTransport({ jsonTransport: true });
}

const transporter = createTransporter();

export { hasSmtpConfig, transporter };
