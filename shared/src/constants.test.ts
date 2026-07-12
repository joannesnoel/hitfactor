import { describe, it, expect } from 'vitest';
import { divisionFromPractiscore, isValidDivisionForOrg } from './constants.js';

describe('divisionFromPractiscore — IPSC ESS division strings', () => {
  it('maps the PCC "PC" typo variants to the pcc_* keys', () => {
    expect(divisionFromPractiscore('PC Optics')).toBe('pcc_optics');
    expect(divisionFromPractiscore('PC Iron')).toBe('pcc_iron');
  });

  it('maps Mini Rifle onto the PRR keys (Open→Unlimited, Standard→Limited)', () => {
    expect(divisionFromPractiscore('MiniRifle Open')).toBe('prr_unlimited');
    expect(divisionFromPractiscore('MiniRifle Standard')).toBe('prr_limited');
    // tolerate a space in "Mini Rifle" too
    expect(divisionFromPractiscore('Mini Rifle Open')).toBe('prr_unlimited');
  });

  it('still resolves the regular PPSA handgun divisions', () => {
    expect(divisionFromPractiscore('Production')).toBe('production');
    expect(divisionFromPractiscore('Production Optics')).toBe(
      'production_optics'
    );
    expect(divisionFromPractiscore('Standard')).toBe('standard');
    expect(divisionFromPractiscore('PCC Optics')).toBe('pcc_optics');
  });
});

describe('isValidDivisionForOrg — PPSA now offers PCC + Mini Rifle', () => {
  it('accepts the PCC and PRR (Mini Rifle) keys under PPSA', () => {
    for (const key of ['pcc_optics', 'pcc_iron', 'prr_unlimited', 'prr_limited']) {
      expect(isValidDivisionForOrg('PPSA', key)).toBe(true);
    }
  });
});
