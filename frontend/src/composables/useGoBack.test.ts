import { describe, it, expect } from 'vitest';
import { pickBackTarget } from './useGoBack';

describe('pickBackTarget', () => {
  it('uses history when the previous page is an app screen', () => {
    expect(pickBackTarget('/shooter/dashboard', '/shooter/matches/abc')).toBe('history');
    expect(pickBackTarget('/shooter/host/matches/abc', '/shooter/matches/abc')).toBe('history');
  });

  it('falls back when the page was opened directly (no previous entry)', () => {
    expect(pickBackTarget(null, '/shooter/matches/abc')).toBe('fallback');
    expect(pickBackTarget(undefined, '/shooter/matches/abc')).toBe('fallback');
    expect(pickBackTarget('', '/shooter/matches/abc')).toBe('fallback');
  });

  it('falls back instead of returning to login/register/join (redirect loops)', () => {
    expect(pickBackTarget('/auth/login', '/shooter/matches/abc')).toBe('fallback');
    expect(pickBackTarget('/auth/register?redirect=%2Fjoin%2Fx', '/shooter/matches/abc')).toBe('fallback');
    expect(pickBackTarget('/join/aB3_x-9Qz12k', '/shooter/matches/abc')).toBe('fallback');
  });

  it('falls back when the previous entry is the same page', () => {
    expect(pickBackTarget('/shooter/matches/abc', '/shooter/matches/abc')).toBe('fallback');
  });
});
