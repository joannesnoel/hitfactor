import { describe, expect, it } from 'vitest';
import { computeShooterPerformance } from './analytics.engine.js';
import type { MatchPerfBundle } from './analytics.engine.js';
import type { StageResultEntry, MatchResultEntry } from './types.js';

const stageEntry = (
  o: Partial<StageResultEntry> & { registration_id: string; place: number }
): StageResultEntry => ({
  shooter_name: 'S',
  division: 'production' as StageResultEntry['division'],
  classification: null,
  power_factor: 'Minor',
  alpha_count: 0,
  charlie_count: 0,
  delta_count: 0,
  miss_count: 0,
  no_shoot_count: 0,
  procedural_count: 0,
  steel_hits: 0,
  steel_misses: 0,
  time: 5,
  raw_points: 0,
  penalty_points: 0,
  total_points: 0,
  hit_factor: 0,
  stage_percentage: 0,
  stage_points: 0,
  dqed: false,
  dnf: false,
  ...o,
});

const matchEntry = (
  o: Partial<MatchResultEntry> & { registration_id: string; place: number }
): MatchResultEntry => ({
  shooter_name: 'S',
  division: 'production' as MatchResultEntry['division'],
  classification: null,
  power_factor: 'Minor',
  stage_percentages: {},
  match_points: 0,
  total_percentage: 0,
  dqed: false,
  ...o,
});

// One match, two stages. "me" (r1) vs winner (r2), plus r3 to make a field of 3.
const bundle = (): MatchPerfBundle => ({
  match_id: 'm1',
  match_name: 'Test Match',
  match_date: '2026-07-01',
  organization: 'PSMOC',
  division: 'production',
  registration_id: 'r1',
  match_results: [
    matchEntry({ registration_id: 'r2', place: 1, total_percentage: 100 }),
    matchEntry({ registration_id: 'r1', place: 2, total_percentage: 85 }),
    matchEntry({ registration_id: 'r3', place: 3, total_percentage: 60 }),
  ],
  stages: [
    {
      stage_id: 's1',
      stage_number: 1,
      max_points: 100,
      results: [
        stageEntry({ registration_id: 'r2', place: 1, total_points: 100, time: 5, hit_factor: 20, stage_percentage: 100 }),
        // acc 90/100=0.9, speed 5/8=0.625 → stage% 56.25
        stageEntry({ registration_id: 'r1', place: 2, total_points: 90, time: 8, hit_factor: 11.25, stage_percentage: 56.25, alpha_count: 8, charlie_count: 2 }),
      ],
    },
    {
      stage_id: 's2',
      stage_number: 2,
      max_points: 100,
      results: [
        stageEntry({ registration_id: 'r2', place: 1, total_points: 100, time: 5, hit_factor: 20, stage_percentage: 100 }),
        // acc 95/100=0.95, speed 5/7=0.7143 → stage% 67.857
        stageEntry({ registration_id: 'r1', place: 2, total_points: 95, time: 7, hit_factor: 13.5714, stage_percentage: 67.857, alpha_count: 9, charlie_count: 1 }),
      ],
    },
  ],
});

describe('computeShooterPerformance', () => {
  it('decomposes each stage into accuracy × speed = stage%', () => {
    const p = computeShooterPerformance([bundle()]);
    const s1 = p.matches[0].stages[0];
    expect(s1.accuracy_factor).toBe(0.9);
    expect(s1.speed_factor).toBe(0.625);
    // identity: accuracy_factor × speed_factor ≈ stage_percentage / 100
    expect(s1.accuracy_factor! * s1.speed_factor!).toBeCloseTo(
      s1.stage_percentage / 100,
      3
    );
    expect(s1.alpha_pct).toBe(80); // 8 / (8+2)
    expect(s1.points_down).toBe(10);
    expect(s1.points_down_pct).toBe(10);
  });

  it('computes placement + percentile from the division field', () => {
    const p = computeShooterPerformance([bundle()]);
    const m = p.matches[0];
    expect(m.place).toBe(2);
    expect(m.field_size).toBe(3);
    expect(m.percentile).toBe(50); // beat 1 of the 2 others
    expect(m.total_percentage).toBe(85);
  });

  it('reports consistency (std-dev of stage %s) and stage wins', () => {
    const p = computeShooterPerformance([bundle()]);
    const m = p.matches[0];
    expect(m.consistency).toBeGreaterThan(0); // stages 56.25 vs 67.86 → ~5.8
    expect(m.consistency).toBeLessThan(10);
    expect(m.stage_wins).toBe(0);
  });

  it('flags the weaker lever as the focus (speed here)', () => {
    const p = computeShooterPerformance([bundle()]);
    // avg acc ≈ 0.925, avg speed ≈ 0.67 → speed is the opportunity
    expect(p.focus).toBe('speed');
    expect(p.totals.alpha_pct).toBe(85); // (8+9)/(10+10)
    expect(p.totals.best_finish).toBe(2);
    expect(p.totals.matches).toBe(1);
    expect(p.totals.stages).toBe(2);
    expect(p.personal_best.match_pct).toBe(85);
  });

  it('excludes DQ/DNF/zero-time stages from accuracy & speed', () => {
    const b = bundle();
    b.stages[0].results[1].dqed = true;
    const p = computeShooterPerformance([b]);
    // only stage 2 counts toward the factor averages now
    expect(p.matches[0].stages[0].accuracy_factor).toBeNull();
    expect(p.matches[0].accuracy_factor).toBe(0.95);
  });
});
