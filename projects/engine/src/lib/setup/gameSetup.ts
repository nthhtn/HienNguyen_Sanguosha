import { GameRules, GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { createRng } from '../rng/rng';

export function createGame(
  mode: GameModeDefinition,
  registry: ContentRegistry,
  seatIds: string[],
  rngSeed: number,
  rules?: GameRules
): GameState {
  const { state } = mode.setup(seatIds, registry, createRng(rngSeed), rules);
  return state;
}
