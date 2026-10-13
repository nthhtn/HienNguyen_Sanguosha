import { RngState, shuffle } from '../rng/rng';
import { CardInstance } from '../domain/types';

export interface DeckSpecEntry {
  definitionId: string;
  suit: CardInstance['suit'];
  rank: number;
}

export function buildDeck(entries: DeckSpecEntry[], rng: RngState): { cards: CardInstance[]; rng: RngState } {
  const { items, rng: currentRng } = shuffle(entries, rng);
  // Ids are given after the shuffle, by place in the deck: a hidden card's id
  // must not tell anyone what the card is.
  const cards = items.map((entry, position) => ({
    instanceId: `card-${position}`,
    definitionId: entry.definitionId,
    suit: entry.suit,
    rank: entry.rank,
  }));
  return { cards, rng: currentRng };
}
