import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { computeShooterPerformance } from '@hitfactor/shared';
import type {
  MatchPerfBundle,
  StageResultEntry,
  MatchResultEntry,
} from '@hitfactor/shared';
import { db } from '../../config/database.js';
import {
  registrations,
  matches,
  stages,
  stageResults,
  matchResults,
} from '../../db/schema.js';

/**
 * GET /api/shooter/performance — the logged-in shooter's cross-match analytics.
 * Assembles the persisted stage_results / match_results for every match+division
 * they competed in and runs the shared analytics engine (no recompute).
 */
export async function getMyPerformance(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.user.id;

  const regs = await db
    .select({
      id: registrations.id,
      match_id: registrations.match_id,
      division: registrations.division,
    })
    .from(registrations)
    .where(eq(registrations.user_id, userId));

  if (regs.length === 0) {
    return reply.send(computeShooterPerformance([]));
  }

  const matchIds = [...new Set(regs.map((r) => r.match_id))];
  const [matchRows, stageRows, srRows, mrRows] = await Promise.all([
    db.select().from(matches).where(inArray(matches.id, matchIds)),
    db.select().from(stages).where(inArray(stages.match_id, matchIds)),
    db.select().from(stageResults).where(inArray(stageResults.match_id, matchIds)),
    db.select().from(matchResults).where(inArray(matchResults.match_id, matchIds)),
  ]);

  const matchById = new Map(matchRows.map((m) => [m.id, m]));
  const stagesByMatch = new Map<string, typeof stageRows>();
  for (const s of stageRows) {
    const list = stagesByMatch.get(s.match_id) ?? [];
    list.push(s);
    stagesByMatch.set(s.match_id, list);
  }
  // (match_id|division) → MatchResultEntry[]
  const fieldByKey = new Map<string, MatchResultEntry[]>();
  for (const mr of mrRows) {
    fieldByKey.set(`${mr.match_id}|${mr.division}`, mr.results as MatchResultEntry[]);
  }
  // (match_id|division) → stage_id → StageResultEntry[]
  const stageResByKey = new Map<string, Map<string, StageResultEntry[]>>();
  for (const sr of srRows) {
    const key = `${sr.match_id}|${sr.division}`;
    let inner = stageResByKey.get(key);
    if (!inner) {
      inner = new Map();
      stageResByKey.set(key, inner);
    }
    inner.set(sr.stage_id, sr.results as StageResultEntry[]);
  }

  const bundles: MatchPerfBundle[] = [];
  for (const reg of regs) {
    const key = `${reg.match_id}|${reg.division}`;
    const field = fieldByKey.get(key);
    if (!field) continue; // results not computed for this match/division yet
    const match = matchById.get(reg.match_id);
    // Private (shooter-hosted) matches are casual and never official, so they're
    // excluded from career stats, trends and accuracy/speed metrics.
    if (match?.is_private) continue;
    const srMap = stageResByKey.get(key) ?? new Map<string, StageResultEntry[]>();
    const bundleStages = (stagesByMatch.get(reg.match_id) ?? [])
      .slice()
      .sort((a, b) => a.stage_number - b.stage_number)
      .map((s) => {
        const results = srMap.get(s.id);
        return results
          ? {
              stage_id: s.id,
              stage_number: s.stage_number,
              max_points: s.max_points,
              results,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    bundles.push({
      match_id: reg.match_id,
      match_name: match?.name ?? 'Match',
      match_date: match?.start_date ?? '',
      organization: match?.organization ?? 'PSMOC',
      division: reg.division,
      registration_id: reg.id,
      match_results: field,
      stages: bundleStages,
    });
  }

  return reply.send(computeShooterPerformance(bundles));
}
