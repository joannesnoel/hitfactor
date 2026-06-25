import { column, Schema, Table } from '@powersync/web';

const users = new Table({
  email: column.text,
  display_name: column.text,
  member_number: column.text,
  roles: column.text, // JSON array as text
  default_division: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const user_divisions = new Table({
  user_id: column.text,
  division: column.text,
  classification: column.text,
});

const matches = new Table({
  name: column.text,
  start_date: column.text,
  end_date: column.text,
  location: column.text,
  description: column.text,
  level: column.text,
  organization: column.text,
  status: column.text,
  created_by: column.text,
  max_shooters: column.integer,
  registration_open: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

const stages = new Table({
  match_id: column.text,
  stage_number: column.integer,
  name: column.text,
  description: column.text,
  scoring_type: column.text,
  min_rounds: column.integer,
  max_points: column.integer,
  number_of_targets: column.integer,
  number_of_steel: column.integer,
  number_of_no_shoots: column.integer,
  paper_target_rounds: column.text, // JSON array
  fixed_time: column.real,
  is_classifier: column.integer,
  classifier_number: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const squads = new Table({
  match_id: column.text,
  squad_number: column.integer,
  name: column.text,
  max_size: column.integer,
});

const registrations = new Table({
  match_id: column.text,
  user_id: column.text,
  shooter_name: column.text,
  member_number: column.text,
  division: column.text,
  power_factor: column.text,
  classification: column.text,
  squad_id: column.text,
  registered_at: column.text,
});

const scores = new Table({
  match_id: column.text,
  stage_id: column.text,
  registration_id: column.text,
  shooter_name: column.text,
  division: column.text,
  power_factor: column.text,
  alpha_count: column.integer,
  charlie_count: column.integer,
  delta_count: column.integer,
  miss_count: column.integer,
  no_shoot_count: column.integer,
  procedural_count: column.integer,
  steel_hits: column.integer,
  steel_misses: column.integer,
  time: column.real,
  raw_points: column.integer,
  penalty_points: column.integer,
  total_points: column.integer,
  hit_factor: column.real,
  scored_by: column.text,
  scored_at: column.text,
  verified: column.integer,
  verified_by: column.text,
  dqed: column.integer,
  dnf: column.integer,
  modified_at: column.text,
  modified_by: column.text,
});

const stage_results = new Table({
  match_id: column.text,
  stage_id: column.text,
  division: column.text,
  stage_winner_hit_factor: column.real,
  results: column.text, // JSON
  computed_at: column.text,
});

const match_results = new Table({
  match_id: column.text,
  division: column.text,
  results: column.text, // JSON
  computed_at: column.text,
});

const match_admins = new Table({
  match_id: column.text,
  user_id: column.text,
});

const match_officers = new Table({
  match_id: column.text,
  user_id: column.text,
});

const stage_officers = new Table({
  match_id: column.text,
  stage_id: column.text,
  user_id: column.text,
});

export const powerSyncSchema = new Schema({
  users,
  user_divisions,
  matches,
  stages,
  squads,
  registrations,
  scores,
  stage_results,
  match_results,
  match_admins,
  match_officers,
  stage_officers,
});
