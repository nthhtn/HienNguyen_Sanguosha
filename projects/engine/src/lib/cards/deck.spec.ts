import { buildDeck, DeckSpecEntry } from './deck';
import { createRng } from '../rng/rng';

function entries(): DeckSpecEntry[] {
  return [
    { definitionId: 'sha', suit: 'spade', rank: 1 },
    { definitionId: 'sha', suit: 'heart', rank: 2 },
    { definitionId: 'shan', suit: 'club', rank: 3 },
    { definitionId: 'peach', suit: 'diamond', rank: 4 },
  ];
}

describe('buildDeck', () => {
  it('includes every entry exactly once, each with a unique instance id', () => {
    const { cards } = buildDeck(entries(), createRng(1));
    expect(cards).toHaveLength(4);
    expect(new Set(cards.map((c) => c.instanceId)).size).toBe(4);
    expect(cards.map((c) => c.definitionId).sort()).toEqual(['peach', 'sha', 'sha', 'shan']);
  });

  it('is deterministic for a given seed and shuffles order for different seeds', () => {
    const a = buildDeck(entries(), createRng(1)).cards.map((c) => c.definitionId + c.suit);
    const b = buildDeck(entries(), createRng(1)).cards.map((c) => c.definitionId + c.suit);
    const c = buildDeck(entries(), createRng(2)).cards.map((c) => c.definitionId + c.suit);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
