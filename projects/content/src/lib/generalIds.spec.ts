import { alternateGeneralId, isAlternateGeneralId, baseGeneralId, ALTERNATE_GENERAL_PREFIX } from './generalIds';

describe('Alternate General ids', () => {
  it('prefixes a base id', () => {
    expect(ALTERNATE_GENERAL_PREFIX).toBe('alternate:');
    expect(alternateGeneralId('liu-bei')).toBe('alternate:liu-bei');
  });
  it('recognises prefixed ids only', () => {
    expect(isAlternateGeneralId('alternate:liu-bei')).toBe(true);
    expect(isAlternateGeneralId('liu-bei')).toBe(false);
    expect(isAlternateGeneralId('filler-liu-bei')).toBe(false);
  });
  it('strips the prefix once', () => {
    expect(baseGeneralId('alternate:liu-bei')).toBe('liu-bei');
    expect(baseGeneralId('liu-bei')).toBe('liu-bei');
    expect(baseGeneralId('alternate:alternate:x')).toBe('alternate:x');
  });
});
