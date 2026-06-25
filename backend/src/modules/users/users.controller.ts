import type { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { eq, or, ilike, sql } from 'drizzle-orm';
import { updateProfileSchema, createOfficerSchema, ROLES } from '@hitfactor/shared';
import type { Role } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { users, userDivisions } from '../../db/schema.js';

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
