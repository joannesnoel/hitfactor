import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, ilike } from 'drizzle-orm';
import { createRangeSchema, updateRangeSchema } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { shootingRanges } from '../../db/schema.js';

export async function listRanges(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await db
    .select()
    .from(shootingRanges)
    .orderBy(shootingRanges.name);

  return reply.send(result);
}

export async function getRange(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const [range] = await db
    .select()
    .from(shootingRanges)
    .where(eq(shootingRanges.id, id))
    .limit(1);

  if (!range) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Range not found',
    });
  }

  return reply.send(range);
}

export async function searchRanges(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { q } = request.query as { q?: string };

  if (!q || q.trim().length < 2) {
    return reply.send([]);
  }

  const pattern = `%${q.trim()}%`;
  const result = await db
    .select()
    .from(shootingRanges)
    .where(ilike(shootingRanges.name, pattern))
    .limit(20);

  return reply.send(result);
}

export async function createRange(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = createRangeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const [range] = await db
    .insert(shootingRanges)
    .values(parsed.data)
    .returning();

  return reply.status(201).send(range);
}

export async function updateRange(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const parsed = updateRangeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const [updated] = await db
    .update(shootingRanges)
    .set(parsed.data)
    .where(eq(shootingRanges.id, id))
    .returning();

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Range not found',
    });
  }

  return reply.send(updated);
}

export async function deleteRange(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const [deleted] = await db
    .delete(shootingRanges)
    .where(eq(shootingRanges.id, id))
    .returning({ id: shootingRanges.id });

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Range not found',
    });
  }

  return reply.status(204).send();
}
