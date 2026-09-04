import { moveCard, drawTop } from './zones';
import { CardZone } from '../domain/types';

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
    const { zones: result, drawn } = drawTop(zones, 'draw', 'seat-a:hand', 2);
    expect(drawn.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
    const hand = result.find((z) => z.id === 'seat-a:hand')!;
    expect(hand.cards.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
  });
});
