import { kingdomWarsGeneralId, isKingdomWarsGeneralId, baseGeneralId, KINGDOM_WARS_GENERAL_PREFIX } from './generalIds';

describe('Kingdom Wars General ids', () => {
  it('prefixes a base id', () => {
    expect(KINGDOM_WARS_GENERAL_PREFIX).toBe('kingdomWars:');
    expect(kingdomWarsGeneralId('liu-bei')).toBe('kingdomWars:liu-bei');
  });
  it('recognises prefixed ids only', () => {
    expect(isKingdomWarsGeneralId('kingdomWars:liu-bei')).toBe(true);
    expect(isKingdomWarsGeneralId('liu-bei')).toBe(false);
    expect(isKingdomWarsGeneralId('filler-liu-bei')).toBe(false);
  });
  it('strips the prefix once', () => {
    expect(baseGeneralId('kingdomWars:liu-bei')).toBe('liu-bei');
    expect(baseGeneralId('liu-bei')).toBe('liu-bei');
    expect(baseGeneralId('kingdomWars:kingdomWars:x')).toBe('kingdomWars:x');
  });
});
