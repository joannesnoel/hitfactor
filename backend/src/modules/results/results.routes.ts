import type { FastifyInstance } from 'fastify';
import {
  computeResultsForMatch,
  getMatchResults,
  getStageResults,
} from './results.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function resultsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/matches/:id/results/compute',
    { preHandler: [authMiddleware] },
    computeResultsForMatch
  );

  app.get(
    '/api/matches/:id/results',
    { preHandler: [authMiddleware] },
    getMatchResults
  );

  app.get(
    '/api/matches/:id/stages/:stageId/results',
    { preHandler: [authMiddleware] },
    getStageResults
  );
}
