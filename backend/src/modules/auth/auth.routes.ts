import type { FastifyInstance } from 'fastify';
import {
  register,
  login,
  refresh,
  getPowerSyncToken,
  getJWKSEndpoint,
} from './auth.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Public routes
  app.post('/api/auth/register', register);
  app.post('/api/auth/login', login);
  app.get('/api/auth/keys', getJWKSEndpoint);

  // Authenticated routes
  app.post('/api/auth/refresh', { preHandler: [authMiddleware] }, refresh);
  app.get(
    '/api/auth/powersync-token',
    { preHandler: [authMiddleware] },
    getPowerSyncToken
  );
}
