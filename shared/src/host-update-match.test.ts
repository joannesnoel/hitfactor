import { describe, it, expect } from 'vitest';
import { hostUpdateMatchSchema } from './validation.js';

describe('hostUpdateMatchSchema', () => {
  it('accepts the fields a host may edit', () => {
    const r = hostUpdateMatchSchema.safeParse({
      name: 'Tuesday night',
      location: 'Range 2',
      start_date: '2026-11-12',
      description: 'casual',
      max_shooters: 30,
      registration_open: false,
      status: 'scoring',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a partial update', () => {
    expect(hostUpdateMatchSchema.safeParse({ registration_open: true }).success).toBe(true);
    expect(hostUpdateMatchSchema.safeParse({}).success).toBe(true);
  });

  it.each([
    ['is_private', { is_private: false }],
    ['level', { level: 'III' }],
    ['organization', { organization: 'PPSA' }],
    ['created_by', { created_by: '00000000-0000-0000-0000-000000000000' }],
    ['join_token', { join_token: 'x' }],
  ])('rejects %s', (_k, body) => {
    expect(hostUpdateMatchSchema.safeParse(body).success).toBe(false);
  });

  it('rejects statuses outside the safe subset', () => {
    expect(hostUpdateMatchSchema.safeParse({ status: 'draft' }).success).toBe(false);
    expect(hostUpdateMatchSchema.safeParse({ status: 'archived' }).success).toBe(false);
    expect(hostUpdateMatchSchema.safeParse({ status: 'final' }).success).toBe(true);
  });
});
