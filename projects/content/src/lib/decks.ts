import type { ContentRegistry } from 'engine';
import { cardsData } from '../../data/cards';
import type { CardPrinting } from '../../data/cards';
import alternateDeck from '../../data/decks/alternate/deck.json';

// A deck is only a distribution: which cards it holds and the suit and rank of
// each copy. Behaviour, text and range stay on the card, so a card exists once
// and decks say how it is dealt.
export const DECK_IDS = ['default', 'alternate'] as const;
export type DeckId = (typeof DECK_IDS)[number];

export interface DeckEntry {
  cardId: string;
  printings: { suit: CardPrinting['suit']; rank: number }[];
}

export interface DeckDefinition {
  id: DeckId;
  entries: DeckEntry[];
}

// Default is built from the card data: each card's own printings. The copies
// other expansions add (tagged with their expansion) stay out until expansions
// can be switched on.
function defaultDeck(): DeckDefinition {
  return {
    id: 'default',
    entries: Object.entries(cardsData).map(([cardId, data]) => ({
      cardId,
      printings: (data.printings ?? []).filter((p) => !p.expansion).map(({ suit, rank }) => ({ suit, rank })),
    })),
  };
}

const DECKS: Record<DeckId, () => DeckDefinition> = {
  default: defaultDeck,
  alternate: () => alternateDeck as DeckDefinition,
};

// No deck chosen means Default; a deck the game does not know is an error.
export function deckFor(deckId: string | undefined): DeckDefinition {
  const id = deckId ?? 'default';
  if (!Object.prototype.hasOwnProperty.call(DECKS, id)) throw new Error(`Unknown deck "${id}"`);
  return DECKS[id as DeckId]();
}

// Cards the deck lists that the registry has no definition for yet: they are
// left out of the deal until their behaviour exists.
export function undealtCardIds(deck: DeckDefinition, registry: ContentRegistry): string[] {
  return deck.entries.filter((e) => !registry.cards.has(e.cardId)).map((e) => e.cardId);
}
