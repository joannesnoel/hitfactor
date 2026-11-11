// Pure (no DB) rules for who may see a match and its invite token. Kept
// separate from match-authz.ts so they can be unit-tested without a database.

/** A user's relationship to one match. */
export interface MatchAccessFlags {
  isGlobalAdmin: boolean;
  isHost: boolean;
  isMatchAdmin: boolean;
  isOfficer: boolean;
  isRegistered: boolean;
}

/** The match ids a user admins / officiates / is registered in. */
export interface MatchMembership {
  adminOf: Set<string>;
  officerOf: Set<string>;
  registeredIn: Set<string>;
}

interface VisibleMatchFields {
  id: string;
  is_private: boolean;
  created_by: string;
  join_token: string | null;
}

/** Statuses in which a shooter may still join via an invite link. */
export const JOINABLE_MATCH_STATUSES = ['registration', 'active', 'scoring'] as const;

export function isJoinableStatus(status: string): boolean {
  return (JOINABLE_MATCH_STATUSES as readonly string[]).includes(status);
}

/** Public matches are visible to everyone; private ones only to people involved. */
export function canViewMatch(isPrivate: boolean, f: MatchAccessFlags): boolean {
  return (
    !isPrivate ||
    f.isGlobalAdmin ||
    f.isHost ||
    f.isMatchAdmin ||
    f.isOfficer ||
    f.isRegistered
  );
}

/**
 * Whether a caller may use the direct registration endpoint on a match: anyone
 * for a public match, but only an admin/host (`isAdminOrHost`) for a private one
 * — strangers must join a private match through its invite token.
 */
export function canRegisterIntoMatch(
  isPrivate: boolean,
  isAdminOrHost: boolean
): boolean {
  return !isPrivate || isAdminOrHost;
}

/** The invite token is only for the people who run the match. */
export function canSeeJoinToken(f: MatchAccessFlags): boolean {
  return f.isGlobalAdmin || f.isHost || f.isMatchAdmin;
}

export function accessFlagsFor(
  match: VisibleMatchFields,
  userId: string,
  isGlobalAdmin: boolean,
  membership: MatchMembership
): MatchAccessFlags {
  return {
    isGlobalAdmin,
    // Same definition as isMatchHost: creator of a private match.
    isHost: match.is_private && match.created_by === userId,
    isMatchAdmin: membership.adminOf.has(match.id),
    isOfficer: membership.officerOf.has(match.id),
    isRegistered: membership.registeredIn.has(match.id),
  };
}

/** Returns the match as the caller may see it (join_token removed unless allowed). */
export function redactMatch<T extends VisibleMatchFields>(
  match: T,
  f: MatchAccessFlags
): T {
  return canSeeJoinToken(f) ? match : { ...match, join_token: null };
}

/** Filters a match list down to what the caller may see, redacting tokens. */
export function visibleMatchesFor<T extends VisibleMatchFields>(
  all: T[],
  userId: string,
  isGlobalAdmin: boolean,
  membership: MatchMembership
): T[] {
  const out: T[] = [];
  for (const m of all) {
    const f = accessFlagsFor(m, userId, isGlobalAdmin, membership);
    if (canViewMatch(m.is_private, f)) out.push(redactMatch(m, f));
  }
  return out;
}
