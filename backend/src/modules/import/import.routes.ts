import type { FastifyInstance } from 'fastify';
import {
  importMatchUpload,
  importMatchFromEss,
  getEssImportStatus,
} from './import.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/admin/import',
    { preHandler: [authMiddleware] },
    importMatchUpload
  );

  // ESS import runs as a background job (POST starts it, GET polls it).
  app.post(
    '/api/admin/import/ess',
    { preHandler: [authMiddleware] },
    importMatchFromEss
  );
  app.get(
    '/api/admin/import/ess/:jobId',
    { preHandler: [authMiddleware] },
    getEssImportStatus
  );
}
