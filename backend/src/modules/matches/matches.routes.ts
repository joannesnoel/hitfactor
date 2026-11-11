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
  addRegistration,
  updateRegistration,
  removeRegistration,
  getJoinPreview,
  joinMatch,
} from './matches.controller.js';
import {
  uploadBanner,
  getBanner,
  deleteBanner,
} from './match-banner.controller.js';
import { listScorers, addScorer, removeScorer } from './match-scorers.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

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

  // Any authenticated user can create a match. Non-admins get a private,
  // self-hosted match (forced in the controller); admins can create public ones.
  app.post(
    '/api/matches',
    { preHandler: [authMiddleware] },
    createMatch
  );

  // Invite links for private matches. The preview is public so a guest without
  // an account can see what they're joining; joining requires a session.
  app.get('/api/matches/join/:token', getJoinPreview);
  app.post(
    '/api/matches/join/:token',
    { preHandler: [authMiddleware] },
    joinMatch
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

  // Banner (image in Garage/S3). GET is public so <img> tags work.
  app.post(
    '/api/matches/:id/banner',
    { preHandler: [authMiddleware] },
    uploadBanner
  );

  app.get('/api/matches/:id/banner', getBanner);

  app.delete(
    '/api/matches/:id/banner',
    { preHandler: [authMiddleware] },
    deleteBanner
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

  // Registrations (admin manual add / remove; per-match admin guard in handler)
  app.post(
    '/api/matches/:id/registrations',
    { preHandler: [authMiddleware] },
    addRegistration
  );

  app.patch(
    '/api/matches/:id/registrations/:registrationId',
    { preHandler: [authMiddleware] },
    updateRegistration
  );

  app.delete(
    '/api/matches/:id/registrations/:registrationId',
    { preHandler: [authMiddleware] },
    removeRegistration
  );

  // Scorers: shooters the host of a private match lets enter scores.
  app.get(
    '/api/matches/:id/scorers',
    { preHandler: [authMiddleware] },
    listScorers
  );

  app.post(
    '/api/matches/:id/scorers',
    { preHandler: [authMiddleware] },
    addScorer
  );

  app.delete(
    '/api/matches/:id/scorers/:userId',
    { preHandler: [authMiddleware] },
    removeScorer
  );
}
