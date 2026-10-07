import { cardsData, CardData } from '../../data/cards';
import { generalsData } from '../../data/generals';

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
  'eight-trigrams': 'Judge: On red, It counts as a Shan',
  'gender-swords': "{target} discards a hand card or lets you draw 1 card",
  axe: 'Discard 2 cards to make your Sha hit {target}',
  'green-dragon-blade': 'Play another Sha at {target}',
  'ice-sword': "Prevent the damage and discard 2 of {target}'s cards instead",
  longbow: "Discard one of {target}'s Mounts",
  'sky-scorcher': 'Add up to 2 more targets to your Sha',
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
};

export function abilityHint(abilityId: string): string | null {
  return ABILITY_HINTS[abilityId] ?? null;
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
};

export function selectionText(abilityId: string): { prompt: string; confirm: string; cancel?: string } | null {
  return SELECTION_TEXT[abilityId] ?? null;
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
