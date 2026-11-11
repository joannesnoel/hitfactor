import { describe, it, expect } from 'vitest';
import {
  canRegisterIntoMatch,
  canSeeJoinToken,
  canViewMatch,
  isJoinableStatus,
  redactMatch,
  visibleMatchesFor,
  accessFlagsFor,
  type MatchAccessFlags,
  type MatchMembership,
} from './match-visibility.js';

const none: MatchAccessFlags = {
  isGlobalAdmin: false,
  isHost: false,
  isMatchAdmin: false,
  isOfficer: false,
  isRegistered: false,
};
const empty = (): MatchMembership => ({
  adminOf: new Set(),
  officerOf: new Set(),
  registeredIn: new Set(),
});

const pub = { id: 'pub', is_private: false, created_by: 'host', join_token: null };
const priv = { id: 'priv', is_private: true, created_by: 'host', join_token: 'TOKEN' };

describe('canViewMatch', () => {
  it('lets anyone see a public match', () => {
    expect(canViewMatch(false, none)).toBe(true);
  });

  it('hides a private match from a stranger', () => {
    expect(canViewMatch(true, none)).toBe(false);
  });

  it.each(['isGlobalAdmin', 'isHost', 'isMatchAdmin', 'isOfficer', 'isRegistered'] as const)(
    'shows a private match to %s',
    (flag) => {
      expect(canViewMatch(true, { ...none, [flag]: true })).toBe(true);
    }
  );
});

describe('canSeeJoinToken', () => {
  it('is limited to global admin, host and match admin', () => {
    expect(canSeeJoinToken({ ...none, isGlobalAdmin: true })).toBe(true);
    expect(canSeeJoinToken({ ...none, isHost: true })).toBe(true);
    expect(canSeeJoinToken({ ...none, isMatchAdmin: true })).toBe(true);
    expect(canSeeJoinToken({ ...none, isOfficer: true })).toBe(false);
    expect(canSeeJoinToken({ ...none, isRegistered: true })).toBe(false);
    expect(canSeeJoinToken(none)).toBe(false);
  });
});

describe('redactMatch', () => {
  it('strips join_token unless the caller may see it', () => {
    expect(redactMatch(priv, { ...none, isRegistered: true }).join_token).toBeNull();
    expect(redactMatch(priv, { ...none, isHost: true }).join_token).toBe('TOKEN');
  });

  it('does not mutate the input', () => {
    redactMatch(priv, none);
    expect(priv.join_token).toBe('TOKEN');
  });
});

describe('accessFlagsFor', () => {
  it('treats only the creator of a private match as host', () => {
    expect(accessFlagsFor(priv, 'host', false, empty()).isHost).toBe(true);
    expect(accessFlagsFor(priv, 'other', false, empty()).isHost).toBe(false);
    expect(accessFlagsFor(pub, 'host', false, empty()).isHost).toBe(false);
  });
});

describe('visibleMatchesFor', () => {
  const all = [pub, priv];

  it('gives a stranger only public matches', () => {
    expect(visibleMatchesFor(all, 'stranger', false, empty()).map((m) => m.id)).toEqual(['pub']);
  });

  it('gives the host their private match, with its token', () => {
    const out = visibleMatchesFor(all, 'host', false, empty());
    expect(out.map((m) => m.id)).toEqual(['pub', 'priv']);
    expect(out[1].join_token).toBe('TOKEN');
  });

  it('gives a registered shooter the private match but without the token', () => {
    const m = empty();
    m.registeredIn.add('priv');
    const out = visibleMatchesFor(all, 'shooter', false, m);
    expect(out.map((x) => x.id)).toEqual(['pub', 'priv']);
    expect(out[1].join_token).toBeNull();
  });

  it('gives an officer the private match without the token', () => {
    const m = empty();
    m.officerOf.add('priv');
    const out = visibleMatchesFor(all, 'officer', false, m);
    expect(out[1].join_token).toBeNull();
  });

  it('gives a match admin the private match with the token', () => {
    const m = empty();
    m.adminOf.add('priv');
    expect(visibleMatchesFor(all, 'ma', false, m)[1].join_token).toBe('TOKEN');
  });

  it('gives a global admin everything with tokens', () => {
    const out = visibleMatchesFor(all, 'admin', true, empty());
    expect(out.map((m) => m.id)).toEqual(['pub', 'priv']);
    expect(out[1].join_token).toBe('TOKEN');
  });
});

describe('isJoinableStatus', () => {
  it('allows registration, active and scoring only', () => {
    for (const s of ['registration', 'active', 'scoring']) {
      expect(isJoinableStatus(s)).toBe(true);
    }
    for (const s of ['draft', 'final', 'archived', 'bogus']) {
      expect(isJoinableStatus(s)).toBe(false);
    }
  });
});

describe('canRegisterIntoMatch', () => {
  it('lets anyone self-register in a public match', () => {
    expect(canRegisterIntoMatch(false, false)).toBe(true);
    expect(canRegisterIntoMatch(false, true)).toBe(true);
  });

  it('blocks a stranger from a private match', () => {
    expect(canRegisterIntoMatch(true, false)).toBe(false);
  });

  it('lets an admin or the host add people to a private match', () => {
    expect(canRegisterIntoMatch(true, true)).toBe(true);
  });
});
