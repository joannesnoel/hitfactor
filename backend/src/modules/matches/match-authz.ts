import { eq, and } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { matches, matchAdmins, matchOfficers, registrations } from '../../db/schema.js';
import type { MatchMembership } from './match-visibility.js';

/**
 * Whether a user is the HOST of a shooter-created private match — i.e. they
 * created it and it is private. The host is the sole authority over their own
 * private match (setup, invites, scoring); this is deliberately separate from
 * the admin/officer machinery used by public, admin-created matches, and grants
 * nothing on public matches even to their creator.
 */
export async function isMatchHost(
  matchId: string,
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.id, matchId),
        eq(matches.created_by, userId),
        eq(matches.is_private, true)
      )
    )
    .limit(1);
  return !!row;
}

/**
 * The matches a user admins, officiates, or is registered in — for the match
 * visibility rules. Pass `matchId` to look at a single match.
 */
export async function loadMatchMembership(
  userId: string,
  matchId?: string
): Promise<MatchMembership> {
  const [admins, officers, regs] = await Promise.all([
    db
      .select({ id: matchAdmins.match_id })
      .from(matchAdmins)
      .where(
        and(
          eq(matchAdmins.user_id, userId),
          matchId ? eq(matchAdmins.match_id, matchId) : undefined
        )
      ),
    db
      .select({ id: matchOfficers.match_id })
      .from(matchOfficers)
      .where(
        and(
          eq(matchOfficers.user_id, userId),
          matchId ? eq(matchOfficers.match_id, matchId) : undefined
        )
      ),
    db
      .select({ id: registrations.match_id })
      .from(registrations)
      .where(
        and(
          eq(registrations.user_id, userId),
          matchId ? eq(registrations.match_id, matchId) : undefined
        )
      ),
  ]);
  return {
    adminOf: new Set(admins.map((r) => r.id)),
    officerOf: new Set(officers.map((r) => r.id)),
    registeredIn: new Set(regs.map((r) => r.id)),
  };
}
