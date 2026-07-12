import type { FastifyInstance } from 'fastify';
import { importMatchUpload, importMatchFromEss } from './import.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/admin/import',
    { preHandler: [authMiddleware] },
    importMatchUpload
  );

  app.post(
    '/api/admin/import/ess',
    { preHandler: [authMiddleware] },
    importMatchFromEss
  );
}
