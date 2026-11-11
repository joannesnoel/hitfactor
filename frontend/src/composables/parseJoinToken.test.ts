import { describe, it, expect } from 'vitest';
import { parseJoinToken } from './parseJoinToken';

describe('parseJoinToken', () => {
  it('reads the token from a full invite link', () => {
    expect(parseJoinToken('https://hitfactor.net/join/aB3_x-9Qz12k')).toBe('aB3_x-9Qz12k');
    expect(parseJoinToken('https://staging.hitfactor.net/join/aB3_x-9Qz12k/')).toBe('aB3_x-9Qz12k');
  });

  it('accepts a bare code and trims whitespace', () => {
    expect(parseJoinToken('  aB3_x-9Qz12k\n')).toBe('aB3_x-9Qz12k');
  });

  it('rejects other URLs and non-invite paths', () => {
    expect(parseJoinToken('https://evil.example/login')).toBeNull();
    expect(parseJoinToken('https://hitfactor.net/shooter/dashboard')).toBeNull();
    expect(parseJoinToken('https://hitfactor.net/join/')).toBeNull();
    expect(parseJoinToken('https://hitfactor.net/join/a/b')).toBeNull();
  });

  it('rejects junk, too-short and unsafe tokens', () => {
    expect(parseJoinToken('')).toBeNull();
    expect(parseJoinToken('abc')).toBeNull();
    expect(parseJoinToken('hello world!')).toBeNull();
    expect(parseJoinToken('../../etc/passwd')).toBeNull();
    expect(parseJoinToken('javascript:alert(1)')).toBeNull();
  });
});
