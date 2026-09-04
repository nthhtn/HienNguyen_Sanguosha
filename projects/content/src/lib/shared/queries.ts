import type { GameState } from 'engine';

export function findSeatIdForGeneral(state: GameState, generalDefinitionId: string): string | undefined {
  const seat = state.seats.find(
    (s) =>
      s.generals.main.generalDefinitionId === generalDefinitionId ||
      s.generals.deputy.generalDefinitionId === generalDefinitionId
  );
  return seat?.id;
}
