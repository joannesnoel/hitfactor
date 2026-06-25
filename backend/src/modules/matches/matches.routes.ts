import type { FastifyInstance } from 'fastify';
import {
  listMatches,
  getMatch,
  createMatch,
  updateMatch,
  deleteMatch,
  assignOfficer,
  listOfficers,
  removeOfficer,
} from './matches.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';

export async function matchesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/matches',
    { preHandler: [authMiddleware] },
    listMatches
  );

  app.get(
    '/api/matches/:id',
    { preHandler: [authMiddleware] },
    getMatch
  );

  app.post(
    '/api/matches',
    { preHandler: [authMiddleware, requireRole('admin')] },
    createMatch
  );

  app.put(
    '/api/matches/:id',
    { preHandler: [authMiddleware] },
    updateMatch
  );

  app.patch(
    '/api/matches/:id',
    { preHandler: [authMiddleware] },
    updateMatch
  );

  app.delete(
    '/api/matches/:id',
    { preHandler: [authMiddleware] },
    deleteMatch
  );

  // Officer management
  app.get(
    '/api/matches/:id/officers',
    { preHandler: [authMiddleware] },
    listOfficers
  );

  app.post(
    '/api/matches/:id/officers',
    { preHandler: [authMiddleware] },
    assignOfficer
  );

  app.delete(
    '/api/matches/:id/officers/:userId',
    { preHandler: [authMiddleware] },
    removeOfficer
  );
}
