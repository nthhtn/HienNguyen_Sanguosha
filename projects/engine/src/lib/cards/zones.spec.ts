import { moveCard, drawTop, findZoneByKind, judgmentZoneOf, requireZoneOfKind } from './zones';
import { CardZone, GameState } from '../domain/types';
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

  describe('missing-destination handling (never silently drop a card)', () => {
    it('moveCard throws, and does not remove the card, when toZoneId matches no zone', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [card('c1')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      expect(() => moveCard(zones, 'c1', 'discardPile')).toThrow(/Destination zone discardPile not found/);
      // the input is untouched — the card is still in the draw pile
      expect(zones.find((z) => z.id === 'draw')!.cards.map((c) => c.instanceId)).toEqual(['c1']);
    });

    it('moveCard still throws for a card that is in no zone', () => {
      const zones: CardZone[] = [{ id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] }];
      expect(() => moveCard(zones, 'ghost', 'seat-a:hand')).toThrow(/not found in any zone/);
    });

    it('drawTop throws, and does not consume the source, when toZoneId matches no zone', () => {
      const zones: CardZone[] = [{ id: 'draw', kind: 'drawPile', cards: [card('c1'), card('c2')] }];
      expect(() => drawTop(zones, 'draw', 'seat-a:hand', 2, createRng(1))).toThrow(
        /Destination zone seat-a:hand not found/
      );
      expect(zones.find((z) => z.id === 'draw')!.cards.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
    });

    it('drawTop still throws for a missing fromZoneId', () => {
      const zones: CardZone[] = [{ id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] }];
      expect(() => drawTop(zones, 'draw', 'seat-a:hand', 1, createRng(1))).toThrow(/Zone draw not found/);
    });
  });

  describe('findZoneByKind / requireZoneOfKind', () => {
    const zones: CardZone[] = [
      { id: 'the-deck', kind: 'drawPile', cards: [] },
      { id: 'the-bin', kind: 'discardPile', cards: [] },
    ];

    it('finds a well-known zone by kind regardless of the id the mode gave it', () => {
      expect(findZoneByKind(zones, 'discardPile')!.id).toBe('the-bin');
      expect(requireZoneOfKind(zones, 'drawPile').id).toBe('the-deck');
    });

    it('findZoneByKind returns undefined and requireZoneOfKind throws when no such zone exists', () => {
      expect(findZoneByKind(zones, 'judgment')).toBeUndefined();
      expect(() => requireZoneOfKind(zones, 'judgment')).toThrow(/No zone of kind 'judgment'/);
    });
  });

  describe('drawTop: reshuffle-on-exhaustion', () => {
    it('reshuffles discardPile into drawPile and completes the requested count when drawPile runs out mid-draw', () => {
      // Reshuffled cards are renamed, so identify cards by definitionId here.
      const named = (id: string) => ({ ...card(id), definitionId: id });
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [named('c1')] },
        { id: 'discard', kind: 'discardPile', cards: [named('d1'), named('d2'), named('d3')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const { zones: result, drawn } = drawTop(zones, 'draw', 'seat-a:hand', 3, createRng(1));
      expect(drawn).toHaveLength(3);
      // All 3 drawn cards must come from the union of what was already in drawPile
      // (c1) plus what was reshuffled in from discardPile (d1, d2, d3) — which
      // exact 2 of the 3 discard cards make it depends on shuffle order, but c1
      // (already in drawPile before any reshuffle) must be drawn first.
      expect(drawn.map((c) => c.definitionId).every((id) => ['c1', 'd1', 'd2', 'd3'].includes(id))).toBe(true);
      expect(drawn[0].instanceId).toBe('c1');
      const uniqueIds = new Set(drawn.map((c) => c.instanceId));
      expect(uniqueIds.size).toBe(3);
      const hand = result.find((z) => z.id === 'seat-a:hand')!;
      expect(hand.cards.map((c) => c.instanceId)).toEqual(drawn.map((c) => c.instanceId));
    });

    it('renames every reshuffled card, so its old face-up id tells nothing', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1'), card('d2'), card('d3')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const { zones: result, drawn } = drawTop(zones, 'draw', 'seat-a:hand', 1, createRng(1));
      const ids = [...drawn, ...result.find((z) => z.id === 'draw')!.cards].map((c) => c.instanceId);
      expect(ids).toHaveLength(3);
      for (const id of ids) expect(id).toMatch(/^r\d+-\d$/);
      expect(new Set(ids).size).toBe(3);
    });

    it('keeps the ids of cards held back in the discard pile', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1'), card('d2')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const { zones: result } = drawTop(zones, 'draw', 'seat-a:hand', 1, createRng(1), ['d2']);
      expect(result.find((z) => z.id === 'discard')!.cards.map((c) => c.instanceId)).toEqual(['d2']);
    });

    it('gives two one-card reshuffles different ids, though a one-card shuffle draws no randomness', () => {
      const first = drawTop(
        [
          { id: 'draw', kind: 'drawPile', cards: [] },
          { id: 'discard', kind: 'discardPile', cards: [card('d1')] },
          { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
        ],
        'draw',
        'seat-a:hand',
        1,
        createRng(1)
      );
      const discardAgain = first.zones.map((z) => (z.id === 'discard' ? { ...z, cards: [card('d2')] } : z));
      const second = drawTop(discardAgain, 'draw', 'seat-a:hand', 1, first.rng);
      expect(second.drawn[0].instanceId).not.toBe(first.drawn[0].instanceId);
    });

    it('leaves discardPile empty after reshuffling', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1'), card('d2')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const { zones: result, reshuffled } = drawTop(zones, 'draw', 'seat-a:hand', 2, createRng(1));
      const discard = result.find((z) => z.id === 'discard')!;
      expect(discard.cards).toEqual([]);
      expect(reshuffled).toBe(2);
    });

    it('reports no reshuffle when the draw pile has enough cards', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [card('c1'), card('c2')] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      expect(drawTop(zones, 'draw', 'seat-a:hand', 2, createRng(1)).reshuffled).toBe(0);
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

describe('judgmentZoneOf', () => {
  const seat = (id: string) => ({ id, judgment: { zoneId: `${id}:judgment` } });
  const state = {
    seats: [seat('a'), seat('b')],
    zones: [
      { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
  } as unknown as GameState;
  it('finds a seat’s Judgment slot through Seat.judgment', () => {
    expect(judgmentZoneOf(state, 'b')?.id).toBe('b:judgment');
  });
  it('is undefined for an unknown seat', () => {
    expect(judgmentZoneOf(state, 'ghost')).toBeUndefined();
  });
});
