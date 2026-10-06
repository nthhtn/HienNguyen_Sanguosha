import { abilityHint, cardDisplayData, generalDisplayData } from './display';

describe('generalDisplayData', () => {
  it('returns name, title and skill name/text for a known general', () => {
    const data = generalDisplayData('cao-cao')!;
    expect(data.name).toBe('Cao Cao');
    expect(data.title).toBe('Martial Emperor of Wei');
    expect(data.skills[0]).toEqual({
      name: 'Evil Hero',
      text: 'When Cao Cao is damaged by a card, he can immediately put it into his hand.',
    });
  });

  it("returns the data file's title for an expansion general", () => {
    expect(generalDisplayData('fire-zhuge-liang')!.title).toBe('Sleeping Dragon');
  });

  it('returns null for an unknown id', () => {
    expect(generalDisplayData('no-such-general')).toBeNull();
  });
});

describe('cardDisplayData', () => {
  it('returns name, category, subtype, range and rules text for a known card', () => {
    expect(cardDisplayData('crossbow')).toEqual({
      name: 'Crossbow',
      category: 'equipment',
      subtype: 'weapon',
      range: 1,
      text: 'Range: 1. With this equipped, a player may attack as much as desired during their turn.',
    });
  });

  it('returns null text and range when the data has none', () => {
    expect(cardDisplayData('sha')).toEqual({ name: 'Sha', category: 'basic', subtype: null, range: null, text: null });
  });

  it('returns null for an unknown id', () => {
    expect(cardDisplayData('no-such-card')).toBeNull();
  });
});
describe('abilityHint', () => {
  it('says what an ability does, in the game’s own words', () => {
    expect(abilityHint('axe')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(abilityHint('eight-trigrams')).toBe('Judge: on red, it counts as a Shan');
    expect(abilityHint('sha')).toBeNull();
  });
});
