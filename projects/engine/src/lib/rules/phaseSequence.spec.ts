import { advancePhaseOrTurn, PHASE_ORDER } from './phaseSequence';
import { GameState, Seat } from '../domain/types';
import { createRng } from '../rng/rng';

function seat(id: string, index: number, eliminated = false): Seat {
  return {
    id, index, kingdom: 'Wei',
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated,
  };
}

function state(phase: GameState['phase'], turn: GameState['turn'], seats: Seat[]): GameState {
  return {
    seats, players: [], turn, phase, zones: [], pendingResponse: null, log: [], rng: createRng(1), result: null,
  };
}

describe('advancePhaseOrTurn', () => {
  it('cycles through phases in order without advancing the turn', () => {
    const turn = { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1)];
    let current = state('Judgment', turn, seats);
    for (let i = 1; i < PHASE_ORDER.length; i++) {
      const next = advancePhaseOrTurn(current);
      expect(next.phase).toBe(PHASE_ORDER[i]);
      expect(next.turn.turnNumber).toBe(1);
      current = { ...current, phase: next.phase, turn: next.turn };
    }
  });

  it('wraps to Judgment and advances to the next living seat clockwise after End', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1, true), seat('seat-c', 2)];
    const result = advancePhaseOrTurn(state('End', turn, seats));
    expect(result.phase).toBe('Judgment');
    expect(result.turn).toEqual({ turnNumber: 4, ownerSeatId: 'seat-c', extraTurnStack: [] });
  });

  it('gives priority to a queued extra turn over clockwise order', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: ['seat-c'] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2)];
    const result = advancePhaseOrTurn(state('End', turn, seats));
    expect(result.turn).toEqual({ turnNumber: 4, ownerSeatId: 'seat-c', extraTurnStack: [] });
  });
});
