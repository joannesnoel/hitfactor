import { describe, it, expect } from 'vitest';
import { welcomeVerifyEmail, passwordResetEmail } from './templates.js';

describe('email templates', () => {
  it('welcome/verify email embeds the verify link in html + text', () => {
    const url = 'https://staging.hitfactor.net/auth/verify-email?token=abc123';
    const { subject, html, text } = welcomeVerifyEmail('Levi', url);
    expect(subject.toLowerCase()).toContain('confirm');
    expect(html).toContain(url);
    expect(html).toContain('Levi');
    expect(text).toContain(url);
  });

  it('password-reset email embeds the reset link + expiry note', () => {
    const url = 'https://hitfactor.net/auth/reset-password?token=xyz';
    const { subject, html, text } = passwordResetEmail('Chris', url);
    expect(subject.toLowerCase()).toContain('reset');
    expect(html).toContain(url);
    expect(html.toLowerCase()).toContain('1 hour');
    expect(text).toContain(url);
  });
});
