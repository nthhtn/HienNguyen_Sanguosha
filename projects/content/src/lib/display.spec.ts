import { cardDisplayData, generalDisplayData } from './display';

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

  it('returns a null title when the data has none', () => {
    expect(generalDisplayData('dong-zhuo')!.title).toBeNull();
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
    expect(cardDisplayData('silver-lion')).toBeNull();
  });
});
