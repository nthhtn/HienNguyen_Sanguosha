import type { GameState } from '../domain/types';

// Whether a seat is dying: at 0 HP or below, unless a skill keeps it alive there
// (cards in its pile, Refusing Death) and no rescue round is asking for it.
// `seat.stash` never counts.
export function isSeatDying(state: GameState, seatId: string): boolean {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.eliminated || seat.combinedHp > 0) return false;
  const rescuing = state.pendingResponse?.reason?.kind === 'dying' && state.pendingResponse.reason.seatId === seatId;
  const pile = seat.pile ? (state.zones.find((z) => z.id === seat.pile!.zoneId)?.cards.length ?? 0) : 0;
  return rescuing || pile === 0;
}
