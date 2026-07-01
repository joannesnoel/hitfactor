import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, ne, desc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { matches, stages } from '../../db/schema.js';

// Public, unauthenticated read handlers. Everything here must be safe to serve
// to anyone: only published matches (status != 'draft') and their results.

export async function listPublicMatches(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await db
    .select()
    .from(matches)
    .where(ne(matches.status, 'draft'))
    .orderBy(desc(matches.start_date));
  return reply.send(result);
}

export async function getPublicMatch(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);

  // Drafts are not published — hide them exactly like a missing match.
  if (!match || match.status === 'draft') {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Match not found',
    });
  }

  const matchStages = await db
    .select()
    .from(stages)
    .where(eq(stages.match_id, id));

  return reply.send({ ...match, stages: matchStages });
}
