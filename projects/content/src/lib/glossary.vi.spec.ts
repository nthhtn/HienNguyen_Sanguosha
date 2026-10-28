import glossary from '../../data/locales/vi/glossary.json';
import { cardsData } from '../../data/cards';
import { generalsData } from '../../data/generals';
import { kingdomWarsGeneralRecords } from './kingdomWarsGenerals';
import { kingdomWarsGeneralTranslations, cardTranslations, generalTranslations, skillIdOf } from './display';

// Every glossary term that the English text uses must appear, in its agreed form, in the
// Vietnamese text of the same entry, with its capitals (Sinh lực, Đào, Tửu are keywords).
const terms = glossary.map((t) => ({ en: new RegExp(t.en, 'i'), vi: new RegExp(t.vi, 'u'), label: t.en }));
const violations = (english: string, vietnamese: string) => terms.filter((t) => t.en.test(english) && !t.vi.test(vietnamese)).map((t) => t.label);

describe('the Vietnamese glossary', () => {
  it('holds in every skill text', () => {
    const found: string[] = [];
    for (const [id, general] of Object.entries(generalTranslations('vi'))) {
      for (const skill of generalsData[id].skills) {
        const text = general.skills?.[skillIdOf(skill.name)]?.text;
        if (text) for (const label of violations(skill.text, text)) found.push(`${id}/${skill.name}: ${label}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('holds in every Kingdom Wars skill text', () => {
    const found: string[] = [];
    const vi = kingdomWarsGeneralTranslations('vi');
    for (const general of kingdomWarsGeneralRecords()) {
      for (const skill of general.skills) {
        const text = vi[general.id]?.skills?.[skillIdOf(skill.name)]?.text;
        if (text) for (const label of violations(skill.text, text)) found.push(`${general.id}/${skill.name}: ${label}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('holds in every card text', () => {
    const found: string[] = [];
    for (const [id, card] of Object.entries(cardTranslations('vi'))) {
      const english = cardsData[id].text;
      if (english && card.text) for (const label of violations(english, card.text)) found.push(`${id}: ${label}`);
    }
    expect(found).toEqual([]);
  });
});
