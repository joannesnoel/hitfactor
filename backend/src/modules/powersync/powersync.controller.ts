import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { computeScore, isValidDivisionForOrg } from '@hitfactor/shared';
import type {
  ScoringType,
  PowerFactor,
  Organization,
  PowerSyncWriteOp,
} from '@hitfactor/shared';
import { db } from '../../config/database.js';
import {
  scores,
  stages,
  registrations,
  matches,
  matchOfficers,
  stageOfficers,
  matchAdmins,
} from '../../db/schema.js';

async function canUserScoreMatch(
  matchId: string,
  userId: string
): Promise<boolean> {
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

  return false;
}

/**
 * Throws if `division` is not a division offered by the match's organization.
 * Errors propagate to handleUploadData's per-op catch and become 207 errors.
 */
async function assertValidDivisionForMatch(
  matchId: string,
  division: string
): Promise<void> {
  const [matchRow] = await db
    .select({ organization: matches.organization })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!matchRow) throw new Error(`Match ${matchId} not found`);
  if (!isValidDivisionForOrg(matchRow.organization as Organization, division)) {
    throw new Error(
      `Division "${division}" is not valid for organization ${matchRow.organization}`
    );
  }
}

async function handleScorePut(
  data: Record<string, unknown>,
  id: string,
  userId: string
): Promise<void> {
  const matchId = data.match_id as string;
  const stageId = data.stage_id as string;
  const registrationId = data.registration_id as string;

  // Get stage for scoring_type
  const [stage] = await db
    .select()
    .from(stages)
    .where(eq(stages.id, stageId))
    .limit(1);

  if (!stage) throw new Error(`Stage ${stageId} not found`);

  // Get registration for power_factor
  const [registration] = await db
    .select()
    .from(registrations)
    .where(eq(registrations.id, registrationId))
    .limit(1);

  if (!registration) throw new Error(`Registration ${registrationId} not found`);

  // A score's division is authoritative from the registration, not the client.
  // Validate it against the match's organization (defense-in-depth).
  await assertValidDivisionForMatch(matchId, registration.division);

  const powerFactor = (data.power_factor ?? registration.power_factor) as PowerFactor;

  // Compute scoring fields
  const computed = computeScore(
    {
      alpha_count: (data.alpha_count as number) ?? 0,
      charlie_count: (data.charlie_count as number) ?? 0,
      delta_count: (data.delta_count as number) ?? 0,
      miss_count: (data.miss_count as number) ?? 0,
      no_shoot_count: (data.no_shoot_count as number) ?? 0,
      procedural_count: (data.procedural_count as number) ?? 0,
      steel_hits: (data.steel_hits as number) ?? 0,
      steel_misses: (data.steel_misses as number) ?? 0,
      time: (data.time as number) ?? 0,
      power_factor: powerFactor,
      dqed: (data.dqed as boolean) ?? false,
      dnf: (data.dnf as boolean) ?? false,
    },
    stage.scoring_type as ScoringType
  );

  const scoreData = {
    id,
    match_id: matchId,
    stage_id: stageId,
    registration_id: registrationId,
    shooter_name: (data.shooter_name as string) ?? registration.shooter_name,
    division: registration.division,
    power_factor: powerFactor,
    alpha_count: (data.alpha_count as number) ?? 0,
    charlie_count: (data.charlie_count as number) ?? 0,
    delta_count: (data.delta_count as number) ?? 0,
    miss_count: (data.miss_count as number) ?? 0,
    no_shoot_count: (data.no_shoot_count as number) ?? 0,
    procedural_count: (data.procedural_count as number) ?? 0,
    steel_hits: (data.steel_hits as number) ?? 0,
    steel_misses: (data.steel_misses as number) ?? 0,
    time: ((data.time as number) ?? 0).toString(),
    raw_points: computed.raw_points,
    penalty_points: computed.penalty_points,
    total_points: computed.total_points,
    hit_factor: computed.hit_factor.toString(),
    scored_by: userId,
    dqed: (data.dqed as boolean) ?? false,
    dnf: (data.dnf as boolean) ?? false,
    modified_at: new Date(),
    modified_by: userId,
  };

  // Check for existing score (last-write-wins)
  const [existing] = await db
    .select({ id: scores.id, modified_at: scores.modified_at })
    .from(scores)
    .where(
      and(
        eq(scores.stage_id, stageId),
        eq(scores.registration_id, registrationId)
      )
    )
    .limit(1);

  if (existing) {
    // Last-write-wins: compare timestamps
    const incomingTime = data.modified_at
      ? new Date(data.modified_at as string)
      : new Date();
    if (existing.modified_at && existing.modified_at > incomingTime) {
      return; // Existing is newer, skip
    }

    await db
      .update(scores)
      .set(scoreData)
      .where(eq(scores.id, existing.id));
  } else {
    await db.insert(scores).values(scoreData);
  }
}

async function handleScorePatch(
  data: Record<string, unknown>,
  id: string,
  userId: string
): Promise<void> {
  // Get existing score
  const [existing] = await db
    .select()
    .from(scores)
    .where(eq(scores.id, id))
    .limit(1);

  if (!existing) throw new Error(`Score ${id} not found`);

  // Division is authoritative from registration and immutable via PATCH;
  // validate the stored value defensively against the match's organization.
  await assertValidDivisionForMatch(existing.match_id, existing.division);

  // Merge fields (division is dropped below so a PATCH can't change it)
  const merged = { ...existing, ...data };

  // Get stage for scoring_type
  const [stage] = await db
    .select()
    .from(stages)
    .where(eq(stages.id, existing.stage_id))
    .limit(1);

  if (!stage) throw new Error(`Stage ${existing.stage_id} not found`);

  // Recompute scoring fields
  const computed = computeScore(
    {
      alpha_count: merged.alpha_count as number,
      charlie_count: merged.charlie_count as number,
      delta_count: merged.delta_count as number,
      miss_count: merged.miss_count as number,
      no_shoot_count: merged.no_shoot_count as number,
      procedural_count: merged.procedural_count as number,
      steel_hits: merged.steel_hits as number,
      steel_misses: merged.steel_misses as number,
      time: parseFloat(merged.time as string),
      power_factor: merged.power_factor as PowerFactor,
      dqed: merged.dqed as boolean,
      dnf: merged.dnf as boolean,
    },
    stage.scoring_type as ScoringType
  );

  // Last-write-wins timestamp check
  const incomingTime = data.modified_at
    ? new Date(data.modified_at as string)
    : new Date();
  if (existing.modified_at && existing.modified_at > incomingTime) {
    return; // Existing is newer, skip
  }

  // Strip any client-supplied division so it can never be patched.
  const { division: _ignoredDivision, ...patchData } = data;

  await db
    .update(scores)
    .set({
      ...patchData,
      raw_points: computed.raw_points,
      penalty_points: computed.penalty_points,
      total_points: computed.total_points,
      hit_factor: computed.hit_factor.toString(),
      modified_at: new Date(),
      modified_by: userId,
    })
    .where(eq(scores.id, id));
}

async function handleScoreDelete(id: string): Promise<void> {
  await db.delete(scores).where(eq(scores.id, id));
}

export async function handleUploadData(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = request.body as { operations?: PowerSyncWriteOp[] };

  if (!body?.operations || !Array.isArray(body.operations)) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'operations array is required',
    });
  }

  const errors: Array<{ op: PowerSyncWriteOp; error: string }> = [];

  for (const op of body.operations) {
    try {
      if (op.type === 'scores') {
        // Check authorization for score operations
        if (op.op === 'PUT' && op.data) {
          const matchId = op.data.match_id as string;
          if (matchId) {
            const hasAccess =
              request.user.roles.includes('admin') ||
              (await canUserScoreMatch(matchId, request.user.id));
            if (!hasAccess) {
              errors.push({
                op,
                error: 'Not authorized to score this match',
              });
              continue;
            }
          }
          await handleScorePut(op.data, op.id, request.user.id);
        } else if (op.op === 'PATCH' && op.data) {
          await handleScorePatch(op.data, op.id, request.user.id);
        } else if (op.op === 'DELETE') {
          await handleScoreDelete(op.id);
        }
      } else if (op.type === 'registrations') {
        // Handle registration operations
        if (op.op === 'PUT' && op.data) {
          const { match_id, shooter_name, division, power_factor, ...rest } =
            op.data;

          // Validate the division is offered by this match's organization.
          await assertValidDivisionForMatch(
            match_id as string,
            division as string
          );

          await db
            .insert(registrations)
            .values({
              id: op.id,
              match_id: match_id as string,
              user_id: request.user.id,
              shooter_name: shooter_name as string,
              division: division as string,
              power_factor: power_factor as string,
              ...(rest as Record<string, unknown>),
            })
            .onConflictDoUpdate({
              target: [registrations.match_id, registrations.user_id],
              set: {
                shooter_name: shooter_name as string,
                division: division as string,
                power_factor: power_factor as string,
              },
            });
        } else if (op.op === 'DELETE') {
          await db
            .delete(registrations)
            .where(eq(registrations.id, op.id));
        }
      }
      // Other table types can be added here as needed
    } catch (err) {
      errors.push({
        op,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  if (errors.length > 0) {
    return reply.status(207).send({
      message: 'Some operations failed',
      errors,
    });
  }

  return reply.send({ message: 'All operations processed successfully' });
}
