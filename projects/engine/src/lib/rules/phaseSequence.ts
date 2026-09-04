import { GameState, Phase, Seat, Turn } from '../domain/types';

export const PHASE_ORDER: readonly Phase[] = ['Judgment', 'Draw', 'Play', 'Discard', 'End'];

export function advancePhaseOrTurn(state: GameState): { phase: Phase; turn: Turn } {
  const currentIndex = PHASE_ORDER.indexOf(state.phase);
  // An unrecognized phase means a real bug upstream, not a case to paper over
  // by silently restarting the phase sequence.
  if (currentIndex === -1) {
    throw new Error(`Unrecognized phase: ${state.phase}`);
  }
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
  const ordered = [...seats].sort((a, b) => a.index - b.index);
  const currentIdx = ordered.findIndex((s) => s.id === turn.ownerSeatId);
  if (currentIdx === -1) {
    throw new Error(`Cannot advance the turn: unknown current turn owner ${turn.ownerSeatId}`);
  }
  // Walk clockwise from the current owner's seat position rather than from its
  // position within the living-seats subsequence: the current owner may itself
  // have just been eliminated, and turn order must still continue from where it
  // sat rather than restarting at the first living seat.
  for (let step = 1; step <= ordered.length; step++) {
    const candidate = ordered[(currentIdx + step) % ordered.length];
    if (!candidate.eliminated) {
      return { turnNumber: turn.turnNumber + 1, ownerSeatId: candidate.id, extraTurnStack: [] };
    }
  }
  // Zero living seats. The mode's win condition should already have ended the
  // game before this point, so reaching here is a bug worth reporting loudly
  // rather than falling back to an arbitrary seat.
  throw new Error('Cannot advance the turn: every seat is eliminated');
}
