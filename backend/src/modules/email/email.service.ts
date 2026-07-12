import { sendMail, APP_URL } from '../../config/mailer.js';
import { welcomeVerifyEmail, passwordResetEmail } from './templates.js';

// Transactional email senders. Best-effort: failures are logged, never thrown
// into the request path (a signup shouldn't 500 because SMTP hiccuped).

export function verifyUrl(token: string): string {
  return `${APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export function resetUrl(token: string): string {
  return `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendWelcomeVerifyEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  try {
    const { subject, html, text } = welcomeVerifyEmail(name, verifyUrl(token));
    await sendMail({ to, subject, html, text });
  } catch (err) {
    console.error('[email] welcome/verify send failed:', err);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  try {
    const { subject, html, text } = passwordResetEmail(name, resetUrl(token));
    await sendMail({ to, subject, html, text });
  } catch (err) {
    console.error('[email] password-reset send failed:', err);
  }
}
