// Cross-match shooter identity. `Member#` is per-entry (a shooter appears twice
// across divisions with different member#s and name suffixes), so identity keys
// off the normalized name instead.

// Strip a second-entry marker attached to the surname, immediately before the
// "LAST, FIRST" comma:
//   "JAVIER - 2, YOGIE"  "DAWA 2, JAMES"  "QUISEO-2, RUDY"  "YU-2, NOLI"
//   "PBGEN ABAD PCC, ARNOLD"
// Leaves genuine name parts alone ("ACAPULCO JR, ROMULO" is unchanged).
function stripEntrySuffix(name: string): string {
  return name.replace(/(?:\s*-?\s*\d+|\s+PCC)\s*,/i, ',');
}

/** Suffix-stripped, whitespace-collapsed display name (original case preserved). */
export function cleanDisplayName(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return stripEntrySuffix(collapsed).replace(/\s+/g, ' ').trim();
}

// Police/military rank + title tokens that PSMOC embeds in the given-name field
// ("ABESIA, PLT ELMER I"). Ranks change with promotions and are formatted
// inconsistently, so they're stripped from the *matching key* only — the full
// name (with rank) is kept for display via cleanDisplayName().
const RANK_PREFIXES = new Set([
  // PNP enlisted
  'PAT', 'PCPL', 'PSSG', 'PMSG', 'PSMS', 'PCMS', 'PEMS', 'PMS',
  // PNP commissioned / general
  'PLT', 'PCPT', 'PCAPT', 'PMAJ', 'PLTCOL', 'PCOL', 'PBGEN', 'PMGEN',
  'PLTGEN', 'PGEN', 'PSUPT', 'PSSUPT', 'PCSUPT', 'PSINSP', 'PINSP', 'PCINSP',
  'PO1', 'PO2', 'PO3', 'SPO1', 'SPO2', 'SPO3', 'SPO4', 'NUP',
  // AFP / military
  'MSG', 'SSG', 'SGT', 'TSG', 'CPL', 'PFC', 'TS', 'CMS', 'SMS',
  // civilian titles occasionally used in this field
  'MS', 'MR', 'MRS', 'DR', 'ATTY', 'ENGR', 'HON',
]);

// Drop a leading rank/title token from the given-name, but only when a real name
// follows (so "SURNAME, PAT" — where Pat is the name — is left intact).
function stripRankPrefix(firstName: string): string {
  const parts = firstName.split(' ').filter(Boolean);
  while (
    parts.length > 1 &&
    RANK_PREFIXES.has(parts[0].replace(/\./g, '').toUpperCase())
  ) {
    parts.shift();
  }
  return parts.join(' ');
}

/** Case-insensitive identity key used to dedupe a shooter across matches. */
export function normalizeShooterName(raw: string): string {
  const clean = cleanDisplayName(raw).toUpperCase();
  const comma = clean.indexOf(',');
  if (comma === -1) return clean;
  const last = clean.slice(0, comma).trim();
  const first = stripRankPrefix(clean.slice(comma + 1).trim());
  return `${last}, ${first}`;
}
