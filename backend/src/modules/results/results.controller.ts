import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import {
  computeStageResults,
  computeMatchResults,
  DIVISIONS,
} from '@hitfactor/shared';
import type {
  ScoringType,
  PowerFactor,
  StageScoreData,
  StageResultsForMatch,
  StageResultEntry,
  MatchResultEntry,
} from '@hitfactor/shared';
import { db } from '../../config/database.js';
import {
  matches,
  registrations,
  matchOfficers,
  scores,
  stages,
  stageResults,
  matchResults,
  matchAdmins,
  matchRecomputeState,
} from '../../db/schema.js';

// Canonical JSON (recursively sorted keys) so a freshly-computed results array
// can be compared against the stored jsonb, which Postgres returns with
// normalized (unordered) keys. Used to skip writing unchanged result rows so
// PowerSync only re-syncs standings that actually moved.
function canonicalJson(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = (val as Record<string, unknown>)[k];
            return acc;
          }, {})
      : val,
  );
}

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

/**
 * Whether the requester may read this match's results. Public matches are
 * visible to anyone (incl. unauthenticated); a private match is visible only to
 * a global admin, or a user registered in / officiating / admin of that match.
 * Used to gate both the public and authenticated results endpoints.
 */
async function canViewMatchResults(
  matchId: string,
  request: FastifyRequest
): Promise<boolean> {
  const [m] = await db
    .select({ is_private: matches.is_private })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!m) return false;
  if (!m.is_private) return true;

  const user = request.user;
  if (!user) return false;
  if (user.roles?.includes('admin')) return true;

  const [reg] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.match_id, matchId),
        eq(registrations.user_id, user.id)
      )
    )
    .limit(1);
  if (reg) return true;

  const [off] = await db
    .select({ id: matchOfficers.id })
    .from(matchOfficers)
    .where(
      and(
        eq(matchOfficers.match_id, matchId),
        eq(matchOfficers.user_id, user.id)
      )
    )
    .limit(1);
  if (off) return true;

  return isMatchAdmin(matchId, user.id);
}

export async function computeResultsForMatch(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId } = request.params as { id: string };

  // Check authorization
  const isAdmin = await isMatchAdmin(matchId, request.user.id);
  const isGlobalAdmin = request.user.roles.includes('admin');

  if (!isAdmin && !isGlobalAdmin) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Not authorized to compute results for this match',
    });
  }

  const { stagesComputed, divisions } = await recomputeMatchResults(matchId);

  return reply.send({
    message: 'Results computed successfully',
    stages_computed: stagesComputed,
    divisions_computed: divisions,
  });
}

/**
 * Recompute stage_results + match_results for a match from its scores. Reusable
 * by the compute endpoint, the auto-recompute scheduler, and the importer.
 *
 * Computes everything in memory, then reconciles under a per-match advisory lock
 * writing ONLY the rows that actually changed (and deleting ones no longer
 * present) — so concurrent recomputes are safe and PowerSync only re-syncs
 * standings that moved.
 */
export async function recomputeMatchResults(
  matchId: string
): Promise<{ stagesComputed: number; divisions: string[] }> {
  // The point-in-time we're computing up to. Anything that changes scores after
  // this stays dirty for the next tick (scores_changed_at will be newer).
  const [state] = await db
    .select({ changed: matchRecomputeState.scores_changed_at })
    .from(matchRecomputeState)
    .where(eq(matchRecomputeState.match_id, matchId))
    .limit(1);
  const computedUpTo = state?.changed ?? new Date();

  const matchStages = await db
    .select()
    .from(stages)
    .where(eq(stages.match_id, matchId));

  const allScores = await db
    .select()
    .from(scores)
    .where(eq(scores.match_id, matchId));

  // ── Pure computation (no DB writes) ──
  const allStageResultsForMatch: StageResultsForMatch[] = [];
  const newStageRows: Array<{
    stage_id: string;
    division: string;
    hf: string;
    results: StageResultEntry[];
  }> = [];

  for (const stage of matchStages) {
    const stageScores: StageScoreData[] = allScores
      .filter((s) => s.stage_id === stage.id)
      .map((s) => ({
        registration_id: s.registration_id,
        shooter_name: s.shooter_name,
        division: s.division,
        classification: null,
        power_factor: s.power_factor as PowerFactor,
        alpha_count: s.alpha_count,
        charlie_count: s.charlie_count,
        delta_count: s.delta_count,
        miss_count: s.miss_count,
        no_shoot_count: s.no_shoot_count,
        procedural_count: s.procedural_count,
        steel_hits: s.steel_hits,
        steel_misses: s.steel_misses,
        time: parseFloat(s.time),
        dqed: s.dqed,
        dnf: s.dnf,
      }));

    const divisionsInStage = [...new Set(stageScores.map((s) => s.division))];
    for (const division of divisionsInStage) {
      const { stageWinnerHF, results } = computeStageResults(
        stageScores,
        stage.scoring_type as ScoringType,
        division,
        stage.max_points
      );
      newStageRows.push({
        stage_id: stage.id,
        division,
        hf: stageWinnerHF.toString(),
        results,
      });
      allStageResultsForMatch.push({ stage_id: stage.id, division, results });
    }

    // Combined (cross-division) — one pool, scored vs the single overall best HF.
    if (stageScores.length > 0) {
      const { stageWinnerHF, results } = computeStageResults(
        stageScores,
        stage.scoring_type as ScoringType,
        'combined',
        stage.max_points,
        true
      );
      newStageRows.push({
        stage_id: stage.id,
        division: 'combined',
        hf: stageWinnerHF.toString(),
        results,
      });
      allStageResultsForMatch.push({
        stage_id: stage.id,
        division: 'combined',
        results,
      });
    }
  }

  const allDivisions = [
    ...new Set(allStageResultsForMatch.map((sr) => sr.division)),
  ];
  const newMatchRows: Array<{ division: string; results: MatchResultEntry[] }> =
    allDivisions.map((division) => ({
      division,
      results: computeMatchResults(
        allStageResultsForMatch.filter((sr) => sr.division === division),
        division
      ),
    }));

  // ── Reconcile: diff-only writes under a per-match advisory lock ──
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${matchId})::bigint)`
    );

    const existingStage = await tx
      .select()
      .from(stageResults)
      .where(eq(stageResults.match_id, matchId));
    const existingMatch = await tx
      .select()
      .from(matchResults)
      .where(eq(matchResults.match_id, matchId));
    const exStage = new Map(
      existingStage.map((r) => [`${r.stage_id}|${r.division}`, r])
    );
    const exMatch = new Map(existingMatch.map((r) => [r.division, r]));

    const seenStage = new Set<string>();
    for (const row of newStageRows) {
      const key = `${row.stage_id}|${row.division}`;
      seenStage.add(key);
      const ex = exStage.get(key);
      if (!ex) {
        await tx.insert(stageResults).values({
          match_id: matchId,
          stage_id: row.stage_id,
          division: row.division,
          stage_winner_hit_factor: row.hf,
          results: row.results,
          computed_at: now,
        });
      } else if (
        ex.stage_winner_hit_factor !== row.hf ||
        canonicalJson(ex.results) !== canonicalJson(row.results)
      ) {
        await tx
          .update(stageResults)
          .set({
            stage_winner_hit_factor: row.hf,
            results: row.results,
            computed_at: now,
          })
          .where(eq(stageResults.id, ex.id));
      }
    }
    for (const ex of existingStage) {
      if (!seenStage.has(`${ex.stage_id}|${ex.division}`)) {
        await tx.delete(stageResults).where(eq(stageResults.id, ex.id));
      }
    }

    const seenMatch = new Set<string>();
    for (const row of newMatchRows) {
      seenMatch.add(row.division);
      const ex = exMatch.get(row.division);
      if (!ex) {
        await tx.insert(matchResults).values({
          match_id: matchId,
          division: row.division,
          results: row.results,
          computed_at: now,
        });
      } else if (canonicalJson(ex.results) !== canonicalJson(row.results)) {
        await tx
          .update(matchResults)
          .set({ results: row.results, computed_at: now })
          .where(eq(matchResults.id, ex.id));
      }
    }
    for (const ex of existingMatch) {
      if (!seenMatch.has(ex.division)) {
        await tx.delete(matchResults).where(eq(matchResults.id, ex.id));
      }
    }

    // Mark results computed up to the captured point (leave scores_changed_at so
    // a score that landed mid-compute keeps the match dirty for the next tick).
    await tx
      .insert(matchRecomputeState)
      .values({
        match_id: matchId,
        scores_changed_at: computedUpTo,
        results_computed_at: computedUpTo,
      })
      .onConflictDoUpdate({
        target: matchRecomputeState.match_id,
        set: { results_computed_at: computedUpTo },
      });
  });

  return { stagesComputed: matchStages.length, divisions: allDivisions };
}

export async function getMatchResults(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId } = request.params as { id: string };
  const { division } = request.query as { division?: string };

  if (!(await canViewMatchResults(matchId, request))) {
    return reply
      .status(404)
      .send({ statusCode: 404, error: 'Not Found', message: 'Match not found' });
  }

  const whereClause = division
    ? and(eq(matchResults.match_id, matchId), eq(matchResults.division, division))
    : eq(matchResults.match_id, matchId);

  const results = await db
    .select()
    .from(matchResults)
    .where(whereClause);

  return reply.send(results);
}

export async function getStageResults(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId, stageId } = request.params as {
    id: string;
    stageId: string;
  };
  const { division } = request.query as { division?: string };

  if (!(await canViewMatchResults(matchId, request))) {
    return reply
      .status(404)
      .send({ statusCode: 404, error: 'Not Found', message: 'Match not found' });
  }

  let whereClause = and(
    eq(stageResults.match_id, matchId),
    eq(stageResults.stage_id, stageId)
  );

  if (division) {
    whereClause = and(whereClause, eq(stageResults.division, division));
  }

  const results = await db
    .select()
    .from(stageResults)
    .where(whereClause);

  return reply.send(results);
}
