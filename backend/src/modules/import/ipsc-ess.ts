import type { ParsedMatch, ParsedStage, ParsedEntry, ParsedStageScore } from './types.js';

// IPSC ESS (`*.ipscess.org`) results portal importer.
//
// The portal's JSON API is auth-gated, but the per-shooter *verify* page is
// public and server-rendered:
//   https://<host>.ipscess.org/portal/verify/<matchId>?shooter=<n>
// It carries the match name (navbar), a shooter header (id · LAST, FIRST ·
// DIV · CLASSE · FATOR · CAT), and a scorecard table
// (STG · FACTOR · PTS · A · C · D · MI · NS · PE · <blank> · TIME).
//
// Shooters iterate 1,2,3…; an out-of-range id renders "Shooter not found."
// IPSC zone points equal USPSA zone points (Major A5/C4/D2, Minor A5/C3/D1,
// miss −10), so our computeScore reproduces ESS's FACTOR/PTS exactly — no
// scoring conversion. We scrape the verify pages into a source-agnostic
// ParsedMatch and hand it to importMatch().

export interface EssStageRow {
  stageNo: number;
  factor: number;
  pts: number;
  a: number;
  c: number;
  d: number;
  mi: number;
  ns: number;
  pe: number;
  time: number;
}

export interface EssShooter {
  id: number;
  name: string; // "LAST, FIRST" as printed
  division: string;
  classification: string;
  powerFactor: string;
  category: string;
  matchName: string;
  stages: EssStageRow[];
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#0?39;/g, "'")
    .replace(/&#0?34;|&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function num(s: string | undefined): number {
  const n = parseFloat((s ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse one ESS verify page into an EssShooter. Returns null when the page
 * carries no shooter block ("Shooter not found." — an id past the end of the
 * list, or a gap).
 */
export function parseEssVerify(html: string): EssShooter | null {
  // Shooter header: `<div class="col-4"> 5 LOPEZ, LEVI </div>`. On a
  // not-found page the col-4 is empty, so no id → bail.
  const header = html.match(
    /<div class="col-4">\s*(\d+)\s+([^<]+?)\s*<\/div>/
  );
  if (!header) return null;
  const id = Number(header[1]);
  const name = decode(header[2]);

  // Meta line: `DIV: Standard CLASSE: U FATOR: Major CAT:  Senior`
  const metaBlock = html.match(/<div class="col-8[^"]*">([\s\S]*?)<\/div>/);
  const meta = metaBlock ? decode(metaBlock[1].replace(/\s+/g, ' ')) : '';
  const grab = (label: string, next: string): string => {
    const re = new RegExp(`${label}:\\s*(.*?)\\s*(?:${next}:|$)`);
    const m = meta.match(re);
    return m ? m[1].trim() : '';
  };
  const division = grab('DIV', 'CLASSE');
  const classification = grab('CLASSE', 'FATOR');
  const powerFactor = grab('FATOR', 'CAT');
  const category = grab('CAT', '\0');

  // Match name from the navbar nav-link.
  const nav = html.match(/<a class="nav-link"[^>]*>([\s\S]*?)<\/a>/);
  const matchName = nav ? decode(nav[1]) : `ESS Match`;

  // Scorecard rows inside <tbody>. Each <tr> is 11 <td> cells:
  // STG · FACTOR · PTS · A · C · D · MI · NS · PE · <blank> · TIME
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  const stages: EssStageRow[] = [];
  if (tbody) {
    const rows = tbody[1].match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
    for (const row of rows) {
      const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) =>
        decode(m[1])
      );
      if (cells.length < 11) continue;
      const stageNo = num(cells[0]); // "STAGE 1" → 1
      if (!stageNo) continue;
      stages.push({
        stageNo,
        factor: num(cells[1]),
        pts: num(cells[2]),
        a: num(cells[3]),
        c: num(cells[4]),
        d: num(cells[5]),
        mi: num(cells[6]),
        ns: num(cells[7]),
        pe: num(cells[8]),
        // cells[9] is the blank spacer column
        time: num(cells[10]),
      });
    }
  }

  return {
    id,
    name,
    division,
    classification,
    powerFactor,
    category,
    matchName,
    stages,
  };
}

/**
 * Parse a division results page (`/portal/results/<matchId>?division=<n>`) for
 * DQ'd shooters. A DQ row has a blank place, the shooter id, the name, a
 * `colspan` filler, and a `DQ` cell — DQ never appears on the verify page, so
 * this is the only place it's visible. Returns the DQ'd shooter ids.
 */
export function parseEssDqIds(html: string): number[] {
  const ids: number[] = [];
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbody) return ids;
  const rows = tbody[1].match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    if (!/>\s*DQ\s*</.test(row)) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      decode(m[1])
    );
    // cells: [place, id, name, …, "DQ"]
    const id = Number(cells[1]);
    if (Number.isInteger(id) && id > 0) ids.push(id);
  }
  return ids;
}

/**
 * GET a page's text with a hard per-request timeout, returning null on any
 * failure (non-2xx, network error, or timeout). A hung ESS page must never
 * stall the whole import — native fetch has no default timeout.
 */
async function fetchPageText(
  url: string,
  timeoutMs = 15000
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'HitFactor-Import/1.0' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scan a match's division results pages (division=1..cap) collecting DQ'd
 * shooter ids. ESS division ids are a sparse catalog, so we fetch the whole
 * small range in parallel batches (fast + complete) rather than stopping early.
 */
export async function fetchEssDqIds(
  host: string,
  matchId: number,
  opts: { cap?: number; concurrency?: number } = {}
): Promise<Set<number>> {
  const cap = opts.cap ?? 80;
  const concurrency = opts.concurrency ?? 10;
  const dq = new Set<number>();
  for (let start = 1; start <= cap; start += concurrency) {
    const ids: number[] = [];
    for (let i = 0; i < concurrency && start + i <= cap; i++) ids.push(start + i);
    const pages = await Promise.all(
      ids.map((d) =>
        fetchPageText(`https://${host}/portal/results/${matchId}?division=${d}`)
      )
    );
    for (const html of pages) {
      if (!html) continue;
      // A populated division has an <h3>Name</h3> heading + a results table.
      const populated =
        /<tbody>[\s\S]*<tr>/.test(html) && /<h3>[^<]+<\/h3>/.test(html);
      if (!populated) continue;
      for (const id of parseEssDqIds(html)) dq.add(id);
    }
  }
  return dq;
}

/**
 * Assemble scraped ESS shooters into a source-agnostic ParsedMatch.
 * `date` defaults to today (the verify page carries no date; match identity is
 * the stable source_match_id, so re-imports update descriptive fields).
 * `dqIds` (from the division results pages) marks those shooters' scores DQ'd —
 * the verify page hides DQ and zeroes only the FACTOR, so without this a DQ'd
 * shooter would recompute to a live score.
 */
export function buildEssMatch(
  host: string,
  matchId: number,
  shooters: EssShooter[],
  date: string,
  dqIds: Set<number> = new Set()
): ParsedMatch {
  const matchName =
    shooters.find((s) => s.matchName)?.matchName ?? `ESS Match ${matchId}`;

  // Union of stage numbers; paper rounds per stage = max(a+c+d+mi) seen, so
  // max_points = rounds×5 (same trick as the .psc parser's stageStats).
  const paperByStage = new Map<number, number>();
  const nsByStage = new Map<number, number>();
  for (const s of shooters) {
    for (const st of s.stages) {
      const rounds = st.a + st.c + st.d + st.mi;
      paperByStage.set(
        st.stageNo,
        Math.max(paperByStage.get(st.stageNo) ?? 0, rounds)
      );
      // No-shoot targets aren't on the verify page, but per-shooter NS hits are.
      // The most any shooter took is a lower-bound estimate of NS targets — at
      // least it reflects that the stage HAS no-shoots (not "turned off").
      nsByStage.set(
        st.stageNo,
        Math.max(nsByStage.get(st.stageNo) ?? 0, st.ns)
      );
    }
  }
  const stages: ParsedStage[] = [...paperByStage.keys()]
    .sort((a, b) => a - b)
    .map((stageNo) => ({
      stage_number: stageNo,
      name: `Stage ${stageNo}`,
      scoring_type: 'comstock' as const,
      number_of_targets: Math.ceil((paperByStage.get(stageNo) ?? 0) / 2),
      paper_target_rounds: undefined,
      number_of_steel: 0,
      number_of_no_shoots: nsByStage.get(stageNo) ?? 0,
    }));

  const entries: ParsedEntry[] = [];
  for (const s of shooters) {
    const dqed = dqIds.has(s.id);
    // Only stages actually shot (a time was recorded). Unshot stages read as
    // all-zero, 0.00 time → skip, leaving them as unscored placeholders.
    const scores: ParsedStageScore[] = s.stages
      .filter((st) => st.time > 0)
      .map((st) => ({
        stage_number: st.stageNo,
        alpha: st.a,
        charlie: st.c,
        delta: st.d,
        miss: st.mi,
        no_shoot: st.ns,
        procedural: st.pe,
        steel_hits: 0,
        steel_misses: 0,
        time: st.time,
        dqed,
      }));
    if (scores.length === 0) continue; // no scored stages → no entry
    entries.push({
      name: s.name,
      member_number: String(s.id),
      division: s.division,
      power_factor: s.powerFactor,
      categories: s.category ? [s.category] : [],
      classification: s.classification || null,
      scores,
    });
  }

  return {
    name: matchName,
    date,
    organization: 'PPSA',
    level: 'I',
    source_match_id: `ess:${host}:${matchId}`,
    stages,
    entries,
  };
}

export interface EssFetchResult {
  shooters: EssShooter[];
  scanned: number;
  matchName: string;
}

/**
 * Fetch verify pages for shooter ids 1,2,3… on a validated ESS host in parallel
 * batches (bounded `concurrency`), stopping after `stopAfterMisses` consecutive
 * not-found pages (tolerating id gaps) or a hard `cap`. Parallelism keeps a
 * several-hundred-shooter match well under proxy timeouts; each page has its own
 * timeout via fetchPageText.
 */
export async function fetchEssShooters(
  host: string,
  matchId: number,
  opts: {
    stopAfterMisses?: number;
    cap?: number;
    concurrency?: number;
    onProgress?: (found: number) => void;
  } = {}
): Promise<EssFetchResult> {
  const stopAfterMisses = opts.stopAfterMisses ?? 15;
  const cap = opts.cap ?? 800;
  const concurrency = opts.concurrency ?? 10;
  const shooters: EssShooter[] = [];
  let matchName = '';
  let consecutiveMisses = 0;
  let scanned = 0;

  for (let start = 1; start <= cap; start += concurrency) {
    const ids: number[] = [];
    for (let i = 0; i < concurrency && start + i <= cap; i++) ids.push(start + i);

    // Fetch this window of shooter ids in parallel.
    const parsedPages = await Promise.all(
      ids.map((id) =>
        fetchPageText(`https://${host}/portal/verify/${matchId}?shooter=${id}`)
          .then((html) => (html ? parseEssVerify(html) : null))
          .catch(() => null)
      )
    );

    // Process in id order so the consecutive-miss end-detection is preserved
    // (parallelism only over-scans by at most one window past the real end).
    let stop = false;
    for (let i = 0; i < parsedPages.length; i++) {
      scanned = ids[i];
      const parsed = parsedPages[i];
      if (parsed) {
        consecutiveMisses = 0;
        if (parsed.matchName) matchName = parsed.matchName;
        shooters.push(parsed);
      } else if (++consecutiveMisses >= stopAfterMisses) {
        stop = true;
        break;
      }
    }
    opts.onProgress?.(shooters.length);
    if (stop) break;
  }

  return { shooters, scanned, matchName };
}
