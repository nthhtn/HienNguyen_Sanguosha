import { getSeatDistance } from './queries';
import type { GameState, Seat } from 'engine';

function seat(id: string, index: number, eliminated = false): Seat {
  return {
    id, index, kingdom: 'Wei',
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated,
  };
}

function stateWith(seats: Seat[]): GameState {
  return {
    seats, players: [],
    turn: { turnNumber: 1, ownerSeatId: seats[0].id, extraTurnStack: [] },
    phase: 'Play', zones: [], pendingResponse: null, log: [],
    rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('getSeatDistance', () => {
  it('measures the shorter way around the table over living seats', () => {
    const state = stateWith([seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2), seat('seat-d', 3)]);
    expect(getSeatDistance(state, 'seat-a', 'seat-b')).toBe(1);
    expect(getSeatDistance(state, 'seat-a', 'seat-c')).toBe(2);
    expect(getSeatDistance(state, 'seat-a', 'seat-d')).toBe(1); // wraps around
    expect(getSeatDistance(state, 'seat-a', 'seat-a')).toBe(0);
  });

  it('closes the gap left by an eliminated seat', () => {
    const state = stateWith([seat('seat-a', 0), seat('seat-b', 1, true), seat('seat-c', 2)]);
    expect(getSeatDistance(state, 'seat-a', 'seat-c')).toBe(1);
  });

  it('returns Infinity, rather than throwing, for an eliminated seat', () => {
    const state = stateWith([seat('seat-a', 0), seat('seat-b', 1, true), seat('seat-c', 2)]);
    expect(getSeatDistance(state, 'seat-a', 'seat-b')).toBe(Number.POSITIVE_INFINITY);
    expect(getSeatDistance(state, 'seat-b', 'seat-c')).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns Infinity, rather than throwing, for an unknown seat id', () => {
    const state = stateWith([seat('seat-a', 0), seat('seat-b', 1)]);
    expect(getSeatDistance(state, 'seat-a', 'ghost-seat')).toBe(Number.POSITIVE_INFINITY);
  });
});
