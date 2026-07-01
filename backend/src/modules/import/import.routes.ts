import type { FastifyInstance } from 'fastify';
import { importMatchUpload } from './import.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function importRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/admin/import',
    { preHandler: [authMiddleware] },
    importMatchUpload
  );
}
