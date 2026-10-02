import { cardsData, CardData } from '../../data/cards';
import { generalsData, GeneralData } from '../../data/generals';
import { GENERAL_SKILLS } from './generals';
import { buildContentRegistry } from './registry';

export interface WikiSkill {
  name: string;
  nameZh: string | null;
  text: string;
}

// One general as the Wiki shows it: everything the data file knows, plus
// whether its skills are coded. Missing optional fields are null, never guessed.
export interface WikiGeneral {
  id: string;
  name: string;
  nameZh: string | null;
  title: string | null;
  titleZh: string | null;
  kingdom: GeneralData['kingdom'];
  maxHp: number | null;
  skills: WikiSkill[];
  skillsInGame: boolean;
}

// One card as the Wiki shows it, plus whether its rules are implemented
// (it is in the game registry).
export interface WikiCard {
  id: string;
  name: string;
  nameZh: string | null;
  category: CardData['category'];
  subtype: NonNullable<CardData['subtype']> | null;
  text: string | null;
  range: number | null;
  count: number | null;
  printings: NonNullable<CardData['printings']>;
  inGame: boolean;
}

const KINGDOM_ORDER: readonly WikiGeneral['kingdom'][] = ['Wei', 'Shu', 'Wu', 'Qun'];
const SUBTYPE_ORDER: readonly NonNullable<WikiCard['subtype']>[] = ['weapon', 'armor', 'horse', 'treasure'];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function wikiGenerals(): WikiGeneral[] {
  return Object.entries(generalsData)
    .map(([id, data]) => ({
      id,
      name: data.name,
      nameZh: data.nameZh ?? null,
      title: data.title ?? null,
      titleZh: data.titleZh ?? null,
      kingdom: data.kingdom,
      maxHp: data.maxHp,
      skills: data.skills.map((s) => ({ name: s.name, nameZh: s.nameZh || null, text: s.text })),
      skillsInGame: GENERAL_SKILLS.has(id),
    }))
    .sort((a, b) => KINGDOM_ORDER.indexOf(a.kingdom) - KINGDOM_ORDER.indexOf(b.kingdom) || byName(a, b));
}

export function wikiCards(category: WikiCard['category']): WikiCard[] {
  const registry = buildContentRegistry();
  const subtypeRank = (c: WikiCard) => (c.subtype === null ? -1 : SUBTYPE_ORDER.indexOf(c.subtype));
  return Object.entries(cardsData)
    .filter(([, data]) => data.category === category)
    .map(([id, data]) => ({
      id,
      name: data.name,
      nameZh: data.nameZh ?? null,
      category: data.category,
      subtype: data.subtype ?? null,
      text: data.text ?? null,
      range: data.range ?? null,
      count: data.count ?? null,
      printings: data.printings ?? [],
      inGame: registry.cards.has(id),
    }))
    .sort((a, b) => subtypeRank(a) - subtypeRank(b) || byName(a, b));
}
