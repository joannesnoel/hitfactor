// Pure rules for the host-managed "scorers" of a private match. A scorer is a
// shooter registered in the match whom the host lets enter scores. They are
// stored as a match-level Score Processing Officer (SPO): that role may score
// every stage (including ones added later) but cannot re-enable locked scores
// (that stays MA/MM/host), and the host can't hand out admin-level roles here.

export const SCORER_ROLE = 'SPO';

export interface ScorerCandidate {
  isRegistered: boolean;
  /** Has a real login (a password), i.e. isn't an unclaimed imported/manual shooter. */
  canLogin: boolean;
  isHost: boolean;
}

export interface ScorerRejection {
  status: number;
  message: string;
}

/** Returns null when the user may be made a scorer, otherwise why not. */
export function checkScorerCandidate(c: ScorerCandidate): ScorerRejection | null {
  if (c.isHost) {
    return { status: 400, message: 'The host can already score this match' };
  }
  if (!c.isRegistered) {
    return { status: 400, message: 'Only shooters registered in this match can be scorers' };
  }
  if (!c.canLogin) {
    return {
      status: 400,
      message: 'This shooter has no login yet, so they cannot score',
    };
  }
  return null;
}
