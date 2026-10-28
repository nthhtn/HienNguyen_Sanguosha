import cards from '../../data/decks/kingdom-wars/cards.json';
import ids from '../../data/decks/kingdom-wars/ids.json';
import texts from '../../data/decks/kingdom-wars/texts.en.json';

// The cards only the Kingdom Wars deck has (no Dynasty Wars counterpart): their names, ids and rules text,
// built from the deck's crawled data files.
export interface KingdomWarsCardData {
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
  dynastyWarsCardId: string | null;
}

const IDS = ids as Record<string, { id: string; name: string }>;
const TEXTS = texts as Record<string, string>;

const DATA: Record<string, KingdomWarsCardData> = {};
for (const card of cards.cards as RawCard[]) {
  if (card.dynastyWarsCardId !== null) continue;
  DATA[card.cardId] = {
    name: IDS[card.nameZh].name,
    nameZh: card.nameZh,
    category: card.category as KingdomWarsCardData['category'],
    subtype: card.subtype === 'weapon' ? 'weapon' : null,
    range: card.range ?? null,
    text: TEXTS[card.nameZh],
  };
}

export const kingdomWarsCardIds = (): string[] => Object.keys(DATA);

export function kingdomWarsCardData(id: string): KingdomWarsCardData | null {
  return Object.prototype.hasOwnProperty.call(DATA, id) ? DATA[id] : null;
}
