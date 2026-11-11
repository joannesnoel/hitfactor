import { describe, it, expect } from 'vitest';
import { checkScorerCandidate, SCORER_ROLE } from './match-scorers.js';
import { MATCH_LEVEL_OFFICIAL_ROLES } from '@hitfactor/shared';

const ok = { isRegistered: true, canLogin: true, isHost: false };

describe('checkScorerCandidate', () => {
  it('accepts a registered shooter with a login', () => {
    expect(checkScorerCandidate(ok)).toBeNull();
  });

  it('rejects someone not registered in the match', () => {
    expect(checkScorerCandidate({ ...ok, isRegistered: false })?.status).toBe(400);
  });

  it('rejects an unclaimed shooter with no login', () => {
    expect(checkScorerCandidate({ ...ok, canLogin: false })?.message).toMatch(/no login/);
  });

  it('rejects the host (already has authority)', () => {
    expect(checkScorerCandidate({ ...ok, isHost: true })?.message).toMatch(/host/);
  });
});

describe('SCORER_ROLE', () => {
  it('is a match-level role that is not an unlock/admin role', () => {
    expect(MATCH_LEVEL_OFFICIAL_ROLES as readonly string[]).toContain(SCORER_ROLE);
    expect(['MA', 'MM']).not.toContain(SCORER_ROLE);
  });
});
