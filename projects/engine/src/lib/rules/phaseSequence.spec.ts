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
    seats, players: [], turn, phase, zones: [], pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('advancePhaseOrTurn', () => {
  it('has six phases, starting at Start', () => {
    expect(PHASE_ORDER).toEqual(['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End']);
  });

  it('cycles through phases in order without advancing the turn', () => {
    const turn = { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1)];
    let current = state('Start', turn, seats);
    for (let i = 1; i < PHASE_ORDER.length; i++) {
      const next = advancePhaseOrTurn(current);
      expect(next.phase).toBe(PHASE_ORDER[i]);
      expect(next.turn.turnNumber).toBe(1);
      current = { ...current, phase: next.phase, turn: next.turn };
    }
  });

  it('wraps to Start and advances to the next living seat clockwise after End', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1, true), seat('seat-c', 2)];
    const result = advancePhaseOrTurn(state('End', turn, seats));
    expect(result.phase).toBe('Start');
    expect(result.turn).toEqual({ turnNumber: 4, ownerSeatId: 'seat-c', extraTurnStack: [] });
  });

  it('gives priority to a queued extra turn over clockwise order', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: ['seat-c'] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2)];
    const result = advancePhaseOrTurn(state('End', turn, seats));
    expect(result.turn).toEqual({ turnNumber: 4, ownerSeatId: 'seat-c', extraTurnStack: [] });
  });

  it('continues clockwise from the current owner even when the current owner is itself eliminated', () => {
    // seat-b just died on its own turn: the next turn must be seat-c (the next
    // living seat clockwise from seat-b), not seat-a (the first living seat).
    const turn = { turnNumber: 3, ownerSeatId: 'seat-b', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1, true), seat('seat-c', 2)];
    const result = advancePhaseOrTurn(state('End', turn, seats));
    expect(result.turn).toEqual({ turnNumber: 4, ownerSeatId: 'seat-c', extraTurnStack: [] });
  });

  it('wraps back to the sole surviving seat when it is the current owner', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1, true), seat('seat-c', 2, true)];
    const result = advancePhaseOrTurn(state('End', turn, seats));
    expect(result.turn).toEqual({ turnNumber: 4, ownerSeatId: 'seat-a', extraTurnStack: [] });
  });

  it('throws rather than falling back to an arbitrary seat when every seat is eliminated', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0, true), seat('seat-b', 1, true)];
    expect(() => advancePhaseOrTurn(state('End', turn, seats))).toThrow(/every seat is eliminated/);
  });

  it('throws for an unknown current turn owner', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'ghost-seat', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1)];
    expect(() => advancePhaseOrTurn(state('End', turn, seats))).toThrow(/unknown current turn owner ghost-seat/);
  });

  it('throws for an unrecognized phase rather than silently restarting at Judgment', () => {
    const turn = { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1)];
    const bogus = { ...state('Play', turn, seats), phase: 'NotAPhase' as unknown as GameState['phase'] };
    expect(() => advancePhaseOrTurn(bogus)).toThrow(/Unrecognized phase: NotAPhase/);
  });
});
