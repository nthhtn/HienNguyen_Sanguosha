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
