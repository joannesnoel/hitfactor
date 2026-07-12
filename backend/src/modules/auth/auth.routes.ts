import type { FastifyInstance } from 'fastify';
import {
  register,
  claim,
  login,
  refresh,
  getPowerSyncToken,
  getJWKSEndpoint,
} from './auth.controller.js';
import {
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from './auth-email.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Public routes
  app.post('/api/auth/register', register);
  app.post('/api/auth/claim', claim);
  app.post('/api/auth/login', login);
  // Refresh is validated by the refresh_token in its body — it must NOT require a
  // valid access token, or the session can never be renewed once access expires.
  app.post('/api/auth/refresh', refresh);
  app.get('/api/auth/keys', getJWKSEndpoint);

  // Email verification + password reset (public — the token authenticates).
  app.post('/api/auth/forgot-password', forgotPassword);
  app.post('/api/auth/reset-password', resetPassword);
  app.post('/api/auth/verify-email', verifyEmail);

  // Authenticated routes
  app.post(
    '/api/auth/resend-verification',
    { preHandler: [authMiddleware] },
    resendVerification
  );
  app.get(
    '/api/auth/powersync-token',
    { preHandler: [authMiddleware] },
    getPowerSyncToken
  );
}
