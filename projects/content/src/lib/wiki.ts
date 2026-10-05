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
  expansion: 'Base' | 'Wind' | 'Fire' | 'Forest' | 'Mountain';
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
  mount: NonNullable<CardData['mount']> | null;
  delayed: boolean;
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
      expansion: (data.source.expansion ?? 'Base') as WikiGeneral['expansion'],
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
      mount: data.mount ?? null,
      delayed: data.delayed === true,
      inGame: registry.cards.has(id),
    }))
    .sort((a, b) => subtypeRank(a) - subtypeRank(b) || byName(a, b));
}

export interface WikiTab<T> {
  key: string;
  label: string;
  entries: T[];
}

interface TabRule<T> {
  key: string;
  label: string;
  holds: (entry: T) => boolean;
  optional?: boolean; // dropped when it holds nothing
}

// Splits entries into the given tabs, in order. Anything no tab claims goes in a
// trailing "Other" tab, so new data is never silently dropped.
function splitIntoTabs<T>(entries: T[], rules: TabRule<T>[]): WikiTab<T>[] {
  const tabs = rules
    .map((rule) => ({ key: rule.key, label: rule.label, entries: entries.filter(rule.holds), optional: rule.optional }))
    .filter((tab) => !tab.optional || tab.entries.length > 0)
    .map(({ key, label, entries: held }) => ({ key, label, entries: held }));
  const unclaimed = entries.filter((entry) => !rules.some((rule) => rule.holds(entry)));
  return unclaimed.length > 0 ? [...tabs, { key: 'other', label: 'Other', entries: unclaimed }] : tabs;
}

export function generalTabs(generals: WikiGeneral[]): WikiTab<WikiGeneral>[] {
  return splitIntoTabs(generals, [
    { key: 'wei', label: 'Wei', holds: (g) => g.kingdom === 'Wei' },
    { key: 'shu', label: 'Shu', holds: (g) => g.kingdom === 'Shu' },
    { key: 'wu', label: 'Wu', holds: (g) => g.kingdom === 'Wu' },
    { key: 'qun', label: 'Qun', holds: (g) => g.kingdom === 'Qun' },
  ]);
}

export function basicTabs(cards: WikiCard[]): WikiTab<WikiCard>[] {
  return splitIntoTabs(cards, [
    { key: 'sha', label: 'Sha', holds: (c) => c.id === 'sha' },
    // The Army expansion's fire and lightning Sha sit beside Sha.
    { key: 'fire-attack', label: 'Fire Attack', holds: (c) => c.id === 'fire-attack' },
    { key: 'lightning-attack', label: 'Lightning Attack', holds: (c) => c.id === 'lightning-attack' },
    { key: 'shan', label: 'Shan', holds: (c) => c.id === 'shan' },
    { key: 'wine', label: 'Wine', holds: (c) => c.id === 'wine' },
    { key: 'peach', label: 'Peach', holds: (c) => c.id === 'peach' },
  ]);
}

export function equipmentTabs(cards: WikiCard[]): WikiTab<WikiCard>[] {
  return splitIntoTabs(cards, [
    { key: 'weapons', label: 'Weapons', holds: (c) => c.subtype === 'weapon' },
    { key: 'armors', label: 'Armors', holds: (c) => c.subtype === 'armor' },
    { key: 'defensive-mount', label: 'Defensive Mount', holds: (c) => c.subtype === 'horse' && c.mount === 'defensive' },
    { key: 'offensive-mount', label: 'Offensive Mount', holds: (c) => c.subtype === 'horse' && c.mount === 'offensive' },
    { key: 'other-mounts', label: 'Other Mounts', holds: (c) => c.subtype === 'horse' && c.mount === null, optional: true },
    { key: 'treasures', label: 'Treasures', holds: (c) => c.subtype === 'treasure', optional: true },
  ]);
}

export function toolTabs(cards: WikiCard[]): WikiTab<WikiCard>[] {
  return splitIntoTabs(cards, [
    { key: 'instant', label: 'Instant', holds: (c) => !c.delayed },
    { key: 'delayed', label: 'Delayed', holds: (c) => c.delayed },
  ]);
}

export function wikiGeneralTabs(): WikiTab<WikiGeneral>[] {
  return generalTabs(wikiGenerals());
}

const CARD_TABS: Record<WikiCard['category'], (cards: WikiCard[]) => WikiTab<WikiCard>[]> = {
  basic: basicTabs,
  equipment: equipmentTabs,
  tool: toolTabs,
};

export function wikiCardTabs(category: WikiCard['category']): WikiTab<WikiCard>[] {
  return CARD_TABS[category](wikiCards(category));
}
