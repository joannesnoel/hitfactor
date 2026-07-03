// ─── Organizations / Federations ─────────────────
// A match is run under one organization; each org names divisions differently.
export const ORGANIZATIONS = ['PSMOC', 'PPSA'] as const;
export type Organization = (typeof ORGANIZATIONS)[number];

export const DEFAULT_ORGANIZATION: Organization = 'PSMOC';

// ─── Divisions ───────────────────────────────────
// Canonical, org-neutral division keys (IPSC-based). These are what gets
// stored in the DB and what the scoring engine groups by. Display names are
// org-specific and resolved via DIVISION_CONFIG / getDivisionLabel().
export const DIVISION_KEYS = [
  'open',
  'classic',
  'production',
  'standard',
  'production_optics',
  'optics',
  'revolver',
  'classic_45',
  'pcc_optics',
  'pcc_iron',
  'prr_limited',
  'prr_unlimited',
  'limited_10',
  'pcc_sb_unlimited',
] as const;
export type DivisionKey = (typeof DIVISION_KEYS)[number];

// Backward-compatible aliases: a "division" value IS a canonical key.
export const DIVISIONS = DIVISION_KEYS;
export type Division = DivisionKey;

// Per-organization division offerings, in display order, with that org's label.
// Sets may differ between orgs (e.g. `classic_45` is PSMOC-only).
export const DIVISION_CONFIG: Record<
  Organization,
  { key: DivisionKey; label: string }[]
> = {
  PSMOC: [
    { key: 'open', label: 'Unlimited' },
    { key: 'standard', label: 'Stock Hi-Cap' },
    { key: 'classic', label: 'Single Stack' },
    { key: 'production', label: 'Double Action/Striker Fired' },
    { key: 'production_optics', label: 'Carry Optics' },
    { key: 'classic_45', label: 'Classic .45' },
    { key: 'optics', label: 'Stock Hi-Cap Optic' },
    { key: 'revolver', label: 'Revolver' },
    { key: 'pcc_optics', label: 'Unlimited PCC' },
    { key: 'pcc_iron', label: 'Limited PCC' },
    { key: 'prr_limited', label: 'Practical Rimfired Rifle Limited' },
    { key: 'prr_unlimited', label: 'Practical Rimfired Rifle Unlimited' },
    { key: 'limited_10', label: 'Limited 10' },
    { key: 'pcc_sb_unlimited', label: 'PCC Short Barrel Unlimited' },
  ],
  PPSA: [
    { key: 'open', label: 'Open' },
    { key: 'classic', label: 'Classic' },
    { key: 'production', label: 'Production' },
    { key: 'standard', label: 'Standard' },
    { key: 'production_optics', label: 'Production Optics' },
    { key: 'optics', label: 'Optics' },
    { key: 'revolver', label: 'Revolver' },
    { key: 'pcc_optics', label: 'PCC Optics' },
    { key: 'pcc_iron', label: 'PCC Iron' },
  ],
};

/** Divisions offered by an org, in display order (key + label). */
export function getDivisionsForOrg(
  org: Organization
): { key: DivisionKey; label: string }[] {
  return DIVISION_CONFIG[org] ?? DIVISION_CONFIG[DEFAULT_ORGANIZATION];
}

/** Display label for a division key under an org; falls back to the raw key. */
export function getDivisionLabel(
  org: Organization,
  key: DivisionKey | string
): string {
  const found = DIVISION_CONFIG[org]?.find((d) => d.key === key);
  return found ? found.label : String(key);
}

/** Whether an org offers a given division key. */
export function isValidDivisionForOrg(
  org: Organization,
  key: DivisionKey | string
): boolean {
  return Boolean(DIVISION_CONFIG[org]?.some((d) => d.key === key));
}

// PSMOC PractiScore division abbreviations → canonical keys. PractiScore exports
// may use an abbreviation (e.g. "DASF"), the canonical key, or the full label;
// divisionFromPractiscore() resolves all three.
const PRACTISCORE_DIVISION_ABBREV: Record<string, DivisionKey> = {
  dasf: 'production',
  shc: 'standard',
  shco: 'optics',
  co: 'production_optics',
  ss: 'classic',
  pccu: 'pcc_optics',
  pccl: 'pcc_iron',
  c45: 'classic_45',
  u: 'open',
  prrl: 'prr_limited',
  prru: 'prr_unlimited',
  l10: 'limited_10',
  pccsbu: 'pcc_sb_unlimited',
  // PractiScore full-name variants that don't exactly match a PSMOC label
  // (e.g. plural "Optics" vs label "Optic", or the full PCC/PRR names vs the
  // short "Unlimited PCC" / "Practical Rimfired Rifle …" labels).
  stockhicapoptic: 'optics',
  stockhicapoptics: 'optics',
  pistolcalibercarbinelimited: 'pcc_iron',
  pistolcalibercarbineunlimited: 'pcc_optics',
  pistolcalibercarbineshortbarrelunlimited: 'pcc_sb_unlimited',
  practicalrimfireriflelimited: 'prr_limited',
  practicalrimfirerifleunlimited: 'prr_unlimited',
};

/** Resolve a PractiScore division string (abbrev, key, or label) to a canonical
 *  key, or null if unrecognized. */
export function divisionFromPractiscore(raw: string): DivisionKey | null {
  const norm = raw.trim().toLowerCase().replace(/[\s._/,-]+/g, '');
  if (PRACTISCORE_DIVISION_ABBREV[norm]) {
    return PRACTISCORE_DIVISION_ABBREV[norm];
  }
  const asKey = DIVISION_KEYS.find((k) => k.replace(/_/g, '') === norm);
  if (asKey) return asKey;
  for (const org of ORGANIZATIONS) {
    const byLabel = DIVISION_CONFIG[org].find(
      (d) => d.label.toLowerCase().replace(/[\s._/-]+/g, '') === norm
    );
    if (byLabel) return byLabel.key;
  }
  return null;
}

export const CLASSIFICATIONS = ['GM', 'M', 'A', 'B', 'C', 'D', 'U'] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const POWER_FACTORS = ['Major', 'Minor'] as const;
export type PowerFactor = (typeof POWER_FACTORS)[number];

export const SCORING_TYPES = [
  'comstock',
  'virginia_count',
  'fixed_time',
] as const;
export type ScoringType = (typeof SCORING_TYPES)[number];

export const MATCH_STATUSES = [
  'draft',
  'registration',
  'active',
  'scoring',
  'final',
  'archived',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_LEVELS = ['I', 'II', 'III'] as const;
export type MatchLevel = (typeof MATCH_LEVELS)[number];

export const ROLES = ['admin', 'officer', 'shooter'] as const;
export type Role = (typeof ROLES)[number];

// PSMOC Match Official Roles (Section 8)
// Match-level roles (assigned to the match, not a specific stage)
export const MATCH_LEVEL_OFFICIAL_ROLES = [
  'MA',    // Match Administrator
  'MM',    // Match Master
  'ACMO',  // Area Chief Match Officer
  'CSPO',  // Chief Score Processing Officer
  'SPO',   // Score Processing Officer
  'CO',    // Chrono Officer
  'LO',    // Logistics Officer
] as const;
export type MatchLevelOfficialRole = (typeof MATCH_LEVEL_OFFICIAL_ROLES)[number];

// Stage-level roles (assigned to specific stages)
export const STAGE_LEVEL_OFFICIAL_ROLES = [
  'SCMO',  // Stage Chief Match Officer
  'MO',    // Match Officer
] as const;
export type StageLevelOfficialRole = (typeof STAGE_LEVEL_OFFICIAL_ROLES)[number];

// All official roles
export const MATCH_OFFICIAL_ROLES = [
  ...MATCH_LEVEL_OFFICIAL_ROLES,
  ...STAGE_LEVEL_OFFICIAL_ROLES,
] as const;
export type MatchOfficialRole = (typeof MATCH_OFFICIAL_ROLES)[number];

export const MATCH_OFFICIAL_ROLE_LABELS: Record<MatchOfficialRole, string> = {
  MA: 'Match Administrator',
  MM: 'Match Master',
  ACMO: 'Area Chief Match Officer',
  CSPO: 'Chief Score Processing Officer',
  SPO: 'Score Processing Officer',
  CO: 'Chrono Officer',
  LO: 'Logistics Officer',
  SCMO: 'Stage Chief Match Officer',
  MO: 'Match Officer',
};

export const SCORING_ZONES = ['A', 'C', 'D'] as const;
export type ScoringZone = (typeof SCORING_ZONES)[number];

// Point values per zone by power factor
export const ZONE_POINTS: Record<PowerFactor, Record<ScoringZone, number>> = {
  Major: { A: 5, C: 4, D: 2 },
  Minor: { A: 5, C: 3, D: 1 },
};

export const STEEL_HIT_POINTS = 5;
export const MISS_PENALTY = -10;
export const NO_SHOOT_PENALTY = -10;
export const PROCEDURAL_PENALTY = -10;

export const HIT_FACTOR_DECIMALS = 4;
export const STAGE_PERCENTAGE_DECIMALS = 4;
