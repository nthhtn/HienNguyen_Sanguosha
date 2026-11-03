import { attackRange, buildContentRegistry, seatDistance } from 'content';
import type { CardInstance, GameState } from 'engine';
import { DISTANCE_EXAMPLE } from './distance-example';

// The Distance page draws a fixed table. Its numbers are checked here against the content project's own
// distance rules, so the picture cannot drift from the game.
function tableOf(example: typeof DISTANCE_EXAMPLE): GameState {
  const ids = example.seats.map((seat) => `seat-${seat.n}`);
  const mounts: Record<string, CardInstance[]> = Object.fromEntries(
    example.seats.filter((seat) => seat.mount).map((seat) => [`seat-${seat.n}:equip`, [{ instanceId: `mount-${seat.n}`, definitionId: seat.mount!, suit: 'spade', rank: 7 }]]),
  );
  return {
    seats: example.seats.map((seat, index) => ({
      id: `seat-${seat.n}`, index, kingdom: seat.force, eliminated: !!seat.out,
      generals: { main: { generalDefinitionId: `${seat.general}`, revealed: true }, deputy: { generalDefinitionId: `${seat.general}`, revealed: true } },
      combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `seat-${seat.n}:hand` }, equipped: { zoneId: `seat-${seat.n}:equip` }, judgment: { zoneId: `seat-${seat.n}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-1', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: mounts[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('the Distance page example', () => {
  const registry = buildContentRegistry();
  const state = tableOf(DISTANCE_EXAMPLE);

  it('seat 1 attacks with the range the example states', () => {
    expect(attackRange(state, 'seat-1', registry)).toBe(DISTANCE_EXAMPLE.range);
  });

  it.each(DISTANCE_EXAMPLE.seats.filter((seat) => seat.distance !== undefined))('seat $n is at the stated distance from seat 1', (seat) => {
    expect(seatDistance(state, 'seat-1', `seat-${seat.n}`, registry)).toBe(seat.distance);
  });

  it('shows a knocked-out seat, a mount and a distance that a mount lengthens', () => {
    expect(DISTANCE_EXAMPLE.seats.some((seat) => seat.out)).toBe(true);
    expect(DISTANCE_EXAMPLE.seats.some((seat) => seat.mount === 'shadow-runner')).toBe(true);
  });
});
