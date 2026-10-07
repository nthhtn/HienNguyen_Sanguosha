import { abilityHint, abilityName, cardDisplayData, generalDisplayData, selectionText, skillIdOf } from './display';

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
    expect(abilityHint('eight-trigrams')).toBe('Judge: On red, It counts as a Shan');
    expect(abilityHint('sha')).toBeNull();
  });
});

describe('skill names', () => {
  it('a skill id is its English name in kebab case, apostrophes dropped', () => {
    expect(skillIdOf("Heaven's Envy")).toBe('heavens-envy');
    expect(skillIdOf('Self-Restraint')).toBe('self-restraint');
    expect(skillIdOf('Fighting Saint')).toBe('fighting-saint');
  });

  it('names a card, a skill from the data, or else the id in Title Case', () => {
    expect(abilityName('eight-trigrams')).toBe('Eight Trigrams');
    expect(abilityName('kindness')).toBe('Kindness');
    expect(abilityName('heavens-envy')).toBe("Heaven's Envy");
    expect(abilityName('ferocity')).toBe('Ferocity');
  });
});

describe('skill texts', () => {
  it('every asked base skill has a hint, and the multi-pick skills have selection text', () => {
    for (const id of ['evil-hero', 'feedback', 'unyielding', 'bestowed-rouse', 'heavens-envy', 'devil', 'river-goddess', 'bare-the-chest', 'raid', 'brave-gesture', 'gathering-wisdom', 'iron-cavalry', 'astrology', 'displace', 'self-restraint']) {
      expect(abilityHint(id)).toEqual(expect.any(String));
    }
    expect(selectionText('reconsider')).toEqual({ prompt: 'Choose cards to discard, then draw as many', confirm: 'Discard' });
    expect(selectionText('bestowed-rouse')).toEqual({ prompt: 'Choose drawn cards to give away', confirm: 'Give', cancel: 'Keep the Rest' });
    expect(selectionText('sha')).toBeNull();
  });
});

describe('Wind skill texts', () => {
  it('every Wind ask has a hint, and the Wind selections have their words', () => {
    for (const id of ['entrench', 'godspeed', 'strong-bow', 'fantasy', 'refusing-death', 'lightning-strike', 'dark-magic']) expect(abilityHint(id)).toEqual(expect.any(String));
    expect(selectionText('fantasy')).toEqual({ prompt: 'Choose a heart card to discard', confirm: 'Discard' });
    expect(selectionText('godspeed')).toEqual({ prompt: 'Choose an Equipment card to discard', confirm: 'Discard' });
  });
});
