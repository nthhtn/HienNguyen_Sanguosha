import { resolve, createRng, getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import type { Action, GameState, EngineContext } from 'engine';
import { pickRandomAction, ruleBasedPolicy } from 'bots';
import type { BotTurnMemory } from 'bots';

export type BotKind = 'random' | 'rule-based';

export interface RunGameResult {
  finalState: GameState;
  actionsSubmitted: number;
}

export function runGame(
  initialState: GameState,
  ctx: EngineContext,
  botRngSeed: number,
  maxActions = 2000,
  botKind: BotKind = 'random',
  onStep?: (state: GameState) => void
): RunGameResult {
  let state = initialState;
  let botRng = createRng(botRngSeed);
  const memories = new Map<string, BotTurnMemory>();
  let actionsSubmitted = 0;
  while (!state.result && actionsSubmitted < maxActions) {
    let action: Action;
    if (botKind === 'random') {
      const picked = pickRandomAction(state, botRng, ctx.registry);
      botRng = picked.rng;
      action = picked.action;
    } else {
      const seatId = getActiveSeatId(state);
      if (seatId === null) throw new Error('No seat is able to act');
      const legal = getLegalActions(state, seatId, ctx.registry);
      const decision = ruleBasedPolicy.decide(redactStateForSeat(state, seatId), seatId, legal, ctx.registry, memories.get(seatId) ?? null);
      memories.set(seatId, decision.memory);
      action = decision.action;
    }
    state = resolve(state, action, ctx).state;
    onStep?.(state);
    actionsSubmitted++;
  }
  return { finalState: state, actionsSubmitted };
}
