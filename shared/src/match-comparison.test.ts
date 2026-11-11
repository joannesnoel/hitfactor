import { describe, it, expect } from 'vitest';
import { buildComparisonBundle } from './match-comparison.js';
import { computeShooterPerformance } from './analytics.engine.js';
import type { StageResultEntry } from './types.js';

// Minor power factor: A = 5 points, so HF = 5 * alphas / time.
function entry(reg: string, name: string, division: string, alphas: number, time = 10): StageResultEntry {
  return {
    registration_id: reg,
    shooter_name: name,
    division,
    classification: null,
    power_factor: 'Minor',
    alpha_count: alphas,
    charlie_count: 0,
    delta_count: 0,
    miss_count: 0,
    no_shoot_count: 0,
    procedural_count: 0,
    steel_hits: 0,
    steel_misses: 0,
    time,
    raw_points: alphas * 5,
    penalty_points: 0,
    total_points: alphas * 5,
    hit_factor: (alphas * 5) / time,
    stage_percentage: 0,
    stage_points: 0,
    place: 0,
    dqed: false,
    dnf: false,
  } as StageResultEntry;
}

// Division "production": X (HF 5.0) and Y (HF 4.0). Division "optics": Z (HF 6.0).
const stage = {
  stage_id: 's1',
  stage_number: 1,
  max_points: 100,
  scoring_type: 'comstock',
  byDivision: {
    production: [entry('X', 'Xena', 'production', 10), entry('Y', 'Yuri', 'production', 8)],
    optics: [entry('Z', 'Zed', 'optics', 12)],
  },
};

const base = {
  match: { id: 'm', name: 'M', date: '2026-11-11', organization: 'PSMOC' },
  stages: [stage],
};

describe('buildComparisonBundle', () => {
  it('scores a shooter against their own division by default', () => {
    const b = buildComparisonBundle({ ...base, shooter: { registration_id: 'X', division: 'production' }, compareDivisions: ['production'] });
    const pct = Object.fromEntries(b.stages[0].results.map((r) => [r.registration_id, Math.round(r.stage_percentage)]));
    expect(pct).toEqual({ X: 100, Y: 80 });
    expect(b.match_results.map((r) => r.registration_id)).toEqual(['X', 'Y']);
  });

  it('re-scores against the best hit factor when another division joins the field', () => {
    const b = buildComparisonBundle({ ...base, shooter: { registration_id: 'X', division: 'production' }, compareDivisions: ['production', 'optics'] });
    const pct = Object.fromEntries(b.stages[0].results.map((r) => [r.registration_id, Math.round(r.stage_percentage)]));
    expect(pct).toEqual({ X: 83, Y: 67, Z: 100 });
    expect(b.match_results.map((r) => r.registration_id)).toEqual(['Z', 'X', 'Y']);
  });

  it('compares a shooter with only another division (themself is always included)', () => {
    const b = buildComparisonBundle({ ...base, shooter: { registration_id: 'X', division: 'production' }, compareDivisions: ['optics'] });
    expect(b.match_results.map((r) => r.registration_id).sort()).toEqual(['X', 'Z']);
    expect(b.match_results[0].registration_id).toBe('Z');
  });

  it('feeds the analytics engine, with entries counted as the real field', () => {
    const b = buildComparisonBundle({ ...base, shooter: { registration_id: 'X', division: 'production' }, compareDivisions: ['production', 'optics'] });
    const perf = computeShooterPerformance([b]).matches[0];
    expect(perf.place).toBe(2);
    expect(perf.field_size).toBe(3);
    expect(perf.stages[0].stage_percentage).toBeCloseTo(83.33, 1);
  });

  it('skips stages the shooter has no result for', () => {
    const noX = { ...stage, stage_id: 's2', stage_number: 2, byDivision: { production: [entry('Y', 'Yuri', 'production', 8)] } };
    const b = buildComparisonBundle({ ...base, stages: [stage, noX], shooter: { registration_id: 'X', division: 'production' }, compareDivisions: ['production'] });
    expect(b.stages.map((s) => s.stage_number)).toEqual([1]);
  });

  it('does not mutate the stored results', () => {
    buildComparisonBundle({ ...base, shooter: { registration_id: 'X', division: 'production' }, compareDivisions: ['production', 'optics'] });
    expect(stage.byDivision.production[0].combined).toBeUndefined();
    expect(stage.byDivision.production[0].stage_percentage).toBe(0);
  });
});
