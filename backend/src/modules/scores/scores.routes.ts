import type { FastifyInstance } from 'fastify';
import {
  getScoresForStage,
  upsertScore,
  verifyScore,
} from './scores.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function scoresRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/matches/:id/stages/:stageId/scores',
    { preHandler: [authMiddleware] },
    getScoresForStage
  );

  app.post(
    '/api/matches/:id/stages/:stageId/scores',
    { preHandler: [authMiddleware] },
    upsertScore
  );

  app.put(
    '/api/matches/:id/stages/:stageId/scores/:scoreId/verify',
    { preHandler: [authMiddleware] },
    verifyScore
  );
}
