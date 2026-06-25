import type { FastifyInstance } from 'fastify';
import { handleUploadData } from './powersync.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function powersyncRoutes(app: FastifyInstance): Promise<void> {
  app.put(
    '/api/powersync/data',
    { preHandler: [authMiddleware] },
    handleUploadData
  );

  app.patch(
    '/api/powersync/data',
    { preHandler: [authMiddleware] },
    handleUploadData
  );

  app.delete(
    '/api/powersync/data',
    { preHandler: [authMiddleware] },
    handleUploadData
  );
}
