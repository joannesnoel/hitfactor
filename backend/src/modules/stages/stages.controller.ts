import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { createStageSchema, updateStageSchema, computeStageRounds } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { stages, matchAdmins } from '../../db/schema.js';

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

export async function listStages(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };

  const result = await db
    .select()
    .from(stages)
    .where(eq(stages.match_id, id));

  return reply.send(result);
}

export async function createStage(
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
      message: 'Not authorized to add stages to this match',
    });
  }

  const parsed = createStageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const { min_rounds, max_points } = computeStageRounds(parsed.data);

  const [stage] = await db
    .insert(stages)
    .values({
      ...parsed.data,
      match_id: matchId,
      min_rounds,
      max_points,
      paper_target_rounds: parsed.data.paper_target_rounds ?? Array(parsed.data.number_of_targets).fill(2),
      fixed_time: parsed.data.fixed_time?.toString() ?? null,
    })
    .returning();

  return reply.status(201).send(stage);
}

export async function updateStage(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, stageId } = request.params as {
    id: string;
    stageId: string;
  };

  const isAdmin = await isMatchAdmin(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');

  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to update stages for this match',
    });
  }

  const parsed = updateStageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updated_at: new Date() };
  if (parsed.data.fixed_time !== undefined) {
    updateData.fixed_time = parsed.data.fixed_time?.toString() ?? null;
  }
  // Recompute min_rounds/max_points if target config changed
  if (parsed.data.number_of_targets !== undefined || parsed.data.number_of_steel !== undefined || parsed.data.paper_target_rounds !== undefined) {
    // Need full stage data to recompute — fetch existing
    const [existing] = await db.select().from(stages).where(and(eq(stages.id, stageId), eq(stages.match_id, matchId)));
    if (existing) {
      const merged = {
        number_of_targets: parsed.data.number_of_targets ?? existing.number_of_targets,
        number_of_steel: parsed.data.number_of_steel ?? existing.number_of_steel,
        paper_target_rounds: parsed.data.paper_target_rounds ?? (existing.paper_target_rounds as number[] | undefined),
      };
      const computed = computeStageRounds(merged);
      updateData.min_rounds = computed.min_rounds;
      updateData.max_points = computed.max_points;
    }
  }

  const [updated] = await db
    .update(stages)
    .set(updateData)
    .where(and(eq(stages.id, stageId), eq(stages.match_id, matchId)))
    .returning();

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Stage not found',
    });
  }

  return reply.send(updated);
}

export async function deleteStage(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, stageId } = request.params as {
    id: string;
    stageId: string;
  };

  const isAdmin = await isMatchAdmin(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');

  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to delete stages for this match',
    });
  }

  const [deleted] = await db
    .delete(stages)
    .where(and(eq(stages.id, stageId), eq(stages.match_id, matchId)))
    .returning();

  if (!deleted) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Stage not found',
    });
  }

  return reply.status(204).send();
}
