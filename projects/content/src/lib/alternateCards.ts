import cards from '../../data/decks/alternate/cards.json';
import ids from '../../data/decks/alternate/ids.json';
import texts from '../../data/decks/alternate/texts.en.json';

// The cards only the Alternate deck has (no Default counterpart): their names, ids and rules text,
// built from the deck's crawled data files.
export interface AlternateCardData {
  name: string;
  nameZh: string;
  category: 'tool' | 'equipment';
  subtype: 'weapon' | null;
  range: number | null;
  text: string;
}

interface RawCard {
  nameZh: string;
  category: string;
  subtype?: string;
  range?: number;
  cardId: string;
  defaultCardId: string | null;
}

const IDS = ids as Record<string, { id: string; name: string }>;
const TEXTS = texts as Record<string, string>;

const DATA: Record<string, AlternateCardData> = {};
for (const card of cards.cards as RawCard[]) {
  if (card.defaultCardId !== null) continue;
  DATA[card.cardId] = {
    name: IDS[card.nameZh].name,
    nameZh: card.nameZh,
    category: card.category as AlternateCardData['category'],
    subtype: card.subtype === 'weapon' ? 'weapon' : null,
    range: card.range ?? null,
    text: TEXTS[card.nameZh],
  };
}

export const alternateCardIds = (): string[] => Object.keys(DATA);

export function alternateCardData(id: string): AlternateCardData | null {
  return Object.prototype.hasOwnProperty.call(DATA, id) ? DATA[id] : null;
}
