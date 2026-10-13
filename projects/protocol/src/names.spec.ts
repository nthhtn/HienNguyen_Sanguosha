import { DISPLAY_NAME_MAX, normalizeDisplayName } from './public-api';

describe('normalizeDisplayName', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeDisplayName('  Liu   Bei \t')).toBe('Liu Bei');
  });

  it('rejects an empty or blank name', () => {
    expect(normalizeDisplayName('')).toBeNull();
    expect(normalizeDisplayName('   ')).toBeNull();
  });

  it('accepts exactly DISPLAY_NAME_MAX characters and rejects one more', () => {
    expect(normalizeDisplayName('a'.repeat(DISPLAY_NAME_MAX))).toBe('a'.repeat(DISPLAY_NAME_MAX));
    expect(normalizeDisplayName('a'.repeat(DISPLAY_NAME_MAX + 1))).toBeNull();
  });

  it('counts length after trimming', () => {
    expect(normalizeDisplayName(`  ${'a'.repeat(DISPLAY_NAME_MAX)}  `)).toBe('a'.repeat(DISPLAY_NAME_MAX));
  });

  it('rejects control characters', () => {
    expect(normalizeDisplayName('Cao\u0000Cao')).toBeNull();
    expect(normalizeDisplayName('Cao\u001bCao')).toBeNull();
  });

  it('normalizes to NFC so look-alike names compare equal', () => {
    expect(normalizeDisplayName('José')).toBe('José');
  });
});
