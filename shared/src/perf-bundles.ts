// Assembles the analytics input (MatchPerfBundle[]) for a shooter from raw rows —
// the same rows the phone holds locally (registrations, matches, stages and the
// computed stage/match results), where JSON columns arrive as strings. Pure, so
// the career analytics can run offline from synced data.

import type { MatchPerfBundle } from './analytics.engine.js';
import type { StageResultEntry, MatchResultEntry } from './types.js';

export interface PerfSourceRows {
  registrations: { id: string; match_id: string; division: string }[];
  matches: { id: string; name: string; start_date: string; organization: string }[];
  stages: { id: string; match_id: string; stage_number: number; max_points: number }[];
  stageResults: {
    match_id: string;
    stage_id: string;
    division: string;
    results: string | StageResultEntry[];
  }[];
  matchResults: {
    match_id: string;
    division: string;
    results: string | MatchResultEntry[];
  }[];
}

function parse<T>(v: string | T[]): T[] {
  if (Array.isArray(v)) return v;
  try {
    const out = JSON.parse(v);
    return Array.isArray(out) ? (out as T[]) : [];
  } catch {
    return [];
  }
}

/** One bundle per registration whose division already has computed match results. */
export function assemblePerfBundles(src: PerfSourceRows): MatchPerfBundle[] {
  const matchById = new Map(src.matches.map((m) => [m.id, m]));
  const bundles: MatchPerfBundle[] = [];

  for (const reg of src.registrations) {
    const field = src.matchResults
      .filter((r) => r.match_id === reg.match_id && r.division === reg.division)
      .flatMap((r) => parse<MatchResultEntry>(r.results));
    if (field.length === 0) continue; // results not computed yet

    const match = matchById.get(reg.match_id);
    const stages = src.stages
      .filter((s) => s.match_id === reg.match_id)
      .sort((a, b) => Number(a.stage_number) - Number(b.stage_number))
      .map((s) => {
        const results = src.stageResults
          .filter(
            (r) =>
              r.match_id === reg.match_id &&
              r.stage_id === s.id &&
              r.division === reg.division
          )
          .flatMap((r) => parse<StageResultEntry>(r.results));
        return results.length > 0
          ? {
              stage_id: s.id,
              stage_number: Number(s.stage_number),
              max_points: Number(s.max_points),
              results,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    bundles.push({
      match_id: reg.match_id,
      match_name: match?.name ?? 'Match',
      match_date: match?.start_date ?? '',
      organization: match?.organization ?? 'PSMOC',
      division: reg.division,
      registration_id: reg.id,
      match_results: field,
      stages,
    });
  }
  return bundles;
}
