import { GameState } from '../domain/types';

// The single source of truth for "whose move is it". During GeneralSelection
// seats choose in seat order; afterwards a pending chooser, selector or
// arranger, then a pending responder, acts before the turn owner. An unknown or eliminated seat can never act.
export function getActiveSeatId(state: GameState): string | null {
  if (state.result) return null;
  if (state.phase === 'GeneralSelection') {
    const candidates = state.generalSelection?.candidates ?? {};
    return state.seats.find((s) => Object.prototype.hasOwnProperty.call(candidates, s.id))?.id ?? null;
  }
  if (state.judgmentView?.settled) return noticeSeatId(state);
  const candidateId =
    state.pendingChoice?.seatId ??
    state.pendingSelection?.seatId ??
    state.pendingArrangement?.seatId ??
    state.pendingResponse?.respondingSeatId ??
    state.turn.ownerSeatId;
  const seat = state.seats.find((s) => s.id === candidateId);
  return seat && !seat.eliminated ? candidateId : null;
}

// Whether a seat owes a decision that pauses the queue: a response, a choice,
// a selection, an arrangement or a judgment waiting to be acknowledged.
export function decisionPending(state: GameState): boolean {
  return !!state.judgmentView?.settled || !!state.pendingResponse || !!state.pendingChoice || !!state.pendingSelection || !!state.pendingArrangement;
}

// Who acts on a settled judgment: the first living human in seat order, else the
// judged seat, else the first living seat. Anyone playing a human may press Close;
// the application layer submits that as this seat's action (with `by`).
function noticeSeatId(state: GameState): string | null {
  const living = state.seats.filter((s) => !s.eliminated);
  const humanSeatIds = new Set(state.players.filter((p) => p.kind === 'human').map((p) => p.seatId));
  const judged = living.find((s) => s.id === state.judgmentView?.seatId);
  return (living.find((s) => humanSeatIds.has(s.id)) ?? judged ?? living[0])?.id ?? null;
}
