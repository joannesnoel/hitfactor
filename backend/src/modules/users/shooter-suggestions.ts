// Suggestion-based shooter de-duplication. Exact-name + rank-stripping already
// collapse the deterministic cases on import; this surfaces the *judgment* cases
// (nicknames, spelling, middle names) that a human has to confirm — so the admin
// doesn't have to guess who to search for.
//
// Strategy: bucket by exact surname (the part before the comma of the normalized
// "LAST, FIRST" key), then within each surname compare given names with a set of
// cheap heuristics. Similar pairs are unioned into groups for review. Nothing is
// auto-merged — these are ranked suggestions.

import { normalizeShooterName } from '../import/shooter-identity.js';

export interface ShooterRow {
  id: string;
  display_name: string;
  normalized_name: string | null;
  claimed: boolean;
  member_number: string | null;
  match_count: number;
  registration_count: number;
}

export interface SuggestionGroup {
  confidence: number; // 0..1 — the strongest pair score in the group
  tier: 'high' | 'medium' | 'low';
  reason: string;
  suggested_keep_id: string;
  shooters: ShooterRow[];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

const surnameOf = (key: string): string => key.split(',')[0].trim();
const givenOf = (key: string): string =>
  key.slice(key.indexOf(',') + 1).trim();

/**
 * Score how likely two given-name strings belong to the same person (0..1),
 * with the heuristic that fired. Both are the upper-cased "FIRST [MIDDLE …]"
 * portion of the normalized key.
 */
export function givenNameSimilarity(
  a: string,
  b: string
): { score: number; kind: string } {
  if (!a || !b) return { score: 0, kind: '' };
  if (a === b) return { score: 1, kind: 'exact' };

  const shorter = Math.min(a.length, b.length);
  // One name extends the other: "ZANDRO" vs "ZANDRO PAOLO", "YOGI" vs "YOGIE".
  if (shorter >= 3 && (a.startsWith(b) || b.startsWith(a))) {
    return { score: 0.9, kind: 'prefix' };
  }

  // One name contains the other as a whole token — catches quoted nicknames
  // ("PRECIOSO \"GAGA\"" vs "GAGA"). Non-letters → spaces to strip quotes.
  const ca = ` ${a.replace(/[^A-Z]+/g, ' ').trim()} `;
  const cb = ` ${b.replace(/[^A-Z]+/g, ' ').trim()} `;
  if (ca.includes(` ${b} `) || cb.includes(` ${a} `)) {
    return { score: 0.85, kind: 'contains' };
  }

  const ta = a.split(' ').filter(Boolean);
  const tb = b.split(' ').filter(Boolean);
  // Same first given name ("MARK ANTHONY D" vs "MARK A").
  if (ta[0] && ta[0] === tb[0] && ta[0].length >= 3) {
    return { score: 0.8, kind: 'shared-first-name' };
  }
  // Any shared token ≥3 chars (middle name / reordered).
  const setB = new Set(tb.filter((t) => t.length >= 3));
  if (ta.some((t) => t.length >= 3 && setB.has(t))) {
    return { score: 0.72, kind: 'shared-name' };
  }

  // Spelling / typo: edit-distance ratio.
  const ratio = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  if (ratio >= 0.7) return { score: ratio, kind: 'spelling' };

  // Weak signal: a long shared prefix ("HERBS" vs "HERBERT").
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  if (p >= 4) return { score: 0.62, kind: 'similar-spelling' };

  return { score: 0, kind: '' };
}

const REASON: Record<string, string> = {
  prefix: 'one given name extends the other (middle name / short form)',
  contains: 'one given name contains the other (nickname)',
  'shared-first-name': 'same surname and first name',
  'shared-name': 'same surname and a shared given name',
  spelling: 'same surname, given name looks like a spelling variant',
  'similar-spelling': 'same surname, similar given-name spelling',
};

// Which record to keep by default: a claimed login wins, then the one carrying
// the most history, then most matches, then a stable id.
function pickKeep(rows: ShooterRow[]): ShooterRow {
  return [...rows].sort(
    (x, y) =>
      Number(y.claimed) - Number(x.claimed) ||
      y.registration_count - x.registration_count ||
      y.match_count - x.match_count ||
      (x.id < y.id ? -1 : 1)
  )[0];
}

/**
 * Group likely-duplicate shooters. `threshold` is the minimum pair score to
 * link two records (default 0.62 — includes weak spelling matches; raise for
 * higher precision). Groups are returned strongest-confidence first.
 */
export function suggestDuplicates(
  rows: ShooterRow[],
  threshold = 0.62
): SuggestionGroup[] {
  // Only real shooters with a usable key; derive the key from display_name so
  // it reflects current normalization (rank-stripping etc.) even if the stored
  // normalized_name is stale.
  const usable = rows
    .filter((r) => r.registration_count > 0)
    .map((r) => ({ row: r, key: normalizeShooterName(r.display_name) }))
    .filter((x) => x.key.includes(','));

  // Bucket by surname.
  const buckets = new Map<string, { row: ShooterRow; key: string }[]>();
  for (const x of usable) {
    const s = surnameOf(x.key);
    if (!s) continue;
    (buckets.get(s) ?? buckets.set(s, []).get(s)!).push(x);
  }

  const groups: SuggestionGroup[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;

    // Union-find: link every pair whose given names score above the threshold.
    const parent = bucket.map((_, i) => i);
    const find = (i: number): number =>
      parent[i] === i ? i : (parent[i] = find(parent[i]));
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        if (
          givenNameSimilarity(givenOf(bucket[i].key), givenOf(bucket[j].key))
            .score >= threshold
        ) {
          parent[find(i)] = find(j);
        }
      }
    }

    // Collect clusters, then describe each by its strongest internal pair.
    const clusters = new Map<number, { row: ShooterRow; key: string }[]>();
    for (let i = 0; i < bucket.length; i++) {
      const r = find(i);
      (clusters.get(r) ?? clusters.set(r, []).get(r)!).push(bucket[i]);
    }
    for (const members of clusters.values()) {
      if (members.length < 2) continue;
      let best = { score: 0, kind: '' };
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const s = givenNameSimilarity(
            givenOf(members[i].key),
            givenOf(members[j].key)
          );
          if (s.score > best.score) best = s;
        }
      }
      const shooters = members.map((m) => m.row);
      groups.push({
        confidence: Number(best.score.toFixed(2)),
        tier: best.score >= 0.85 ? 'high' : best.score >= 0.72 ? 'medium' : 'low',
        reason: REASON[best.kind] ?? 'same surname, similar given name',
        suggested_keep_id: pickKeep(shooters).id,
        shooters,
      });
    }
  }

  return groups.sort((a, b) => b.confidence - a.confidence);
}
