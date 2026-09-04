import { moveCard, drawTop } from './zones';
import { CardZone } from '../domain/types';
import { createRng } from '../rng/rng';

function card(instanceId: string): { instanceId: string; definitionId: string; suit: 'spade'; rank: number } {
  return { instanceId, definitionId: 'sha', suit: 'spade', rank: 1 };
}

describe('zones', () => {
  it('moveCard relocates a card from whichever zone holds it to the target zone', () => {
    const zones: CardZone[] = [
      { id: 'draw', kind: 'drawPile', cards: [card('c1'), card('c2')] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
    ];
    const result = moveCard(zones, 'c1', 'seat-a:hand');
    const draw = result.find((z) => z.id === 'draw')!;
    const hand = result.find((z) => z.id === 'seat-a:hand')!;
    expect(draw.cards.map((c) => c.instanceId)).toEqual(['c2']);
    expect(hand.cards.map((c) => c.instanceId)).toEqual(['c1']);
  });

  it('drawTop moves the first N cards and reports what was drawn', () => {
    const zones: CardZone[] = [
      { id: 'draw', kind: 'drawPile', cards: [card('c1'), card('c2'), card('c3')] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
    ];
    const { zones: result, drawn, rng } = drawTop(zones, 'draw', 'seat-a:hand', 2, createRng(1));
    expect(drawn.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
    const hand = result.find((z) => z.id === 'seat-a:hand')!;
    expect(hand.cards.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
    // No reshuffle needed here (draw pile had enough cards), so rng passes through unchanged.
    expect(rng).toEqual(createRng(1));
  });

  describe('drawTop: reshuffle-on-exhaustion', () => {
    it('reshuffles discardPile into drawPile and completes the requested count when drawPile runs out mid-draw', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [card('c1')] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1'), card('d2'), card('d3')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const { zones: result, drawn } = drawTop(zones, 'draw', 'seat-a:hand', 3, createRng(1));
      expect(drawn).toHaveLength(3);
      // All 3 drawn cards must come from the union of what was already in drawPile
      // (c1) plus what was reshuffled in from discardPile (d1, d2, d3) — which
      // exact 2 of the 3 discard cards make it depends on shuffle order, but c1
      // (already in drawPile before any reshuffle) must be drawn first.
      expect(drawn.map((c) => c.instanceId).every((id) => ['c1', 'd1', 'd2', 'd3'].includes(id))).toBe(true);
      expect(drawn[0].instanceId).toBe('c1');
      const uniqueIds = new Set(drawn.map((c) => c.instanceId));
      expect(uniqueIds.size).toBe(3);
      const hand = result.find((z) => z.id === 'seat-a:hand')!;
      expect(hand.cards.map((c) => c.instanceId)).toEqual(drawn.map((c) => c.instanceId));
    });

    it('leaves discardPile empty after reshuffling', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1'), card('d2')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const { zones: result } = drawTop(zones, 'draw', 'seat-a:hand', 2, createRng(1));
      const discard = result.find((z) => z.id === 'discard')!;
      expect(discard.cards).toEqual([]);
    });

    it('draws as many cards as available and stops, without crashing, when drawPile and discardPile combined cannot satisfy count', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [card('c1')] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      expect(() => drawTop(zones, 'draw', 'seat-a:hand', 10, createRng(1))).not.toThrow();
      const { zones: result, drawn } = drawTop(zones, 'draw', 'seat-a:hand', 10, createRng(1));
      expect(drawn).toHaveLength(2);
      const draw = result.find((z) => z.id === 'draw')!;
      const discard = result.find((z) => z.id === 'discard')!;
      expect(draw.cards).toEqual([]);
      expect(discard.cards).toEqual([]);
    });

    it('returns an updated rng, distinct from the input, when a reshuffle actually happened', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1'), card('d2'), card('d3')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const inputRng = createRng(1);
      const { rng } = drawTop(zones, 'draw', 'seat-a:hand', 2, inputRng);
      expect(rng).not.toEqual(inputRng);
    });

    it('does not reshuffle (and rng passes through unchanged) when drawPile already has enough cards', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [card('c1'), card('c2')] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const inputRng = createRng(1);
      const { rng, zones: result } = drawTop(zones, 'draw', 'seat-a:hand', 2, inputRng);
      expect(rng).toEqual(inputRng);
      const discard = result.find((z) => z.id === 'discard')!;
      expect(discard.cards.map((c) => c.instanceId)).toEqual(['d1']);
    });
  });
});
