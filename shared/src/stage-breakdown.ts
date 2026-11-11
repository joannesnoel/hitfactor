// Stage-level comparison for one shooter. The stage winner has nobody ahead of
// them to measure against, so a winner is compared with the runner-up; everyone
// else is compared with the winner. Both are also shown against the field average
// (everyone else who was scored on the stage).

import type { StagePerfBundle } from './analytics.engine.js';
import type { StageResultEntry } from './types.js';

export interface StageSide {
  registration_id: string;
  name: string;
  place: number;
  hit_factor: number;
  points: number;
  time: number;
  alpha_pct: number | null;
}

export interface StageBreakdown {
  stage_id: string;
  stage_number: number;
  /** The shooter's own line, or null when unscored (DQ / DNF / no time). */
  me: StageSide | null;
  /** The runner-up when the shooter won the stage, otherwise the stage winner. */
  benchmark: (StageSide & { role: 'winner' | 'runner_up' }) | null;
  /** Average of everyone else scored on the stage. */
  fieldAvg: { hit_factor: number; points: number; time: number; alpha_pct: number | null } | null;
  /** Shooter minus benchmark: positive hit factor/points = ahead; negative time = faster. */
  vs: { hit_factor_pct: number; points: number; time: number } | null;
}

const isScored = (e: StageResultEntry) => !e.dqed && !e.dnf && e.time > 0;

function alphaPct(e: StageResultEntry): number | null {
  const hits = e.alpha_count + e.charlie_count + e.delta_count + e.miss_count;
  return hits > 0 ? (e.alpha_count / hits) * 100 : null;
}

function side(e: StageResultEntry): StageSide {
  return {
    registration_id: e.registration_id,
    name: e.shooter_name,
    place: e.place,
    hit_factor: e.hit_factor,
    points: e.total_points,
    time: e.time,
    alpha_pct: alphaPct(e),
  };
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function buildStageBreakdowns(
  stages: StagePerfBundle[],
  registrationId: string
): StageBreakdown[] {
  const out: StageBreakdown[] = [];

  for (const s of [...stages].sort((a, b) => a.stage_number - b.stage_number)) {
    const field = s.results.filter((r) => !r.combined);
    const mine = field.find((r) => r.registration_id === registrationId);
    if (!mine) continue;

    const scored = field.filter(isScored).sort((a, b) => a.place - b.place);
    const me = isScored(mine) ? side(mine) : null;
    const others = scored.filter((r) => r.registration_id !== registrationId);

    // Winner → compare with the runner-up; everyone else → with the winner.
    let benchmark: StageBreakdown['benchmark'] = null;
    if (me && others.length > 0) {
      const iWon = scored[0]?.registration_id === registrationId;
      benchmark = {
        ...side(iWon ? others[0] : scored[0]),
        role: iWon ? 'runner_up' : 'winner',
      };
    }

    const alphas = others.map(alphaPct).filter((x): x is number => x !== null);
    const fieldAvg =
      others.length > 0
        ? {
            hit_factor: mean(others.map((r) => r.hit_factor)) ?? 0,
            points: mean(others.map((r) => r.total_points)) ?? 0,
            time: mean(others.map((r) => r.time)) ?? 0,
            alpha_pct: mean(alphas),
          }
        : null;

    const vs =
      me && benchmark && benchmark.hit_factor > 0
        ? {
            hit_factor_pct: ((me.hit_factor - benchmark.hit_factor) / benchmark.hit_factor) * 100,
            points: me.points - benchmark.points,
            time: me.time - benchmark.time,
          }
        : null;

    out.push({
      stage_id: s.stage_id,
      stage_number: s.stage_number,
      me,
      benchmark,
      fieldAvg,
      vs,
    });
  }
  return out;
}
