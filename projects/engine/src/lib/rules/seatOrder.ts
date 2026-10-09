import { GameState } from '../domain/types';

// Living seat ids in turn order, starting at `firstSeatId` (included when
// living) and wrapping round the table.
export function livingSeatOrderFrom(state: GameState, firstSeatId: string): string[] {
  const ordered = [...state.seats].sort((a, b) => a.index - b.index);
  const start = ordered.findIndex((s) => s.id === firstSeatId);
  if (start === -1) throw new Error(`Unknown seat: ${firstSeatId}`);
  return [...ordered.slice(start), ...ordered.slice(0, start)].filter((s) => !s.eliminated).map((s) => s.id);
}
