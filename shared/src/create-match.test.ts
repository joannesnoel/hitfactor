import { describe, it, expect } from 'vitest';
import { createMatchSchema } from './validation.js';

const base = {
  name: 'Sunday Steel',
  start_date: '2026-11-15',
  location: 'Home range',
  level: 'I',
  organization: 'PPSA',
};

describe('createMatchSchema', () => {
  it('accepts the hosted flag the "Host a match" flow sends', () => {
    const r = createMatchSchema.safeParse({ ...base, is_private: true, hosted: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.hosted).toBe(true);
  });

  it('leaves hosted unset for admin-created matches', () => {
    const r = createMatchSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.hosted).toBeUndefined();
  });

  it('requires both division and power factor when the host participates', () => {
    const hosted = { ...base, is_private: true, hosted: true };
    expect(
      createMatchSchema.safeParse({
        ...hosted,
        participate: { division: 'production', power_factor: 'Minor' },
      }).success,
    ).toBe(true);
    expect(createMatchSchema.safeParse({ ...hosted, participate: { division: 'production' } }).success).toBe(false);
    expect(createMatchSchema.safeParse({ ...hosted, participate: { power_factor: 'Minor' } }).success).toBe(false);
    expect(
      createMatchSchema.safeParse({ ...hosted, participate: { division: '', power_factor: 'Minor' } }).success,
    ).toBe(false);
  });
});
