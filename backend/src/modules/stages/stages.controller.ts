import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ne } from 'drizzle-orm';
import {
  createStageSchema,
  updateStageSchema,
  computeStageRounds,
  changedLockedStageFields,
  defaultStageName,
  STAGE_HAS_SCORES_MESSAGE,
  STAGE_DELETE_HAS_SCORES_MESSAGE,
} from '@hitfactor/shared';
import { db } from '../../config/database.js';
import { stages, matchAdmins, scores } from '../../db/schema.js';
import { isMatchHost } from '../matches/match-authz.js';

// May the user set up stages for this match? A match admin (public match) or the
// host (private, shooter-created match). Callers also allow the global admin.
export async function canManageStages(
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
  if (admin) return true;
  return isMatchHost(matchId, userId);
}

// Whether `stageNumber` is already used by another stage in the match
// (stages_match_stage_unique). `excludeStageId` lets an update keep its own number.
export async function stageNumberTaken(
  matchId: string,
  stageNumber: number,
  excludeStageId?: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(
      and(
        eq(stages.match_id, matchId),
        eq(stages.stage_number, stageNumber),
        excludeStageId ? ne(stages.id, excludeStageId) : undefined
      )
    )
    .limit(1);
  return !!row;
}

// Whether any score has been entered on the stage.
export async function stageHasScores(stageId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: scores.id })
    .from(scores)
    .where(eq(scores.stage_id, stageId))
    .limit(1);
  return !!row;
}

function stageLocked(reply: FastifyReply, message: string) {
  return reply.status(409).send({
    statusCode: 409,
    error: 'Conflict',
    message,
  });
}

function stageNumberConflict(reply: FastifyReply, stageNumber: number) {
  return reply.status(409).send({
    statusCode: 409,
    error: 'Conflict',
    message: `Stage ${stageNumber} already exists in this match`,
  });
}

// Postgres unique_violation, possibly wrapped by the driver/ORM as `cause`.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23505' || e?.cause?.code === '23505';
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

  const isAdmin = await canManageStages(matchId, request.user.id);
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

  if (await stageNumberTaken(matchId, parsed.data.stage_number)) {
    return stageNumberConflict(reply, parsed.data.stage_number);
  }

  const { min_rounds, max_points } = computeStageRounds(parsed.data);

  try {
    const [stage] = await db
      .insert(stages)
      .values({
        ...parsed.data,
        name: parsed.data.name ?? defaultStageName(parsed.data.stage_number),
        match_id: matchId,
        min_rounds,
        max_points,
        paper_target_rounds: parsed.data.paper_target_rounds ?? Array(parsed.data.number_of_targets).fill(2),
        fixed_time: parsed.data.fixed_time?.toString() ?? null,
      })
      .returning();

    return reply.status(201).send(stage);
  } catch (err) {
    // Lost a race with a concurrent create of the same stage number.
    if (isUniqueViolation(err)) {
      return stageNumberConflict(reply, parsed.data.stage_number);
    }
    throw err;
  }
}

export async function updateStage(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, stageId } = request.params as {
    id: string;
    stageId: string;
  };

  const isAdmin = await canManageStages(matchId, request.user.id);
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

  if (
    parsed.data.stage_number !== undefined &&
    (await stageNumberTaken(matchId, parsed.data.stage_number, stageId))
  ) {
    return stageNumberConflict(reply, parsed.data.stage_number);
  }

  // Once a stage has scores, what makes a score valid (targets, steel, rounds,
  // scoring type…) can't change — scores keep the hits they were entered with.
  const [current] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.match_id, matchId)));
  if (
    current &&
    changedLockedStageFields(current, parsed.data).length > 0 &&
    (await stageHasScores(stageId))
  ) {
    return stageLocked(reply, STAGE_HAS_SCORES_MESSAGE);
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

  const isAdmin = await canManageStages(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');

  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to delete stages for this match',
    });
  }

  if (await stageHasScores(stageId)) {
    return stageLocked(reply, STAGE_DELETE_HAS_SCORES_MESSAGE);
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
