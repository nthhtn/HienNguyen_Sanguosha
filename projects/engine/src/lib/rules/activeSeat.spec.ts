import { getActiveSeatId } from './activeSeat';
import { GameState, Seat } from '../domain/types';
import { createRng } from '../rng/rng';

function seat(id: string, index: number, eliminated = false): Seat {
  return {
    id, index, kingdom: 'Wei',
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated,
  };
}

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
    generalSelection: null,
    ...overrides,
  };
}

describe('getActiveSeatId', () => {
  it('is the turn owner when no response is pending', () => {
    expect(getActiveSeatId(state())).toBe('seat-a');
  });

  it('is the responder when a response is pending', () => {
    const pending = {
      id: 'r1', respondingSeatId: 'seat-b', allowedActionKinds: ['PassAction'],
      context: { effect: { kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: 'seat-b' }, amount: 1 } },
    };
    expect(getActiveSeatId(state({ pendingResponse: pending }))).toBe('seat-b');
  });

  it('is null when the would-be actor is eliminated', () => {
    expect(getActiveSeatId(state({ seats: [seat('seat-a', 0, true), seat('seat-b', 1)] }))).toBeNull();
  });

  it('is null once the game has a result', () => {
    expect(getActiveSeatId(state({ result: { endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] } }))).toBeNull();
  });

  it('is the first seat, in seat order, still holding candidates during GeneralSelection', () => {
    const selecting = state({ phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-b': ['x'], 'seat-a': ['y'] } } });
    expect(getActiveSeatId(selecting)).toBe('seat-a');
    const afterA = state({ phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-b': ['x'] } } });
    expect(getActiveSeatId(afterA)).toBe('seat-b');
  });
});
