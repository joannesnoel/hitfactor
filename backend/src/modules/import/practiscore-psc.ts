import { unzipSync, strFromU8 } from 'fflate';
import type { ScoringType } from '@hitfactor/shared';
import type {
  ParsedMatch,
  ParsedStage,
  ParsedEntry,
  ParsedStageScore,
} from './types.js';

// A .psc file is a ZIP of match_def.json (match/stages/shooters) and
// match_scores.json (per-stage, per-shooter scores). Reverse-engineered layout:
//
//  - stage_stagescores[].ts[] : one nibble-packed int per target, 4 bits/zone:
//      nibble 0=A, 1=B, 2=C, 3=D, 4=NS(no-shoot), 5=M(miss).
//    A/B/C/D validated against rawpts (1172/1172); NS/M order cross-checked
//    against the PDF's per-shooter M/NS columns.
//  - str[] = string times (sum = stage time); poph/popm = steel hits/misses;
//    proc = procedural count; dnf/dqs flags.
//
// The app models three paper zones (alpha/charlie/delta) where its charlie is
// worth the same as PractiScore B *and* C (3 Minor / 4 Major), so:
//   alpha = A, charlie = B + C, delta = D.

interface PscTargetHits {
  a: number;
  b: number;
  c: number;
  d: number;
  m: number;
  ns: number;
}

function decodeTargetCell(v: number): PscTargetHits {
  return {
    a: (v >> 0) & 0xf,
    b: (v >> 4) & 0xf,
    c: (v >> 8) & 0xf,
    d: (v >> 12) & 0xf,
    ns: (v >> 16) & 0xf,
    m: (v >> 20) & 0xf,
  };
}

function mapScoringType(raw: string | undefined): ScoringType {
  const s = (raw ?? '').toLowerCase().replace(/[\s_]+/g, '');
  if (s.startsWith('virginia')) return 'virginia_count';
  if (s.startsWith('fixed')) return 'fixed_time';
  return 'comstock';
}

function toNum(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function parseCategories(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

const VALID_CLASSIFICATIONS = new Set(['GM', 'M', 'A', 'B', 'C', 'D', 'U']);

// PractiScore `sh_grd` is free-form — short codes, full words, or a percentage.
// The app stores classification as a short USPSA-style code (varchar(5)), so map
// to a known code or null. Unknown/long grades → null, never a raw overflowing
// string.
function normalizeClassification(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s) return null;
  if (VALID_CLASSIFICATIONS.has(s)) return s;
  const aliases: Record<string, string> = {
    GRANDMASTER: 'GM',
    'GRAND MASTER': 'GM',
    MASTER: 'M',
    UNCLASSIFIED: 'U',
    UNCL: 'U',
    UNC: 'U',
    NONE: 'U',
    NA: 'U',
  };
  return aliases[s] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Parse a PractiScore .psc file buffer into the normalized ParsedMatch. */
export function parsePsc(buf: Uint8Array): ParsedMatch {
  const files = unzipSync(buf);
  const defRaw = files['match_def.json'];
  if (!defRaw) throw new Error('match_def.json not found — not a valid .psc file');
  const def: Json = JSON.parse(strFromU8(defRaw));
  const scoresDoc: Json = files['match_scores.json']
    ? JSON.parse(strFromU8(files['match_scores.json']))
    : { match_scores: [] };

  // ── Stages ──────────────────────────────────────────────────────────────
  const stages: ParsedStage[] = (def.match_stages ?? [])
    // Chronograph "stages" are power-factor checks, not scored stages — skip them.
    .filter(
      (st: Json) => String(st.stage_scoretype ?? '').toLowerCase() !== 'chrono'
    )
    .map((st: Json) => {
    const targets: Json[] = st.stage_targets ?? [];
    return {
      stage_number: Number(st.stage_number),
      name: String(st.stage_name ?? `Stage ${st.stage_number}`),
      scoring_type: mapScoringType(st.stage_scoretype),
      number_of_targets: targets.length,
      paper_target_rounds: targets.map((t) => Number(t.target_reqshots ?? 2)),
      number_of_steel: Number(st.stage_poppers ?? 0),
      number_of_no_shoots: 0,
    } satisfies ParsedStage;
  });

  // ── Shooters (skip deleted) ─────────────────────────────────────────────
  interface ShooterInfo {
    name: string;
    member_number: string | null;
    division: string;
    power_factor: string;
    categories: string[];
    classification: string | null;
    dq: boolean;
  }
  const shooters = new Map<string, ShooterInfo>(); // sh_uid → info
  for (const sh of def.match_shooters ?? []) {
    if (sh.sh_del) continue;
    const ln = String(sh.sh_ln ?? '').trim();
    const fn = String(sh.sh_fn ?? '').trim();
    const name = [ln, fn].filter(Boolean).join(', ');
    if (!name) continue;
    shooters.set(sh.sh_uid ?? sh.sh_uuid, {
      name,
      member_number: sh.sh_id != null ? String(sh.sh_id) : null,
      division: String(sh.sh_dvp ?? ''),
      power_factor: String(sh.sh_pf ?? 'MINOR'),
      categories: parseCategories(sh.sh_ctgs),
      classification: normalizeClassification(sh.sh_grd),
      dq: Boolean(sh.sh_dq),
    });
  }

  // ── Scores: index by stage_number → shooter_uid → stagescore ────────────
  const scoreIndex = new Map<number, Map<string, Json>>();
  for (const st of scoresDoc.match_scores ?? []) {
    const stageNo = Number(st.stage_number);
    const byShooter = new Map<string, Json>();
    for (const ss of st.stage_stagescores ?? []) {
      if (ss.shtr) byShooter.set(ss.shtr, ss);
    }
    scoreIndex.set(stageNo, byShooter);
  }

  // ── Entries ─────────────────────────────────────────────────────────────
  const entries: ParsedEntry[] = [];
  for (const [uid, info] of shooters) {
    const scores: ParsedStageScore[] = [];
    for (const stage of stages) {
      const ss = scoreIndex.get(stage.stage_number)?.get(uid);
      if (!ss) continue;
      const ts: number[] = Array.isArray(ss.ts) ? ss.ts : [];
      const dnf = Boolean(ss.dnf ?? ss.dnfs);
      const poph = Number(ss.poph ?? 0);
      const popm = Number(ss.popm ?? 0);
      const time = (Array.isArray(ss.str) ? ss.str : []).reduce(
        (sum: number, t: unknown) => sum + toNum(t),
        0
      );
      // Skip only if the shooter didn't shoot this stage at all. Steel-only
      // stages have an empty `ts` (hits live in poph/popm), so don't drop them.
      if (ts.length === 0 && poph === 0 && popm === 0 && time <= 0 && !dnf) {
        continue;
      }

      let a = 0;
      let bc = 0;
      let d = 0;
      let m = 0;
      let ns = 0;
      for (const cell of ts) {
        const h = decodeTargetCell(cell);
        a += h.a;
        bc += h.b + h.c;
        d += h.d;
        m += h.m;
        ns += h.ns;
      }

      scores.push({
        stage_number: stage.stage_number,
        alpha: a,
        charlie: bc,
        delta: d,
        miss: m,
        no_shoot: ns,
        procedural: Number(ss.proc ?? 0),
        steel_hits: poph,
        steel_misses: popm,
        time: time > 0 ? time : null,
        dqed: info.dq || Boolean(ss.dqs ?? ss.stagedq_details),
        dnf,
      });
    }
    if (scores.length === 0) continue; // shooter with no scored stages
    entries.push({
      name: info.name,
      member_number: info.member_number,
      division: info.division,
      power_factor: info.power_factor,
      categories: info.categories,
      classification: info.classification,
      scores,
    });
  }

  return {
    name: String(def.match_name ?? 'Imported Match'),
    date: String(def.match_date ?? '').slice(0, 10),
    location: String(def.match_clubname ?? def.match_clubcode ?? 'Unknown'),
    organization: 'PSMOC',
    level: 'I',
    stages,
    entries,
  };
}
