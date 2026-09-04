import { RngState, nextInt } from '../rng/rng';
import { CardInstance } from '../domain/types';

export interface DeckSpecEntry {
  definitionId: string;
  suit: CardInstance['suit'];
  rank: number;
}

export function buildDeck(entries: DeckSpecEntry[], rng: RngState): { cards: CardInstance[]; rng: RngState } {
  const cards: CardInstance[] = entries.map((entry, index) => ({
    instanceId: `${entry.definitionId}-${entry.suit}-${entry.rank}-${index}`,
    definitionId: entry.definitionId,
    suit: entry.suit,
    rank: entry.rank,
  }));

  let currentRng = rng;
  for (let i = cards.length - 1; i > 0; i--) {
    const step = nextInt(currentRng, i + 1);
    currentRng = step.rng;
    const j = step.value;
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, rng: currentRng };
}
