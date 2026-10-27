import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

type Mail = { to: string; subject: string; text: string; html?: string };

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export function frontendUrl(path: string) {
  return new URL(path, process.env.FRONTEND_URL || "http://localhost:5173").toString();
}

export async function sendMail(mail: Mail) {
  const smtp = getTransporter();
  if (!smtp) {
    // Without SMTP the link (which carries a token) only reaches local dev logs, never production logs.
    if (process.env.NODE_ENV === "production") logger.warn("SMTP not configured; email not sent", { subject: mail.subject });
    else logger.info(`[mail:dev] ${mail.subject} -> ${mail.to}\n${mail.text}`);
    return;
  }
  await smtp.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...mail });
}

// Fire-and-forget so a slow or failing SMTP server never blocks the auth response.
export function sendMailInBackground(mail: Mail) {
  sendMail(mail).catch((error) => logger.error("Failed to send email", { subject: mail.subject, error: error instanceof Error ? error.message : error }));
}
