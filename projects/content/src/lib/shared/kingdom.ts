import { livingSeatOrderFrom } from 'engine';
import type { GameState, Kingdom } from 'engine';

/** The seat's exposed Kingdom, or null while it has none (hidden). Read live from the Seat. */
export function exposedKingdom(state: GameState, seatId: string): Exclude<Kingdom, 'hidden'> | null {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.kingdom === 'hidden') return null;
  return seat.kingdom;
}

/** Living seats, in turn order from `seatId`, sharing its exposed Kingdom; starts with `seatId`. */
export function sameKingdomSeatIds(state: GameState, seatId: string): string[] {
  const kingdom = exposedKingdom(state, seatId);
  if (kingdom === null) return [seatId];
  return livingSeatOrderFrom(state, seatId).filter((id) => exposedKingdom(state, id) === kingdom);
}
