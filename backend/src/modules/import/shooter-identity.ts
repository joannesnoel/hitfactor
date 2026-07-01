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

/** Case-insensitive identity key used to dedupe a shooter across matches. */
export function normalizeShooterName(raw: string): string {
  return cleanDisplayName(raw).toUpperCase();
}
