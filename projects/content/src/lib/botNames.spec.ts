import botNames from '../../data/botNames.json';
import { generalsData } from '../../data/generals';
import { botNameDisplay, botNameIds, drawBotNameIds } from './botNames';
import { generalTranslations, kingdomWarsGeneralTranslations } from './display';
import { kingdomWarsGeneralRecords } from './kingdomWarsGenerals';

// A small deterministic generator for the draw.
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('bot names', () => {
  it('has the 32 pool names', () => {
    expect(botNameIds()).toHaveLength(32);
    expect(botNameDisplay('zhou-cang', 'en')).toBe('Zhou Cang');
    expect(botNameDisplay('zhou-cang', 'vi')).toBe('Chu Thương');
    expect(botNameDisplay('lu-fan', 'vi')).toBe('Lã Phạm');
    expect(botNameDisplay('han-hao', 'vi')).toBe('Hàn Hạo');
  });

  it('names no General in either deck', () => {
    const general = new Set<string>();
    for (const g of kingdomWarsGeneralRecords()) general.add(g.name.toLowerCase());
    for (const g of Object.values(generalsData)) general.add(g.name.toLowerCase());
    for (const t of Object.values(generalTranslations('vi'))) general.add(t.name.toLowerCase());
    for (const t of Object.values(kingdomWarsGeneralTranslations('vi'))) general.add(t.name.toLowerCase());
    for (const id of botNameIds()) {
      expect(general.has(botNameDisplay(id, 'en')!.toLowerCase())).toBe(false);
      expect(general.has(botNameDisplay(id, 'vi')!.toLowerCase())).toBe(false);
    }
  });

  it('is flat: every entry is just a name', () => {
    for (const value of Object.values(botNames)) expect(typeof value).toBe('string');
  });

  it('falls back to English for a language with no names and to null for an unknown id', () => {
    expect(botNameDisplay('nobody', 'en')).toBeNull();
    expect(botNameDisplay('zhou-cang', 'fr')).toBe('Zhou Cang');
  });

  it('draws distinct names', () => {
    const drawn = drawBotNameIds(7, [], seeded(1));
    expect(new Set(drawn).size).toBe(7);
    const all = botNameIds();
    expect(drawBotNameIds(2, all.slice(0, 30), seeded(1)).sort()).toEqual(all.slice(30).sort());
    expect(() => drawBotNameIds(1, all)).toThrow(RangeError);
    expect(drawBotNameIds(7, [], seeded(9))).toEqual(drawBotNameIds(7, [], seeded(9)));
  });
});
