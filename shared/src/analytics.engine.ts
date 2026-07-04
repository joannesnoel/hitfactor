// Shooter performance analytics. Pure functions over already-computed results
// (StageResultEntry / MatchResultEntry) — no DB access, so it's unit-testable and
// shared. The backend assembles MatchPerfBundle[] from persisted stage_results /
// match_results and hands them here.

import type { StageResultEntry, MatchResultEntry } from './types.js';

// ─── Inputs (assembled by the backend from the DB) ──────────────────────────

export interface StagePerfBundle {
  stage_id: string;
  stage_number: number;
  max_points: number; // stage's max attainable points (rounds × 5)
  results: StageResultEntry[]; // the division's full field for this stage
}

export interface MatchPerfBundle {
  match_id: string;
  match_name: string;
  match_date: string; // YYYY-MM-DD
  organization: string;
  division: string;
  registration_id: string; // the shooter's registration in this match+division
  match_results: MatchResultEntry[]; // the division's full field
  stages: StagePerfBundle[];
}

// ─── Outputs ────────────────────────────────────────────────────────────────

export interface StagePerf {
  stage_id: string;
  stage_number: number;
  stage_percentage: number;
  hit_factor: number;
  accuracy_factor: number | null; // your points ÷ winner's points
  speed_factor: number | null; // winner's time ÷ your time
  alpha_pct: number | null;
  points_down: number;
  points_down_pct: number;
  place: number;
  dqed: boolean;
  dnf: boolean;
}

export interface MatchPerf {
  match_id: string;
  match_name: string;
  match_date: string;
  organization: string;
  division: string;
  place: number;
  field_size: number;
  percentile: number; // % of the field you beat (0–100)
  total_percentage: number; // match %
  match_points: number;
  dqed: boolean;
  alpha_pct: number | null;
  avg_hit_factor: number;
  accuracy_factor: number | null; // mean over stages
  speed_factor: number | null;
  consistency: number | null; // std-dev of your stage %s (lower = steadier)
  stage_wins: number;
  stages: StagePerf[];
}

export interface ShooterPerformance {
  totals: {
    matches: number;
    stages: number;
    best_finish: number | null;
    avg_finish: number | null;
    avg_percentile: number | null;
    avg_match_pct: number | null;
    alpha_pct: number | null;
    avg_accuracy_factor: number | null;
    avg_speed_factor: number | null;
    stage_wins: number;
  };
  focus: 'accuracy' | 'speed' | 'balanced' | null; // your weaker lever
  personal_best: {
    match_pct: number | null;
    finish: number | null;
    hit_factor: number | null;
  };
  trend: {
    match_id: string;
    match_name: string;
    date: string;
    match_pct: number;
    avg_hf: number;
    alpha_pct: number | null;
    place: number;
    percentile: number;
  }[];
  matches: MatchPerf[]; // most-recent first
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const stddev = (xs: number[]): number | null => {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
};
const alphaPct = (e: StageResultEntry): number | null => {
  const hits = e.alpha_count + e.charlie_count + e.delta_count + e.miss_count;
  return hits > 0 ? (e.alpha_count / hits) * 100 : null;
};

// ─── Per-match analysis ──────────────────────────────────────────────────────

function analyzeMatch(b: MatchPerfBundle): MatchPerf | null {
  const field = b.match_results.filter((r) => !r.combined);
  const me = field.find((r) => r.registration_id === b.registration_id);
  if (!me) return null;

  const fieldSize = field.length;
  const percentile =
    fieldSize > 1 ? ((fieldSize - me.place) / (fieldSize - 1)) * 100 : 100;

  const stages: StagePerf[] = [];
  let aSum = 0;
  let hitSum = 0; // A+C+D+M across stages, for a weighted career alpha%
  const hfs: number[] = [];
  const accFactors: number[] = [];
  const speedFactors: number[] = [];
  const stagePcts: number[] = [];
  let stageWins = 0;

  for (const s of b.stages) {
    const mine = s.results.find(
      (r) => r.registration_id === b.registration_id && !r.combined
    );
    if (!mine) continue;
    const winner = s.results.find((r) => r.place === 1 && !r.combined);
    const scored = !mine.dqed && !mine.dnf && mine.time > 0;

    const accuracy_factor =
      scored && winner && winner.total_points > 0
        ? mine.total_points / winner.total_points
        : null;
    const speed_factor =
      scored && winner && winner.time > 0 && mine.time > 0
        ? winner.time / mine.time
        : null;
    const ap = alphaPct(mine);
    const pointsDown = Math.max(0, s.max_points - mine.total_points);

    stages.push({
      stage_id: s.stage_id,
      stage_number: s.stage_number,
      stage_percentage: round(mine.stage_percentage),
      hit_factor: mine.hit_factor,
      accuracy_factor: accuracy_factor === null ? null : round(accuracy_factor, 4),
      speed_factor: speed_factor === null ? null : round(speed_factor, 4),
      alpha_pct: ap === null ? null : round(ap),
      points_down: pointsDown,
      points_down_pct: s.max_points > 0 ? round((pointsDown / s.max_points) * 100) : 0,
      place: mine.place,
      dqed: mine.dqed,
      dnf: mine.dnf,
    });

    if (scored) {
      aSum += mine.alpha_count;
      hitSum += mine.alpha_count + mine.charlie_count + mine.delta_count + mine.miss_count;
      hfs.push(mine.hit_factor);
      stagePcts.push(mine.stage_percentage);
      if (accuracy_factor !== null) accFactors.push(accuracy_factor);
      if (speed_factor !== null) speedFactors.push(speed_factor);
      if (mine.place === 1) stageWins++;
    }
  }

  const acc = mean(accFactors);
  const spd = mean(speedFactors);
  const cons = stddev(stagePcts);
  return {
    match_id: b.match_id,
    match_name: b.match_name,
    match_date: b.match_date,
    organization: b.organization,
    division: b.division,
    place: me.place,
    field_size: fieldSize,
    percentile: round(percentile),
    total_percentage: round(me.total_percentage),
    match_points: round(me.match_points),
    dqed: me.dqed,
    alpha_pct: hitSum > 0 ? round((aSum / hitSum) * 100) : null,
    avg_hit_factor: round(mean(hfs) ?? 0, 4),
    accuracy_factor: acc === null ? null : round(acc, 4),
    speed_factor: spd === null ? null : round(spd, 4),
    consistency: cons === null ? null : round(cons),
    stage_wins: stageWins,
    stages,
  };
}

// ─── Career roll-up ──────────────────────────────────────────────────────────

export function computeShooterPerformance(
  bundles: MatchPerfBundle[]
): ShooterPerformance {
  const matches = bundles
    .map(analyzeMatch)
    .filter((m): m is MatchPerf => m !== null)
    .sort((a, b) => (a.match_date < b.match_date ? 1 : -1)); // newest first

  const scored = matches.filter((m) => !m.dqed);
  const places = scored.map((m) => m.place);
  const percentiles = scored.map((m) => m.percentile);
  const matchPcts = scored.map((m) => m.total_percentage);
  const accs = scored.map((m) => m.accuracy_factor).filter((x): x is number => x !== null);
  const spds = scored.map((m) => m.speed_factor).filter((x): x is number => x !== null);

  // Career alpha% is hit-weighted across every stage.
  let aSum = 0;
  let hitSum = 0;
  let stageCount = 0;
  let stageWins = 0;
  let bestHf: number | null = null;
  for (const b of bundles) {
    for (const s of b.stages) {
      const mine = s.results.find(
        (r) => r.registration_id === b.registration_id && !r.combined
      );
      if (!mine || mine.dqed || mine.dnf || mine.time <= 0) continue;
      stageCount++;
      aSum += mine.alpha_count;
      hitSum += mine.alpha_count + mine.charlie_count + mine.delta_count + mine.miss_count;
      if (mine.place === 1) stageWins++;
      if (bestHf === null || mine.hit_factor > bestHf) bestHf = mine.hit_factor;
    }
  }

  const avgAcc = mean(accs);
  const avgSpd = mean(spds);
  let focus: ShooterPerformance['focus'] = null;
  if (avgAcc !== null && avgSpd !== null) {
    if (avgAcc < avgSpd - 0.02) focus = 'accuracy';
    else if (avgSpd < avgAcc - 0.02) focus = 'speed';
    else focus = 'balanced';
  }

  return {
    totals: {
      matches: matches.length,
      stages: stageCount,
      best_finish: places.length ? Math.min(...places) : null,
      avg_finish: places.length ? round(mean(places) ?? 0, 1) : null,
      avg_percentile: percentiles.length ? round(mean(percentiles) ?? 0) : null,
      avg_match_pct: matchPcts.length ? round(mean(matchPcts) ?? 0) : null,
      alpha_pct: hitSum > 0 ? round((aSum / hitSum) * 100) : null,
      avg_accuracy_factor: avgAcc === null ? null : round(avgAcc, 4),
      avg_speed_factor: avgSpd === null ? null : round(avgSpd, 4),
      stage_wins: stageWins,
    },
    focus,
    personal_best: {
      match_pct: matchPcts.length ? round(Math.max(...matchPcts)) : null,
      finish: places.length ? Math.min(...places) : null,
      hit_factor: bestHf,
    },
    trend: [...scored]
      .sort((a, b) => (a.match_date < b.match_date ? -1 : 1)) // oldest first for charts
      .map((m) => ({
        match_id: m.match_id,
        match_name: m.match_name,
        date: m.match_date,
        match_pct: m.total_percentage,
        avg_hf: m.avg_hit_factor,
        alpha_pct: m.alpha_pct,
        place: m.place,
        percentile: m.percentile,
      })),
    matches,
  };
}
