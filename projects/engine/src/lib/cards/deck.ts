import { RngState, shuffle } from '../rng/rng';
import { CardInstance } from '../domain/types';

export interface DeckSpecEntry {
  definitionId: string;
  suit: CardInstance['suit'];
  rank: number;
}

export function buildDeck(entries: DeckSpecEntry[], rng: RngState): { cards: CardInstance[]; rng: RngState } {
  const ordered: CardInstance[] = entries.map((entry, index) => ({
    instanceId: `${entry.definitionId}-${entry.suit}-${entry.rank}-${index}`,
    definitionId: entry.definitionId,
    suit: entry.suit,
    rank: entry.rank,
  }));

  const { items: cards, rng: currentRng } = shuffle(ordered, rng);
  return { cards, rng: currentRng };
}
