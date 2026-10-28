import type { ContentRegistry } from 'engine';
import { cardsData } from '../../data/cards';
import type { CardPrinting } from '../../data/cards';
import kingdomWarsDeck from '../../data/decks/kingdom-wars/deck.json';

// A deck is only a distribution: which cards it holds and the suit and rank of
// each copy. Behaviour, text and range stay on the card, so a card exists once
// and decks say how it is dealt.
export const DECK_IDS = ['identity', 'kingdomWars'] as const;
export type DeckId = (typeof DECK_IDS)[number];
// The deck a game is dealt from when it names none.
export const DEFAULT_DECK_ID: DeckId = 'kingdomWars';

export interface DeckEntry {
  cardId: string;
  printings: { suit: CardPrinting['suit']; rank: number }[];
}

export interface DeckDefinition {
  id: DeckId;
  entries: DeckEntry[];
}

// Identity is built from the card data: each card's own printings. The copies
// other expansions add (tagged with their expansion) stay out until expansions
// can be switched on.
function identityDeck(): DeckDefinition {
  return {
    id: 'identity',
    entries: Object.entries(cardsData).map(([cardId, data]) => ({
      cardId,
      printings: (data.printings ?? []).filter((p) => !p.expansion).map(({ suit, rank }) => ({ suit, rank })),
    })),
  };
}

const DECKS: Record<DeckId, () => DeckDefinition> = {
  identity: identityDeck,
  kingdomWars: () => kingdomWarsDeck as DeckDefinition,
};

// The deck id in rules, which the engine types as a plain string; anything that
// is not a known deck reads as the default deck.
export function deckIdOf(id: string | undefined): DeckId {
  return (DECK_IDS as readonly string[]).includes(id ?? '') ? (id as DeckId) : DEFAULT_DECK_ID;
}

// No deck chosen means the default deck; a deck the game does not know is an error.
export function deckFor(deckId: string | undefined): DeckDefinition {
  const id = deckId ?? DEFAULT_DECK_ID;
  if (!Object.prototype.hasOwnProperty.call(DECKS, id)) throw new Error(`Unknown deck "${id}"`);
  return DECKS[id as DeckId]();
}

// Cards the deck lists that the registry has no definition for yet: they are
// left out of the deal until their behaviour exists.
export function undealtCardIds(deck: DeckDefinition, registry: ContentRegistry): string[] {
  return deck.entries.filter((e) => !registry.cards.has(e.cardId)).map((e) => e.cardId);
}
