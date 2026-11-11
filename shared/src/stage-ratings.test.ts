import { describe, it, expect } from 'vitest';
import { buildStageRatings } from './stage-ratings.js';
import type { StagePerfBundle } from './analytics.engine.js';
import type { StageResultEntry } from './types.js';

function e(reg: string, name: string, points: number, time: number, extra: Partial<StageResultEntry> = {}): StageResultEntry {
  return {
    registration_id: reg, shooter_name: name, division: 'production', classification: null, power_factor: 'Minor',
    alpha_count: 8, charlie_count: 0, delta_count: 0, miss_count: 0, no_shoot_count: 0, procedural_count: 0,
    steel_hits: 0, steel_misses: 0, time, raw_points: points, penalty_points: 0, total_points: points,
    hit_factor: points / time, stage_percentage: 0, stage_points: 0, place: 0, dqed: false, dnf: false, ...extra,
  } as StageResultEntry;
}
const stage = (n: number, results: StageResultEntry[]): StagePerfBundle => ({ stage_id: `s${n}`, stage_number: n, max_points: 100, results });

// Me: 80 pts in 10s. Bea: 100 pts in 20s. Cy: 60 pts in 8s.
const field = [e('M', 'Me', 80, 10), e('B', 'Bea', 100, 20), e('C', 'Cy', 60, 8)];

describe('buildStageRatings', () => {
  const [r] = buildStageRatings([stage(1, field)], 'M');

  it('rates points against the best other shooter (100 = equal)', () => {
    expect(r.best.points).toEqual({ value: 100, name: 'Bea' });
    expect(r.rating.points).toBeCloseTo(80, 5);
  });

  it('rates speed so a lower time is a higher rating', () => {
    expect(r.best.time).toEqual({ value: 8, name: 'Cy' });
    expect(r.rating.speed).toBeCloseTo(80, 5); // 8s best other / my 10s
  });

  it('rates hit factor against the best other hit factor', () => {
    // Me 8.0, Bea 5.0, Cy 7.5 → best other 7.5.
    expect(r.best.hit_factor.name).toBe('Cy');
    expect(r.rating.hit_factor).toBeCloseTo((8 / 7.5) * 100, 5);
  });

  it('goes above 100 for a stage winner, so a winner still has a comparison', () => {
    const win = buildStageRatings([stage(1, [e('M', 'Me', 120, 10), e('B', 'Bea', 100, 20)])], 'M')[0];
    expect(win.rating.points).toBeCloseTo(120, 5);
    expect(win.rating.speed).toBeCloseTo(200, 5); // twice as fast as the best other
  });

  it('rates the field average against the same baseline', () => {
    expect(r.avgRating.points).toBeCloseTo(80, 5); // others avg 80 / best other 100
  });

  it('skips stages where nobody else was scored, or the shooter was not', () => {
    expect(buildStageRatings([stage(1, [e('M', 'Me', 80, 10)])], 'M')).toEqual([]);
    expect(buildStageRatings([stage(1, [e('B', 'Bea', 100, 20)])], 'M')).toEqual([]);
    expect(buildStageRatings([stage(1, [e('M', 'Me', 0, 0, { dnf: true }), e('B', 'Bea', 100, 20)])], 'M')).toEqual([]);
  });

  it('ignores DQ/DNF shooters as the benchmark', () => {
    const f = [e('M', 'Me', 80, 10), e('B', 'Bea', 200, 5, { dqed: true }), e('C', 'Cy', 60, 8)];
    const [x] = buildStageRatings([stage(1, f)], 'M');
    expect(x.best.points.name).toBe('Cy');
  });

  it('orders by stage number', () => {
    const out = buildStageRatings([stage(2, field), stage(1, field)], 'M');
    expect(out.map((s) => s.stage_number)).toEqual([1, 2]);
  });
});
