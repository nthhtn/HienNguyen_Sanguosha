import { buildContentRegistry } from './registry';
import { DECK_IDS, deckFor, undealtCardIds } from './decks';

describe('decks', () => {
  const registry = buildContentRegistry();

  it('knows the Default and Alternate decks', () => {
    expect([...DECK_IDS]).toEqual(['default', 'alternate']);
  });

  it('treats no deck as Default', () => {
    expect(deckFor(undefined)).toEqual(deckFor('default'));
  });

  it('refuses a deck it does not know', () => {
    expect(() => deckFor('nope')).toThrow('Unknown deck "nope"');
  });

  it('lists every playable registry card in the Default deck', () => {
    const listed = new Set(deckFor('default').entries.map((e) => e.cardId));
    const missing = [...registry.cards.values()].filter((c) => !c.outOfDeck && !listed.has(c.id)).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it('names the Alternate cards the game cannot play yet', () => {
    expect(undealtCardIds(deckFor('alternate'), registry).sort()).toEqual(
      ['ally-far-attack-near', 'amass', 'ascertain', 'fire-fan', 'trident-glaive', 'wu-six-swords', 'wuxie-guo'].sort()
    );
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
