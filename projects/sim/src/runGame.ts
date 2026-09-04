import { resolve, createRng } from 'engine';
import type { GameState, EngineContext } from 'engine';
import { pickRandomAction } from './bot';

export interface RunGameResult {
  finalState: GameState;
  actionsSubmitted: number;
}

export function runGame(
  initialState: GameState,
  ctx: EngineContext,
  botRngSeed: number,
  maxActions = 2000
): RunGameResult {
  let state = initialState;
  let botRng = createRng(botRngSeed);
  let actionsSubmitted = 0;
  while (!state.result && actionsSubmitted < maxActions) {
    const picked = pickRandomAction(state, botRng);
    botRng = picked.rng;
    const result = resolve(state, picked.action, ctx);
    state = result.state;
    actionsSubmitted++;
  }
  return { finalState: state, actionsSubmitted };
}
