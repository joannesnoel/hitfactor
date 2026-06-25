import type { FastifyInstance } from 'fastify';
import {
  listSquads,
  createSquad,
  updateSquad,
  deleteSquad,
  assignToSquad,
} from './squads.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function squadsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/matches/:id/squads',
    { preHandler: [authMiddleware] },
    listSquads
  );

  app.post(
    '/api/matches/:id/squads',
    { preHandler: [authMiddleware] },
    createSquad
  );

  app.put(
    '/api/matches/:id/squads/:squadId',
    { preHandler: [authMiddleware] },
    updateSquad
  );

  app.delete(
    '/api/matches/:id/squads/:squadId',
    { preHandler: [authMiddleware] },
    deleteSquad
  );

  app.post(
    '/api/matches/:id/squads/:squadId/assign',
    { preHandler: [authMiddleware] },
    assignToSquad
  );
}
