import { z } from 'zod';
import {
  CLASSIFICATIONS,
  DIVISIONS,
  MATCH_LEVEL_OFFICIAL_ROLES,
  MATCH_LEVELS,
  MATCH_STATUSES,
  ORGANIZATIONS,
  POWER_FACTORS,
  ROLES,
  SCORING_TYPES,
  STAGE_LEVEL_OFFICIAL_ROLES,
} from './constants.js';

// ─── Auth ────────────────────────────────────────

export const userDivisionSchema = z.object({
  division: z.enum(DIVISIONS),
  classification: z.enum(CLASSIFICATIONS).default('U'),
});
export type UserDivisionInput = z.infer<typeof userDivisionSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(100),
  member_number: z.string().max(20).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// ─── Match ───────────────────────────────────────

export const createMatchSchema = z.object({
  name: z.string().min(1).max(200),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  level: z.enum(MATCH_LEVELS),
  organization: z.enum(ORGANIZATIONS),
  max_shooters: z.number().int().min(1).max(500).optional(),
});
export type CreateMatchInput = z.infer<typeof createMatchSchema>;

export const createRangeSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
});
export type CreateRangeInput = z.infer<typeof createRangeSchema>;

export const updateRangeSchema = createRangeSchema.partial();
export type UpdateRangeInput = z.infer<typeof updateRangeSchema>;

export const updateMatchSchema = createMatchSchema.partial().extend({
  status: z.enum(MATCH_STATUSES).optional(),
  registration_open: z.boolean().optional(),
});
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;

// ─── Stage ───────────────────────────────────────

export const createStageSchema = z.object({
  stage_number: z.number().int().min(1).max(30),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scoring_type: z.enum(SCORING_TYPES),
  number_of_targets: z.number().int().min(0).max(32),
  number_of_steel: z.number().int().min(0).max(32),
  number_of_no_shoots: z.number().int().min(0).max(16),
  paper_target_rounds: z.array(z.number().int().min(1).max(32)).optional(),
  fixed_time: z.number().positive().optional(),
  is_classifier: z.boolean().default(false),
  classifier_number: z.string().max(20).optional(),
});
export type CreateStageInput = z.infer<typeof createStageSchema>;

export const updateStageSchema = createStageSchema.partial();
export type UpdateStageInput = z.infer<typeof updateStageSchema>;

/** Compute min_rounds and max_points from target configuration */
export function computeStageRounds(input: {
  number_of_targets: number;
  number_of_steel: number;
  paper_target_rounds?: number[];
}): { min_rounds: number; max_points: number } {
  const rounds = input.paper_target_rounds
    ?? Array(input.number_of_targets).fill(2);
  const paperRounds = rounds.reduce((sum, r) => sum + r, 0);
  const steelRounds = input.number_of_steel;
  const min_rounds = paperRounds + steelRounds;
  const max_points = (paperRounds + steelRounds) * 5;
  return { min_rounds, max_points };
}

// ─── Registration ────────────────────────────────

export const registrationSchema = z.object({
  shooter_name: z.string().min(1).max(100),
  member_number: z.string().max(20).optional(),
  division: z.enum(DIVISIONS),
  power_factor: z.enum(POWER_FACTORS),
  classification: z.enum(CLASSIFICATIONS).optional(),
  squad_id: z.string().uuid().optional(),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

// ─── Score ───────────────────────────────────────

export const scoreInputSchema = z.object({
  registration_id: z.string().uuid(),
  alpha_count: z.number().int().min(0).max(64),
  charlie_count: z.number().int().min(0).max(64),
  delta_count: z.number().int().min(0).max(64),
  miss_count: z.number().int().min(0).max(64),
  no_shoot_count: z.number().int().min(0).max(16),
  procedural_count: z.number().int().min(0).max(16),
  steel_hits: z.number().int().min(0).max(32),
  steel_misses: z.number().int().min(0).max(32),
  time: z.number().positive().max(999.99),
  dqed: z.boolean().default(false),
  dnf: z.boolean().default(false),
});
export type ScoreInputSchema = z.infer<typeof scoreInputSchema>;

// ─── Squad ───────────────────────────────────────

export const createSquadSchema = z.object({
  squad_number: z.number().int().min(1).max(50),
  name: z.string().max(100).optional(),
  max_size: z.number().int().min(1).max(20).default(10),
});
export type CreateSquadInput = z.infer<typeof createSquadSchema>;

// ─── User Profile ────────────────────────────────

export const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  member_number: z.string().max(20).optional(),
  default_division: z.enum(DIVISIONS).optional(),
  divisions: z.array(userDivisionSchema).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Create Officer (stub user) ──────────────────

export const createOfficerSchema = z.object({
  display_name: z.string().min(1).max(100),
  email: z.string().email(),
  member_number: z.string().max(20).optional(),
});
export type CreateOfficerInput = z.infer<typeof createOfficerSchema>;

// ─── Officer Assignment ──────────────────────────

export const assignMatchOfficerSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(MATCH_LEVEL_OFFICIAL_ROLES),
});
export type AssignMatchOfficerInput = z.infer<typeof assignMatchOfficerSchema>;

export const assignStageOfficerSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(STAGE_LEVEL_OFFICIAL_ROLES),
  stage_ids: z.array(z.string().uuid()).min(1),
});
export type AssignStageOfficerInput = z.infer<typeof assignStageOfficerSchema>;

// Keep backward compat alias
export const assignOfficerSchema = z.union([
  assignMatchOfficerSchema,
  assignStageOfficerSchema,
]);
export type AssignOfficerInput = z.infer<typeof assignOfficerSchema>;

// Self-service account claim: link a login onto an imported (unclaimed) shooter.
export const claimSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type ClaimInput = z.infer<typeof claimSchema>;
