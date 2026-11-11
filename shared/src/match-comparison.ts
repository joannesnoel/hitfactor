// Builds the analytics input for ONE shooter measured against a chosen field:
// their own division (the default), or any mix of the match's divisions. The
// stored results score each division against its own winner, so to compare across
// divisions the stage results are recomputed for the combined pool — every shooter
// scored against the single best hit factor in the pool, as in the Combined view.

import type { MatchPerfBundle } from './analytics.engine.js';
import type { ScoringType } from './constants.js';
import { computeMatchResults, computeStageResults } from './scoring.engine.js';
import type { StageScoreData } from './scoring.engine.js';
import type { StageResultEntry } from './types.js';

export interface ComparisonStage {
  stage_id: string;
  stage_number: number;
  max_points: number;
  scoring_type: string;
  /** The stored stage results, per division (the cross-division "combined" row excluded). */
  byDivision: Record<string, StageResultEntry[]>;
}

export interface ComparisonInput {
  match: { id: string; name: string; date: string; organization: string };
  shooter: { registration_id: string; division: string };
  stages: ComparisonStage[];
  /** Divisions whose shooters form the field. The shooter themself is always included. */
  compareDivisions: string[];
}

const POOL = 'pool';

function toScoreData(e: StageResultEntry): StageScoreData {
  return {
    registration_id: e.registration_id,
    shooter_name: e.shooter_name,
    division: e.division,
    classification: e.classification,
    power_factor: e.power_factor,
    alpha_count: e.alpha_count,
    charlie_count: e.charlie_count,
    delta_count: e.delta_count,
    miss_count: e.miss_count,
    no_shoot_count: e.no_shoot_count,
    procedural_count: e.procedural_count,
    steel_hits: e.steel_hits,
    steel_misses: e.steel_misses,
    time: e.time,
    dqed: e.dqed,
    dnf: e.dnf,
  };
}

export function buildComparisonBundle(input: ComparisonInput): MatchPerfBundle {
  const { shooter } = input;
  const divisions = new Set(input.compareDivisions);

  const stageResultsForMatch: { stage_id: string; division: string; results: StageResultEntry[] }[] = [];
  const stages: MatchPerfBundle['stages'] = [];

  for (const s of [...input.stages].sort((a, b) => a.stage_number - b.stage_number)) {
    // The pool: everyone in the chosen divisions, plus the shooter themself.
    const pool = new Map<string, StageScoreData>();
    for (const d of divisions) {
      for (const e of s.byDivision[d] ?? []) pool.set(e.registration_id, toScoreData(e));
    }
    if (!pool.has(shooter.registration_id)) {
      const mine = (s.byDivision[shooter.division] ?? []).find(
        (e) => e.registration_id === shooter.registration_id
      );
      if (mine) pool.set(mine.registration_id, toScoreData(mine));
    }
    // Nobody in the pool shot this stage (or the shooter hasn't yet): skip it.
    if (!pool.has(shooter.registration_id)) continue;

    const { results } = computeStageResults(
      [...pool.values()],
      s.scoring_type as ScoringType,
      POOL,
      s.max_points,
      true
    );
    // The engine marks pooled entries as "combined"; they are the real field here.
    const cleaned = results.map((r) => ({ ...r, combined: false }));
    stageResultsForMatch.push({ stage_id: s.stage_id, division: POOL, results: cleaned });
    stages.push({
      stage_id: s.stage_id,
      stage_number: s.stage_number,
      max_points: s.max_points,
      results: cleaned,
    });
  }

  const matchResults = computeMatchResults(stageResultsForMatch, POOL).map((r) => ({
    ...r,
    combined: false,
  }));

  return {
    match_id: input.match.id,
    match_name: input.match.name,
    match_date: input.match.date,
    organization: input.match.organization,
    division: shooter.division,
    registration_id: shooter.registration_id,
    match_results: matchResults,
    stages,
  };
}
