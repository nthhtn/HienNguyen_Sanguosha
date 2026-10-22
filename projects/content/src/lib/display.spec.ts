import { abilityHint, abilityName, competeOutcomeText, cardDisplayData, choicePromptText, seatPickText, selectionText, skillIdOf, stepSelectionText } from './display';
import { generalDisplayData } from './generalDisplay';
import { alternateCardIds } from './alternateCards';
import viAlternateGenerals from '../../data/locales/vi/alternate-generals.json';

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

  it("reads an Alternate General's own name and skills", () => {
    expect(generalDisplayData('alternate:guan-yu')?.skills[0].name).toBe('Warrior Saint');
    expect(generalDisplayData('guan-yu')?.skills[0].name).toBe('Fighting Saint');
  });

  it('translates an Alternate General', () => {
    expect(generalDisplayData('alternate:guan-yu', 'vi')?.name).toBe(viAlternateGenerals['guan-yu'].name);
  });

  it('marks an Alternate skill as in the game only when the registry plays it', () => {
    expect(generalDisplayData('alternate:zhang-fei')?.skills.find((s) => s.name === 'Berserk')?.inGame).toBe(true);
    expect(generalDisplayData('alternate:guan-yu')?.skills.find((s) => s.name === 'Warrior Saint')?.inGame).toBe(false);
  });

  it('leaves Default skills unmarked as not in the game', () => {
    expect(generalDisplayData('guan-yu')?.skills.every((s) => s.inGame !== false)).toBe(true);
  });

  it('returns null for an unknown Alternate id', () => {
    expect(generalDisplayData('alternate:nobody')).toBeNull();
  });
});

describe('abilityName for Alternate skills', () => {
  it('names an alternate: skill by the Alternate record, in each language', () => {
    expect(abilityName('alternate:benevolence')).toBe('Benevolence');
    expect(abilityName('alternate:benevolence', 'vi')).toBe(viAlternateGenerals['liu-bei'].skills!['benevolence'].name);
  });
  it('still names Default Kindness', () => {
    expect(abilityName('kindness')).toBe('Kindness');
  });
});

describe('cardDisplayData', () => {
  it('returns name, category, subtype, range and rules text for a known card', () => {
    expect(cardDisplayData('crossbow')).toEqual({
      name: 'Crossbow',
      category: 'equipment',
      subtype: 'weapon',
      range: 1,
      mount: null,
      text: 'With this equipped, a player may attack as much as desired during their turn.',
    });
  });

  it('returns null text and range when the data has none', () => {
    expect(cardDisplayData('sha')).toEqual({ name: 'Slash', category: 'basic', subtype: null, range: null, mount: null, text: null });
  });

  it('returns null for an unknown id', () => {
    expect(cardDisplayData('no-such-card')).toBeNull();
  });
});
describe('abilityHint', () => {
  it('Eight Trigrams and Eight Arrays read in sentence case', () => {
    expect(abilityHint('eight-trigrams')).toBe('Judge: on red, it counts as a Dodge');
    expect(abilityHint('eight-arrays')).toBe('Judge: on red, it counts as a Dodge');
  });

  it('says what an ability does, in the game’s own words', () => {
    expect(abilityHint('axe')).toBe('Discard 2 cards to make your Slash hit {target}');
    expect(abilityHint('eight-trigrams')).toBe('Judge: on red, it counts as a Dodge');
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

describe('Mountain texts', () => {
  it('names a hint for each skill the player is asked about', () => {
    for (const id of ['clever-change', 'military-farm', 'decentralization', 'stubborn', 'lament', 'incarnation', 'instigate', 'direct-instruction']) expect(abilityHint(id)).toBeTruthy();
  });

  it('words the skills’ selections, seat picks and choices', () => {
    expect(selectionText('clever-change')?.confirm).toBe('Discard');
    expect(selectionText('pleasure')?.cancel).toBe('Give Up');
    expect(stepSelectionText('draw-take')?.prompt).toBe('Choose up to 2 seats to take a hand card from');
    expect(stepSelectionText('move-card')?.prompt).toBe('Choose a seat to move a card from');
    expect(stepSelectionText('swap', 'en', 'alliance')).toEqual({ prompt: 'Choose cards to discard for Alliance', confirm: 'Discard' });
    expect(stepSelectionText('swap', 'en', 'someone-else')).toBeNull();
    expect(stepSelectionText('pay', 'en')).toBeNull();
    expect(stepSelectionText('compete-user', 'en', 'rouse-the-tiger')?.confirm).toBe('Compete');
    expect(seatPickText('clever-change')).toBe('Choose a seat to move the card to');
    expect(choicePromptText('incarnation')).toBe('Choose a Form skill');
    expect(choicePromptText('stubborn')).toBe('Choose a card to give back; you take the others');
  });
});

describe('competeOutcomeText', () => {
  const names = { user: 'Seat 0', target: 'Seat 1' };
  it('says what a win and a loss lead to, naming both seats', () => {
    expect(competeOutcomeText('heavens-justice', true, names)).toBe('Seat 0 can play one more Slash this turn, at any distance, with one more target');
    expect(competeOutcomeText('heavens-justice', false, names)).toBe("Seat 0 can't play a Slash this turn");
    expect(competeOutcomeText('rouse-the-tiger', true, names)).toBe("Seat 0 will choose a seat within Seat 1's attack range; Seat 1 deals it 1 damage");
    expect(competeOutcomeText('rouse-the-tiger', false, names)).toBe('Seat 1 deals 1 damage to Seat 0');
    expect(competeOutcomeText('intense-edge', true, names)).toBe("Seat 0 will take one of Seat 1's cards");
    expect(competeOutcomeText('intense-edge', false, names)).toBe('Nothing happens');
  });
  it('has nothing to say for an ability that does not compete', () => {
    expect(competeOutcomeText('sha', true, names)).toBeNull();
  });
});

describe('Alternate-only cards', () => {
  it('lists the six ids', () => {
    expect([...alternateCardIds()].sort()).toEqual(['ally-far-attack-near', 'amass', 'ascertain', 'trident-glaive', 'wu-six-swords', 'wuxie-guo']);
  });

  it('shows English name and text', () => {
    const amass = cardDisplayData('amass')!;
    expect(amass.name).toBe('Amass');
    expect(amass.text).toBeTruthy();
    expect(cardDisplayData('wuxie-guo')!.name).toBe('Wuxie Kingdom');
  });

  it('shows Vietnamese', () => {
    expect(cardDisplayData('wu-six-swords', 'vi')!.name).toBe('Ngô Lục Kiếm');
  });

  it('knows a weapon range', () => {
    const glaive = cardDisplayData('trident-glaive')!;
    expect(glaive.range).toBe(3);
    expect(glaive.subtype).toBe('weapon');
    expect(glaive.category).toBe('equipment');
  });

  it('is null for an unknown id', () => {
    expect(cardDisplayData('nope')).toBeNull();
  });
});

describe('variant skill texts', () => {
  it.each(['en', 'vi'])('a variant shows its base skill’s texts in %s', (locale) => {
    expect(selectionText('alternate:benevolence', locale)).toEqual(selectionText('kindness', locale));
    expect(selectionText('alternate:benevolence', locale)).not.toBeNull();
    expect(abilityHint('alternate:benevolence', locale)).toEqual(abilityHint('kindness', locale));
    expect(seatPickText('alternate:benevolence', locale)).toEqual(seatPickText('kindness', locale));
    expect(choicePromptText('alternate:benevolence', locale)).toEqual(choicePromptText('kindness', locale));
    expect(stepSelectionText('compete-user', locale, 'alternate:benevolence')).toEqual(stepSelectionText('compete-user', locale));
  });
});
