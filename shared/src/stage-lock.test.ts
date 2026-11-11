import { describe, it, expect } from 'vitest';
import { changedLockedStageFields, defaultStageName } from './stage-lock.js';
import { createStageSchema } from './validation.js';

const existing = {
  number_of_targets: 5,
  number_of_steel: 2,
  number_of_no_shoots: 1,
  paper_target_rounds: [2, 2, 2, 2, 2],
  scoring_type: 'comstock',
  fixed_time: null,
};

describe('changedLockedStageFields', () => {
  it('ignores an edit that changes nothing locked (form sends every field)', () => {
    expect(changedLockedStageFields(existing, { ...existing })).toEqual([]);
  });

  it('only looks at fields present in the patch', () => {
    expect(changedLockedStageFields(existing, {})).toEqual([]);
    expect(changedLockedStageFields(existing, { number_of_steel: 2 })).toEqual([]);
  });

  it('flags changed target, steel, no-shoot counts and scoring type', () => {
    expect(changedLockedStageFields(existing, { number_of_targets: 6 })).toContain('number_of_targets');
    expect(changedLockedStageFields(existing, { number_of_steel: 3 })).toEqual(['number_of_steel']);
    expect(changedLockedStageFields(existing, { number_of_no_shoots: 0 })).toEqual(['number_of_no_shoots']);
    expect(changedLockedStageFields(existing, { scoring_type: 'virginia_count' })).toEqual(['scoring_type']);
  });

  it('flags changed rounds per target', () => {
    expect(
      changedLockedStageFields(existing, { paper_target_rounds: [2, 2, 3, 2, 2] }),
    ).toEqual(['paper_target_rounds']);
  });

  it('treats a stored JSON string and an unset default as the same rounds', () => {
    expect(
      changedLockedStageFields(
        { ...existing, paper_target_rounds: '[2,2,2,2,2]' },
        { paper_target_rounds: [2, 2, 2, 2, 2] },
      ),
    ).toEqual([]);
    expect(
      changedLockedStageFields(
        { ...existing, paper_target_rounds: null },
        { paper_target_rounds: [2, 2, 2, 2, 2] },
      ),
    ).toEqual([]);
  });

  it('compares fixed time numerically (Postgres numeric comes back as a string)', () => {
    const ft = { ...existing, scoring_type: 'fixed_time', fixed_time: '12.50' };
    expect(changedLockedStageFields(ft, { fixed_time: 12.5 })).toEqual([]);
    expect(changedLockedStageFields(ft, { fixed_time: 13 })).toEqual(['fixed_time']);
  });
});

describe('stage name is optional', () => {
  const base = {
    stage_number: 3,
    scoring_type: 'comstock',
    number_of_targets: 5,
    number_of_steel: 0,
    number_of_no_shoots: 0,
  };

  it('accepts a stage without a name', () => {
    expect(createStageSchema.safeParse(base).success).toBe(true);
  });

  it('still accepts a name when one is given (imports, old clients)', () => {
    expect(createStageSchema.safeParse({ ...base, name: 'Shootin Steel' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(createStageSchema.safeParse({ ...base, name: '' }).success).toBe(false);
  });

  it('defaults the stored name to "Stage N"', () => {
    expect(defaultStageName(3)).toBe('Stage 3');
  });
});
