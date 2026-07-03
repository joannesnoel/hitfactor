import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';

// ─── Users ──────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable for unclaimed shooter accounts imported from match results — they
    // have no email/password until the shooter claims the account. UNIQUE still
    // holds (Postgres allows multiple NULLs).
    email: varchar('email', { length: 255 }).unique(),
    password_hash: text('password_hash'),
    display_name: varchar('display_name', { length: 100 }).notNull(),
    member_number: varchar('member_number', { length: 20 }),
    // Normalized "LAST, FIRST" identity key for cross-match shooter dedupe.
    normalized_name: varchar('normalized_name', { length: 120 }),
    phone: varchar('phone', { length: 30 }),
    claimed: boolean('claimed').notNull().default(false),
    claimed_at: timestamp('claimed_at'),
    roles: text('roles').array().notNull().$default(() => ['shooter']),
    default_division: varchar('default_division', { length: 50 }),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('users_normalized_name_idx').on(table.normalized_name)]
);

// ─── User Divisions (classification per division) ─

export const userDivisions = pgTable(
  'user_divisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    division: varchar('division', { length: 50 }).notNull(),
    classification: varchar('classification', { length: 5 }).notNull().default('U'),
  },
  (table) => [
    unique('user_divisions_user_division_unique').on(table.user_id, table.division),
  ]
);

// ─── Shooter Aliases (sticky merges) ─────────────
// Extra normalized "LAST, FIRST" keys that resolve to a shooter even though they
// aren't that user's own normalized_name — recorded when an admin merges two
// records (nickname / spelling / middle-name variants that normalization can't
// derive). Consulted by the importer after the exact normalized_name lookup, so
// a hand merge stays merged on future imports.
export const shooterAliases = pgTable('shooter_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  normalized_name: varchar('normalized_name', { length: 120 }).notNull().unique(),
  user_id: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ─── Matches ────────────────────────────────────

export const shootingRanges = pgTable('shooting_ranges', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date'),
  location: varchar('location', { length: 200 }).notNull(),
  description: text('description'),
  level: varchar('level', { length: 5 }).notNull(),
  organization: varchar('organization', { length: 10 })
    .notNull()
    .default('PSMOC'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  created_by: uuid('created_by')
    .references(() => users.id)
    .notNull(),
  max_shooters: integer('max_shooters'),
  registration_open: boolean('registration_open').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Stages ─────────────────────────────────────

export const stages = pgTable(
  'stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    stage_number: integer('stage_number').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    scoring_type: varchar('scoring_type', { length: 20 }).notNull(),
    min_rounds: integer('min_rounds').notNull(),
    max_points: integer('max_points').notNull(),
    number_of_targets: integer('number_of_targets').notNull().default(0),
    number_of_steel: integer('number_of_steel').notNull().default(0),
    number_of_no_shoots: integer('number_of_no_shoots').notNull().default(0),
    paper_target_rounds: jsonb('paper_target_rounds').$type<number[]>(),
    fixed_time: numeric('fixed_time', { precision: 6, scale: 2 }),
    is_classifier: boolean('is_classifier').default(false).notNull(),
    classifier_number: varchar('classifier_number', { length: 20 }),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('stages_match_stage_unique').on(table.match_id, table.stage_number),
  ]
);

// ─── Match Admins ───────────────────────────────

export const matchAdmins = pgTable(
  'match_admins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    unique('match_admins_match_user_unique').on(table.match_id, table.user_id),
  ]
);

// ─── Match Officers ─────────────────────────────
// Match-level roles: MM, CSPO, SPO, CO, LO

export const matchOfficers = pgTable(
  'match_officers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 10 }).notNull().default('MO'),
  },
  (table) => [
    unique('match_officers_match_user_unique').on(
      table.match_id,
      table.user_id
    ),
  ]
);

// ─── Stage Officers ─────────────────────────────
// Stage-level roles: ACMO, SCMO, MO

export const stageOfficers = pgTable(
  'stage_officers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    stage_id: uuid('stage_id')
      .references(() => stages.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 10 }).notNull().default('MO'),
  },
  (table) => [
    unique('stage_officers_stage_user_unique').on(
      table.stage_id,
      table.user_id
    ),
  ]
);

// ─── Squads ─────────────────────────────────────

export const squads = pgTable(
  'squads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    squad_number: integer('squad_number').notNull(),
    name: varchar('name', { length: 100 }),
    max_size: integer('max_size').notNull().default(10),
  },
  (table) => [
    unique('squads_match_number_unique').on(
      table.match_id,
      table.squad_number
    ),
  ]
);

// ─── Registrations ──────────────────────────────

export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    shooter_name: varchar('shooter_name', { length: 100 }).notNull(),
    member_number: varchar('member_number', { length: 20 }),
    division: varchar('division', { length: 50 }).notNull(),
    power_factor: varchar('power_factor', { length: 10 }).notNull(),
    classification: varchar('classification', { length: 5 }),
    squad_id: uuid('squad_id').references(() => squads.id, {
      onDelete: 'set null',
    }),
    registered_at: timestamp('registered_at').defaultNow().notNull(),
  },
  (table) => [
    // A shooter can enter a match more than once — different divisions, or even
    // the same division twice (a second gun / re-entry, distinct PractiScore
    // line items). Each entry is its own registration, distinguished by
    // member_number, so uniqueness includes it.
    unique('registrations_match_user_division_member_unique').on(
      table.match_id,
      table.user_id,
      table.division,
      table.member_number
    ),
  ]
);

// ─── Scores ─────────────────────────────────────

export const scores = pgTable(
  'scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    stage_id: uuid('stage_id')
      .references(() => stages.id, { onDelete: 'cascade' })
      .notNull(),
    registration_id: uuid('registration_id')
      .references(() => registrations.id, { onDelete: 'cascade' })
      .notNull(),
    shooter_name: varchar('shooter_name', { length: 100 }).notNull(),
    division: varchar('division', { length: 50 }).notNull(),
    power_factor: varchar('power_factor', { length: 10 }).notNull(),
    alpha_count: integer('alpha_count').notNull().default(0),
    charlie_count: integer('charlie_count').notNull().default(0),
    delta_count: integer('delta_count').notNull().default(0),
    miss_count: integer('miss_count').notNull().default(0),
    no_shoot_count: integer('no_shoot_count').notNull().default(0),
    procedural_count: integer('procedural_count').notNull().default(0),
    steel_hits: integer('steel_hits').notNull().default(0),
    steel_misses: integer('steel_misses').notNull().default(0),
    time: numeric('time', { precision: 6, scale: 2 }).notNull(),
    raw_points: integer('raw_points').notNull().default(0),
    penalty_points: integer('penalty_points').notNull().default(0),
    total_points: integer('total_points').notNull().default(0),
    hit_factor: numeric('hit_factor', { precision: 10, scale: 4 })
      .notNull()
      .default('0'),
    scored_by: uuid('scored_by')
      .references(() => users.id)
      .notNull(),
    scored_at: timestamp('scored_at').defaultNow().notNull(),
    verified: boolean('verified').default(false).notNull(),
    verified_by: uuid('verified_by').references(() => users.id),
    dqed: boolean('dqed').default(false).notNull(),
    dnf: boolean('dnf').default(false).notNull(),
    modified_at: timestamp('modified_at'),
    modified_by: uuid('modified_by').references(() => users.id),
  },
  (table) => [
    unique('scores_stage_registration_unique').on(
      table.stage_id,
      table.registration_id
    ),
  ]
);

// ─── Stage Results ──────────────────────────────

export const stageResults = pgTable(
  'stage_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    stage_id: uuid('stage_id')
      .references(() => stages.id, { onDelete: 'cascade' })
      .notNull(),
    division: varchar('division', { length: 50 }).notNull(),
    stage_winner_hit_factor: numeric('stage_winner_hit_factor', {
      precision: 10,
      scale: 4,
    })
      .notNull()
      .default('0'),
    results: jsonb('results').notNull().default('[]'),
    computed_at: timestamp('computed_at').defaultNow().notNull(),
  },
  (table) => [
    unique('stage_results_stage_division_unique').on(
      table.stage_id,
      table.division
    ),
  ]
);

// ─── Match Results ──────────────────────────────

export const matchResults = pgTable(
  'match_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    match_id: uuid('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    division: varchar('division', { length: 50 }).notNull(),
    results: jsonb('results').notNull().default('[]'),
    computed_at: timestamp('computed_at').defaultNow().notNull(),
  },
  (table) => [
    unique('match_results_match_division_unique').on(
      table.match_id,
      table.division
    ),
  ]
);
