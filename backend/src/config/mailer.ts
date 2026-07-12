import nodemailer, { type Transporter } from 'nodemailer';

// SMTP transport for transactional email. Configured via env (a k8s Secret per
// namespace). When SMTP_HOST is unset (local dev), mailEnabled is false and
// sendMail logs-and-skips so nothing breaks.

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 587);
const secure = process.env.SMTP_SECURE === 'true';
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

export const MAIL_FROM =
  process.env.MAIL_FROM ?? 'HitFactor <noreply@hitfactor.net>';

// Frontend base URL for links in emails. Falls back to the first CORS origin.
export const APP_URL =
  process.env.APP_URL ??
  process.env.CORS_ORIGIN?.split(',')[0]?.trim() ??
  'http://localhost:9000';

export const mailEnabled = Boolean(host);

const transporter: Transporter | null = mailEnabled
  ? nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for 587/1025 (STARTTLS or none)
      ...(user && pass ? { auth: { user, pass } } : {}),
    })
  : null;

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Send an email. No-ops (with a log) when SMTP is not configured. */
export async function sendMail(msg: MailMessage): Promise<void> {
  if (!transporter) {
    console.log(
      `[mailer] disabled — would send "${msg.subject}" to ${msg.to}`
    );
    return;
  }
  await transporter.sendMail({
    from: MAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
}
