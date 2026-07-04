import type { Organization, ScoringType } from '@hitfactor/shared';

// ─── Normalized match-import contract ────────────────────────────────────────
// The CSV parser (or any source) produces a ParsedMatch; the import service
// consumes it. This decouples brittle source-format parsing from DB logic.

export interface ParsedStage {
  stage_number: number;
  name: string;
  scoring_type?: ScoringType; // default 'comstock'
  number_of_targets?: number;
  paper_target_rounds?: number[];
  number_of_steel?: number;
  number_of_no_shoots?: number;
}

export interface ParsedStageScore {
  stage_number: number;
  // App scoring zones — the parser maps the source's zones onto these
  // (e.g. PractiScore A/B/C/D → alpha=A, charlie=B+C, delta=D).
  alpha: number;
  charlie: number;
  delta: number;
  miss: number;
  no_shoot: number;
  procedural: number;
  steel_hits: number;
  steel_misses: number;
  // Seconds. null = not shot / no time recorded → unscored placeholder.
  time: number | null;
  dqed?: boolean;
  dnf?: boolean;
}

export interface ParsedEntry {
  name: string; // raw "LAST, FIRST" (may carry a second-entry suffix)
  member_number?: string | null;
  division: string; // PractiScore abbreviation, key, or full label (raw)
  power_factor: string; // 'Min'/'Maj' or 'Minor'/'Major'
  categories?: string[];
  classification?: string | null;
  scores: ParsedStageScore[];
}

export interface ParsedMatch {
  name: string;
  date: string; // YYYY-MM-DD
  location?: string;
  organization?: Organization; // default 'PSMOC'
  level?: string;
  source_match_id?: string; // PractiScore match UUID — stable identity for re-uploads
  stages: ParsedStage[];
  entries: ParsedEntry[];
}

export interface ImportSummary {
  match: string;
  matchCreated: boolean;
  stages: number;
  shootersCreated: number;
  shootersMatched: number;
  registrations: number;
  scores: number;
  scored: number; // scores that had a time (real HF) vs placeholders
  scoresRemoved?: number; // reconciled away (no longer in the .psc)
  registrationsRemoved?: number;
  warnings: string[];
  dryRun: boolean;
}
