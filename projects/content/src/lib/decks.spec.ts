import { buildContentRegistry } from './registry';
import { alternateCardData } from './alternateCards';
import { DECK_IDS, deckFor, deckIdOf, undealtCardIds } from './decks';

describe('decks', () => {
  const registry = buildContentRegistry();

  it('knows the Default and Alternate decks', () => {
    expect([...DECK_IDS]).toEqual(['default', 'alternate']);
  });

  it('treats no deck as Default', () => {
    expect(deckFor(undefined)).toEqual(deckFor('default'));
  });

  it('reads a deck id from loosely typed rules, falling back to Default', () => {
    expect(deckIdOf('alternate')).toBe('alternate');
    expect(deckIdOf('default')).toBe('default');
    expect(deckIdOf(undefined)).toBe('default');
    expect(deckIdOf('bogus')).toBe('default');
  });

  it('refuses a deck it does not know', () => {
    expect(() => deckFor('nope')).toThrow('Unknown deck "nope"');
  });

  it('lists every playable registry card in the Default deck', () => {
    const listed = new Set(deckFor('default').entries.map((e) => e.cardId));
    const missing = [...registry.cards.values()].filter((c) => !c.outOfDeck && !alternateCardData(c.id) && !listed.has(c.id)).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it('names the Alternate cards the game cannot play yet', () => {
    expect(undealtCardIds(deckFor('alternate'), registry)).toEqual(['fire-fan']);
  });

  it('prints only real suits and ranks in the Alternate deck', () => {
    const printings = deckFor('alternate').entries.flatMap((e) => e.printings);
    expect(printings).toHaveLength(108);
    for (const p of printings) {
      expect(['spade', 'heart', 'club', 'diamond']).toContain(p.suit);
      expect(p.rank).toBeGreaterThanOrEqual(1);
      expect(p.rank).toBeLessThanOrEqual(13);
    }
  });
});
