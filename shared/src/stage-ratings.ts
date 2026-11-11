// Per-stage ratings for one shooter, measured against "the best of the rest": the
// best any OTHER shooter did on that measure on that stage. 100 means equal to
// them; a stage winner goes above 100, everyone else sits at or below it. That
// way a winner still has something to compare with.
//
//   points     = your points ÷ the best other shooter's points
//   speed      = the fastest other time ÷ your time  (a lower time rates higher)
//   hit_factor = your hit factor ÷ the best other hit factor

import type { StagePerfBundle } from './analytics.engine.js';
import type { StageResultEntry } from './types.js';

export type RatingMetric = 'points' | 'speed' | 'hit_factor';

interface Named {
  value: number;
  name: string;
}

export interface StageRating {
  stage_id: string;
  stage_number: number;
  me: { points: number; time: number; hit_factor: number };
  /** The best any other shooter did on each measure (and who). */
  best: { points: Named; time: Named; hit_factor: Named };
  /** The average of everyone else. */
  avg: { points: number; time: number; hit_factor: number };
  /** You vs the best of the rest, as a % (100 = equal). */
  rating: Record<RatingMetric, number | null>;
  /** The field average vs the best of the rest, as a %. */
  avgRating: Record<RatingMetric, number | null>;
}

const isScored = (e: StageResultEntry) => !e.dqed && !e.dnf && e.time > 0;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (a: number, b: number): number | null => (b > 0 ? (a / b) * 100 : null);

function maxBy(es: StageResultEntry[], f: (e: StageResultEntry) => number): Named {
  const e = es.reduce((m, x) => (f(x) > f(m) ? x : m));
  return { value: f(e), name: e.shooter_name };
}
function minBy(es: StageResultEntry[], f: (e: StageResultEntry) => number): Named {
  const e = es.reduce((m, x) => (f(x) < f(m) ? x : m));
  return { value: f(e), name: e.shooter_name };
}

/** Only stages the shooter was scored on and at least one other shooter was too. */
export function buildStageRatings(
  stages: StagePerfBundle[],
  registrationId: string
): StageRating[] {
  const out: StageRating[] = [];

  for (const s of [...stages].sort((a, b) => a.stage_number - b.stage_number)) {
    const field = s.results.filter((r) => !r.combined);
    const mine = field.find((r) => r.registration_id === registrationId);
    if (!mine || !isScored(mine)) continue;
    const others = field.filter((r) => r.registration_id !== registrationId && isScored(r));
    if (others.length === 0) continue;

    const best = {
      points: maxBy(others, (e) => e.total_points),
      time: minBy(others, (e) => e.time),
      hit_factor: maxBy(others, (e) => e.hit_factor),
    };
    const avg = {
      points: mean(others.map((e) => e.total_points)),
      time: mean(others.map((e) => e.time)),
      hit_factor: mean(others.map((e) => e.hit_factor)),
    };

    out.push({
      stage_id: s.stage_id,
      stage_number: s.stage_number,
      me: { points: mine.total_points, time: mine.time, hit_factor: mine.hit_factor },
      best,
      avg,
      rating: {
        points: pct(mine.total_points, best.points.value),
        speed: pct(best.time.value, mine.time),
        hit_factor: pct(mine.hit_factor, best.hit_factor.value),
      },
      avgRating: {
        points: pct(avg.points, best.points.value),
        speed: pct(best.time.value, avg.time),
        hit_factor: pct(avg.hit_factor, best.hit_factor.value),
      },
    });
  }
  return out;
}
