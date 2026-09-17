import {
  HIT_FACTOR_DECIMALS,
  MISS_PENALTY,
  NO_SHOOT_PENALTY,
  PROCEDURAL_PENALTY,
  STAGE_PERCENTAGE_DECIMALS,
  STEEL_HIT_POINTS,
  ZONE_POINTS,
} from './constants.js';
import type { PowerFactor, ScoringType } from './constants.js';
import type {
  MatchResultEntry,
  ScoreInput,
  StageResultEntry,
} from './types.js';

// ─── Raw Point Calculation ───────────────────────

/**
 * Resolve a power factor to a valid ZONE_POINTS key, tolerating case and legacy
 * values (e.g. a lowercase "minor" from older data). Anything unrecognized
 * scores as Minor rather than crashing on an undefined zone map.
 */
function normalizePowerFactor(powerFactor: PowerFactor | string): PowerFactor {
  return String(powerFactor).toLowerCase() === 'major' ? 'Major' : 'Minor';
}

export function calculateRawPoints(
  input: Pick<
    ScoreInput,
    'alpha_count' | 'charlie_count' | 'delta_count' | 'steel_hits'
  >,
  powerFactor: PowerFactor
): number {
  const pts = ZONE_POINTS[normalizePowerFactor(powerFactor)];
  return (
    input.alpha_count * pts.A +
    input.charlie_count * pts.C +
    input.delta_count * pts.D +
    input.steel_hits * STEEL_HIT_POINTS
  );
}

// ─── Penalty Calculation ─────────────────────────

export function calculatePenalties(
  input: Pick<
    ScoreInput,
    'miss_count' | 'no_shoot_count' | 'procedural_count' | 'steel_misses'
  >
): number {
  const total =
    input.miss_count * MISS_PENALTY +
    input.no_shoot_count * NO_SHOOT_PENALTY +
    input.procedural_count * PROCEDURAL_PENALTY +
    input.steel_misses * MISS_PENALTY;
  return total || 0; // normalize -0 to 0
}

// ─── Total Points ────────────────────────────────

export function calculateTotalPoints(
  input: ScoreInput
): { rawPoints: number; penaltyPoints: number; totalPoints: number } {
  const rawPoints = calculateRawPoints(input, input.power_factor);
  const penaltyPoints = calculatePenalties(input);
  const totalPoints = rawPoints + penaltyPoints;
  return { rawPoints, penaltyPoints, totalPoints };
}

// ─── Hit Factor ──────────────────────────────────

export function calculateHitFactor(
  input: ScoreInput,
  scoringType: ScoringType
): number {
  if (input.dqed || input.dnf) return 0;

  const { totalPoints } = calculateTotalPoints(input);

  if (scoringType === 'fixed_time') {
    return Math.max(0, totalPoints);
  }

  // Comstock or Virginia Count
  if (input.time <= 0) return 0;
  const hf = totalPoints / input.time;
  return parseFloat(Math.max(0, hf).toFixed(HIT_FACTOR_DECIMALS));
}

// ─── Full Score Computation ──────────────────────

export interface ComputedScore {
  raw_points: number;
  penalty_points: number;
  total_points: number;
  hit_factor: number;
}

export function computeScore(
  input: ScoreInput,
  scoringType: ScoringType
): ComputedScore {
  const { rawPoints, penaltyPoints, totalPoints } =
    calculateTotalPoints(input);
  const hitFactor = calculateHitFactor(input, scoringType);

  return {
    raw_points: rawPoints,
    penalty_points: penaltyPoints,
    total_points: totalPoints,
    hit_factor: hitFactor,
  };
}

// ─── Stage Percentage ────────────────────────────

export function calculateStagePercentage(
  shooterHF: number,
  stageWinnerHF: number
): number {
  if (stageWinnerHF <= 0) return 0;
  if (shooterHF <= 0) return 0;
  const pct = (shooterHF / stageWinnerHF) * 100;
  return parseFloat(pct.toFixed(STAGE_PERCENTAGE_DECIMALS));
}

// ─── Stage Results Computation ───────────────────

export interface StageScoreData {
  registration_id: string;
  shooter_name: string;
  division: string;
  classification: string | null;
  power_factor: PowerFactor;
  alpha_count: number;
  charlie_count: number;
  delta_count: number;
  miss_count: number;
  no_shoot_count: number;
  procedural_count: number;
  steel_hits: number;
  steel_misses: number;
  time: number;
  dqed: boolean;
  dnf: boolean;
}

export function computeStageResults(
  scores: StageScoreData[],
  scoringType: ScoringType,
  division: string,
  maxStagePoints: number,
  combined = false
): { stageWinnerHF: number; results: StageResultEntry[] } {
  // Combined = one pool across all divisions (winner is the single overall best
  // HF); otherwise filter to the division. Entries keep their real division.
  const divisionScores = combined
    ? scores
    : scores.filter((s) => s.division === division);

  // Compute HF for each
  const computed = divisionScores.map((s) => {
    const input: ScoreInput = {
      alpha_count: s.alpha_count,
      charlie_count: s.charlie_count,
      delta_count: s.delta_count,
      miss_count: s.miss_count,
      no_shoot_count: s.no_shoot_count,
      procedural_count: s.procedural_count,
      steel_hits: s.steel_hits,
      steel_misses: s.steel_misses,
      time: s.time,
      power_factor: s.power_factor,
      dqed: s.dqed,
      dnf: s.dnf,
    };
    const score = computeScore(input, scoringType);
    return { ...s, ...score };
  });

  // Find stage winner HF (highest among non-DQ/DNF)
  const stageWinnerHF = computed.reduce((max, s) => {
    if (s.dqed || s.dnf) return max;
    return Math.max(max, s.hit_factor);
  }, 0);

  // Compute stage percentage and sort
  const results: StageResultEntry[] = computed
    .map((s) => ({
      registration_id: s.registration_id,
      shooter_name: s.shooter_name,
      division: s.division as StageResultEntry['division'],
      classification:
        s.classification as StageResultEntry['classification'],
      power_factor: s.power_factor,
      alpha_count: s.alpha_count,
      charlie_count: s.charlie_count,
      delta_count: s.delta_count,
      miss_count: s.miss_count,
      no_shoot_count: s.no_shoot_count,
      procedural_count: s.procedural_count,
      steel_hits: s.steel_hits,
      steel_misses: s.steel_misses,
      time: s.time,
      raw_points: s.raw_points,
      penalty_points: s.penalty_points,
      total_points: s.total_points,
      hit_factor: s.hit_factor,
      stage_percentage: s.dqed || s.dnf
        ? 0
        : calculateStagePercentage(s.hit_factor, stageWinnerHF),
      // Points = stage% of the stage's max points; the winner (100%) earns it all.
      stage_points:
        s.dqed || s.dnf
          ? 0
          : parseFloat(
              (
                (calculateStagePercentage(s.hit_factor, stageWinnerHF) / 100) *
                maxStagePoints
              ).toFixed(4)
            ),
      place: 0, // Assigned below
      dqed: s.dqed,
      dnf: s.dnf,
      combined,
    }))
    .sort((a, b) => {
      // DQ/DNF go last
      if (a.dqed !== b.dqed) return a.dqed ? 1 : -1;
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
      return b.stage_percentage - a.stage_percentage;
    });

  // Assign places
  results.forEach((r, i) => {
    r.place = i + 1;
  });

  return { stageWinnerHF, results };
}

// ─── Match Results Computation ───────────────────

export interface StageResultsForMatch {
  stage_id: string;
  division: string;
  results: StageResultEntry[];
}

export function computeMatchResults(
  stageResults: StageResultsForMatch[],
  division: string
): MatchResultEntry[] {
  // Collect all registration IDs for this division
  const registrationMap = new Map<
    string,
    {
      shooter_name: string;
      classification: string | null;
      power_factor: PowerFactor;
      // Keep the shooter's real division (for the Combined view it differs from
      // the `division` param, which is the pseudo-division 'combined').
      division: string;
      combined: boolean | undefined;
      stagePercentages: Map<string, number>;
      matchPoints: number;
      dqed: boolean;
    }
  >();

  for (const sr of stageResults) {
    if (sr.division !== division) continue;
    for (const entry of sr.results) {
      let reg = registrationMap.get(entry.registration_id);
      if (!reg) {
        reg = {
          shooter_name: entry.shooter_name,
          classification: entry.classification,
          power_factor: entry.power_factor,
          division: entry.division,
          combined: entry.combined,
          stagePercentages: new Map(),
          matchPoints: 0,
          dqed: false,
        };
        registrationMap.set(entry.registration_id, reg);
      }
      reg.stagePercentages.set(sr.stage_id, entry.stage_percentage);
      // Match points = sum of stage points (each weighted by its stage's size).
      reg.matchPoints += entry.stage_points;
      // DQ in any stage = DQ for match (0 for remaining stages)
      if (entry.dqed) reg.dqed = true;
    }
  }

  // The match winner (most total stage points) anchors 100%.
  let winnerPoints = 0;
  for (const reg of registrationMap.values()) {
    if (!reg.dqed) winnerPoints = Math.max(winnerPoints, reg.matchPoints);
  }

  const entries: MatchResultEntry[] = [];

  for (const [regId, reg] of registrationMap) {
    const stagePercentages: Record<string, number> = {};
    for (const [stageId, pct] of reg.stagePercentages) {
      stagePercentages[stageId] = reg.dqed ? 0 : pct;
    }
    const matchPoints = reg.dqed ? 0 : reg.matchPoints;
    const totalPercentage =
      winnerPoints > 0 && !reg.dqed ? (matchPoints / winnerPoints) * 100 : 0;

    entries.push({
      registration_id: regId,
      shooter_name: reg.shooter_name,
      division: reg.division as MatchResultEntry['division'],
      classification:
        reg.classification as MatchResultEntry['classification'],
      power_factor: reg.power_factor,
      stage_percentages: stagePercentages,
      match_points: parseFloat(matchPoints.toFixed(STAGE_PERCENTAGE_DECIMALS)),
      total_percentage: parseFloat(
        totalPercentage.toFixed(STAGE_PERCENTAGE_DECIMALS)
      ),
      place: 0,
      dqed: reg.dqed,
      combined: reg.combined,
    });
  }

  // Sort: DQ last, then by match points descending
  entries.sort((a, b) => {
    if (a.dqed !== b.dqed) return a.dqed ? 1 : -1;
    return b.match_points - a.match_points;
  });

  entries.forEach((e, i) => {
    e.place = i + 1;
  });

  return entries;
}
