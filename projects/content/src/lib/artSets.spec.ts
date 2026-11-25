import { ArtChoice, ArtSetCatalog, ArtSetEntry, DEFAULT_ART_CHOICE, DEFAULT_ART_SET, artSetGeneralId, artSetName, resolveArtSet, setsCovering } from './artSets';

const entry = (names: { en: string; vi: string }, portraits: string[], faces: string[]): ArtSetEntry => ({ names, provenance: 'test', portraits, faces });

const catalog: ArtSetCatalog = {
  order: ['classic', 'ink'],
  sets: {
    classic: entry({ en: 'Classic', vi: 'Cổ điển' }, ['a', 'b', 'c'], ['a', 'b', 'c']),
    ink: entry({ en: 'Ink Wash', vi: 'Thủy mặc' }, ['a', 'b'], ['a']),
  },
};

const choice = (global: string, overrides: Record<string, string> = {}): ArtChoice => ({ global, overrides, catalog });

describe('resolveArtSet', () => {
  it('uses the override when that set covers the General', () => {
    expect(resolveArtSet('a', choice('classic', { a: 'ink' }))).toBe('ink');
  });

  it('uses the global set when there is no override', () => {
    expect(resolveArtSet('a', choice('ink'))).toBe('ink');
  });

  it('falls back to classic when the global set lacks the General', () => {
    expect(resolveArtSet('c', choice('ink'))).toBe('classic');
  });

  it('ignores an override whose set lacks the General and uses the global set', () => {
    expect(resolveArtSet('c', choice('classic', { c: 'ink' }))).toBe('classic');
    expect(resolveArtSet('b', choice('ink', { b: 'classic' }))).toBe('classic');
    expect(resolveArtSet('c', choice('ink', { c: 'ink' }))).toBe('classic');
  });

  it('ignores an override naming an unknown set', () => {
    expect(resolveArtSet('a', choice('ink', { a: 'gone' }))).toBe('ink');
  });

  it('ignores an unknown global set and uses classic', () => {
    expect(resolveArtSet('a', choice('gone'))).toBe(DEFAULT_ART_SET);
  });
});

describe('setsCovering', () => {
  it('lists the sets that have a portrait for the General, in catalog order', () => {
    expect(setsCovering('a', catalog)).toEqual(['classic', 'ink']);
    expect(setsCovering('c', catalog)).toEqual(['classic']);
    expect(setsCovering('nobody', catalog)).toEqual([]);
  });
});

describe('artSetName', () => {
  it('gives the Vietnamese name for vi and English for anything else', () => {
    expect(artSetName(catalog.sets['ink'], 'vi')).toBe('Thủy mặc');
    expect(artSetName(catalog.sets['ink'], 'en')).toBe('Ink Wash');
    expect(artSetName(catalog.sets['ink'], 'fr')).toBe('Ink Wash');
  });
});

describe('DEFAULT_ART_CHOICE', () => {
  it('is classic with no overrides', () => {
    expect(DEFAULT_ART_CHOICE.global).toBe('classic');
    expect(DEFAULT_ART_CHOICE.overrides).toEqual({});
  });
});

describe('artSetGeneralId', () => {
  it('gives the base General id for a plain or a Kingdom Wars id', () => {
    expect(artSetGeneralId('kingdomWars:guan-yu')).toBe('guan-yu');
    expect(artSetGeneralId('guan-yu')).toBe('guan-yu');
  });
});
