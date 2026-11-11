import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { addScorerSchema } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { matchOfficers, registrations, users } from '../../db/schema.js';
import { isMatchHost } from './match-authz.js';
import { SCORER_ROLE, checkScorerCandidate } from './match-scorers.js';

// Scorers are managed only by the host of a private match (not admins — public
// matches use the officers machinery).
async function requireHost(
  request: FastifyRequest,
  reply: FastifyReply,
  matchId: string
): Promise<boolean> {
  if (await isMatchHost(matchId, request.user.id)) return true;
  reply.status(403).send({
    statusCode: 403,
    error: 'Forbidden',
    message: 'Only the host can manage scorers',
  });
  return false;
}

export async function listScorers(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  if (!(await requireHost(request, reply, id))) return;

  const rows = await db
    .select({ user_id: matchOfficers.user_id, display_name: users.display_name })
    .from(matchOfficers)
    .innerJoin(users, eq(matchOfficers.user_id, users.id))
    .where(and(eq(matchOfficers.match_id, id), eq(matchOfficers.role, SCORER_ROLE)));

  return reply.send(rows);
}

export async function addScorer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  if (!(await requireHost(request, reply, id))) return;

  const parsed = addScorerSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }
  const { user_id } = parsed.data;

  const [reg] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(and(eq(registrations.match_id, id), eq(registrations.user_id, user_id)))
    .limit(1);
  const [u] = await db
    .select({ password_hash: users.password_hash })
    .from(users)
    .where(eq(users.id, user_id))
    .limit(1);

  const rejection = checkScorerCandidate({
    isRegistered: !!reg,
    canLogin: !!u?.password_hash,
    isHost: user_id === request.user.id,
  });
  if (rejection) {
    return reply.status(rejection.status).send({
      statusCode: rejection.status,
      error: 'Bad Request',
      message: rejection.message,
    });
  }

  // One officer row per user per match; an existing row (any role) is kept as is.
  await db
    .insert(matchOfficers)
    .values({ match_id: id, user_id, role: SCORER_ROLE })
    .onConflictDoNothing();

  return reply.status(201).send({ message: 'Scorer added' });
}

export async function removeScorer(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id, userId } = request.params as { id: string; userId: string };
  if (!(await requireHost(request, reply, id))) return;

  // Only removes scorers added here (role SPO), never other officer roles.
  const deleted = await db
    .delete(matchOfficers)
    .where(
      and(
        eq(matchOfficers.match_id, id),
        eq(matchOfficers.user_id, userId),
        eq(matchOfficers.role, SCORER_ROLE)
      )
    )
    .returning({ id: matchOfficers.id });

  if (deleted.length === 0) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Scorer not found',
    });
  }
  return reply.status(204).send();
}
