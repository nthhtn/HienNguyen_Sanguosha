import { cardsData, CardData } from '../../data/cards';
import { generalsData } from '../../data/generals';
import viProse from '../../data/locales/vi/prose.json';

export interface GeneralDisplayData {
  name: string;
  title: string | null;
  skills: { name: string; text: string }[];
}

// Presentation-facing view of a general's data file, so UI code never imports
// raw content JSON.
export function generalDisplayData(id: string): GeneralDisplayData | null {
  if (!Object.prototype.hasOwnProperty.call(generalsData, id)) return null;
  const data = generalsData[id];
  return {
    name: data.name,
    title: data.title ?? null,
    skills: data.skills.map(({ name, text }) => ({ name, text })),
  };
}

export interface CardDisplayData {
  name: string;
  category: CardData['category'];
  subtype: NonNullable<CardData['subtype']> | null;
  range: number | null;
  text: string | null;
}

// Presentation-facing view of a card's data file (rules text etc.).
export function cardDisplayData(id: string): CardDisplayData | null {
  if (!Object.prototype.hasOwnProperty.call(cardsData, id)) return null;
  const data = cardsData[id];
  return {
    name: data.name,
    category: data.category,
    subtype: data.subtype ?? null,
    range: data.range ?? null,
    text: data.text ?? null,
  };
}
// What an optional ability does, for its ask, in the game's own terms.
// '{target}' stands for the seat it is aimed at.
const ABILITY_HINTS: Record<string, string> = {
  'eight-trigrams': 'Judge: on red, it counts as a Shan',
  'gender-swords': "{target} discards a hand card or lets you draw 1 card",
  axe: 'Discard 2 cards to make your Sha hit {target}',
  'green-dragon-blade': 'Play another Sha at {target}',
  'ice-sword': "Prevent the damage and discard 2 of {target}'s cards instead",
  longbow: "Discard one of {target}'s Mounts",
  'evil-hero': 'Take the card that damaged you into your hand',
  feedback: "Take one of {target}'s cards",
  unyielding: 'Judge: unless it is a heart, {target} discards 2 hand cards or takes 1 damage',
  'bestowed-rouse': 'Draw 2 cards, then give any of them away',
  'heavens-envy': 'Take the judgment card into your hand',
  devil: "Replace {target}'s judgment card with one of your hand cards",
  'river-goddess': 'Judge: keep each black card and judge again; a red card ends it',
  'bare-the-chest': 'Draw 1 fewer card; your Sha and Duel deal 1 more damage this turn',
  raid: 'Instead of drawing, take a hand card from 1 or 2 other seats',
  'brave-gesture': 'Draw 1 more card',
  'gathering-wisdom': 'Draw 1 card',
  'iron-cavalry': "Judge: on red, {target} can't play a Shan against this Sha",
  astrology: 'Look at the top cards of the draw pile and put them back in any order',
  displace: 'Discard 1 card to move the Sha to another seat in your attack range',
  'self-restraint': 'Skip your Discard Phase',
  entrench: 'Turn face down and draw 3 cards',
  godspeed: 'Skip phases to use a Sha on any seat, ignoring distance',
  'strong-bow': 'Make your Sha unblockable for {target}',
  fantasy: 'Discard a heart card to pass the damage to another seat',
  'refusing-death': 'Turn the top card of the draw pile under your General to stay alive',
  'lightning-strike': 'A seat of your choice judges: on a spade it takes 2 damage',
  'dark-magic': "Replace {target}'s judgment card with a black card, and take the old one",
  'eternal-loyalty': 'A seat of your choice draws up to its max HP',
  nirvana: 'Discard every card, draw 3, recover to 3 HP and turn face up',
  'eight-arrays': 'Judge: on red, it counts as a Shan',
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
  lament: 'Discard a card: {target} judges, and a heart, diamond, club or spade has its effect',
  incarnation: 'Choose a skill of one of your Forms',
  instigate: 'Choose a seat to play a Sha at you, or you discard one of its cards',
  'direct-instruction': "Place an Equipment card from your hand in another seat's empty slot, then draw 1 card",
};

export function abilityHint(abilityId: string, locale = 'en'): string | null {
  return lookup(proseOf(locale)?.hints, abilityId) ?? lookup(ABILITY_HINTS, abilityId) ?? null;
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
  pleasure: { prompt: 'Choose a Basic card to discard, or the Sha has no effect', confirm: 'Discard', cancel: 'Give Up' },
  decentralization: { prompt: 'Choose a hand card to discard', confirm: 'Discard' },
  lament: { prompt: 'Choose cards to discard', confirm: 'Discard' },
  'direct-instruction': { prompt: 'Choose an Equipment card to place', confirm: 'Place' },
  instigate: { prompt: 'Choose a seat to play a Sha at you', confirm: 'Choose' },
};

export function selectionText(abilityId: string, locale = 'en'): { prompt: string; confirm: string; cancel?: string } | null {
  return lookup(proseOf(locale)?.selection, abilityId) ?? lookup(SELECTION_TEXT, abilityId) ?? null;
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
};

export function seatPickText(abilityId: string, locale = 'en'): string | null {
  return lookup(proseOf(locale)?.seatPick, abilityId) ?? lookup(SEAT_PICK_TEXT, abilityId) ?? null;
}

// What a skill's pick says when it mixes seats and labels, or is all labels.
const CHOICE_PROMPT_TEXT: Record<string, string> = {
  upheaval: 'Choose a seat to play a Sha at, or pass',
  collapse: 'Choose how Collapse costs you',
  'brave-spirit': 'Choose how to draw and discard',
  'clever-change': 'Choose a card to move',
  'follow-the-master': 'Choose how Follow the Master helps you',
  incarnation: 'Choose a Form skill',
  stubborn: 'Choose a card to give back; you take the others',
};

export function choicePromptText(abilityId: string, locale = 'en'): string | null {
  return lookup(proseOf(locale)?.choicePrompt, abilityId) ?? lookup(CHOICE_PROMPT_TEXT, abilityId) ?? null;
}

// What a selection says by the step it leads to, whatever opened it:
// competing (any skill's), and Blaze's two picks.
const STEP_SELECTION_TEXT: Record<string, { prompt: string; confirm: string; cancel?: string }> = {
  'compete-user': { prompt: 'Choose a hand card to compete with', confirm: 'Compete' },
  'compete-target': { prompt: 'Choose a hand card to compete with', confirm: 'Compete' },
  'blaze-shown': { prompt: 'Choose a hand card to show', confirm: 'Show' },
  'blaze-hit': { prompt: 'Discard a card of the same suit to deal 1 damage', confirm: 'Discard' },
  pay: { prompt: 'Choose cards to discard for Alliance', confirm: 'Discard' },
  'draw-take': { prompt: 'Choose up to 2 seats to take a hand card from', confirm: 'Take' },
  'move-card': { prompt: 'Choose a seat to move a card from', confirm: 'Choose' },
};

export function stepSelectionText(step: string, locale = 'en'): { prompt: string; confirm: string; cancel?: string } | null {
  return lookup(proseOf(locale)?.stepSelection, step) ?? lookup(STEP_SELECTION_TEXT, step) ?? null;
}

// A skill's id: its English name in kebab case, apostrophes dropped
// ("Heaven's Envy" → "heavens-envy"). Stage 7's skills use these ids.
export function skillIdOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const SKILL_NAMES: ReadonlyMap<string, string> = new Map(
  Object.values(generalsData).flatMap((g) => g.skills.map((s): [string, string] => [skillIdOf(s.name), s.name]))
);

const titleCase = (id: string) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// The name of an ability, for any text: a worn card's name, else a skill's
// name from the General data, else its id in Title Case.
export function abilityName(abilityId: string): string {
  return cardDisplayData(abilityId)?.name ?? SKILL_NAMES.get(abilityId) ?? titleCase(abilityId);
}

// What a Compete leads to for the skill that started it: `{user}` competed
// with `{target}`. `null` for an ability that does not compete.
const COMPETE_OUTCOMES: Record<string, { won: string; lost: string }> = {
  'heavens-justice': {
    won: '{user} can play one more Sha this turn, at any distance, with one more target',
    lost: "{user} can't play a Sha this turn",
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
  const outcome = lookup(proseOf(locale)?.competeOutcomes, abilityId) ?? lookup(COMPETE_OUTCOMES, abilityId);
  return outcome ? (won ? outcome.won : outcome.lost).replaceAll('{user}', names.user).replaceAll('{target}', names.target) : null;
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
