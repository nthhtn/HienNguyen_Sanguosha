import type { GameState } from 'engine';

export function findSeatIdForGeneral(state: GameState, generalDefinitionId: string): string | undefined {
  const seat = state.seats.find(
    (s) =>
      s.generals.main.generalDefinitionId === generalDefinitionId ||
      s.generals.deputy.generalDefinitionId === generalDefinitionId
  );
  return seat?.id;
}

export function getSeatDistance(state: GameState, fromSeatId: string, toSeatId: string): number {
  const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
  const fromIdx = living.findIndex((s) => s.id === fromSeatId);
  const toIdx = living.findIndex((s) => s.id === toSeatId);
  if (fromIdx === -1 || toIdx === -1) {
    throw new Error('Seat not found among living seats');
  }
  const n = living.length;
  const diff = Math.abs(fromIdx - toIdx);
  return Math.min(diff, n - diff);
}
