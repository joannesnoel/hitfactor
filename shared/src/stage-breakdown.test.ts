import { describe, it, expect } from 'vitest';
import { buildStageBreakdowns } from './stage-breakdown.js';
import type { StagePerfBundle } from './analytics.engine.js';
import type { StageResultEntry } from './types.js';

function e(reg: string, name: string, place: number, hf: number, points: number, time: number, extra: Partial<StageResultEntry> = {}): StageResultEntry {
  return {
    registration_id: reg, shooter_name: name, division: 'production', classification: null, power_factor: 'Minor',
    alpha_count: 8, charlie_count: 2, delta_count: 0, miss_count: 0, no_shoot_count: 0, procedural_count: 0,
    steel_hits: 0, steel_misses: 0, time, raw_points: points, penalty_points: 0, total_points: points,
    hit_factor: hf, stage_percentage: 0, stage_points: 0, place, dqed: false, dnf: false, ...extra,
  } as StageResultEntry;
}

const stage = (results: StageResultEntry[]): StagePerfBundle => ({ stage_id: 's1', stage_number: 1, max_points: 100, results });

describe('buildStageBreakdowns', () => {
  const field = [e('A', 'Ann', 1, 6.0, 60, 10), e('B', 'Bea', 2, 5.0, 55, 11), e('C', 'Cy', 3, 4.0, 48, 12)];

  it('compares a stage winner with the runner-up', () => {
    const [b] = buildStageBreakdowns([stage(field)], 'A');
    expect(b.benchmark?.role).toBe('runner_up');
    expect(b.benchmark?.name).toBe('Bea');
    expect(b.vs?.hit_factor_pct).toBeCloseTo(20, 5); // 6.0 vs 5.0
    expect(b.vs?.points).toBe(5);
    expect(b.vs?.time).toBe(-1); // one second faster
  });

  it('compares everyone else with the winner', () => {
    const [b] = buildStageBreakdowns([stage(field)], 'C');
    expect(b.benchmark?.role).toBe('winner');
    expect(b.benchmark?.name).toBe('Ann');
    expect(b.vs?.hit_factor_pct).toBeCloseTo(-33.33, 1);
    expect(b.vs?.time).toBe(2);
  });

  it('averages everyone else for the field comparison', () => {
    const [b] = buildStageBreakdowns([stage(field)], 'A');
    expect(b.fieldAvg?.hit_factor).toBeCloseTo(4.5, 5); // Bea 5.0, Cy 4.0
    expect(b.fieldAvg?.points).toBeCloseTo(51.5, 5);
  });

  it('has nothing to compare when the shooter is alone on the stage', () => {
    const [b] = buildStageBreakdowns([stage([e('A', 'Ann', 1, 6, 60, 10)])], 'A');
    expect(b.benchmark).toBeNull();
    expect(b.fieldAvg).toBeNull();
    expect(b.vs).toBeNull();
  });

  it('ignores DQ/DNF shooters when picking the benchmark and averages', () => {
    const f = [e('A', 'Ann', 2, 5, 55, 11), e('B', 'Bea', 1, 6, 60, 10, { dqed: true }), e('C', 'Cy', 3, 4, 48, 12)];
    const [b] = buildStageBreakdowns([stage(f)], 'A');
    expect(b.benchmark?.role).toBe('runner_up'); // Ann is the best scored, so she "won"
    expect(b.benchmark?.name).toBe('Cy');
  });

  it('has no line for an unscored shooter', () => {
    const [b] = buildStageBreakdowns([stage([e('A', 'Ann', 3, 0, 0, 0, { dnf: true }), e('B', 'Bea', 1, 6, 60, 10)])], 'A');
    expect(b.me).toBeNull();
    expect(b.benchmark).toBeNull();
  });

  it('skips stages the shooter was not in', () => {
    expect(buildStageBreakdowns([stage([e('B', 'Bea', 1, 6, 60, 10)])], 'A')).toEqual([]);
  });
});
