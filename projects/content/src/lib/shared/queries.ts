import type { GameState } from 'engine';

// Seat-to-seat distance measured around the table over living seats only.
// Returns Infinity when either seat is missing from the living set (an
// already-eliminated or unknown seat): such a seat is unreachable rather than
// "at some distance", and a range check should treat it as out of range instead
// of crashing mid-resolution.
export function getSeatDistance(state: GameState, fromSeatId: string, toSeatId: string): number {
  const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
  const fromIdx = living.findIndex((s) => s.id === fromSeatId);
  const toIdx = living.findIndex((s) => s.id === toSeatId);
  if (fromIdx === -1 || toIdx === -1) {
    return Number.POSITIVE_INFINITY;
  }
  const n = living.length;
  const diff = Math.abs(fromIdx - toIdx);
  return Math.min(diff, n - diff);
}
