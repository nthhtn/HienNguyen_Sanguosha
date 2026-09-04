import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { createRng } from '../rng/rng';

export function createGame(
  mode: GameModeDefinition,
  registry: ContentRegistry,
  seatIds: string[],
  rngSeed: number
): GameState {
  const { state } = mode.setup(seatIds, registry, createRng(rngSeed));
  return state;
}
