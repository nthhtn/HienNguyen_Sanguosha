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
  'eight-trigrams': 'Judge: on red, it counts as a Shan',
  'gender-swords': "{target} discards a hand card or lets you draw 1 card",
  axe: 'Discard 2 cards to make your Sha hit {target}',
  'green-dragon-blade': 'Play another Sha at {target}',
  'ice-sword': "Prevent the damage and discard 2 of {target}'s cards instead",
  longbow: "Discard one of {target}'s Mounts",
  'sky-scorcher': 'Add up to 2 more targets to your Sha',
};

export function abilityHint(abilityId: string): string | null {
  return ABILITY_HINTS[abilityId] ?? null;
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
