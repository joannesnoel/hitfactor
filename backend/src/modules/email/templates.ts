import { APP_URL } from '../../config/mailer.js';

// Minimal branded HTML email templates (HitFactor navy/gold). Inline CSS only —
// email clients don't support <style>/external CSS. Each builder returns
// { subject, html, text }.

const NAVY = '#1a2b4a';
const GOLD = '#c8a94e';

function layout(headline: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#222">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e3e5e8">
        <tr><td style="background:${NAVY};padding:20px 28px">
          <img src="${APP_URL}/logo.png" alt="HitFactor" height="28" style="height:28px;vertical-align:middle" />
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 16px;font-size:20px;color:${NAVY}">${headline}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#999">
          HitFactor — USPSA/IPSC match management
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:${GOLD};color:${NAVY};text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:6px">${label}</a>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function welcomeVerifyEmail(
  name: string,
  verifyUrl: string
): RenderedEmail {
  const subject = 'Welcome to HitFactor — confirm your email';
  const html = layout(
    `Welcome, ${name}!`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Your HitFactor account is ready. Confirm your email address to finish setting up:</p>
     <p style="margin:0 0 20px">${button('Confirm email', verifyUrl)}</p>
     <p style="margin:0;font-size:13px;color:#666">Or paste this link into your browser:<br><a href="${verifyUrl}" style="color:${NAVY};word-break:break-all">${verifyUrl}</a></p>`
  );
  const text = `Welcome, ${name}!\n\nYour HitFactor account is ready. Confirm your email address:\n${verifyUrl}\n`;
  return { subject, html, text };
}

export function passwordResetEmail(
  name: string,
  resetUrl: string
): RenderedEmail {
  const subject = 'Reset your HitFactor password';
  const html = layout(
    'Reset your password',
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Hi ${name}, we received a request to reset your HitFactor password. This link expires in 1 hour.</p>
     <p style="margin:0 0 20px">${button('Reset password', resetUrl)}</p>
     <p style="margin:0 0 12px;font-size:13px;color:#666">Or paste this link into your browser:<br><a href="${resetUrl}" style="color:${NAVY};word-break:break-all">${resetUrl}</a></p>
     <p style="margin:0;font-size:13px;color:#999">If you didn't request this, you can safely ignore this email.</p>`
  );
  const text = `Hi ${name},\n\nReset your HitFactor password (link expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n`;
  return { subject, html, text };
}
