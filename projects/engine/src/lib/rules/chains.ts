import { GameState } from '../domain/types';
import { livingSeatOrderFrom } from './seatOrder';

// Whether `seatId` is a living, chained seat.
export function isChained(state: GameState, seatId: string): boolean {
  const seat = state.seats.find((s) => s.id === seatId);
  return !!seat && !seat.eliminated && !!seat.chained;
}

// The other living chained seats, in turn order starting after `damagedSeatId`:
// who a wave started at that seat reaches.
export function chainWaveOrder(state: GameState, damagedSeatId: string): string[] {
  return livingSeatOrderFrom(state, damagedSeatId).filter((id) => id !== damagedSeatId && isChained(state, id));
}
