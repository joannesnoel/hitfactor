import type { FastifyInstance } from 'fastify';
import { listRanges, getRange, searchRanges, createRange, updateRange, deleteRange } from './ranges.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';

export async function rangesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/ranges',
    { preHandler: [authMiddleware] },
    listRanges
  );

  app.get(
    '/api/ranges/search',
    { preHandler: [authMiddleware] },
    searchRanges
  );

  app.get(
    '/api/ranges/:id',
    { preHandler: [authMiddleware] },
    getRange
  );

  app.post(
    '/api/ranges',
    { preHandler: [authMiddleware, requireRole('admin')] },
    createRange
  );

  app.patch(
    '/api/ranges/:id',
    { preHandler: [authMiddleware, requireRole('admin')] },
    updateRange
  );

  app.delete(
    '/api/ranges/:id',
    { preHandler: [authMiddleware, requireRole('admin')] },
    deleteRange
  );
}
