import type { FastifyInstance } from 'fastify';
import { listPublicMatches, getPublicMatch } from './public.controller.js';
import {
  getMatchResults,
  getStageResults,
} from '../results/results.controller.js';

// Unauthenticated read-only endpoints under /api/public. No preHandler — these
// are intentionally open. The results handlers are reused verbatim (they never
// read request.user and results are inherently public).
export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/public/matches', listPublicMatches);
  app.get('/api/public/matches/:id', getPublicMatch);
  app.get('/api/public/matches/:id/results', getMatchResults);
  app.get(
    '/api/public/matches/:id/stages/:stageId/results',
    getStageResults
  );
}
