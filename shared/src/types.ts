import type {
  Classification,
  Division,
  MatchLevel,
  MatchLevelOfficialRole,
  MatchStatus,
  Organization,
  PowerFactor,
  Role,
  ScoringType,
  StageLevelOfficialRole,
} from './constants.js';

// ─── User ────────────────────────────────────────
export interface User {
  id: string;
  // Null for unclaimed shooter accounts imported from match results.
  email: string | null;
  display_name: string;
  member_number: string | null;
  phone: string | null;
  claimed: boolean;
  roles: Role[];
  default_division: Division | null;
  divisions: UserDivision[];
  created_at: string;
  updated_at: string;
}

// ─── User Division (classification per division) ─
export interface UserDivision {
  id: string;
  user_id: string;
  division: Division;
  classification: Classification;
}

// ─── Match ───────────────────────────────────────
export interface Match {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  location: string;
  description: string | null;
  level: MatchLevel;
  organization: Organization;
  status: MatchStatus;
  created_by: string;
  max_shooters: number | null;
  registration_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShootingRange {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

// ─── Stage ───────────────────────────────────────
export interface Stage {
  id: string;
  match_id: string;
  stage_number: number;
  name: string;
  description: string | null;
  scoring_type: ScoringType;
  min_rounds: number;
  max_points: number;
  number_of_targets: number;
  number_of_steel: number;
  number_of_no_shoots: number;
  paper_target_rounds: number[] | null;
  fixed_time: number | null;
  is_classifier: boolean;
  classifier_number: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Squad ───────────────────────────────────────
export interface Squad {
  id: string;
  match_id: string;
  squad_number: number;
  name: string | null;
  max_size: number;
}

// ─── Registration ────────────────────────────────
export interface Registration {
  id: string;
  match_id: string;
  user_id: string;
  shooter_name: string;
  member_number: string | null;
  division: Division;
  power_factor: PowerFactor;
  classification: Classification | null;
  squad_id: string | null;
  registered_at: string;
}

// ─── Score ───────────────────────────────────────
export interface Score {
  id: string;
  match_id: string;
  stage_id: string;
  registration_id: string;
  shooter_name: string;
  division: Division;
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
  raw_points: number;
  penalty_points: number;
  total_points: number;
  hit_factor: number;
  scored_by: string;
  scored_at: string;
  verified: boolean;
  verified_by: string | null;
  dqed: boolean;
  dnf: boolean;
  modified_at: string | null;
  modified_by: string | null;
}

// ─── Score Input (what the officer enters) ───────
export interface ScoreInput {
  alpha_count: number;
  charlie_count: number;
  delta_count: number;
  miss_count: number;
  no_shoot_count: number;
  procedural_count: number;
  steel_hits: number;
  steel_misses: number;
  time: number;
  power_factor: PowerFactor;
  dqed?: boolean;
  dnf?: boolean;
}

// ─── Stage Result Entry (within JSONB) ───────────
export interface StageResultEntry {
  registration_id: string;
  shooter_name: string;
  division: Division;
  classification: Classification | null;
  alpha_count: number;
  charlie_count: number;
  delta_count: number;
  miss_count: number;
  no_shoot_count: number;
  procedural_count: number;
  steel_hits: number;
  steel_misses: number;
  time: number;
  raw_points: number;
  penalty_points: number;
  total_points: number;
  hit_factor: number;
  stage_percentage: number;
  place: number;
  dqed: boolean;
  dnf: boolean;
}

export interface StageResult {
  id: string;
  match_id: string;
  stage_id: string;
  division: Division;
  stage_winner_hit_factor: number;
  results: StageResultEntry[];
  computed_at: string;
}

// ─── Match Result Entry (within JSONB) ───────────
export interface MatchResultEntry {
  registration_id: string;
  shooter_name: string;
  division: Division;
  classification: Classification | null;
  stage_percentages: Record<string, number>; // stage_id → stage%
  total_percentage: number;
  place: number;
  dqed: boolean;
}

export interface MatchResult {
  id: string;
  match_id: string;
  division: Division;
  results: MatchResultEntry[];
  computed_at: string;
}

// ─── Junction Tables ─────────────────────────────
export interface MatchAdmin {
  id: string;
  match_id: string;
  user_id: string;
}

export interface MatchOfficer {
  id: string;
  match_id: string;
  user_id: string;
  role: MatchLevelOfficialRole;
}

export interface StageOfficer {
  id: string;
  match_id: string;
  stage_id: string;
  user_id: string;
  role: StageLevelOfficialRole;
}

// ─── Auth ────────────────────────────────────────
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  iss: string;
  aud: string;
}

// ─── PowerSync Upload ────────────────────────────
export interface PowerSyncWriteOp {
  op: 'PUT' | 'PATCH' | 'DELETE';
  type: string;
  id: string;
  data?: Record<string, unknown>;
}
