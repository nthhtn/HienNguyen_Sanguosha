import { GameState, Seat } from '../domain/types';

function requireSeat(state: GameState, seatId: string): Seat {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  return seat;
}

// The most cards a seat may keep through its Discard phase: its current HP.
// Skills that change the limit hook in here, the only place it is computed.
export function handLimit(state: GameState, seatId: string): number {
  return Math.max(0, requireSeat(state, seatId).combinedHp);
}

// How many cards the seat must still discard to get down to its hand limit.
export function cardsOverHandLimit(state: GameState, seatId: string): number {
  const seat = requireSeat(state, seatId);
  const handSize = state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
  return Math.max(0, handSize - handLimit(state, seatId));
}
