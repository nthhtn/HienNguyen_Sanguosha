import { nextInt } from 'engine';
import { getLegalActions } from 'engine';
import type { GameState, RngState, Action } from 'engine';

// Returns the seat whose turn it is to submit an action, or null when no seat
// can act — an unknown or eliminated seat is never able to act, even if it is
// still named as the turn owner or as a pending response's responder.
export function seatToAct(state: GameState): string | null {
  const candidateId = state.pendingResponse ? state.pendingResponse.respondingSeatId : state.turn.ownerSeatId;
  const seat = state.seats.find((s) => s.id === candidateId);
  return seat && !seat.eliminated ? candidateId : null;
}

export function pickRandomAction(state: GameState, rng: RngState): { action: Action; rng: RngState } {
  const seatId = seatToAct(state);
  if (seatId === null) {
    throw new Error(
      'No seat is able to act: the turn owner / pending responder is unknown or eliminated ' +
        `(turn owner ${state.turn.ownerSeatId}, responder ${state.pendingResponse?.respondingSeatId ?? 'none'})`
    );
  }
  const legal = getLegalActions(state, seatId);
  if (legal.length === 0) {
    throw new Error(`No legal actions for seat ${seatId} to act with`);
  }
  const step = nextInt(rng, legal.length);
  return { action: legal[step.value], rng: step.rng };
}
