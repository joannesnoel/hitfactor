import type { FastifyInstance } from 'fastify';
import { getProfile, updateProfile, searchUsers, createOfficer, listOfficers, updateUserRoles, deleteUser, listShooters, mergeShooters } from './users.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/users/search',
    { preHandler: [authMiddleware] },
    searchUsers
  );

  // Admin: shooter de-duplication (find candidates + merge two records)
  app.get(
    '/api/users/shooters',
    { preHandler: [authMiddleware, requireRole('admin')] },
    listShooters
  );

  app.post(
    '/api/users/:id/merge',
    { preHandler: [authMiddleware, requireRole('admin')] },
    mergeShooters
  );

  // Platform-level officer management (admin only)
  app.get(
    '/api/users/officers',
    { preHandler: [authMiddleware, requireRole('admin')] },
    listOfficers
  );

  app.post(
    '/api/users/officers',
    { preHandler: [authMiddleware] },
    createOfficer
  );

  app.patch(
    '/api/users/:id/roles',
    { preHandler: [authMiddleware, requireRole('admin')] },
    updateUserRoles
  );

  app.delete(
    '/api/users/:id',
    { preHandler: [authMiddleware, requireRole('admin')] },
    deleteUser
  );

  app.get(
    '/api/users/me',
    { preHandler: [authMiddleware] },
    getProfile
  );

  app.put(
    '/api/users/me',
    { preHandler: [authMiddleware] },
    updateProfile
  );
}
