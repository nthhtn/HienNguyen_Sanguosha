import { card, harness, kwMode, registry, table } from '../generals/skills.testing';
import { colourFor, suitOf } from './suits';
import { usedCardOf } from 'engine';

// A test General whose spades count as hearts (Beauty's modifier), not in the real data.
registry.generals.set('test-beauty', { id: 'test-beauty', kingdom: 'Wu', maxHp: 3, skills: [{ id: 'test-beauty', compulsory: true, modifiers: { suitAs: { spade: 'heart' } } }] });
const withBeauty = (revealed = true) => table({}, { generals: { 'seat-a': ['test-beauty', 'filler-dong-zhuo', revealed] } });

describe('suitOf', () => {
  it("applies the seat's suit modifiers, only while its General is revealed", () => {
    const spade = card('s', 'sha', 'spade');
    expect(suitOf(withBeauty(), 'seat-a', spade, registry)).toBe('heart');
    expect(colourFor(withBeauty(), 'seat-a', spade, registry)).toBe('red');
    expect(suitOf(withBeauty(false), 'seat-a', spade, registry)).toBe('spade');
    expect(suitOf(withBeauty(), 'seat-b', spade, registry)).toBe('spade');
  });

  it('a Capture judged on that seat reads a spade as a heart, and spares the Play Phase', () => {
    const { run } = harness();
    const capture = usedCardOf(card('cp', 'capture', 'spade', 6));
    const s = run({ ...withBeauty(), zones: withBeauty().zones.map((z) => (z.id === 'drawPile' ? { ...z, cards: [card('j', 'sha', 'spade', 9)] } : z)) }, [
      { kind: 'JudgeEffect', seatId: 'seat-a', reader: { kind: 'card', card: capture } },
    ]);
    expect(s.turn.flags).toBeUndefined();
  });
});

describe('Kingdom War: the pile under each General', () => {
  it('every seat has one, face up', () => {
    const { state } = kwMode.setup(['seat-0', 'seat-1'], registry, { seed: 3, counter: 0 });
    expect(state.seats.map((s) => s.pile)).toEqual([{ zoneId: 'seat-0:pile' }, { zoneId: 'seat-1:pile' }]);
    expect(state.zones.filter((z) => z.kind === 'pile').map((z) => z.ownerSeatId)).toEqual(['seat-0', 'seat-1']);
  });
});
