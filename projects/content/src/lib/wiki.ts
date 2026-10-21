import { cardsData, CardData } from '../../data/cards';
import { generalsData, GeneralData } from '../../data/generals';
import { GENERAL_SKILLS } from './generals';
import { buildContentRegistry } from './registry';
import type { DeckId } from './decks';
import alternateCards from '../../data/decks/alternate/cards.json';
import alternateEnglish from '../../data/decks/alternate/texts.en.json';
import alternateIds from '../../data/decks/alternate/ids.json';

// Every pack, in the order the Wiki lists them.
const PACK_ORDER = ['Base', 'EX', 'Army', 'Wind', 'Fire', 'Forest', 'Mountain'] as const;
export type WikiPack = (typeof PACK_ORDER)[number];

// Whether a skill works in the game: the game has code for it, it is a Lord skill
// (inactive in Kingdom War), or the data has it but the game does not yet.
export type SkillStatus = 'working' | 'lord' | 'missing';

export interface WikiSkill {
  name: string;
  nameZh: string | null;
  text: string;
  // A Lord skill: not used in Kingdom War.
  lord: boolean;
  status: SkillStatus;
}

// The id the game's code gives a skill: its name in lower case, apostrophes
// dropped, every other run of non-letters and digits one hyphen.
export function skillIdFromName(name: string): string {
  return name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function skillStatus(skill: { name: string; lord: boolean }, codedSkillIds: ReadonlySet<string>): SkillStatus {
  if (skill.lord) return 'lord';
  return codedSkillIds.has(skillIdFromName(skill.name)) ? 'working' : 'missing';
}

// A General's skills are in the game when it has skill code and none of its skills lacks it.
export function generalSkillsInGame(hasCode: boolean, skills: { status: SkillStatus }[]): boolean {
  return hasCode && skills.every((s) => s.status !== 'missing');
}

// Every skill id the game has code for, across all Generals.
const CODED_SKILL_IDS: ReadonlySet<string> = new Set([...GENERAL_SKILLS.values()].flatMap((skills) => skills.map((skill) => skill.id)));

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
  gender: 'male' | 'female';
  skills: WikiSkill[];
  skillsInGame: boolean;
  expansion: Extract<WikiPack, 'Base' | 'Wind' | 'Fire' | 'Forest' | 'Mountain'>;
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
  // The pack a Default card belongs to; null on an Alternate card, which has no pack.
  expansion: Extract<WikiPack, 'Base' | 'EX' | 'Army'> | null;
  // Whether the game has behaviour for the card (in the Alternate deck, the same test).
  inGame: boolean;
  deck: DeckId;
}

const KINGDOM_ORDER: readonly WikiGeneral['kingdom'][] = ['Wei', 'Shu', 'Wu', 'Qun'];
const SUBTYPE_ORDER: readonly NonNullable<WikiCard['subtype']>[] = ['weapon', 'armor', 'horse', 'treasure'];

// Each kingdom's Lords (a General with a Lord skill, whether or not it is used
// in the game) head its list; the rest follow. Each group sorts by pack, then name.
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const byPack = (a: { expansion: WikiPack }, b: { expansion: WikiPack }) => PACK_ORDER.indexOf(a.expansion) - PACK_ORDER.indexOf(b.expansion);
const lordRank = (g: { skills: { lord: boolean }[] }) => (g.skills.some((s) => s.lord) ? 0 : 1);
const lordsFirst = (a: Parameters<typeof lordRank>[0], b: Parameters<typeof lordRank>[0]) => lordRank(a) - lordRank(b);

export function wikiGenerals(): WikiGeneral[] {
  return Object.entries(generalsData)
    .map(([id, data]) => {
      const skills = data.skills.map((s) => ({ name: s.name, nameZh: s.nameZh || null, text: s.text, lord: !!s.lord, status: skillStatus({ name: s.name, lord: !!s.lord }, CODED_SKILL_IDS) }));
      return {
      id,
      name: data.name,
      nameZh: data.nameZh ?? null,
      title: data.title ?? null,
      titleZh: data.titleZh ?? null,
      kingdom: data.kingdom,
      maxHp: data.maxHp,
      gender: data.gender,
      skills,
      skillsInGame: generalSkillsInGame(GENERAL_SKILLS.has(id), skills),
      expansion: (data.source.expansion ?? 'Base') as WikiGeneral['expansion'],
      };
    })
    .sort((a, b) => KINGDOM_ORDER.indexOf(a.kingdom) - KINGDOM_ORDER.indexOf(b.kingdom) || lordsFirst(a, b) || byPack(a, b) || byName(a, b));
}

export function wikiCards(category: WikiCard['category'], deck: DeckId = 'default'): WikiCard[] {
  return deck === 'alternate' ? alternateWikiCards(category) : defaultWikiCards(category);
}

interface AlternateCardData {
  nameZh: string;
  category: WikiCard['category'];
  subtype?: 'weapon' | 'armor' | 'mount';
  count: number;
  cardId: string;
  defaultCardId: string | null;
  range?: number;
  mount?: 'offensive' | 'defensive';
  printings: NonNullable<CardData['printings']>;
}

// The Alternate deck's cards. A card Default also has takes its English name and
// text from Default's data; a card it lacks takes its name from ids.json and its text from texts.en.json.
function alternateWikiCards(category: WikiCard['category']): WikiCard[] {
  const registry = buildContentRegistry();
  const english = alternateEnglish as Record<string, string>;
  const ids = alternateIds as Record<string, { id: string; name: string }>;
  const subtypeRank = (c: WikiCard) => (c.subtype === null ? -1 : SUBTYPE_ORDER.indexOf(c.subtype));
  return (alternateCards.cards as AlternateCardData[])
    .filter((card) => card.category === category)
    .map((card): WikiCard => {
      const fromDefault: CardData | undefined = card.defaultCardId ? cardsData[card.defaultCardId] : undefined;
      return {
        id: card.cardId,
        name: fromDefault?.name ?? ids[card.nameZh].name,
        nameZh: card.nameZh,
        category: card.category,
        subtype: card.subtype === undefined ? null : card.subtype === 'mount' ? 'horse' : card.subtype,
        text: fromDefault?.text ?? english[card.nameZh] ?? null,
        range: card.range ?? null,
        count: card.count,
        printings: card.printings,
        mount: card.mount ?? null,
        delayed: fromDefault?.delayed === true,
        expansion: null,
        inGame: registry.cards.has(card.cardId),
        deck: 'alternate',
      };
    })
    .sort((a, b) => subtypeRank(a) - subtypeRank(b) || byName(a, b));
}

function defaultWikiCards(category: WikiCard['category']): WikiCard[] {
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
      expansion: (data.source.expansion ?? 'Base') as NonNullable<WikiCard['expansion']>,
      inGame: registry.cards.has(id),
      deck: 'default' as const,
    }))
    .sort((a, b) => subtypeRank(a) - subtypeRank(b) || byPack(a, b) || byName(a, b));
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
    { key: 'sha', label: 'Slash', holds: (c) => c.id === 'sha' },
    // The Army expansion's fire and lightning Sha sit beside Sha.
    { key: 'fire-attack', label: 'Fire Attack', holds: (c) => c.id === 'fire-attack' },
    { key: 'lightning-attack', label: 'Lightning Attack', holds: (c) => c.id === 'lightning-attack' },
    { key: 'shan', label: 'Dodge', holds: (c) => c.id === 'shan' },
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

export function wikiCardTabs(category: WikiCard['category'], deck: DeckId = 'default'): WikiTab<WikiCard>[] {
  return CARD_TABS[category](wikiCards(category, deck));
}
