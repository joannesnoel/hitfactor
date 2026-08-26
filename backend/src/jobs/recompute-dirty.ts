/**
 * Auto-recompute scheduler tick (run by a k8s CronJob, ~every minute).
 *
 * Recomputes results for every active match that has had a score change since
 * its last recompute (the cheap "dirty" check against match_recompute_state).
 * Idle matches cost one indexed query and nothing else. Single-runner by design
 * (one CronJob pod per tick) + a per-match advisory lock inside the recompute,
 * so it never races a manual "Compute results" click.
 */
import { and, or, eq, gt, isNull, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { matches, matchRecomputeState } from '../db/schema.js';
import { recomputeMatchResults } from '../modules/results/results.controller.js';

async function main(): Promise<void> {
  const started = Date.now();

  const dirty = await db
    .select({ match_id: matchRecomputeState.match_id })
    .from(matchRecomputeState)
    .innerJoin(matches, eq(matches.id, matchRecomputeState.match_id))
    .where(
      and(
        inArray(matches.status, ['active', 'scoring']),
        or(
          isNull(matchRecomputeState.results_computed_at),
          gt(
            matchRecomputeState.scores_changed_at,
            matchRecomputeState.results_computed_at
          )
        )
      )
    );

  if (dirty.length === 0) {
    console.log(
      `[recompute-dirty] no dirty active matches (${Date.now() - started}ms)`
    );
    return;
  }

  let ok = 0;
  for (const { match_id } of dirty) {
    try {
      const { stagesComputed, divisions } =
        await recomputeMatchResults(match_id);
      ok++;
      console.log(
        `[recompute-dirty] ${match_id}: ${stagesComputed} stages, ${divisions.length} divisions`
      );
    } catch (err) {
      console.error(`[recompute-dirty] ${match_id} failed:`, err);
    }
  }

  console.log(
    `[recompute-dirty] recomputed ${ok}/${dirty.length} matches (${Date.now() - started}ms)`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[recompute-dirty] fatal:', err);
    process.exit(1);
  });
