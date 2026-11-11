// Once a stage has scores, the fields that decide what a valid score looks like
// can no longer change: a score keeps the hits it was entered with, so changing
// the number of targets/steel/rounds would leave it inconsistent with its stage.

export const SCORE_LOCKED_STAGE_FIELDS = [
  'number_of_targets',
  'number_of_steel',
  'number_of_no_shoots',
  'paper_target_rounds',
  'scoring_type',
  'fixed_time',
] as const;
export type ScoreLockedStageField = (typeof SCORE_LOCKED_STAGE_FIELDS)[number];

export const STAGE_HAS_SCORES_MESSAGE =
  'This stage already has scores, so its targets, rounds and scoring type can no longer change. Create a new stage instead.';
export const STAGE_DELETE_HAS_SCORES_MESSAGE =
  'This stage already has scores and cannot be deleted.';

interface StageLike {
  number_of_targets?: number | null;
  number_of_steel?: number | null;
  number_of_no_shoots?: number | null;
  paper_target_rounds?: unknown;
  scoring_type?: string | null;
  fixed_time?: number | string | null;
}

// jsonb arrives as an array from Postgres but a JSON string from local SQLite;
// an unset value means the default of 2 rounds per paper target.
function roundsOf(stage: StageLike): number[] {
  let raw = stage.paper_target_rounds;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (Array.isArray(raw)) return raw.map(Number);
  return Array(Number(stage.number_of_targets ?? 0)).fill(2);
}

function sameFixedTime(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  return norm(a) === norm(b);
}

/**
 * The score-locked fields a patch would actually change on `existing`. Only
 * fields present in `patch` count, and a value equal to the current one is not a
 * change (the edit form sends every field).
 */
export function changedLockedStageFields(
  existing: StageLike,
  patch: StageLike
): ScoreLockedStageField[] {
  const changed: ScoreLockedStageField[] = [];
  const has = (k: keyof StageLike) => patch[k] !== undefined;

  if (has('number_of_targets') && Number(patch.number_of_targets) !== Number(existing.number_of_targets)) {
    changed.push('number_of_targets');
  }
  if (has('number_of_steel') && Number(patch.number_of_steel) !== Number(existing.number_of_steel)) {
    changed.push('number_of_steel');
  }
  if (has('number_of_no_shoots') && Number(patch.number_of_no_shoots) !== Number(existing.number_of_no_shoots)) {
    changed.push('number_of_no_shoots');
  }
  if (has('scoring_type') && patch.scoring_type !== existing.scoring_type) {
    changed.push('scoring_type');
  }
  if (has('fixed_time') && !sameFixedTime(patch.fixed_time, existing.fixed_time)) {
    changed.push('fixed_time');
  }
  if (has('paper_target_rounds')) {
    // Compare against the patch's own target count when it changes too.
    const next = roundsOf(patch);
    const cur = roundsOf(existing);
    if (next.length !== cur.length || next.some((n, i) => n !== cur[i])) {
      changed.push('paper_target_rounds');
    }
  }
  return changed;
}

/** The stored name for a stage created without one. */
export function defaultStageName(stageNumber: number): string {
  return `Stage ${stageNumber}`;
}
