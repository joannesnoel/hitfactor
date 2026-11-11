// Per-match performance analysis for one shooter: how their match standing rose
// and fell stage by stage against the rest of the field, and which stages were
// strengths or weaknesses. Pure functions over already-computed results (the same
// inputs as analytics.engine), so it runs on the phone from synced data.

import type { StagePerfBundle, MatchPerf, StagePerf } from './analytics.engine.js';

// ─── Stage-by-stage progression ──────────────────────────────────────────────

export interface ProgressionShooter {
  registration_id: string;
  shooter_name: string;
  isMe: boolean;
  /** Running match points after each stage (stage points summed so far). */
  points: number[];
  /** Running points as a % of the leader's running points at that stage. */
  pct: number[];
  /** Running place after each stage (ties share the better place). */
  place: number[];
}

export interface Progression {
  stages: { stage_id: string; stage_number: number }[];
  shooters: ProgressionShooter[];
  /** Index into `shooters` of the leader after the last stage, or -1. */
  leaderIndex: number;
}

/**
 * Running standings after each stage. Only stages the shooter themselves has a
 * result for are included, so a match still in progress isn't judged on stages
 * they haven't shot yet. Anyone missing a stage counts 0 points for it.
 */
export function buildProgression(
  stages: StagePerfBundle[],
  registrationId: string
): Progression {
  const ordered = [...stages]
    .filter((s) =>
      s.results.some((r) => r.registration_id === registrationId && !r.combined)
    )
    .sort((a, b) => a.stage_number - b.stage_number);

  const people = new Map<string, string>(); // registration_id → name
  for (const s of ordered) {
    for (const r of s.results) {
      if (!r.combined) people.set(r.registration_id, r.shooter_name);
    }
  }

  const ids = [...people.keys()];
  const cum = new Map<string, number[]>(ids.map((id) => [id, []]));
  const running = new Map<string, number>(ids.map((id) => [id, 0]));

  for (const s of ordered) {
    const byReg = new Map(
      s.results.filter((r) => !r.combined).map((r) => [r.registration_id, r])
    );
    for (const id of ids) {
      const e = byReg.get(id);
      const earned = e && !e.dqed ? e.stage_points : 0;
      running.set(id, (running.get(id) ?? 0) + earned);
      cum.get(id)!.push(running.get(id)!);
    }
  }

  const n = ordered.length;
  const leaderAt = Array.from({ length: n }, (_, k) =>
    Math.max(0, ...ids.map((id) => cum.get(id)![k]))
  );

  const shooters: ProgressionShooter[] = ids.map((id) => {
    const points = cum.get(id)!;
    return {
      registration_id: id,
      shooter_name: people.get(id)!,
      isMe: id === registrationId,
      points,
      pct: points.map((p, k) => (leaderAt[k] > 0 ? (p / leaderAt[k]) * 100 : 0)),
      place: points.map(
        (p, k) => 1 + ids.filter((o) => cum.get(o)![k] > p).length
      ),
    };
  });

  let leaderIndex = -1;
  if (n > 0) {
    let best = -1;
    shooters.forEach((s, i) => {
      if (s.points[n - 1] > best) {
        best = s.points[n - 1];
        leaderIndex = i;
      }
    });
  }

  return {
    stages: ordered.map((s) => ({ stage_id: s.stage_id, stage_number: s.stage_number })),
    shooters,
    leaderIndex,
  };
}

// ─── Strengths and weaknesses ────────────────────────────────────────────────

export type WeaknessCause = 'accuracy' | 'speed' | 'both' | 'unscored';

export interface StageInsight {
  stage_id: string;
  stage_number: number;
  kind: 'strength' | 'weakness';
  cause?: WeaknessCause;
  stage_percentage: number;
  place: number;
  /** Your points ÷ the winner's points (null when unscored). */
  accuracy_factor: number | null;
  /** The winner's time ÷ your time (null when unscored). */
  speed_factor: number | null;
}

export interface MatchInsights {
  strengths: StageInsight[];
  weaknesses: StageInsight[];
  /** Which lever cost you more across the match, from average accuracy/speed. */
  focus: 'accuracy' | 'speed' | 'balanced' | null;
}

const MAX_PER_LIST = 2;
const STRONG_PCT = 90; // ≥ this % of the stage winner's points counts as strong
const WEAK_BELOW_AVG = 8; // this many points under your own average = weak spot
const CAUSE_MARGIN = 0.05; // accuracy vs speed gap needed to name one cause

function weaknessCause(s: StagePerf): WeaknessCause {
  if (s.dqed || s.dnf) return 'unscored';
  const acc = s.accuracy_factor;
  const spd = s.speed_factor;
  if (acc === null || spd === null) return 'both';
  if (acc < spd - CAUSE_MARGIN) return 'accuracy';
  if (spd < acc - CAUSE_MARGIN) return 'speed';
  return 'both';
}

export function buildMatchInsights(perf: MatchPerf): MatchInsights {
  const scored = perf.stages.filter((s) => !s.dqed && !s.dnf);
  const avg =
    scored.length > 0
      ? scored.reduce((a, s) => a + s.stage_percentage, 0) / scored.length
      : 0;

  const strengths = scored
    .filter((s) => s.place === 1 || s.stage_percentage >= STRONG_PCT)
    .sort((a, b) => b.stage_percentage - a.stage_percentage)
    .slice(0, MAX_PER_LIST)
    .map<StageInsight>((s) => ({
      stage_id: s.stage_id,
      stage_number: s.stage_number,
      kind: 'strength',
      stage_percentage: s.stage_percentage,
      place: s.place,
      accuracy_factor: s.accuracy_factor,
      speed_factor: s.speed_factor,
    }));

  const strongIds = new Set(strengths.map((s) => s.stage_id));
  const weaknesses = perf.stages
    .filter(
      (s) =>
        !strongIds.has(s.stage_id) &&
        (s.dqed || s.dnf || s.stage_percentage < avg - WEAK_BELOW_AVG)
    )
    .sort((a, b) => a.stage_percentage - b.stage_percentage)
    .slice(0, MAX_PER_LIST)
    .map<StageInsight>((s) => ({
      stage_id: s.stage_id,
      stage_number: s.stage_number,
      kind: 'weakness',
      cause: weaknessCause(s),
      stage_percentage: s.stage_percentage,
      place: s.place,
      accuracy_factor: s.accuracy_factor,
      speed_factor: s.speed_factor,
    }));

  let focus: MatchInsights['focus'] = null;
  const { accuracy_factor: acc, speed_factor: spd } = perf;
  if (acc !== null && spd !== null) {
    focus = acc < spd - CAUSE_MARGIN ? 'accuracy' : spd < acc - CAUSE_MARGIN ? 'speed' : 'balanced';
  }

  return { strengths, weaknesses, focus };
}
