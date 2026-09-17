import { eq, and } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { matches } from '../../db/schema.js';

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
