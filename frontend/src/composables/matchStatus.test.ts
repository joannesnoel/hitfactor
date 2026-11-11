import { describe, it, expect } from 'vitest';
import { isUpcomingMatch, sortYourMatches } from './matchStatus';

const today = '2026-11-11';
const m = (name: string, start_date: string, status: string, end_date: string | null = null) => ({
  name,
  start_date,
  end_date,
  status,
});

describe('isUpcomingMatch', () => {
  it('counts today and future matches', () => {
    expect(isUpcomingMatch(m('a', '2026-11-11', 'active'), today)).toBe(true);
    expect(isUpcomingMatch(m('a', '2026-11-14', 'registration'), today)).toBe(true);
  });

  it('counts a multi-day match until its last day', () => {
    expect(isUpcomingMatch(m('a', '2026-11-10', 'active', '2026-11-12'), today)).toBe(true);
    expect(isUpcomingMatch(m('a', '2026-11-08', 'active', '2026-11-09'), today)).toBe(false);
  });

  it('does not count a past match even if it is still on "scoring"', () => {
    expect(isUpcomingMatch(m('a', '2026-08-22', 'scoring'), today)).toBe(false);
  });

  it('does not count a finished or archived match, even a future-dated one', () => {
    expect(isUpcomingMatch(m('a', '2026-11-14', 'final'), today)).toBe(false);
    expect(isUpcomingMatch(m('a', '2026-11-14', 'archived'), today)).toBe(false);
  });
});

describe('sortYourMatches', () => {
  it('puts upcoming first (soonest first) then past (newest first)', () => {
    const out = sortYourMatches(
      [
        m('Scoring Dry Run', '2026-08-22', 'scoring'),
        m('Christmas Album', '2026-11-14', 'active'),
        m('Next week', '2026-11-18', 'registration'),
        m('Older', '2026-07-01', 'final'),
        m('Today', '2026-11-11', 'active'),
      ],
      today,
    );
    expect(out.map((x) => x.name)).toEqual([
      'Today',
      'Christmas Album',
      'Next week',
      'Scoring Dry Run',
      'Older',
    ]);
  });
});
