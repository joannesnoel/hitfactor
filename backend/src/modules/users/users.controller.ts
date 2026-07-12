import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { eq, and, or, ilike, sql } from 'drizzle-orm';
import {
  updateProfileSchema,
  createOfficerSchema,
  adminUpdateShooterSchema,
  ROLES,
} from '@hitfactor/shared';
import type { Role } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { users, userDivisions } from '../../db/schema.js';
import { suggestDuplicates } from './shooter-suggestions.js';
import { normalizeShooterName } from '../import/shooter-identity.js';

export async function createOfficer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = createOfficerSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { display_name, email, member_number } = parsed.data;

  // Check if email already exists
  const [existing] = await db
    .select({ id: users.id, display_name: users.display_name, email: users.email, roles: users.roles })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return reply.send(existing);
  }

  // Create user with random password — they can reset later
  const tempPassword = randomBytes(16).toString('hex');
  const password_hash = await bcrypt.hash(tempPassword, 10);

  const [user] = await db
    .insert(users)
    .values({
      email,
      password_hash,
      display_name,
      member_number: member_number ?? null,
      roles: ['officer'],
    })
    .returning({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      roles: users.roles,
    });

  return reply.status(201).send(user);
}

export async function searchUsers(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { q } = request.query as { q?: string };

  if (!q || q.trim().length < 2) {
    return reply.send([]);
  }

  const pattern = `%${q.trim()}%`;
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      display_name: users.display_name,
      roles: users.roles,
    })
    .from(users)
    .where(
      or(
        ilike(users.display_name, pattern),
        ilike(users.email, pattern),
      )
    )
    .limit(20);

  return reply.send(result);
}

export async function getProfile(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      display_name: users.display_name,
      member_number: users.member_number,
      email_verified: users.email_verified,
      claimed: users.claimed,
      roles: users.roles,
      default_division: users.default_division,
      created_at: users.created_at,
      updated_at: users.updated_at,
    })
    .from(users)
    .where(eq(users.id, request.user.id))
    .limit(1);

  if (!user) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'User not found',
    });
  }

  const divisions = await db
    .select()
    .from(userDivisions)
    .where(eq(userDivisions.user_id, request.user.id));

  return reply.send({ ...user, divisions });
}

export async function updateProfile(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = updateProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { divisions, ...profileData } = parsed.data;

  const [updated] = await db
    .update(users)
    .set({ ...profileData, updated_at: new Date() })
    .where(eq(users.id, request.user.id))
    .returning({
      id: users.id,
      email: users.email,
      display_name: users.display_name,
      member_number: users.member_number,
      roles: users.roles,
      default_division: users.default_division,
      created_at: users.created_at,
      updated_at: users.updated_at,
    });

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'User not found',
    });
  }

  // Replace division profiles if provided
  if (divisions) {
    await db
      .delete(userDivisions)
      .where(eq(userDivisions.user_id, request.user.id));

    if (divisions.length > 0) {
      await db.insert(userDivisions).values(
        divisions.map((d) => ({
          user_id: request.user.id,
          division: d.division,
          classification: d.classification,
        })),
      );
    }
  }

  const updatedDivisions = await db
    .select()
    .from(userDivisions)
    .where(eq(userDivisions.user_id, request.user.id));

  return reply.send({ ...updated, divisions: updatedDivisions });
}

export async function listOfficers(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      display_name: users.display_name,
      member_number: users.member_number,
      roles: users.roles,
      created_at: users.created_at,
    })
    .from(users)
    .where(sql`'officer' = ANY(${users.roles})`)
    .orderBy(users.display_name);

  return reply.send(result);
}

export async function updateUserRoles(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const { roles: newRoles } = request.body as { roles: string[] };

  // Validate roles
  const validRoles = (ROLES as readonly string[]);
  if (!Array.isArray(newRoles) || newRoles.some((r) => !validRoles.includes(r))) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: `Invalid roles. Must be: ${ROLES.join(', ')}`,
    });
  }

  // Prevent removing own admin role
  if (id === request.user.id && !newRoles.includes('admin') && request.user.roles.includes('admin')) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Cannot remove your own admin role',
    });
  }

  const [updated] = await db
    .update(users)
    .set({ roles: newRoles as Role[], updated_at: new Date() })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      display_name: users.display_name,
      member_number: users.member_number,
      roles: users.roles,
    });

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'User not found',
    });
  }

  return reply.send(updated);
}

export async function deleteUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  if (id === request.user.id) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Cannot delete your own account',
    });
  }

  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'User not found',
    });
  }

  return reply.status(204).send();
}

/**
 * Admin: search shooter records with enough context (member #, claimed status,
 * how many matches/registrations they carry) to spot and pick duplicates to
 * merge. Matches on display name or member number.
 */
/**
 * GET /api/users/accounts — admin: list shooters who have signed up (claimed a
 * login). Small set, so no search/pagination.
 */
export async function listAccounts(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      member_number: users.member_number,
      email_verified: users.email_verified,
      roles: users.roles,
      created_at: users.created_at,
    })
    .from(users)
    .where(eq(users.claimed, true))
    .orderBy(users.display_name);

  return reply.send(result);
}

/**
 * PATCH /api/users/:id — admin: edit an account. Name only for now. Also
 * refreshes normalized_name so a future re-import matches the corrected
 * identity. Account-level only — does not touch match history/results.
 */
export async function adminUpdateShooter(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const parsed = adminUpdateShooterSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }
  const { display_name } = parsed.data;

  const [updated] = await db
    .update(users)
    .set({
      display_name,
      normalized_name: normalizeShooterName(display_name),
      updated_at: new Date(),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      member_number: users.member_number,
      email_verified: users.email_verified,
      claimed: users.claimed,
      roles: users.roles,
    });

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Account not found',
    });
  }

  return reply.send(updated);
}

export async function listShooters(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { q } = request.query as { q?: string };
  if (!q || q.trim().length < 2) {
    return reply.send([]);
  }
  const pattern = `%${q.trim()}%`;
  const result = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      member_number: users.member_number,
      claimed: users.claimed,
      roles: users.roles,
      match_count: sql<number>`(SELECT count(DISTINCT r.match_id)::int FROM registrations r WHERE r.user_id = users.id)`,
      registration_count: sql<number>`(SELECT count(*)::int FROM registrations r WHERE r.user_id = users.id)`,
    })
    .from(users)
    .where(or(ilike(users.display_name, pattern), ilike(users.member_number, pattern)))
    .orderBy(users.display_name)
    .limit(50);

  return reply.send(result);
}

/**
 * Public: search UNCLAIMED shooter records (with match history) so a shooter can
 * find + claim themselves at sign-up. Names/results are already public; claimed
 * accounts are never returned.
 */
export async function listClaimable(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { q } = request.query as { q?: string };
  if (!q || q.trim().length < 2) {
    return reply.send([]);
  }
  const pattern = `%${q.trim()}%`;
  const result = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      member_number: users.member_number,
      match_count: sql<number>`(SELECT count(DISTINCT r.match_id)::int FROM registrations r WHERE r.user_id = users.id)`,
    })
    .from(users)
    .where(
      and(
        eq(users.claimed, false),
        or(ilike(users.display_name, pattern), ilike(users.member_number, pattern))
      )
    )
    .orderBy(users.display_name)
    .limit(25);

  // Only surface records that actually carry match history.
  return reply.send(result.filter((r) => r.match_count > 0));
}

/**
 * Admin: suggest likely-duplicate shooters to review + merge, so the admin
 * doesn't have to guess who to search for. Fuzzy-groups records by surname +
 * given-name similarity (nicknames, spelling, middle names). Nothing auto-merges.
 */
export async function listShooterSuggestions(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const rows = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      normalized_name: users.normalized_name,
      claimed: users.claimed,
      member_number: users.member_number,
      match_count: sql<number>`(SELECT count(DISTINCT r.match_id)::int FROM registrations r WHERE r.user_id = users.id)`,
      registration_count: sql<number>`(SELECT count(*)::int FROM registrations r WHERE r.user_id = users.id)`,
    })
    .from(users);

  return reply.send(suggestDuplicates(rows).slice(0, 300));
}

/**
 * Admin: merge one shooter record (source `:id`) into another (`into`).
 * Reassigns the source's match history and any audit/owner references to the
 * target, then deletes the source. Registrations that would exactly duplicate
 * one the target already has are dropped (via cascade). Claimed accounts can't
 * be the source — merge the other direction to preserve the login.
 */
export async function mergeShooters(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: sourceId } = request.params as { id: string };
  const { into: targetId } = (request.body ?? {}) as { into?: string };

  if (!targetId) {
    return reply.status(400).send({
      statusCode: 400, error: 'Bad Request',
      message: 'Missing "into" target user id',
    });
  }
  if (sourceId === targetId) {
    return reply.status(400).send({
      statusCode: 400, error: 'Bad Request',
      message: 'Cannot merge a shooter into itself',
    });
  }

  const [source] = await db
    .select({ id: users.id, claimed: users.claimed, display_name: users.display_name, normalized_name: users.normalized_name })
    .from(users).where(eq(users.id, sourceId)).limit(1);
  const [target] = await db
    .select({ id: users.id, display_name: users.display_name, normalized_name: users.normalized_name })
    .from(users).where(eq(users.id, targetId)).limit(1);

  if (!source || !target) {
    return reply.status(404).send({
      statusCode: 404, error: 'Not Found', message: 'Source or target shooter not found',
    });
  }
  if (source.claimed) {
    return reply.status(400).send({
      statusCode: 400, error: 'Bad Request',
      message: 'Source is a claimed account; merge the other direction to keep its login',
    });
  }

  const [{ moved }] = await db.transaction(async (tx) => {
    // Reassign the shooter's match history. Skip a registration that would
    // exactly duplicate one the target already has (same match/division/member);
    // that stray source row is removed by the cascade when the user is deleted.
    const res = await tx.execute(sql`
      UPDATE registrations r SET user_id = ${targetId}
      WHERE r.user_id = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM registrations o
          WHERE o.user_id = ${targetId}
            AND o.match_id = r.match_id
            AND o.division = r.division
            AND coalesce(o.member_number, '') = coalesce(r.member_number, '')
        )`);
    // Unblock the non-cascade FK references so the source user can be deleted.
    await tx.execute(sql`UPDATE matches SET created_by = ${targetId} WHERE created_by = ${sourceId}`);
    await tx.execute(sql`UPDATE scores SET scored_by = ${targetId} WHERE scored_by = ${sourceId}`);
    await tx.execute(sql`UPDATE scores SET verified_by = ${targetId} WHERE verified_by = ${sourceId}`);
    await tx.execute(sql`UPDATE scores SET modified_by = ${targetId} WHERE modified_by = ${sourceId}`);
    // Make the merge sticky: carry over any aliases the source already owned,
    // then record the source's own identity key as an alias of the target, so a
    // future import of that name variant resolves to the kept record instead of
    // re-creating the duplicate. (Aliases cascade-delete with the source, so
    // re-point them before the delete.)
    await tx.execute(sql`UPDATE shooter_aliases SET user_id = ${targetId} WHERE user_id = ${sourceId}`);
    if (source.normalized_name && source.normalized_name !== target.normalized_name) {
      await tx.execute(sql`
        INSERT INTO shooter_aliases (normalized_name, user_id)
        VALUES (${source.normalized_name}, ${targetId})
        ON CONFLICT (normalized_name) DO UPDATE SET user_id = ${targetId}`);
    }
    // Delete the source; cascades away its (now empty/duplicate) memberships.
    await tx.execute(sql`DELETE FROM users WHERE id = ${sourceId}`);
    return [{ moved: res.count ?? 0 }];
  });

  return reply.send({
    message: `Merged "${source.display_name}" into "${target.display_name}"`,
    registrations_moved: moved,
    target_id: targetId,
  });
}
