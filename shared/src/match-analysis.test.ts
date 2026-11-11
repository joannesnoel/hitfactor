import { describe, it, expect } from 'vitest';
import { buildProgression, buildMatchInsights } from './match-analysis.js';
import { computeShooterPerformance } from './analytics.engine.js';
import type { StagePerfBundle, MatchPerfBundle } from './analytics.engine.js';
import type { StageResultEntry, MatchResultEntry } from './types.js';

function entry(reg: string, name: string, pts: number, extra: Partial<StageResultEntry> = {}): StageResultEntry {
  return {
    registration_id: reg,
    shooter_name: name,
    division: 'production',
    classification: null,
    power_factor: 'Minor',
    alpha_count: 10,
    charlie_count: 0,
    delta_count: 0,
    miss_count: 0,
    no_shoot_count: 0,
    procedural_count: 0,
    steel_hits: 0,
    steel_misses: 0,
    time: 10,
    raw_points: pts,
    penalty_points: 0,
    total_points: pts,
    hit_factor: pts / 10,
    stage_percentage: 0,
    stage_points: pts,
    place: 0,
    dqed: false,
    dnf: false,
    ...extra,
  } as StageResultEntry;
}

// Three shooters, three stages. Me (A) leads after stage 1, then drops back.
function stage(id: string, n: number, pts: Record<string, number>): StagePerfBundle {
  const names: Record<string, string> = { A: 'Me', B: 'Bea', C: 'Cy' };
  const results = Object.entries(pts)
    .sort((a, b) => b[1] - a[1])
    .map(([reg, p], i) => entry(reg, names[reg], p, { place: i + 1, stage_percentage: (p / Math.max(...Object.values(pts))) * 100 }));
  return { stage_id: id, stage_number: n, max_points: 100, results };
}

const stages = [
  stage('s1', 1, { A: 100, B: 80, C: 60 }),
  stage('s2', 2, { A: 40, B: 100, C: 90 }),
  stage('s3', 3, { A: 90, B: 70, C: 100 }),
];

describe('buildProgression', () => {
  const p = buildProgression(stages, 'A');
  const me = p.shooters.find((s) => s.isMe)!;
  const bea = p.shooters.find((s) => s.registration_id === 'B')!;

  it('orders stages and accumulates points', () => {
    expect(p.stages.map((s) => s.stage_number)).toEqual([1, 2, 3]);
    expect(me.points).toEqual([100, 140, 230]);
    expect(bea.points).toEqual([80, 180, 250]);
  });

  it('tracks running place as it rises and falls', () => {
    // After stage 3 Bea and Cy tie on 250, both ahead of my 230.
    expect(me.place).toEqual([1, 3, 3]);
  });

  it('expresses running points as a % of the leader at each stage', () => {
    expect(me.pct[0]).toBe(100);
    expect(me.pct[1]).toBeCloseTo((140 / 180) * 100, 5); // leader after stage 2 is Bea on 180
  });

  it('finds the leader after the last stage', () => {
    expect(p.shooters[p.leaderIndex].registration_id).toBe('B');
  });

  it('only includes stages the shooter has a result for', () => {
    const partial = [stages[0], { ...stages[1], results: stages[1].results.filter((r) => r.registration_id !== 'A') }, stages[2]];
    expect(buildProgression(partial, 'A').stages.map((s) => s.stage_number)).toEqual([1, 3]);
  });

  it('counts a DQ as zero for that stage', () => {
    const dq = [stage('s1', 1, { A: 100, B: 80 })];
    dq[0].results[0] = { ...dq[0].results[0], dqed: true };
    expect(buildProgression(dq, 'A').shooters.find((s) => s.isMe)!.points).toEqual([0]);
  });

  it('is empty when the shooter has no results', () => {
    const p2 = buildProgression(stages, 'ZZ');
    expect(p2.stages).toEqual([]);
    expect(p2.leaderIndex).toBe(-1);
  });
});

function perfFor(stagesIn: StagePerfBundle[]) {
  const mr: MatchResultEntry[] = ['A', 'B', 'C'].map((r, i) => ({
    registration_id: r,
    shooter_name: r,
    division: 'production',
    classification: null,
    power_factor: 'Minor',
    stage_percentages: {},
    match_points: 0,
    total_percentage: 100 - i * 10,
    place: i + 1,
    dqed: false,
  })) as MatchResultEntry[];
  const bundle: MatchPerfBundle = {
    match_id: 'm',
    match_name: 'M',
    match_date: '2026-11-11',
    organization: 'PSMOC',
    division: 'production',
    registration_id: 'A',
    match_results: mr,
    stages: stagesIn,
  };
  return computeShooterPerformance([bundle]).matches[0];
}

describe('buildMatchInsights', () => {
  it('names a win as a strength and a clear low as a weakness', () => {
    const perf = perfFor(stages);
    const ins = buildMatchInsights(perf);
    expect(ins.strengths.map((s) => s.stage_number)).toContain(1);
    expect(ins.weaknesses.map((s) => s.stage_number)).toEqual([2]);
    expect(ins.weaknesses[0].kind).toBe('weakness');
  });

  it('blames accuracy when points were lost more than time', () => {
    // Stage 2: me 40 pts in the same 10s as the winner → points, not pace.
    const ins = buildMatchInsights(perfFor(stages));
    expect(ins.weaknesses[0].cause).toBe('accuracy');
  });

  it('blames speed when points are close but time is much slower', () => {
    const slow = [
      stage('s1', 1, { A: 100, B: 100, C: 90 }),
      stage('s2', 2, { A: 98, B: 100, C: 90 }),
    ];
    slow[1].results = slow[1].results.map((r) =>
      r.registration_id === 'A' ? { ...r, time: 20 } : r
    );
    slow[0].results = slow[0].results.map((r) =>
      r.registration_id === 'A' ? { ...r, place: 2, stage_percentage: 70 } : r
    );
    slow[1].results = slow[1].results.map((r) =>
      r.registration_id === 'A' ? { ...r, place: 2, stage_percentage: 40 } : r
    );
    const ins = buildMatchInsights(perfFor(slow));
    expect(ins.weaknesses.some((w) => w.cause === 'speed')).toBe(true);
  });

  it('treats a DQ/DNF stage as an unscored weakness', () => {
    const withDnf = [stages[0], stages[1]].map((s) => ({ ...s, results: s.results.map((r) => ({ ...r })) }));
    withDnf[1].results = withDnf[1].results.map((r) =>
      r.registration_id === 'A' ? { ...r, dnf: true, time: 0, total_points: 0, stage_percentage: 0 } : r
    );
    const ins = buildMatchInsights(perfFor(withDnf));
    expect(ins.weaknesses.find((w) => w.stage_number === 2)?.cause).toBe('unscored');
  });
});
