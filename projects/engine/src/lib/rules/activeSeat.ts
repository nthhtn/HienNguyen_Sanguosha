import { GameState } from '../domain/types';

// The single source of truth for "whose move is it". During GeneralSelection
// seats choose in seat order; afterwards a pending responder acts before the
// turn owner. An unknown or eliminated seat can never act.
export function getActiveSeatId(state: GameState): string | null {
  if (state.result) return null;
  if (state.phase === 'GeneralSelection') {
    const candidates = state.generalSelection?.candidates ?? {};
    return state.seats.find((s) => Object.prototype.hasOwnProperty.call(candidates, s.id))?.id ?? null;
  }
  const candidateId = state.pendingResponse?.respondingSeatId ?? state.turn.ownerSeatId;
  const seat = state.seats.find((s) => s.id === candidateId);
  return seat && !seat.eliminated ? candidateId : null;
}
