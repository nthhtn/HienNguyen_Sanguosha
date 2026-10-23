import { livingSeatOrderFrom } from 'engine';
import type { GameState, Kingdom } from 'engine';

/** The seat's exposed Kingdom, or null while it has none: hidden, or no General revealed yet. Read live from the Seat. */
export function exposedKingdom(state: GameState, seatId: string): Exclude<Kingdom, 'hidden'> | null {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.kingdom === 'hidden' || !seat.generals) return null; // generals is null until the seat has chosen
  if (!seat.generals.main.revealed && !seat.generals.deputy.revealed) return null;
  return seat.kingdom;
}

/** Living seats, in turn order from `seatId`, sharing its exposed Kingdom; starts with `seatId`. */
export function sameKingdomSeatIds(state: GameState, seatId: string): string[] {
  const kingdom = exposedKingdom(state, seatId);
  if (kingdom === null) return [seatId];
  return livingSeatOrderFrom(state, seatId).filter((id) => exposedKingdom(state, id) === kingdom);
}

/** Living exposed seats per Kingdom (no Ambitionist yet, so each Kingdom is one group). */
export function exposedKingdomCounts(state: GameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const seat of state.seats) {
    if (seat.eliminated) continue;
    const kingdom = exposedKingdom(state, seat.id);
    if (kingdom !== null) counts.set(kingdom, (counts.get(kingdom) ?? 0) + 1);
  }
  return counts;
}
