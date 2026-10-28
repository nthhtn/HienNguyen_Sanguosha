import { buildContentRegistry } from './registry';
import { kingdomWarsCardData } from './kingdomWarsCards';
import { DECK_IDS, deckFor, deckIdOf, undealtCardIds } from './decks';

describe('decks', () => {
  const registry = buildContentRegistry();

  it('knows the Identity and Kingdom Wars decks', () => {
    expect([...DECK_IDS]).toEqual(['identity', 'kingdomWars']);
  });

  it('treats no deck as Kingdom Wars', () => {
    expect(deckFor(undefined)).toEqual(deckFor('kingdomWars'));
  });

  it('reads a deck id from loosely typed rules, falling back to Kingdom Wars', () => {
    expect(deckIdOf('kingdomWars')).toBe('kingdomWars');
    expect(deckIdOf('identity')).toBe('identity');
    expect(deckIdOf(undefined)).toBe('kingdomWars');
    expect(deckIdOf('bogus')).toBe('kingdomWars');
  });

  it('refuses a deck it does not know', () => {
    expect(() => deckFor('nope')).toThrow('Unknown deck "nope"');
  });

  it('lists every playable registry card in the Identity deck', () => {
    const listed = new Set(deckFor('identity').entries.map((e) => e.cardId));
    const missing = [...registry.cards.values()].filter((c) => !c.outOfDeck && !kingdomWarsCardData(c.id) && !listed.has(c.id)).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it('leaves no Kingdom Wars card the game cannot play', () => {
    expect(undealtCardIds(deckFor('kingdomWars'), registry)).toEqual([]);
  });

  it('prints only real suits and ranks in the Kingdom Wars deck', () => {
    const printings = deckFor('kingdomWars').entries.flatMap((e) => e.printings);
    expect(printings).toHaveLength(108);
    for (const p of printings) {
      expect(['spade', 'heart', 'club', 'diamond']).toContain(p.suit);
      expect(p.rank).toBeGreaterThanOrEqual(1);
      expect(p.rank).toBeLessThanOrEqual(13);
    }
  });
});
