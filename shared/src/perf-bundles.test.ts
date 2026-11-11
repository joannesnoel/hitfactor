import { describe, it, expect } from 'vitest';
import { assemblePerfBundles } from './perf-bundles.js';
import { computeShooterPerformance } from './analytics.engine.js';

const me = { registration_id: 'R1', shooter_name: 'Me', division: 'production', stage_points: 90, dqed: false, dnf: false, place: 1, stage_percentage: 100, total_points: 90, time: 10, alpha_count: 9, charlie_count: 0, delta_count: 0, miss_count: 0, hit_factor: 9 };
const mr = (place: number) => ({ registration_id: 'R1', shooter_name: 'Me', division: 'production', place, total_percentage: 100, match_points: 90, dqed: false, stage_percentages: {} });

const rows = {
  registrations: [
    { id: 'R1', match_id: 'm1', division: 'production' },
    { id: 'R2', match_id: 'm2', division: 'production' }, // no results yet
  ],
  matches: [
    { id: 'm1', name: 'Tuesday', start_date: '2026-11-04', organization: 'PSMOC' },
    { id: 'm2', name: 'Later', start_date: '2026-11-11', organization: 'PSMOC' },
  ],
  stages: [
    { id: 's2', match_id: 'm1', stage_number: 2, max_points: 100 },
    { id: 's1', match_id: 'm1', stage_number: 1, max_points: 100 },
  ],
  stageResults: [
    { match_id: 'm1', stage_id: 's1', division: 'production', results: JSON.stringify([me]) },
    { match_id: 'm1', stage_id: 's2', division: 'production', results: JSON.stringify([me]) },
    { match_id: 'm1', stage_id: 's1', division: 'combined', results: JSON.stringify([{ ...me, combined: true }]) },
  ],
  matchResults: [{ match_id: 'm1', division: 'production', results: JSON.stringify([mr(1)]) }],
};

describe('assemblePerfBundles', () => {
  const bundles = assemblePerfBundles(rows);

  it('skips a registration whose results are not computed yet', () => {
    expect(bundles.map((b) => b.match_id)).toEqual(['m1']);
  });

  it('parses JSON columns, orders stages, and keeps only the shooter division', () => {
    expect(bundles[0].stages.map((s) => s.stage_number)).toEqual([1, 2]);
    expect(bundles[0].stages[0].results).toHaveLength(1);
    expect(bundles[0].match_name).toBe('Tuesday');
  });

  it('feeds the analytics engine', () => {
    const perf = computeShooterPerformance(bundles);
    expect(perf.totals.matches).toBe(1);
    expect(perf.matches[0].place).toBe(1);
  });

  it('tolerates malformed JSON', () => {
    const bad = assemblePerfBundles({ ...rows, matchResults: [{ match_id: 'm1', division: 'production', results: '{nope' }] });
    expect(bad).toEqual([]);
  });
});
