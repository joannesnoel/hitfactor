/**
 * One pass of the auto-recompute scheduler: recompute results for every non-final
 * match whose scores changed since its last recompute (cheap dirty-check on
 * match_recompute_state). Idle matches cost one indexed query and nothing else.
 * The per-match advisory lock lives inside recomputeMatchResults, so this is safe
 * even alongside a manual "Compute results" click.
 */
import { and, or, eq, gt, isNull, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { matches, matchRecomputeState } from '../db/schema.js';
import { recomputeMatchResults } from '../modules/results/results.controller.js';

export async function recomputeDirtyMatches(): Promise<{
  recomputed: number;
  total: number;
  ms: number;
}> {
  const started = Date.now();

  const dirty = await db
    .select({ match_id: matchRecomputeState.match_id })
    .from(matchRecomputeState)
    .innerJoin(matches, eq(matches.id, matchRecomputeState.match_id))
    .where(
      and(
        // Any match that isn't finalised/archived: scores can land while a match
        // is still 'draft' (a host who never advanced the status) and shooters
        // expect results to follow.
        inArray(matches.status, ['draft', 'registration', 'active', 'scoring']),
        or(
          isNull(matchRecomputeState.results_computed_at),
          gt(
            matchRecomputeState.scores_changed_at,
            matchRecomputeState.results_computed_at
          )
        )
      )
    );

  let recomputed = 0;
  for (const { match_id } of dirty) {
    try {
      await recomputeMatchResults(match_id);
      recomputed++;
    } catch (err) {
      console.error(`[recompute] ${match_id} failed:`, err);
    }
  }

  return { recomputed, total: dirty.length, ms: Date.now() - started };
}
