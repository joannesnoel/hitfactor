import { eq, and, isNull } from 'drizzle-orm';
import {
  computeScore,
  divisionFromPractiscore,
  isValidDivisionForOrg,
  DEFAULT_ORGANIZATION,
} from '@hitfactor/shared';
import type {
  Organization,
  PowerFactor,
  ScoringType,
} from '@hitfactor/shared';
import { db } from '../../config/database.js';
import {
  matches,
  matchAdmins,
  stages,
  registrations,
  scores,
  users,
} from '../../db/schema.js';
import { recomputeMatchResults } from '../results/results.controller.js';
import { normalizeShooterName, cleanDisplayName } from './shooter-identity.js';
import type { ParsedMatch, ParsedEntry, ImportSummary } from './types.js';

class DryRunRollback extends Error {}

function normalizePowerFactor(raw: string): PowerFactor {
  return raw.trim().toLowerCase().startsWith('maj') ? 'Major' : 'Minor';
}

/** Build a per-target rounds array summing to `total` (2 per target, remainder
 *  on the last), when the source didn't provide explicit target rounds. */
function buildRoundsArray(numTargets: number, total: number): number[] {
  if (numTargets <= 0) return [];
  const arr = Array<number>(numTargets).fill(2);
  arr[numTargets - 1] += total - 2 * numTargets;
  if (arr[numTargets - 1] < 0) arr[numTargets - 1] = 0;
  return arr;
}

/**
 * Idempotent, transactional import of one parsed match. Upserts the match +
 * stages, resolves each entry to a persistent (unclaimed) shooter by normalized
 * name, upserts per-division registrations, and upserts per-stage scores
 * (computing hit factor when a time is present). Re-running with the same data
 * leaves row counts unchanged. Pass { dryRun: true } to preview (rolls back).
 */
export async function importMatch(
  parsed: ParsedMatch,
  adminUserId: string,
  opts: { dryRun?: boolean } = {}
): Promise<ImportSummary> {
  const org: Organization = parsed.organization ?? DEFAULT_ORGANIZATION;
  const summary: ImportSummary = {
    match: parsed.name,
    matchCreated: false,
    stages: 0,
    shootersCreated: 0,
    shootersMatched: 0,
    registrations: 0,
    scores: 0,
    scored: 0,
    warnings: [],
    dryRun: Boolean(opts.dryRun),
  };
  let capturedMatchId: string | null = null;

  // Per-stage max paper/steel round counts, used to derive stage config when the
  // source doesn't carry it (hits-only sheets).
  const stageStats = new Map<number, { paper: number; steel: number }>();
  for (const e of parsed.entries) {
    for (const s of e.scores) {
      const paper = s.alpha + s.charlie + s.delta + s.miss;
      const steel = s.steel_hits + s.steel_misses;
      const cur = stageStats.get(s.stage_number) ?? { paper: 0, steel: 0 };
      cur.paper = Math.max(cur.paper, paper);
      cur.steel = Math.max(cur.steel, steel);
      stageStats.set(s.stage_number, cur);
    }
  }

  try {
    await db.transaction(async (tx) => {
      // ── Match ──────────────────────────────────────────────────────────────
      const [existingMatch] = await tx
        .select({ id: matches.id })
        .from(matches)
        .where(
          and(eq(matches.name, parsed.name), eq(matches.start_date, parsed.date))
        )
        .limit(1);

      let matchId: string;
      if (existingMatch) {
        matchId = existingMatch.id;
      } else {
        const [m] = await tx
          .insert(matches)
          .values({
            name: parsed.name,
            start_date: parsed.date,
            end_date: parsed.date,
            location: parsed.location ?? 'Unknown',
            level: parsed.level ?? 'I',
            organization: org,
            status: 'final',
            created_by: adminUserId,
            registration_open: false,
          })
          .returning({ id: matches.id });
        matchId = m.id;
        summary.matchCreated = true;
      }

      // The importing admin administers the match, so its results sync to them
      // (PowerSync admin_match_data bucket keys off match_admins).
      await tx
        .insert(matchAdmins)
        .values({ match_id: matchId, user_id: adminUserId })
        .onConflictDoNothing();
      capturedMatchId = matchId;

      // ── Stages ─────────────────────────────────────────────────────────────
      const stageIdByNumber = new Map<number, string>();
      const scoringTypeByNumber = new Map<number, ScoringType>();
      for (const ps of parsed.stages) {
        const stats = stageStats.get(ps.stage_number) ?? { paper: 0, steel: 0 };
        const paperRounds = ps.paper_target_rounds
          ? ps.paper_target_rounds.reduce((a, b) => a + b, 0)
          : ps.number_of_targets
            ? ps.number_of_targets * 2
            : stats.paper;
        const numTargets = ps.number_of_targets ?? Math.ceil(paperRounds / 2);
        const paperTargetRounds =
          ps.paper_target_rounds ?? buildRoundsArray(numTargets, paperRounds);
        const numSteel = ps.number_of_steel ?? stats.steel;
        const scoringType: ScoringType = ps.scoring_type ?? 'comstock';
        scoringTypeByNumber.set(ps.stage_number, scoringType);

        const [existingStage] = await tx
          .select({ id: stages.id })
          .from(stages)
          .where(
            and(
              eq(stages.match_id, matchId),
              eq(stages.stage_number, ps.stage_number)
            )
          )
          .limit(1);

        if (existingStage) {
          stageIdByNumber.set(ps.stage_number, existingStage.id);
        } else {
          const [st] = await tx
            .insert(stages)
            .values({
              match_id: matchId,
              stage_number: ps.stage_number,
              name: ps.name,
              scoring_type: scoringType,
              min_rounds: paperRounds + numSteel,
              max_points: paperRounds * 5 + numSteel * 5,
              number_of_targets: numTargets,
              number_of_steel: numSteel,
              number_of_no_shoots: ps.number_of_no_shoots ?? 0,
              paper_target_rounds: paperTargetRounds,
            })
            .returning({ id: stages.id });
          stageIdByNumber.set(ps.stage_number, st.id);
          summary.stages++;
        }
      }

      // ── Entries → shooters, registrations, scores ─────────────────────────
      const shooterCache = new Map<string, string>(); // normalized name → user id

      const resolveShooter = async (entry: ParsedEntry): Promise<string> => {
        const norm = normalizeShooterName(entry.name);
        const cached = shooterCache.get(norm);
        if (cached) return cached;

        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.normalized_name, norm))
          .limit(1);
        if (existing) {
          shooterCache.set(norm, existing.id);
          summary.shootersMatched++;
          return existing.id;
        }

        const [created] = await tx
          .insert(users)
          .values({
            display_name: cleanDisplayName(entry.name),
            normalized_name: norm,
            member_number: entry.member_number ?? null,
            email: null,
            password_hash: null,
            claimed: false,
            roles: ['shooter'],
          })
          .returning({ id: users.id });
        shooterCache.set(norm, created.id);
        summary.shootersCreated++;
        return created.id;
      };

      for (const entry of parsed.entries) {
        const division = divisionFromPractiscore(entry.division);
        if (!division || !isValidDivisionForOrg(org, division)) {
          summary.warnings.push(
            `Unknown division "${entry.division}" for ${entry.name} — entry skipped`
          );
          continue;
        }
        const pf = normalizePowerFactor(entry.power_factor);
        const userId = await resolveShooter(entry);
        const shooterName = cleanDisplayName(entry.name);

        // Registration — one per entry. A shooter may have several in the same
        // division (distinct member numbers), so dedupe includes member_number.
        const memberNumber = entry.member_number ?? null;
        const [existingReg] = await tx
          .select({ id: registrations.id })
          .from(registrations)
          .where(
            and(
              eq(registrations.match_id, matchId),
              eq(registrations.user_id, userId),
              eq(registrations.division, division),
              memberNumber === null
                ? isNull(registrations.member_number)
                : eq(registrations.member_number, memberNumber)
            )
          )
          .limit(1);

        let registrationId: string;
        if (existingReg) {
          registrationId = existingReg.id;
        } else {
          const [reg] = await tx
            .insert(registrations)
            .values({
              match_id: matchId,
              user_id: userId,
              shooter_name: shooterName,
              member_number: entry.member_number ?? null,
              division,
              power_factor: pf,
              classification: entry.classification ?? null,
            })
            .returning({ id: registrations.id });
          registrationId = reg.id;
          summary.registrations++;
        }

        // Scores (one per stage).
        for (const sc of entry.scores) {
          const stageId = stageIdByNumber.get(sc.stage_number);
          if (!stageId) {
            summary.warnings.push(
              `Stage ${sc.stage_number} not defined — score skipped for ${entry.name}`
            );
            continue;
          }
          const hasTime = sc.time != null && sc.time > 0;
          const scoringType =
            scoringTypeByNumber.get(sc.stage_number) ?? 'comstock';
          const computed = computeScore(
            {
              alpha_count: sc.alpha,
              charlie_count: sc.charlie,
              delta_count: sc.delta,
              miss_count: sc.miss,
              no_shoot_count: sc.no_shoot,
              procedural_count: sc.procedural,
              steel_hits: sc.steel_hits,
              steel_misses: sc.steel_misses,
              time: sc.time ?? 0,
              power_factor: pf,
              dqed: sc.dqed ?? false,
              dnf: sc.dnf ?? false,
            },
            scoringType
          );

          const row = {
            alpha_count: sc.alpha,
            charlie_count: sc.charlie,
            delta_count: sc.delta,
            miss_count: sc.miss,
            no_shoot_count: sc.no_shoot,
            procedural_count: sc.procedural,
            steel_hits: sc.steel_hits,
            steel_misses: sc.steel_misses,
            time: (sc.time ?? 0).toFixed(2),
            raw_points: computed.raw_points,
            penalty_points: computed.penalty_points,
            total_points: computed.total_points,
            hit_factor: computed.hit_factor.toFixed(4),
            dqed: sc.dqed ?? false,
            dnf: sc.dnf ?? false,
          };

          await tx
            .insert(scores)
            .values({
              match_id: matchId,
              stage_id: stageId,
              registration_id: registrationId,
              shooter_name: shooterName,
              division,
              power_factor: pf,
              scored_by: adminUserId,
              verified: true,
              ...row,
            })
            .onConflictDoUpdate({
              target: [scores.stage_id, scores.registration_id],
              set: { ...row, modified_at: new Date(), modified_by: adminUserId },
            });
          summary.scores++;
          if (hasTime) summary.scored++;
        }
      }

      if (opts.dryRun) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  // Compute standings (stage_results + match_results) from the imported scores.
  if (!opts.dryRun && capturedMatchId) {
    await recomputeMatchResults(capturedMatchId);
  }

  return summary;
}
