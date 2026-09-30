import { generalDisplayData } from './display';

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
