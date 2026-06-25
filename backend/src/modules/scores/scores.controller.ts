import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { scoreInputSchema, computeScore } from '@hitfactor/shared';
import type { ScoringType, PowerFactor } from '@hitfactor/shared';
import { db } from '../../config/database.js';
import {
  scores,
  stages,
  registrations,
  matchOfficers,
  stageOfficers,
  matchAdmins,
} from '../../db/schema.js';

async function canScoreStage(
  matchId: string,
  stageId: string,
  userId: string,
  userRoles: string[]
): Promise<boolean> {
  if (userRoles.includes('admin')) return true;

  // Check match admin
  const [admin] = await db
    .select({ id: matchAdmins.id })
    .from(matchAdmins)
    .where(
      and(eq(matchAdmins.match_id, matchId), eq(matchAdmins.user_id, userId))
    )
    .limit(1);
  if (admin) return true;

  // Check match officer
  const [officer] = await db
    .select({ id: matchOfficers.id })
    .from(matchOfficers)
    .where(
      and(
        eq(matchOfficers.match_id, matchId),
        eq(matchOfficers.user_id, userId)
      )
    )
    .limit(1);
  if (officer) return true;

  // Check stage officer
  const [stageOfficer] = await db
    .select({ id: stageOfficers.id })
    .from(stageOfficers)
    .where(
      and(
        eq(stageOfficers.stage_id, stageId),
        eq(stageOfficers.user_id, userId)
      )
    )
    .limit(1);
  if (stageOfficer) return true;

  return false;
}

export async function getScoresForStage(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, stageId } = request.params as {
    id: string;
    stageId: string;
  };

  const result = await db
    .select()
    .from(scores)
    .where(and(eq(scores.match_id, matchId), eq(scores.stage_id, stageId)));

  return reply.send(result);
}

export async function upsertScore(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, stageId } = request.params as {
    id: string;
    stageId: string;
  };

  // Check authorization
  const canScore = await canScoreStage(
    matchId,
    stageId,
    request.user.id,
    request.user.roles
  );
  if (!canScore) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to score this stage',
    });
  }

  const parsed = scoreInputSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: parsed.error.flatten(),
    });
  }

  const input = parsed.data;

  // Get stage for scoring_type
  const [stage] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.match_id, matchId)))
    .limit(1);

  if (!stage) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Stage not found',
    });
  }

  // Get registration info
  const [registration] = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.id, input.registration_id),
        eq(registrations.match_id, matchId)
      )
    )
    .limit(1);

  if (!registration) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Registration not found',
    });
  }

  // Compute scoring fields
  const computed = computeScore(
    {
      alpha_count: input.alpha_count,
      charlie_count: input.charlie_count,
      delta_count: input.delta_count,
      miss_count: input.miss_count,
      no_shoot_count: input.no_shoot_count,
      procedural_count: input.procedural_count,
      steel_hits: input.steel_hits,
      steel_misses: input.steel_misses,
      time: input.time,
      power_factor: registration.power_factor as PowerFactor,
      dqed: input.dqed,
      dnf: input.dnf,
    },
    stage.scoring_type as ScoringType
  );

  const scoreData = {
    match_id: matchId,
    stage_id: stageId,
    registration_id: input.registration_id,
    shooter_name: registration.shooter_name,
    division: registration.division,
    power_factor: registration.power_factor,
    alpha_count: input.alpha_count,
    charlie_count: input.charlie_count,
    delta_count: input.delta_count,
    miss_count: input.miss_count,
    no_shoot_count: input.no_shoot_count,
    procedural_count: input.procedural_count,
    steel_hits: input.steel_hits,
    steel_misses: input.steel_misses,
    time: input.time.toString(),
    raw_points: computed.raw_points,
    penalty_points: computed.penalty_points,
    total_points: computed.total_points,
    hit_factor: computed.hit_factor.toString(),
    scored_by: request.user.id,
    dqed: input.dqed ?? false,
    dnf: input.dnf ?? false,
    modified_at: new Date(),
    modified_by: request.user.id,
  };

  // Check if score already exists for this stage + registration
  const [existing] = await db
    .select({ id: scores.id })
    .from(scores)
    .where(
      and(
        eq(scores.stage_id, stageId),
        eq(scores.registration_id, input.registration_id)
      )
    )
    .limit(1);

  let result;
  if (existing) {
    [result] = await db
      .update(scores)
      .set(scoreData)
      .where(eq(scores.id, existing.id))
      .returning();
  } else {
    [result] = await db
      .insert(scores)
      .values(scoreData)
      .returning();
  }

  return reply.status(existing ? 200 : 201).send(result);
}

export async function verifyScore(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, stageId, scoreId } = request.params as {
    id: string;
    stageId: string;
    scoreId: string;
  };

  // Check authorization
  const canScore = await canScoreStage(
    matchId,
    stageId,
    request.user.id,
    request.user.roles
  );
  if (!canScore) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to verify scores for this stage',
    });
  }

  const [updated] = await db
    .update(scores)
    .set({
      verified: true,
      verified_by: request.user.id,
      modified_at: new Date(),
      modified_by: request.user.id,
    })
    .where(
      and(
        eq(scores.id, scoreId),
        eq(scores.stage_id, stageId),
        eq(scores.match_id, matchId)
      )
    )
    .returning();

  if (!updated) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Score not found',
    });
  }

  return reply.send(updated);
}
