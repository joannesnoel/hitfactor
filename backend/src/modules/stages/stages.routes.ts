import type { FastifyInstance } from 'fastify';
import {
  listStages,
  createStage,
  updateStage,
  deleteStage,
} from './stages.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function stagesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/matches/:id/stages',
    { preHandler: [authMiddleware] },
    listStages
  );

  app.post(
    '/api/matches/:id/stages',
    { preHandler: [authMiddleware] },
    createStage
  );

  app.put(
    '/api/matches/:id/stages/:stageId',
    { preHandler: [authMiddleware] },
    updateStage
  );

  app.delete(
    '/api/matches/:id/stages/:stageId',
    { preHandler: [authMiddleware] },
    deleteStage
  );
}
