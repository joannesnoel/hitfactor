import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { users } from '../../db/schema.js';
import { createToken, consumeToken } from './token.service.js';
import {
  sendPasswordResetEmail,
  sendWelcomeVerifyEmail,
} from '../email/email.service.js';

/**
 * POST /api/auth/forgot-password — { email }. Emails a reset link if a claimed
 * account with that email exists. Always returns 200 (never leaks whether an
 * email is registered).
 */
export async function forgotPassword(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = forgotPasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'A valid email is required',
    });
  }
  const { email } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Only claimed accounts with a password can reset. Silently no-op otherwise.
  if (user && user.password_hash) {
    const token = await createToken(user.id, 'reset');
    await sendPasswordResetEmail(email, user.display_name, token);
  }

  return reply.send({
    message: 'If that email is registered, a reset link has been sent.',
  });
}

/**
 * POST /api/auth/reset-password — { token, password }. Sets a new password.
 * A valid reset link also proves email ownership, so mark the email verified.
 */
export async function resetPassword(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }
  const { token, password } = parsed.data;

  const userId = await consumeToken('reset', token);
  if (!userId) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'This reset link is invalid or has expired.',
    });
  }

  const password_hash = await bcrypt.hash(password, 10);
  await db
    .update(users)
    .set({ password_hash, email_verified: true, updated_at: new Date() })
    .where(eq(users.id, userId));

  return reply.send({ message: 'Password updated. You can now log in.' });
}

/**
 * POST /api/auth/verify-email — { token }. Marks the account's email verified.
 */
export async function verifyEmail(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = verifyEmailSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'A token is required',
    });
  }

  const userId = await consumeToken('verify', parsed.data.token);
  if (!userId) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'This verification link is invalid or has expired.',
    });
  }

  await db
    .update(users)
    .set({ email_verified: true, updated_at: new Date() })
    .where(eq(users.id, userId));

  return reply.send({ message: 'Email verified.' });
}

/**
 * POST /api/auth/resend-verification — authenticated. Re-sends the verification
 * email to the current user (no-op if already verified).
 */
export async function resendVerification(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, request.user.id))
    .limit(1);

  if (!user || !user.email) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'No email on file for this account',
    });
  }
  if (user.email_verified) {
    return reply.send({ message: 'Email already verified.' });
  }

  const token = await createToken(user.id, 'verify');
  await sendWelcomeVerifyEmail(user.email, user.display_name, token);
  return reply.send({ message: 'Verification email sent.' });
}
