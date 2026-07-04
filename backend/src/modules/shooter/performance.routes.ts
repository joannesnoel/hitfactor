import type { FastifyInstance } from 'fastify';
import { getMyPerformance } from './performance.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function performanceRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/shooter/performance',
    { preHandler: [authMiddleware] },
    getMyPerformance
  );
}
