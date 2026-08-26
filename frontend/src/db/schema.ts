import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// All tables use 'id' as text primary key (PowerSync requirement)

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  display_name: text('display_name').notNull(),
  member_number: text('member_number'),
  roles: text('roles').notNull(), // JSON array stored as text
  default_division: text('default_division'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const user_divisions = sqliteTable('user_divisions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  division: text('division').notNull(),
  classification: text('classification').notNull(),
});

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  start_date: text('start_date').notNull(),
  end_date: text('end_date'),
  location: text('location').notNull(),
  description: text('description'),
  level: text('level').notNull(),
  organization: text('organization').notNull(),
  status: text('status').notNull(),
  created_by: text('created_by').notNull(),
  max_shooters: integer('max_shooters'),
  registration_open: integer('registration_open', { mode: 'boolean' }).notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const stages = sqliteTable('stages', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  stage_number: integer('stage_number').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  scoring_type: text('scoring_type').notNull(),
  min_rounds: integer('min_rounds').notNull(),
  max_points: integer('max_points').notNull(),
  number_of_targets: integer('number_of_targets').notNull(),
  number_of_steel: integer('number_of_steel').notNull(),
  number_of_no_shoots: integer('number_of_no_shoots').notNull(),
  paper_target_rounds: text('paper_target_rounds'), // JSON array
  fixed_time: real('fixed_time'),
  is_classifier: integer('is_classifier', { mode: 'boolean' }).notNull(),
  classifier_number: text('classifier_number'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const squads = sqliteTable('squads', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  squad_number: integer('squad_number').notNull(),
  name: text('name'),
  max_size: integer('max_size').notNull(),
});

export const registrations = sqliteTable('registrations', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  user_id: text('user_id').notNull(),
  shooter_name: text('shooter_name').notNull(),
  member_number: text('member_number'),
  division: text('division').notNull(),
  power_factor: text('power_factor').notNull(),
  classification: text('classification'),
  squad_id: text('squad_id'),
  registered_at: text('registered_at').notNull(),
});

export const scores = sqliteTable('scores', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  stage_id: text('stage_id').notNull(),
  registration_id: text('registration_id').notNull(),
  shooter_name: text('shooter_name').notNull(),
  division: text('division').notNull(),
  power_factor: text('power_factor').notNull(),
  alpha_count: integer('alpha_count').notNull(),
  charlie_count: integer('charlie_count').notNull(),
  delta_count: integer('delta_count').notNull(),
  miss_count: integer('miss_count').notNull(),
  no_shoot_count: integer('no_shoot_count').notNull(),
  procedural_count: integer('procedural_count').notNull(),
  steel_hits: integer('steel_hits').notNull(),
  steel_misses: integer('steel_misses').notNull(),
  time: real('time').notNull(),
  raw_points: integer('raw_points').notNull(),
  penalty_points: integer('penalty_points').notNull(),
  total_points: integer('total_points').notNull(),
  hit_factor: real('hit_factor').notNull(),
  scored_by: text('scored_by').notNull(),
  scored_at: text('scored_at').notNull(),
  verified: integer('verified', { mode: 'boolean' }).notNull(),
  verified_by: text('verified_by'),
  dqed: integer('dqed', { mode: 'boolean' }).notNull(),
  dnf: integer('dnf', { mode: 'boolean' }).notNull(),
  modified_at: text('modified_at'),
  modified_by: text('modified_by'),
  target_hits: text('target_hits'), // JSON: { paper: string[][], steel: boolean[] }
  locked: integer('locked', { mode: 'boolean' }),
});

export const stage_results = sqliteTable('stage_results', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  stage_id: text('stage_id').notNull(),
  division: text('division').notNull(),
  stage_winner_hit_factor: real('stage_winner_hit_factor').notNull(),
  results: text('results').notNull(), // JSON stored as text
  computed_at: text('computed_at').notNull(),
});

export const match_results = sqliteTable('match_results', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  division: text('division').notNull(),
  results: text('results').notNull(), // JSON stored as text
  computed_at: text('computed_at').notNull(),
});

export const match_admins = sqliteTable('match_admins', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  user_id: text('user_id').notNull(),
});

export const match_officers = sqliteTable('match_officers', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  user_id: text('user_id').notNull(),
});

export const stage_officers = sqliteTable('stage_officers', {
  id: text('id').primaryKey(),
  match_id: text('match_id').notNull(),
  stage_id: text('stage_id').notNull(),
  user_id: text('user_id').notNull(),
});
