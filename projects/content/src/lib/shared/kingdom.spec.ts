import { exposedKingdom, sameKingdomSeatIds } from './kingdom';
import type { GameState, Seat } from 'engine';

function seat(id: string, index: number, kingdom: Seat['kingdom'], eliminated = false): Seat {
  return {
    id, index, kingdom,
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

describe('Kingdom helpers', () => {
  const state = stateWith([seat('a', 0, 'Wei'), seat('b', 1, 'Wei'), seat('c', 2, 'hidden')]);

  it('lists living seats sharing the Kingdom, starting with the given seat', () => {
    expect(sameKingdomSeatIds(state, 'a')).toEqual(['a', 'b']);
    expect(sameKingdomSeatIds(state, 'b')).toEqual(['b', 'a']);
  });

  it('returns only the seat itself when it has no Kingdom', () => {
    expect(sameKingdomSeatIds(state, 'c')).toEqual(['c']);
  });

  it('excludes dead seats', () => {
    const dead = stateWith([seat('a', 0, 'Wei'), seat('b', 1, 'Wei', true), seat('c', 2, 'hidden')]);
    expect(sameKingdomSeatIds(dead, 'a')).toEqual(['a']);
  });

  it('exposedKingdom is null for a hidden seat and the Kingdom otherwise', () => {
    expect(exposedKingdom(state, 'c')).toBeNull();
    expect(exposedKingdom(state, 'a')).toBe('Wei');
  });
});
