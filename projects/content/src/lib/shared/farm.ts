import type { CardZone, Effect, GameState } from 'engine';

// A seat's stash pile, if its table has one (Deng Ai's Farms lie there).
export function stashZoneOf(state: GameState, seatId: string): CardZone | undefined {
  const seat = state.seats.find((s) => s.id === seatId);
  return seat?.stash && state.zones.find((z) => z.id === seat.stash!.zoneId);
}

// Each card in the stash is one Farm.
export const farmCount = (state: GameState, seatId: string): number => stashZoneOf(state, seatId)?.cards.length ?? 0;

// Moves `cardInstanceId` into the seat's stash (only if it still lies in `onlyFrom`).
export function stashMove(state: GameState, seatId: string, cardInstanceId: string, onlyFrom?: string): Effect {
  const zone = stashZoneOf(state, seatId);
  if (!zone) throw new Error(`Seat ${seatId} has no stash`);
  return { kind: 'MoveCardEffect', cardInstanceId, toZoneId: zone.id, ...(onlyFrom ? { onlyFrom } : {}) };
}
