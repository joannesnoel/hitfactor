import { describe, it, expect } from 'vitest';
import { pickBackTarget } from './useGoBack';

describe('pickBackTarget', () => {
  it('uses history when the previous page is an app screen', () => {
    expect(pickBackTarget('/dashboard', '/matches/abc')).toBe('history');
    expect(pickBackTarget('/host/matches/abc', '/matches/abc')).toBe('history');
  });

  it('falls back when the page was opened directly (no previous entry)', () => {
    expect(pickBackTarget(null, '/matches/abc')).toBe('fallback');
    expect(pickBackTarget(undefined, '/matches/abc')).toBe('fallback');
    expect(pickBackTarget('', '/matches/abc')).toBe('fallback');
  });

  it('falls back instead of returning to login/register/join (redirect loops)', () => {
    expect(pickBackTarget('/auth/login', '/matches/abc')).toBe('fallback');
    expect(pickBackTarget('/auth/register?redirect=%2Fjoin%2Fx', '/matches/abc')).toBe('fallback');
    expect(pickBackTarget('/join/aB3_x-9Qz12k', '/matches/abc')).toBe('fallback');
  });

  it('falls back when the previous entry is the same page', () => {
    expect(pickBackTarget('/matches/abc', '/matches/abc')).toBe('fallback');
  });
});
