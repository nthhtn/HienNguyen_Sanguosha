import { GameState, Phase, Seat, Turn } from '../domain/types';

export const PHASE_ORDER: readonly Phase[] = ['Judgment', 'Draw', 'Play', 'Discard', 'End'];

export function advancePhaseOrTurn(state: GameState): { phase: Phase; turn: Turn } {
  const currentIndex = PHASE_ORDER.indexOf(state.phase);
  if (currentIndex < PHASE_ORDER.length - 1) {
    return { phase: PHASE_ORDER[currentIndex + 1], turn: state.turn };
  }
  return { phase: PHASE_ORDER[0], turn: advanceTurn(state.turn, state.seats) };
}

function advanceTurn(turn: Turn, seats: Seat[]): Turn {
  if (turn.extraTurnStack.length > 0) {
    const nextSeatId = turn.extraTurnStack[turn.extraTurnStack.length - 1];
    return {
      turnNumber: turn.turnNumber + 1,
      ownerSeatId: nextSeatId,
      extraTurnStack: turn.extraTurnStack.slice(0, -1),
    };
  }
  const livingSeats = seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
  const currentIdx = livingSeats.findIndex((s) => s.id === turn.ownerSeatId);
  const nextSeat = livingSeats[(currentIdx + 1) % livingSeats.length];
  return { turnNumber: turn.turnNumber + 1, ownerSeatId: nextSeat.id, extraTurnStack: [] };
}
