import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray } from 'drizzle-orm';
import {
  computeScore,
  isValidDivisionForOrg,
  MATCH_LEVEL_OFFICIAL_ROLES,
} from '@hitfactor/shared';
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

/**
 * Whether a user may score a specific stage:
 *  - match admins                         → any stage in the match
 *  - match-level officials (MM, CSPO, …)  → any stage in the match
 *  - everyone else (stage officers)       → only stages they are assigned to
 */
async function canUserScoreStage(
  matchId: string,
  stageId: string,
  userId: string
): Promise<boolean> {
  // Match admins can score any stage in the match.
  const [admin] = await db
    .select({ id: matchAdmins.id })
    .from(matchAdmins)
    .where(
      and(eq(matchAdmins.match_id, matchId), eq(matchAdmins.user_id, userId))
    )
    .limit(1);
  if (admin) return true;

  // Match-level officials manage/process the whole match.
  const [officer] = await db
    .select({ role: matchOfficers.role })
    .from(matchOfficers)
    .where(
      and(
        eq(matchOfficers.match_id, matchId),
        eq(matchOfficers.user_id, userId)
      )
    )
    .limit(1);
  if (
    officer &&
    (MATCH_LEVEL_OFFICIAL_ROLES as readonly string[]).includes(officer.role)
  ) {
    return true;
  }

  // Otherwise the user must be assigned to this specific stage.
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
  return !!stageOfficer;
}

/** Authorize a PATCH/DELETE on an existing score (resolves its stage first). */
async function canUserModifyScore(
  scoreId: string,
  userId: string
): Promise<boolean> {
  const [s] = await db
    .select({ match_id: scores.match_id, stage_id: scores.stage_id })
    .from(scores)
    .where(eq(scores.id, scoreId))
    .limit(1);
  if (!s) return true; // missing row — the handler reports "not found"
  return canUserScoreStage(s.match_id, s.stage_id, userId);
}

/**
 * Who may re-enable scoring on a locked score: only a user holding the Match
 * Admin (MA) or Match Master (MM) OFFICER role on this match. Deliberately NOT a
 * global admin, nor the match's created-by admin, unless they hold one of those
 * match roles — re-enabling a score is a per-match workflow control.
 */
async function canUnlockScore(
  matchId: string,
  userId: string
): Promise<boolean> {
  const [mo] = await db
    .select({ role: matchOfficers.role })
    .from(matchOfficers)
    .where(
      and(
        eq(matchOfficers.match_id, matchId),
        eq(matchOfficers.user_id, userId),
        inArray(matchOfficers.role, ['MA', 'MM'])
      )
    )
    .limit(1);
  return !!mo;
}

const LOCKED_MESSAGE =
  'Score is locked. A Match Admin or Match Master must re-enable scoring to revise it.';

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

// The client stores jsonb columns as JSON strings in local SQLite, so target_hits
// arrives as a string on upload. Parse it to an object so drizzle's jsonb column
// stores it correctly (a raw string would get double-encoded).
function parseTargetHits(
  v: unknown
): { paper: string[][]; steel: boolean[] } | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    try {
      const o = JSON.parse(v);
      return o && typeof o === 'object'
        ? (o as { paper: string[][]; steel: boolean[] })
        : null;
    } catch {
      return null;
    }
  }
  if (typeof v === 'object') {
    return v as { paper: string[][]; steel: boolean[] };
  }
  return null;
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
    target_hits: parseTargetHits(data.target_hits),
    // A save locks the score (defaults to locked when the client omits it).
    locked: data.locked !== undefined ? Boolean(data.locked) : true,
    modified_at: new Date(),
    modified_by: userId,
  };

  // Check for existing score (last-write-wins)
  const [existing] = await db
    .select({ id: scores.id, modified_at: scores.modified_at, locked: scores.locked })
    .from(scores)
    .where(
      and(
        eq(scores.stage_id, stageId),
        eq(scores.registration_id, registrationId)
      )
    )
    .limit(1);

  if (existing) {
    // A locked score can only be modified by a Match Admin/Master (or admin).
    if (existing.locked && !(await canUnlockScore(matchId, userId))) {
      throw new Error(LOCKED_MESSAGE);
    }

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

  // A locked score can only be modified (including re-enabling scoring) by a
  // Match Admin/Master (or admin).
  if (existing.locked && !(await canUnlockScore(existing.match_id, userId))) {
    throw new Error(LOCKED_MESSAGE);
  }

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

  // Strip any client-supplied division so it can never be patched. Pull
  // target_hits out too so we can parse it (jsonb) instead of spreading the raw
  // JSON string, which would double-encode; and `locked` so the client's 0/1
  // becomes a real boolean.
  const {
    division: _ignoredDivision,
    target_hits: rawTargetHits,
    locked: rawLocked,
    ...patchData
  } = data;

  await db
    .update(scores)
    .set({
      ...patchData,
      ...(rawTargetHits !== undefined
        ? { target_hits: parseTargetHits(rawTargetHits) }
        : {}),
      ...(rawLocked !== undefined ? { locked: Boolean(rawLocked) } : {}),
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
        // System admins bypass; otherwise scoring is enforced per-stage.
        const isSystemAdmin = request.user.roles.includes('admin');
        if (op.op === 'PUT' && op.data) {
          const matchId = op.data.match_id as string;
          const stageId = op.data.stage_id as string;
          if (
            !isSystemAdmin &&
            !(await canUserScoreStage(matchId, stageId, request.user.id))
          ) {
            errors.push({ op, error: 'Not authorized to score this stage' });
            continue;
          }
          await handleScorePut(op.data, op.id, request.user.id);
        } else if (op.op === 'PATCH' && op.data) {
          if (
            !isSystemAdmin &&
            !(await canUserModifyScore(op.id, request.user.id))
          ) {
            errors.push({ op, error: 'Not authorized to edit this score' });
            continue;
          }
          await handleScorePatch(op.data, op.id, request.user.id);
        } else if (op.op === 'DELETE') {
          if (
            !isSystemAdmin &&
            !(await canUserModifyScore(op.id, request.user.id))
          ) {
            errors.push({ op, error: 'Not authorized to delete this score' });
            continue;
          }
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
            // Idempotent by registration id (the client's stable local row id):
            // editing a registration updates in place, while a genuinely different
            // division is a distinct row (allowed by the wider unique constraint).
            .onConflictDoUpdate({
              target: registrations.id,
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
