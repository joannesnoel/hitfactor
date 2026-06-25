import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
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
} from '@hitfactor/shared';
import { db } from '../../config/database.js';
import {
  scores,
  stages,
  stageResults,
  matchResults,
  matchAdmins,
} from '../../db/schema.js';

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

  // Get all stages for this match
  const matchStages = await db
    .select()
    .from(stages)
    .where(eq(stages.match_id, matchId));

  // Get all scores for this match
  const allScores = await db
    .select()
    .from(scores)
    .where(eq(scores.match_id, matchId));

  const now = new Date();
  const allStageResultsForMatch: StageResultsForMatch[] = [];

  // Compute stage results per division per stage
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

    // Find which divisions have scores for this stage
    const divisionsInStage = [
      ...new Set(stageScores.map((s) => s.division)),
    ];

    for (const division of divisionsInStage) {
      const { stageWinnerHF, results } = computeStageResults(
        stageScores,
        stage.scoring_type as ScoringType,
        division
      );

      // Upsert stage result
      const [existing] = await db
        .select({ id: stageResults.id })
        .from(stageResults)
        .where(
          and(
            eq(stageResults.stage_id, stage.id),
            eq(stageResults.division, division)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(stageResults)
          .set({
            stage_winner_hit_factor: stageWinnerHF.toString(),
            results: results,
            computed_at: now,
          })
          .where(eq(stageResults.id, existing.id));
      } else {
        await db.insert(stageResults).values({
          match_id: matchId,
          stage_id: stage.id,
          division,
          stage_winner_hit_factor: stageWinnerHF.toString(),
          results: results,
          computed_at: now,
        });
      }

      allStageResultsForMatch.push({
        stage_id: stage.id,
        division,
        results,
      });
    }
  }

  // Compute match results per division
  const allDivisions = [
    ...new Set(allStageResultsForMatch.map((sr) => sr.division)),
  ];

  for (const division of allDivisions) {
    const divisionStageResults = allStageResultsForMatch.filter(
      (sr) => sr.division === division
    );

    const matchResultEntries = computeMatchResults(
      divisionStageResults,
      division
    );

    // Upsert match result
    const [existing] = await db
      .select({ id: matchResults.id })
      .from(matchResults)
      .where(
        and(
          eq(matchResults.match_id, matchId),
          eq(matchResults.division, division)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(matchResults)
        .set({
          results: matchResultEntries,
          computed_at: now,
        })
        .where(eq(matchResults.id, existing.id));
    } else {
      await db.insert(matchResults).values({
        match_id: matchId,
        division,
        results: matchResultEntries,
        computed_at: now,
      });
    }
  }

  return reply.send({
    message: 'Results computed successfully',
    stages_computed: matchStages.length,
    divisions_computed: allDivisions,
  });
}

export async function getMatchResults(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id: matchId } = request.params as { id: string };
  const { division } = request.query as { division?: string };

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
