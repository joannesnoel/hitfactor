import { describe, expect, it } from 'vitest';
import {
  calculateHitFactor,
  calculatePenalties,
  calculateRawPoints,
  calculateStagePercentage,
  computeMatchResults,
  computeScore,
  computeStageResults,
} from './scoring.engine.js';
import type { ScoreInput, StageScoreData } from './types.js';

describe('calculateRawPoints', () => {
  it('calculates Major power factor correctly', () => {
    expect(
      calculateRawPoints(
        { alpha_count: 8, charlie_count: 2, delta_count: 1, steel_hits: 2 },
        'Major'
      )
    ).toBe(8 * 5 + 2 * 4 + 1 * 2 + 2 * 5); // 40+8+2+10 = 60
  });

  it('calculates Minor power factor correctly', () => {
    expect(
      calculateRawPoints(
        { alpha_count: 8, charlie_count: 2, delta_count: 1, steel_hits: 2 },
        'Minor'
      )
    ).toBe(8 * 5 + 2 * 3 + 1 * 1 + 2 * 5); // 40+6+1+10 = 57
  });

  it('handles all zeros', () => {
    expect(
      calculateRawPoints(
        { alpha_count: 0, charlie_count: 0, delta_count: 0, steel_hits: 0 },
        'Major'
      )
    ).toBe(0);
  });

  it('handles all alphas', () => {
    expect(
      calculateRawPoints(
        { alpha_count: 12, charlie_count: 0, delta_count: 0, steel_hits: 0 },
        'Minor'
      )
    ).toBe(60);
  });
});

describe('calculatePenalties', () => {
  it('calculates penalties correctly', () => {
    expect(
      calculatePenalties({
        miss_count: 2,
        no_shoot_count: 1,
        procedural_count: 1,
        steel_misses: 1,
      })
    ).toBe(-50); // 2*-10 + 1*-10 + 1*-10 + 1*-10
  });

  it('returns 0 for no penalties', () => {
    expect(
      calculatePenalties({
        miss_count: 0,
        no_shoot_count: 0,
        procedural_count: 0,
        steel_misses: 0,
      })
    ).toBe(0);
  });
});

describe('calculateHitFactor', () => {
  const baseInput: ScoreInput = {
    alpha_count: 10,
    charlie_count: 2,
    delta_count: 0,
    miss_count: 0,
    no_shoot_count: 0,
    procedural_count: 0,
    steel_hits: 0,
    steel_misses: 0,
    time: 10,
    power_factor: 'Minor',
  };

  it('calculates Comstock HF correctly', () => {
    // 10*5 + 2*3 = 56 points, / 10s = 5.6 HF
    expect(calculateHitFactor(baseInput, 'comstock')).toBe(5.6);
  });

  it('calculates Virginia Count HF same as Comstock', () => {
    expect(calculateHitFactor(baseInput, 'virginia_count')).toBe(5.6);
  });

  it('calculates Fixed Time (no time division)', () => {
    expect(calculateHitFactor(baseInput, 'fixed_time')).toBe(56);
  });

  it('returns 0 for DQ', () => {
    expect(
      calculateHitFactor({ ...baseInput, dqed: true }, 'comstock')
    ).toBe(0);
  });

  it('returns 0 for DNF', () => {
    expect(
      calculateHitFactor({ ...baseInput, dnf: true }, 'comstock')
    ).toBe(0);
  });

  it('returns 0 for zero time', () => {
    expect(
      calculateHitFactor({ ...baseInput, time: 0 }, 'comstock')
    ).toBe(0);
  });

  it('returns 0 for negative total points (clamped)', () => {
    const input: ScoreInput = {
      alpha_count: 0,
      charlie_count: 0,
      delta_count: 0,
      miss_count: 10,
      no_shoot_count: 0,
      procedural_count: 0,
      steel_hits: 0,
      steel_misses: 0,
      time: 5,
      power_factor: 'Minor',
    };
    expect(calculateHitFactor(input, 'comstock')).toBe(0);
  });

  it('handles penalties reducing HF', () => {
    const input: ScoreInput = {
      alpha_count: 10,
      charlie_count: 0,
      delta_count: 0,
      miss_count: 2,
      no_shoot_count: 1,
      procedural_count: 0,
      steel_hits: 0,
      steel_misses: 0,
      time: 10,
      power_factor: 'Major',
    };
    // 50 - 30 = 20 / 10 = 2.0
    expect(calculateHitFactor(input, 'comstock')).toBe(2.0);
  });

  it('rounds to 4 decimal places', () => {
    const input: ScoreInput = {
      alpha_count: 7,
      charlie_count: 3,
      delta_count: 2,
      miss_count: 0,
      no_shoot_count: 0,
      procedural_count: 0,
      steel_hits: 0,
      steel_misses: 0,
      time: 7.33,
      power_factor: 'Minor',
    };
    // 35 + 9 + 2 = 46 / 7.33 = 6.27558...
    expect(calculateHitFactor(input, 'comstock')).toBe(6.2756);
  });
});

describe('computeScore', () => {
  it('returns full computed score object', () => {
    const input: ScoreInput = {
      alpha_count: 8,
      charlie_count: 2,
      delta_count: 1,
      miss_count: 1,
      no_shoot_count: 0,
      procedural_count: 0,
      steel_hits: 2,
      steel_misses: 0,
      time: 12.5,
      power_factor: 'Major',
    };
    const result = computeScore(input, 'comstock');
    // Raw: 40+8+2+10 = 60, Penalty: -10, Total: 50
    expect(result.raw_points).toBe(60);
    expect(result.penalty_points).toBe(-10);
    expect(result.total_points).toBe(50);
    expect(result.hit_factor).toBe(4.0); // 50/12.5
  });
});

describe('calculateStagePercentage', () => {
  it('calculates stage % correctly', () => {
    expect(calculateStagePercentage(5.0, 10.0)).toBe(50.0);
  });

  it('stage winner gets 100%', () => {
    expect(calculateStagePercentage(10.0, 10.0)).toBe(100.0);
  });

  it('returns 0 for zero winner HF', () => {
    expect(calculateStagePercentage(5.0, 0)).toBe(0);
  });

  it('returns 0 for zero shooter HF', () => {
    expect(calculateStagePercentage(0, 10.0)).toBe(0);
  });
});

describe('computeStageResults', () => {
  const makeScore = (
    overrides: Partial<StageScoreData> & { registration_id: string }
  ): StageScoreData => ({
    shooter_name: 'Shooter',
    division: 'Open',
    classification: 'A',
    power_factor: 'Major' as const,
    alpha_count: 10,
    charlie_count: 0,
    delta_count: 0,
    miss_count: 0,
    no_shoot_count: 0,
    procedural_count: 0,
    steel_hits: 0,
    steel_misses: 0,
    time: 10,
    dqed: false,
    dnf: false,
    ...overrides,
  });

  it('ranks shooters by HF descending', () => {
    const scores = [
      makeScore({ registration_id: 'r1', shooter_name: 'Fast', time: 5 }),
      makeScore({ registration_id: 'r2', shooter_name: 'Medium', time: 10 }),
      makeScore({ registration_id: 'r3', shooter_name: 'Slow', time: 20 }),
    ];
    const { results, stageWinnerHF } = computeStageResults(
      scores,
      'comstock',
      'Open'
    );
    expect(stageWinnerHF).toBe(10.0); // 50/5
    expect(results[0].shooter_name).toBe('Fast');
    expect(results[0].stage_percentage).toBe(100.0);
    expect(results[0].place).toBe(1);
    expect(results[1].shooter_name).toBe('Medium');
    expect(results[1].stage_percentage).toBe(50.0);
    expect(results[1].place).toBe(2);
    expect(results[2].stage_percentage).toBe(25.0);
    expect(results[2].place).toBe(3);
  });

  it('puts DQ shooters last with 0%', () => {
    const scores = [
      makeScore({ registration_id: 'r1', shooter_name: 'Normal', time: 10 }),
      makeScore({
        registration_id: 'r2',
        shooter_name: 'DQd',
        time: 5,
        dqed: true,
      }),
    ];
    const { results } = computeStageResults(scores, 'comstock', 'Open');
    expect(results[0].shooter_name).toBe('Normal');
    expect(results[0].stage_percentage).toBe(100.0);
    expect(results[1].shooter_name).toBe('DQd');
    expect(results[1].stage_percentage).toBe(0);
    expect(results[1].place).toBe(2);
  });

  it('filters by division', () => {
    const scores = [
      makeScore({
        registration_id: 'r1',
        division: 'Open',
        time: 10,
      }),
      makeScore({
        registration_id: 'r2',
        division: 'Production',
        time: 10,
      }),
    ];
    const { results } = computeStageResults(scores, 'comstock', 'Open');
    expect(results).toHaveLength(1);
  });
});

describe('computeMatchResults', () => {
  it('sums stage percentages and ranks', () => {
    const stageResults = [
      {
        stage_id: 's1',
        division: 'Open',
        results: [
          {
            registration_id: 'r1',
            shooter_name: 'A',
            division: 'Open' as const,
            classification: 'A' as const,
            alpha_count: 0, charlie_count: 0, delta_count: 0,
            miss_count: 0, no_shoot_count: 0, procedural_count: 0,
            steel_hits: 0, steel_misses: 0, time: 0,
            raw_points: 0, penalty_points: 0, total_points: 0,
            hit_factor: 10, stage_percentage: 100, place: 1,
            dqed: false, dnf: false,
          },
          {
            registration_id: 'r2',
            shooter_name: 'B',
            division: 'Open' as const,
            classification: 'B' as const,
            alpha_count: 0, charlie_count: 0, delta_count: 0,
            miss_count: 0, no_shoot_count: 0, procedural_count: 0,
            steel_hits: 0, steel_misses: 0, time: 0,
            raw_points: 0, penalty_points: 0, total_points: 0,
            hit_factor: 5, stage_percentage: 50, place: 2,
            dqed: false, dnf: false,
          },
        ],
      },
      {
        stage_id: 's2',
        division: 'Open',
        results: [
          {
            registration_id: 'r1',
            shooter_name: 'A',
            division: 'Open' as const,
            classification: 'A' as const,
            alpha_count: 0, charlie_count: 0, delta_count: 0,
            miss_count: 0, no_shoot_count: 0, procedural_count: 0,
            steel_hits: 0, steel_misses: 0, time: 0,
            raw_points: 0, penalty_points: 0, total_points: 0,
            hit_factor: 8, stage_percentage: 80, place: 1,
            dqed: false, dnf: false,
          },
          {
            registration_id: 'r2',
            shooter_name: 'B',
            division: 'Open' as const,
            classification: 'B' as const,
            alpha_count: 0, charlie_count: 0, delta_count: 0,
            miss_count: 0, no_shoot_count: 0, procedural_count: 0,
            steel_hits: 0, steel_misses: 0, time: 0,
            raw_points: 0, penalty_points: 0, total_points: 0,
            hit_factor: 10, stage_percentage: 100, place: 1,
            dqed: false, dnf: false,
          },
        ],
      },
    ];

    const results = computeMatchResults(stageResults, 'Open');
    expect(results).toHaveLength(2);
    // A: 100+80=180, B: 50+100=150
    expect(results[0].shooter_name).toBe('A');
    expect(results[0].total_percentage).toBe(180);
    expect(results[0].place).toBe(1);
    expect(results[1].shooter_name).toBe('B');
    expect(results[1].total_percentage).toBe(150);
    expect(results[1].place).toBe(2);
  });

  it('DQ sets all stage percentages to 0', () => {
    const stageResults = [
      {
        stage_id: 's1',
        division: 'Open',
        results: [
          {
            registration_id: 'r1',
            shooter_name: 'DQd',
            division: 'Open' as const,
            classification: 'A' as const,
            alpha_count: 0, charlie_count: 0, delta_count: 0,
            miss_count: 0, no_shoot_count: 0, procedural_count: 0,
            steel_hits: 0, steel_misses: 0, time: 0,
            raw_points: 0, penalty_points: 0, total_points: 0,
            hit_factor: 10, stage_percentage: 100, place: 1,
            dqed: true, dnf: false,
          },
        ],
      },
    ];

    const results = computeMatchResults(stageResults, 'Open');
    expect(results[0].total_percentage).toBe(0);
    expect(results[0].dqed).toBe(true);
  });
});
