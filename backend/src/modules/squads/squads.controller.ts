import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { createSquadSchema } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { squads, registrations, matchAdmins } from '../../db/schema.js';

async function isMatchAdmin(
  matchId: string,
  userId: string
): Promise<boolean> {
  const [admin] = await db
    .select({ id: matchAdmins.id })
    .from(matchAdmins)
    .where(
      and(eq(matchAdmins.match_id, matchId), eq(matchAdmins.user_id, userId))
    )
    .limit(1);
  return !!admin;
}

export async function listSquads(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId } = request.params as { id: string };

  const result = await db
    .select()
    .from(squads)
    .where(eq(squads.match_id, matchId));

  return reply.send(result);
}

export async function createSquad(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId } = request.params as { id: string };

  const isAdmin = await isMatchAdmin(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');

  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to create squads for this match',
    });
  }

  const parsed = createSquadSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const [squad] = await db
    .insert(squads)
    .values({
      ...parsed.data,
      match_id: matchId,
    })
    .returning();

  return reply.status(201).send(squad);
}

export async function updateSquad(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, squadId } = request.params as {
    id: string;
    squadId: string;
  };

  const isAdmin = await isMatchAdmin(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');

  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to update squads for this match',
    });
  }

  const parsed = createSquadSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const [updated] = await db
    .update(squads)
    .set(parsed.data)
    .where(and(eq(squads.id, squadId), eq(squads.match_id, matchId)))
    .returning();

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Squad not found',
    });
  }

  return reply.send(updated);
}

export async function deleteSquad(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, squadId } = request.params as {
    id: string;
    squadId: string;
  };

  const isAdmin = await isMatchAdmin(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');

  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to delete squads for this match',
    });
  }

  const [deleted] = await db
    .delete(squads)
    .where(and(eq(squads.id, squadId), eq(squads.match_id, matchId)))
    .returning();

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Squad not found',
    });
  }

  return reply.status(204).send();
}

export async function assignToSquad(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, squadId } = request.params as {
    id: string;
    squadId: string;
  };
  const { registration_id } = request.body as { registration_id: string };

  if (!registration_id) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'registration_id is required',
    });
  }

  // Verify squad exists and belongs to match
  const [squad] = await db
    .select()
    .from(squads)
    .where(and(eq(squads.id, squadId), eq(squads.match_id, matchId)))
    .limit(1);

  if (!squad) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Squad not found',
    });
  }

  // Check squad capacity
  const currentMembers = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.squad_id, squadId));

  if (currentMembers.length >= squad.max_size) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Squad is full',
    });
  }

  // Update registration
  const [updated] = await db
    .update(registrations)
    .set({ squad_id: squadId })
    .where(
      and(
        eq(registrations.id, registration_id),
        eq(registrations.match_id, matchId)
      )
    )
    .returning();

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Registration not found',
    });
  }

  return reply.send(updated);
}
