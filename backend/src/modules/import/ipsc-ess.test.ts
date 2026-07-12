import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeScore } from '@hitfactor/shared';
import { parseEssVerify, buildEssMatch } from './ipsc-ess.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string =>
  readFileSync(join(here, '__fixtures__', name), 'utf8');

describe('parseEssVerify', () => {
  it('parses a scored Major shooter (LOPEZ, LEVI / Standard)', () => {
    const s = parseEssVerify(fixture('ess-verify-5.html'));
    expect(s).not.toBeNull();
    expect(s!.id).toBe(5);
    expect(s!.name).toBe('LOPEZ, LEVI');
    expect(s!.division).toBe('Standard');
    expect(s!.classification).toBe('U');
    expect(s!.powerFactor).toBe('Major');
    expect(s!.category).toBe('Senior');
    expect(s!.matchName).toBe("CAC N' LOAD: SHOOT FOR A CAUSE HG");
    expect(s!.stages).toHaveLength(6);
    const st1 = s!.stages[0];
    expect(st1).toMatchObject({
      stageNo: 1,
      factor: 4.4043,
      pts: 156,
      a: 28,
      c: 4,
      d: 0,
      mi: 0,
      ns: 0,
      pe: 0,
      time: 35.42,
    });
  });

  it('reproduces the ESS Major FACTOR/PTS with computeScore', () => {
    const st1 = parseEssVerify(fixture('ess-verify-5.html'))!.stages[0];
    const computed = computeScore(
      {
        alpha_count: st1.a,
        charlie_count: st1.c,
        delta_count: st1.d,
        miss_count: st1.mi,
        no_shoot_count: st1.ns,
        procedural_count: st1.pe,
        steel_hits: 0,
        steel_misses: 0,
        time: st1.time,
        power_factor: 'Major',
      },
      'comstock'
    );
    expect(computed.total_points).toBe(st1.pts); // 156
    expect(computed.hit_factor).toBeCloseTo(st1.factor, 4); // 4.4043
  });

  it('reproduces the ESS Minor FACTOR/PTS (with a miss penalty)', () => {
    const s = parseEssVerify(fixture('ess-verify-40.html'))!;
    expect(s.division).toBe('Classic');
    expect(s.powerFactor).toBe('Minor');
    expect(s.category).toBe('S. Senior');
    const st1 = s.stages[0]; // a16 c7 d1 mi8, t37.25 → 22 pts, HF 0.5906
    const computed = computeScore(
      {
        alpha_count: st1.a,
        charlie_count: st1.c,
        delta_count: st1.d,
        miss_count: st1.mi,
        no_shoot_count: st1.ns,
        procedural_count: st1.pe,
        steel_hits: 0,
        steel_misses: 0,
        time: st1.time,
        power_factor: 'Minor',
      },
      'comstock'
    );
    expect(computed.total_points).toBe(st1.pts); // 22
    expect(computed.hit_factor).toBeCloseTo(st1.factor, 4); // 0.5906
  });

  it('parses an all-zero no-show shooter (still returns the block)', () => {
    const s = parseEssVerify(fixture('ess-verify-1.html'));
    expect(s).not.toBeNull();
    expect(s!.id).toBe(1);
    expect(s!.name).toBe('MARAVILLAS, DENNIS');
    expect(s!.stages.every((st) => st.time === 0)).toBe(true);
  });

  it('returns null for a "Shooter not found" page (end of list)', () => {
    expect(parseEssVerify(fixture('ess-verify-notfound.html'))).toBeNull();
  });
});

describe('buildEssMatch', () => {
  it('drops no-show shooters and keeps only scored stages', () => {
    const scored = parseEssVerify(fixture('ess-verify-5.html'))!;
    const noShow = parseEssVerify(fixture('ess-verify-1.html'))!;
    const match = buildEssMatch('phicvi.as.ipscess.org', 29, [scored, noShow], '2026-07-12');

    expect(match.organization).toBe('PPSA');
    expect(match.source_match_id).toBe('ess:phicvi.as.ipscess.org:29');
    expect(match.name).toBe("CAC N' LOAD: SHOOT FOR A CAUSE HG");
    // 6 stage columns exist across shooters
    expect(match.stages.map((s) => s.stage_number)).toEqual([1, 2, 3, 4, 5, 6]);

    // no-show shooter #1 produces no entry; #5 shot stages 1-4 only
    expect(match.entries).toHaveLength(1);
    const entry = match.entries[0];
    expect(entry.member_number).toBe('5');
    expect(entry.division).toBe('Standard');
    expect(entry.power_factor).toBe('Major');
    expect(entry.scores.map((s) => s.stage_number)).toEqual([1, 2, 3, 4]);
    expect(entry.scores[0]).toMatchObject({
      stage_number: 1,
      alpha: 28,
      charlie: 4,
      steel_hits: 0,
      steel_misses: 0,
      time: 35.42,
    });
  });
});
