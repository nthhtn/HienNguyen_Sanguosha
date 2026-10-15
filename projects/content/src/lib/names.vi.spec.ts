import { abilityName, cardDisplayData, cardTranslations, generalDisplayData, generalTranslations, skillIdOf } from './display';
import { cardsData } from '../../data/cards';
import { generalsData } from '../../data/generals';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const numbers = (text: string) => (text.match(/\d+/g) ?? []).sort();

describe('Vietnamese General and card translations', () => {
  it('only name Generals, skills and cards that exist', () => {
    for (const [id, general] of Object.entries(generalTranslations('vi'))) {
      expect({ id, known: id in generalsData }).toEqual({ id, known: true });
      const skillIds = generalsData[id].skills.map((s) => skillIdOf(s.name));
      for (const skillId of Object.keys(general.skills ?? {})) expect({ id, skillId, known: skillIds.includes(skillId) }).toEqual({ id, skillId, known: true });
    }
    for (const id of Object.keys(cardTranslations('vi'))) expect({ id, known: id in cardsData }).toEqual({ id, known: true });
  });

  it('keeps every number of the English rules text', () => {
    for (const [id, general] of Object.entries(generalTranslations('vi'))) {
      for (const skill of generalsData[id].skills) {
        const translated = general.skills?.[skillIdOf(skill.name)];
        if (translated?.text) expect({ id, skill: skill.name, numbers: numbers(translated.text) }).toEqual({ id, skill: skill.name, numbers: numbers(skill.text) });
      }
    }
    for (const [id, card] of Object.entries(cardTranslations('vi'))) {
      if (card.text) expect({ id, numbers: numbers(card.text), placeholders: placeholders(card.text) }).toEqual({ id, numbers: numbers(cardsData[id].text ?? ''), placeholders: placeholders(cardsData[id].text ?? '') });
    }
  });

  it('every translated entry is non-empty', () => {
    for (const [id, general] of Object.entries(generalTranslations('vi'))) {
      expect({ id, name: general.name.trim() !== '' }).toEqual({ id, name: true });
      for (const skill of Object.values(general.skills ?? {})) expect(skill.name.trim() !== '' && (skill.text ?? 'x').trim() !== '').toBe(true);
    }
    for (const card of Object.values(cardTranslations('vi'))) expect(card.name.trim()).not.toBe('');
  });
});

describe('Vietnamese names cover the whole roster', () => {
  it('names every General with a title, and every skill', () => {
    const missing: string[] = [];
    for (const [id, data] of Object.entries(generalsData)) {
      const t = generalTranslations('vi')[id];
      if (!t?.name) missing.push(`${id}: name`);
      if (data.title && !t?.title) missing.push(`${id}: title`);
      for (const skill of data.skills) if (!t?.skills?.[skillIdOf(skill.name)]?.name) missing.push(`${id}: ${skill.name}`);
    }
    expect(missing).toEqual([]);
  });

  it('names every card', () => {
    expect(Object.keys(cardsData).filter((id) => !cardTranslations('vi')[id]?.name)).toEqual([]);
  });
});

describe('the locale-aware display lookups', () => {
  it('read Vietnamese where there is an entry', () => {
    expect(generalDisplayData('cao-cao', 'vi')).toMatchObject({ name: 'Tào Tháo', title: 'Ngụy Võ Đế' });
    expect(generalDisplayData('cao-cao', 'vi')!.skills.map((s) => s.name)).toEqual(['Gian hùng', 'Hộ giá']);
    expect(cardDisplayData('sha', 'vi')!.name).toBe('Sát');
    expect(abilityName('evil-hero', 'vi')).toBe('Gian hùng');
    expect(abilityName('sha', 'vi')).toBe('Sát');
  });

  it('fall back to English for another locale and for an id with no entry', () => {
    expect(generalDisplayData('cao-cao')).toMatchObject({ name: 'Cao Cao', title: 'Martial Emperor of Wei' });
    expect(generalDisplayData('cao-cao', 'fr')!.name).toBe('Cao Cao');
    expect(generalDisplayData('cao-pi', 'vi')!.name).toBe('Tào Phi');
    expect(generalDisplayData('cao-pi', 'vi')!.skills.map((x) => x.text)).toEqual(generalDisplayData('cao-pi')!.skills.map((x) => x.text));
    expect(abilityName('evil-hero')).toBe('Evil Hero');
    expect(abilityName('godspeed', 'vi')).toBe('Thần tốc');
    expect(abilityName('godspeed')).toBe('Godspeed');
    expect(abilityName('constructor', 'vi')).toBe('Constructor');
  });
});
