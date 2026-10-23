import { cardsData, CardData } from '../../data/cards';
import { generalsData } from '../../data/generals';
import { alternateCardData } from './alternateCards';
import { alternateGeneralRecords } from './alternateGenerals';
import { skillIdOf } from './skillId';
import { baseSkillId, lookupWithBase } from './alternateBase';
import { alternateGeneralId, baseGeneralId, isAlternateGeneralId } from './generalIds';
import viCards from '../../data/locales/vi/cards.json';
import viAlternateCards from '../../data/locales/vi/alternate-cards.json';
import viGenerals from '../../data/locales/vi/generals.json';
import viAlternateGenerals from '../../data/locales/vi/alternate-generals.json';
import viProse from '../../data/locales/vi/prose.json';

// One language's names and rules text, keyed by the same ids as the English data. A missing
// id, skill or field reads English, so a language can be filled in piece by piece.
export interface GeneralTranslation {
  name: string;
  title?: string;
  skills?: Record<string, { name: string; text?: string }>;
}
export interface CardTranslation {
  name: string;
  text?: string;
}
const GENERAL_TEXT: Record<string, Record<string, GeneralTranslation>> = { vi: viGenerals };
const CARD_TEXT: Record<string, Record<string, CardTranslation>> = { vi: viCards };

// Names and text of cards only the Alternate deck has, by card id; a card Default also has is in CARD_TEXT.
const ALTERNATE_CARD_TEXT: Record<string, Record<string, CardTranslation>> = { vi: viAlternateCards };
export function alternateCardTranslation(id: string, locale: string): CardTranslation | null {
  return lookup(ALTERNATE_CARD_TEXT, locale)?.[id] ?? null;
}

// The Alternate deck's Generals, by their id (which is Default's id when Default has the General, so the
// two tables never mix: an Alternate entry always reads its own file). Everything a translation can hold
// is optional, so a language can be filled in piece by piece.
export interface AlternateGeneralTranslation {
  name: string;
  title?: string;
  // Keyed by the skill id of the Alternate English skill name (skillIdOf).
  skills?: Record<string, { name: string; text?: string }>;
  differenceNote?: string;
  // Each Synergistic Partners entry translated whole, in the English list's order.
  partners?: string[];
}
const ALTERNATE_GENERAL_TEXT: Record<string, Record<string, AlternateGeneralTranslation>> = { vi: viAlternateGenerals };
export function alternateGeneralTranslations(locale: string): Record<string, AlternateGeneralTranslation> {
  return lookup(ALTERNATE_GENERAL_TEXT, locale) ?? {};
}

export interface AlternateGeneralDisplayData {
  name: string;
  title: string | null;
  skills: { name: string; text: string }[];
  differenceNote: string | null;
  partners: string[];
}

export function alternateGeneralDisplayData(id: string, locale = 'en'): AlternateGeneralDisplayData | null {
  const record = alternateGeneralRecords().find((g) => g.id === id);
  if (!record) return null;
  const translated = lookup(alternateGeneralTranslations(locale), id);
  const partners = translated?.partners;
  return {
    name: translated?.name ?? record.name,
    title: translated?.title ?? record.title ?? null,
    skills: record.skills.map(({ name, text }) => {
      const skill = lookup(translated?.skills, skillIdOf(name));
      return { name: skill?.name ?? name, text: skill?.text ?? text };
    }),
    differenceNote: translated?.differenceNote ?? record.differenceFromNormal,
    partners: partners && partners.length === record.synergisticPartners.length ? partners : record.synergisticPartners,
  };
}

// Every General and card id, from the English data (the ids a translation has to cover).
export const generalIds = (): string[] => Object.keys(generalsData);
export const cardIds = (): string[] => Object.keys(cardsData);
// The ids the Vietnamese review file can list for Generals: Default's, then the Alternate deck's written
// `alternate:<id>` (their ids overlap Default's, so they need the prefix).
export const reviewGeneralIds = (): string[] => [...generalIds(), ...alternateGeneralRecords().map((g) => alternateGeneralId(g.id))];

// The translations of a language, exported for the parity spec.
export function generalTranslations(locale: string): Record<string, GeneralTranslation> {
  return lookup(GENERAL_TEXT, locale) ?? {};
}
export function cardTranslations(locale: string): Record<string, CardTranslation> {
  return lookup(CARD_TEXT, locale) ?? {};
}

export interface GeneralDisplayData {
  name: string;
  title: string | null;
  // inGame is set for Alternate skills only: false when the game does not play this skill yet. Absent means in the game.
  skills: { name: string; text: string; inGame?: boolean }[];
}

// Presentation-facing view of a general's data file, so UI code never imports
// raw content JSON. `inGame` is added by generalDisplayData (generalDisplay.ts), which needs the skill
// registry; this file must not import it, since the General skills import this file.
export function generalTextData(id: string, locale = 'en'): GeneralDisplayData | null {
  if (isAlternateGeneralId(id)) {
    const alternate = alternateGeneralDisplayData(baseGeneralId(id), locale);
    if (!alternate) return null;
    return { name: alternate.name, title: alternate.title, skills: alternate.skills };
  }
  if (!Object.prototype.hasOwnProperty.call(generalsData, id)) return null;
  const data = generalsData[id];
  const translated = lookup(generalTranslations(locale), id);
  return {
    name: translated?.name ?? data.name,
    title: translated?.title ?? data.title ?? null,
    skills: data.skills.map(({ name, text }) => {
      const skill = lookup(translated?.skills, skillIdOf(name));
      return { name: skill?.name ?? name, text: skill?.text ?? text };
    }),
  };
}

export interface CardDisplayData {
  name: string;
  category: CardData['category'];
  subtype: NonNullable<CardData['subtype']> | null;
  range: number | null;
  // Horses only: defensive (+1) or offensive (-1).
  mount: 'defensive' | 'offensive' | null;
  text: string | null;
}

// Presentation-facing view of a card's data file (rules text etc.).
export function cardDisplayData(id: string, locale = 'en'): CardDisplayData | null {
  if (!Object.prototype.hasOwnProperty.call(cardsData, id)) return alternateDisplayData(id, locale);
  const data = cardsData[id];
  const translated = lookup(cardTranslations(locale), id);
  return {
    name: translated?.name ?? data.name,
    category: data.category,
    subtype: data.subtype ?? null,
    range: data.range ?? null,
    mount: data.mount ?? null,
    text: translated?.text ?? data.text ?? null,
  };
}
function alternateDisplayData(id: string, locale: string): CardDisplayData | null {
  const data = alternateCardData(id);
  if (!data) return null;
  const translated = alternateCardTranslation(id, locale);
  return {
    name: translated?.name ?? data.name,
    category: data.category,
    subtype: data.subtype,
    range: data.range,
    mount: null,
    text: translated?.text ?? data.text,
  };
}

// What an optional ability does, for its ask, in the game's own terms.
// '{target}' stands for the seat it is aimed at.
const ABILITY_HINTS: Record<string, string> = {
  'eight-trigrams': 'Judge: on red, it counts as a Dodge',
  'gender-swords': "{target} discards a hand card or lets you draw 1 card",
  axe: 'Discard 2 cards to make your Slash hit {target}',
  'green-dragon-blade': 'Play another Slash at {target}',
  'ice-sword': "Prevent the damage and discard 2 of {target}'s cards instead",
  longbow: "Discard one of {target}'s Mounts",
  'evil-hero': 'Take the card that damaged you into your hand',
  feedback: "Take one of {target}'s cards",
  unyielding: 'Judge: unless it is a heart, {target} discards 2 hand cards or takes 1 damage',
  'bestowed-rouse': 'Draw 2 cards, then give any of them away',
  'heavens-envy': 'Take the judgment card into your hand',
  devil: "Replace {target}'s judgment card with one of your hand cards",
  'river-goddess': 'Judge: keep each black card and judge again; a red card ends it',
  'alternate:goddess-luo': 'Judge: set each black card aside and judge again or stop; a red card ends it, then take the black cards',
  'bare-the-chest': 'Draw 1 fewer card; your Slash and Duel deal 1 more damage this turn',
  raid: 'Instead of drawing, take a hand card from 1 or 2 other seats',
  'brave-gesture': 'Draw 1 more card',
  'gathering-wisdom': 'Draw 1 card',
  'alternate:envious-moon': 'Draw 1 card',
  'alternate:warrior-lady': 'Draw 2 cards',
  'iron-cavalry': "Judge: on red, {target} can't play a Dodge against this Slash",
  astrology: 'Look at the top cards of the draw pile and put them back in any order',
  displace: 'Discard 1 card to move the Slash to another seat in your attack range',
  'self-restraint': 'Skip your Discard Phase',
  entrench: 'Turn face down and draw 3 cards',
  godspeed: 'Skip phases to use a Slash on any seat, ignoring distance',
  'strong-bow': 'Make your Slash unblockable for {target}',
  fantasy: 'Discard a heart card to pass the damage to another seat',
  'refusing-death': 'Turn the top card of the draw pile under your General to stay alive',
  'lightning-strike': 'A seat of your choice judges: on a spade it takes 2 thunder damage',
  'dark-magic': "Replace {target}'s judgment card with a black card, and take the old one",
  'eternal-loyalty': 'A seat of your choice draws up to its max HP',
  'alternate:eternal-loyalty': 'A seat of your choice draws up to its max HP, but never above 5 cards',
  'alternate:bequeathed-strategy': 'Look at the top 2 cards of the draw pile, then give one to any player and the other to any player',
  nirvana: 'Discard every card, draw 3, recover to 3 HP and turn face up',
  'eight-arrays': 'Judge: on red, it counts as a Dodge',
  'sudden-attack': "Discard one of {target}'s cards",
  'dueling-heroes': 'Instead of drawing, judge and take the card; cards of the other colour can be used as Duel this turn',
  'unnatural-death': "Take all of {target}'s cards into your hand",
  exile: 'A seat of your choice turns over and draws cards',
  resurgence: 'Instead of drawing, reveal cards: each heart recovers 1 HP, the rest go to your hand',
  'intense-edge': 'Compete with {target}; if you win, take one of its cards',
  'brave-spirit': 'A seat of your choice draws and discards cards',
  charity: 'Draw 2 more cards; with more than 5, give half to the seat with the fewest',
  'clever-change': 'Discard a hand card to skip this phase',
  'military-farm': 'Judge: a card that is not a heart becomes a Farm under your General',
  decentralization: 'Skip your Play Phase; at the end of your turn another seat takes an extra turn',
  stubborn: 'Give one of the discarded cards back and take the rest',
  'alternate:stabilization': 'Give one of the discarded cards back and take the rest, if there are any',
  lament: 'Discard a card: {target} judges, and a heart, diamond, club or spade has its effect',
  incarnation: 'Choose a skill of one of your Forms',
  instigate: 'Choose a seat to play a Slash at you, or you discard one of its cards',
  'direct-instruction': "Place an Equipment card from your hand in another seat's empty slot, then draw 1 card",
};

export function abilityHint(abilityId: string, locale = 'en'): string | null {
  return lookupWithBase(proseOf(locale)?.hints, abilityId) ?? lookupWithBase(ABILITY_HINTS, abilityId) ?? null;
}

// What a skill's selection says: its prompt, its confirm button and, when
// cancelling means something else than "back", its cancel button.
const SELECTION_TEXT: Record<string, { prompt: string; confirm: string; cancel?: string }> = {
  reconsider: { prompt: 'Choose cards to discard, then draw as many', confirm: 'Discard' },
  kindness: { prompt: 'Choose cards to give', confirm: 'Give' },
  'bestowed-rouse': { prompt: 'Choose drawn cards to give away', confirm: 'Give', cancel: 'Keep the Rest' },
  marriage: { prompt: 'Choose 2 hand cards to discard', confirm: 'Discard' },
  'green-vesicle': { prompt: 'Choose a hand card to discard', confirm: 'Discard' },
  'sow-discord': { prompt: 'Choose a card to discard', confirm: 'Discard' },
  displace: { prompt: 'Choose a card to discard', confirm: 'Discard' },
  raid: { prompt: 'Choose 1 or 2 seats to take a hand card from', confirm: 'Take' },
  'sow-revolt': { prompt: 'Choose a seat', confirm: 'Choose' },
  fantasy: { prompt: 'Choose a heart card to discard', confirm: 'Discard' },
  godspeed: { prompt: 'Choose an Equipment card to discard', confirm: 'Discard' },
  'refusing-death': { prompt: 'Choose a card under your General to discard', confirm: 'Discard', cancel: 'Keep Them' },
  'dark-magic': { prompt: 'Choose a black card to replace the judgment', confirm: 'Replace' },
  shackle: { prompt: 'Choose a club to discard, then draw 1', confirm: 'Recast' },
  assault: { prompt: 'Choose a Weapon to discard, or none to lose 1 HP', confirm: 'Confirm' },
  'rouse-the-tiger': { prompt: 'Choose a seat with more HP to compete with', confirm: 'Choose' },
  'heavens-justice': { prompt: 'Choose a seat to compete with', confirm: 'Choose' },
  alliance: { prompt: 'Choose a seat to swap hands', confirm: 'Choose' },
  'brave-spirit': { prompt: 'Choose cards to discard', confirm: 'Discard' },
  charity: { prompt: 'Choose half of your hand to give away', confirm: 'Give' },
  'clever-change': { prompt: 'Choose a hand card to discard to skip the phase', confirm: 'Discard' },
  pleasure: { prompt: 'Choose a Basic card to discard, or the Slash has no effect', confirm: 'Discard', cancel: 'Give Up' },
  decentralization: { prompt: 'Choose a hand card to discard', confirm: 'Discard' },
  lament: { prompt: 'Choose cards to discard', confirm: 'Discard' },
  'direct-instruction': { prompt: 'Choose an Equipment card to place', confirm: 'Place' },
  instigate: { prompt: 'Choose a seat to play a Slash at you', confirm: 'Choose' },
};

export function selectionText(abilityId: string, locale = 'en'): { prompt: string; confirm: string; cancel?: string } | null {
  return lookupWithBase(proseOf(locale)?.selection, abilityId) ?? lookupWithBase(SELECTION_TEXT, abilityId) ?? null;
}

// What a skill's seat pick asks, when "Choose a seat" says too little.
// '{target}' stands for the seat the skill is aimed at.
const SEAT_PICK_TEXT: Record<string, string> = {
  'rouse-the-tiger': 'Choose a seat for {target} to damage',
  exile: 'Choose a seat to turn over',
  'brave-spirit': 'Choose a seat to draw and discard cards',
  alliance: 'Choose a seat to swap hands with {target}',
  'clever-change': 'Choose a seat to move the card to',
  decentralization: 'Choose a seat to take an extra turn',
  'direct-instruction': 'Choose a seat to place the card in',
  'alternate:bequeathed-strategy': 'Choose a seat to give {card} to',
};

export function seatPickText(abilityId: string, locale = 'en'): string | null {
  return lookupWithBase(proseOf(locale)?.seatPick, abilityId) ?? lookupWithBase(SEAT_PICK_TEXT, abilityId) ?? null;
}

// What a skill's pick says when it mixes seats and labels, or is all labels.
const CHOICE_PROMPT_TEXT: Record<string, string> = {
  upheaval: 'Choose a seat to play a Slash at, or pass',
  collapse: 'Choose how Collapse costs you',
  'brave-spirit': 'Choose how {target} draws and discards',
  'clever-change': 'Choose a card to move',
  'follow-the-master': 'Choose how Follow the Master helps you',
  incarnation: 'Choose a Form skill',
  stubborn: 'Choose a card to give back; you take the others',
  'alternate:stabilization': 'Choose a card to give back; you take the others, if there are any',
  'alternate:bequeathed-strategy': 'Choose a card to give first; the other is given next',
  'alternate:sorrow': "Choose which of {target}'s Generals loses its skills",
};

export function choicePromptText(abilityId: string, locale = 'en'): string | null {
  return lookupWithBase(proseOf(locale)?.choicePrompt, abilityId) ?? lookupWithBase(CHOICE_PROMPT_TEXT, abilityId) ?? null;
}

// What a selection says by the step it leads to: competing and Blaze's picks
// (any skill's), and a skill's own step keyed "skill/step".
const STEP_SELECTION_TEXT: Record<string, { prompt: string; confirm: string; cancel?: string }> = {
  'compete-user': { prompt: 'Choose a hand card to compete with', confirm: 'Compete' },
  'compete-target': { prompt: 'Choose a hand card to compete with', confirm: 'Compete' },
  'blaze-shown': { prompt: 'Choose a hand card to show', confirm: 'Show' },
  'blaze-hit': { prompt: 'Discard a card of the same suit to deal 1 damage', confirm: 'Discard' },
  'alliance/swap': { prompt: 'Choose cards to discard for Alliance', confirm: 'Discard' },
  'draw-take': { prompt: 'Choose up to 2 seats to take a hand card from', confirm: 'Take' },
  'move-card': { prompt: 'Choose a seat to move a card from', confirm: 'Choose' },
};

// A skill's own step ("alliance/swap") is found before a step name shared by any skill.
export function stepSelectionText(step: string, locale = 'en', skillId?: string): { prompt: string; confirm: string; cancel?: string } | null {
  const keys = skillId ? [...new Set([skillId, baseSkillId(skillId)])].map((id) => `${id}/${step}`).concat(step) : [step];
  for (const key of keys) {
    const found = lookup(proseOf(locale)?.stepSelection, key) ?? lookup(STEP_SELECTION_TEXT, key);
    if (found) return found;
  }
  return null;
}

export { skillIdOf };

const SKILL_NAMES: ReadonlyMap<string, string> = new Map(
  Object.values(generalsData).flatMap((g) => g.skills.map((s): [string, string] => [skillIdOf(s.name), s.name]))
);

// An Alternate skill's name by its `alternate:` skill id, in a language: the Alternate record's English
// name, or its translation.
const ALTERNATE_SKILL_NAMES_BY_LOCALE = new Map<string, ReadonlyMap<string, string>>();
function alternateSkillNames(locale: string): ReadonlyMap<string, string> {
  let names = ALTERNATE_SKILL_NAMES_BY_LOCALE.get(locale);
  if (!names) {
    const translations = alternateGeneralTranslations(locale);
    names = new Map(alternateGeneralRecords().flatMap((rec) => rec.skills.map((s): [string, string] => {
      const id = skillIdOf(s.name);
      return [`alternate:${id}`, translations[rec.id]?.skills?.[id]?.name ?? s.name];
    })));
    ALTERNATE_SKILL_NAMES_BY_LOCALE.set(locale, names);
  }
  return names;
}

const titleCase = (id: string) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// The name of an ability, for any text: a worn card's name, else a skill's
// name from the General data, else its id in Title Case.
export function abilityName(abilityId: string, locale = 'en'): string {
  const alternate = alternateSkillNames(locale).get(abilityId);
  if (alternate) return alternate;
  const card = cardDisplayData(abilityId, locale);
  // A General's skill can share an id with a card (Dong Zhuo's Wine skill and the Wine card): a
  // worn card is an ability only through its Equipment, so a skill of that id wins otherwise.
  const skill = skillNames(locale).get(abilityId);
  if (skill && card?.category !== 'equipment') return skill;
  return card?.name ?? SKILL_NAMES.get(abilityId) ?? titleCase(abilityId);
}

// A language's skill names by skill id, built once per language.
const SKILL_NAMES_BY_LOCALE = new Map<string, ReadonlyMap<string, string>>();
function skillNames(locale: string): ReadonlyMap<string, string> {
  let names = SKILL_NAMES_BY_LOCALE.get(locale);
  if (!names) {
    names = new Map(Object.values(generalTranslations(locale)).flatMap((g) => Object.entries(g.skills ?? {}).map(([id, skill]): [string, string] => [id, skill.name])));
    SKILL_NAMES_BY_LOCALE.set(locale, names);
  }
  return names;
}

// What a Compete leads to for the skill that started it: `{user}` competed
// with `{target}`. `null` for an ability that does not compete.
const COMPETE_OUTCOMES: Record<string, { won: string; lost: string }> = {
  'heavens-justice': {
    won: '{user} can play one more Slash this turn, at any distance, with one more target',
    lost: "{user} can't play a Slash this turn",
  },
  'rouse-the-tiger': {
    won: "{user} will choose a seat within {target}'s attack range; {target} deals it 1 damage",
    lost: '{target} deals 1 damage to {user}',
  },
  'intense-edge': {
    won: "{user} will take one of {target}'s cards",
    lost: 'Nothing happens',
  },
};

export function competeOutcomeText(abilityId: string, won: boolean, names: { user: string; target: string }, locale = 'en'): string | null {
  const outcome = lookupWithBase(proseOf(locale)?.competeOutcomes, abilityId) ?? lookupWithBase(COMPETE_OUTCOMES, abilityId);
  return outcome ? (won ? outcome.won : outcome.lost).replaceAll('{user}', names.user).replaceAll('{target}', names.target) : null;
}

// What a judgment's final card will do, for the skill or card that required it: by reader id
// (a card's id, or a skill's id), then outcome key. `{seat}` is the judged seat, `{owner}` the
// owner of the reader, `{source}` a third seat it acts on (a damage source).
const JUDGMENT_OUTCOMES: Record<string, Record<string, string>> = {
  lightning: {
    struck: '{seat} takes 3 thunder damage',
    moves: 'Lightning moves to the next seat',
    stays: 'Lightning stays where it is',
  },
  capture: { skip: '{seat} skips the Play Phase', spared: 'Nothing happens' },
  starvation: { skip: '{seat} skips the Draw Phase', spared: 'Nothing happens' },
  'eight-trigrams': { shan: '{seat} counts as having played a Shan', none: 'Nothing happens' },
  'eight-arrays': { shan: '{seat} counts as having played a Shan', none: 'Nothing happens' },
  unyielding: {
    'discard-or-damage': '{source} discards 2 cards or takes 1 damage',
    damage: '{source} takes 1 damage',
    spared: 'Nothing happens',
  },
  'river-goddess': { again: '{owner} takes the card and judges again', ends: 'The card is discarded and the judging ends' },
  'alternate:goddess-luo': {
    again: '{owner} sets the card aside and may judge again',
    ends: 'The card is discarded and the judging ends; {owner} takes any cards set aside',
  },
  'iron-cavalry': { unblockable: 'The Slash cannot be dodged', none: 'Nothing happens' },
  'lightning-strike': { damage: '{seat} takes 2 thunder damage', none: 'Nothing happens' },
  'dueling-heroes': {
    red: '{owner} takes the card and may play black hand cards as Duel this turn',
    black: '{owner} takes the card and may play red hand cards as Duel this turn',
  },
  'military-farm': { farm: '{owner} stashes the card as a Farm', discard: 'The card is discarded' },
  lament: {
    heal: '{seat} heals 1 HP',
    draw: '{seat} draws 2 cards',
    discard2: '{source} discards 2 cards',
    discard1: '{source} discards 1 card',
    'face-down': '{source} turns face down',
    'face-up': '{source} turns face up',
    none: 'Nothing happens',
  },
};

export interface JudgmentOutcomeNames {
  seat: string;
  owner: string;
  source: string;
}

export function judgmentOutcomeText(readerId: string, key: string, names: JudgmentOutcomeNames, locale = 'en'): string | null {
  const text = lookup(lookup(proseOf(locale)?.judgmentOutcomes, readerId), key) ?? lookup(lookup(JUDGMENT_OUTCOMES, readerId), key);
  return text === undefined ? null : text.replaceAll('{seat}', names.seat).replaceAll('{owner}', names.owner).replaceAll('{source}', names.source);
}

// The English prose tables, for the parity spec and for translation tools: every
// other language's prose file must cover exactly these ids.
export const ENGLISH_PROSE = {
  hints: ABILITY_HINTS,
  selection: SELECTION_TEXT,
  seatPick: SEAT_PICK_TEXT,
  choicePrompt: CHOICE_PROMPT_TEXT,
  stepSelection: STEP_SELECTION_TEXT,
  competeOutcomes: COMPETE_OUTCOMES,
  judgmentOutcomes: JUDGMENT_OUTCOMES,
};

// One language's prose, shaped like the English tables above.
interface ProseText {
  prompt: string;
  confirm: string;
  cancel?: string;
}
interface Prose {
  hints: Record<string, string>;
  selection: Record<string, ProseText>;
  seatPick: Record<string, string>;
  choicePrompt: Record<string, string>;
  stepSelection: Record<string, ProseText>;
  competeOutcomes: Record<string, { won: string; lost: string }>;
  judgmentOutcomes: Record<string, Record<string, string>>;
}

// Languages other than English that have prose; any other locale reads English.
const PROSE: Record<string, Prose> = { vi: viProse };

function proseOf(locale: string): Prose | undefined {
  return Object.prototype.hasOwnProperty.call(PROSE, locale) ? PROSE[locale] : undefined;
}

// An own entry of a table: an id such as 'constructor' is not an entry.
function lookup<T>(table: Readonly<Record<string, T>> | undefined, id: string): T | undefined {
  return table && Object.prototype.hasOwnProperty.call(table, id) ? table[id] : undefined;
}
