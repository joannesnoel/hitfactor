import type { FastifyInstance } from 'fastify';
import { getProfile, updateProfile, searchUsers, createOfficer, listOfficers, updateUserRoles, deleteUser, listShooters, listShooterSuggestions, listClaimable, mergeShooters, listAccounts, adminUpdateShooter } from './users.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  // Public: find your unclaimed shooter record to claim it at sign-up.
  app.get('/api/users/claimable', listClaimable);

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

  app.get(
    '/api/users/shooters/duplicates',
    { preHandler: [authMiddleware, requireRole('admin')] },
    listShooterSuggestions
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

  // Admin: account management (list signed-up accounts + edit name)
  app.get(
    '/api/users/accounts',
    { preHandler: [authMiddleware, requireRole('admin')] },
    listAccounts
  );

  app.patch(
    '/api/users/:id',
    { preHandler: [authMiddleware, requireRole('admin')] },
    adminUpdateShooter
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
