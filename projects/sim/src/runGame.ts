import { resolve, createRng, getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import type { Action, GameState, EngineContext } from 'engine';
import { pickRandomAction, policyById, policyIds } from 'bots';
import type { BotTurnMemory } from 'bots';

// 'random', or the id of any registered policy.
export type BotKind = string;

export function botKinds(): string[] {
  return ['random', ...policyIds()];
}

export function parseBotKind(text: string): BotKind {
  if (!botKinds().includes(text)) throw new Error(`Unknown bot "${text}". Valid bots: ${botKinds().join(', ')}`);
  return text;
}

export interface RunGameResult {
  finalState: GameState;
  actionsSubmitted: number;
}

// `policyFor`, when given, picks each acting seat's bot; otherwise `botKind` plays every seat.
export function runGame(
  initialState: GameState,
  ctx: EngineContext,
  botRngSeed: number,
  maxActions = 2000,
  botKind: BotKind = 'random',
  onStep?: (state: GameState) => void,
  policyFor?: (seatId: string) => BotKind
): RunGameResult {
  let state = initialState;
  let botRng = createRng(botRngSeed);
  const memories = new Map<string, BotTurnMemory>();
  let actionsSubmitted = 0;
  while (!state.result && actionsSubmitted < maxActions) {
    let action: Action;
    const seatId = getActiveSeatId(state);
    const kind = seatId !== null && policyFor ? policyFor(seatId) : botKind;
    if (kind === 'random') {
      const picked = pickRandomAction(state, botRng, ctx.registry);
      botRng = picked.rng;
      action = picked.action;
    } else {
      if (seatId === null) throw new Error('No seat is able to act');
      const legal = getLegalActions(state, seatId, ctx.registry);
      const decision = policyById(kind).decide(redactStateForSeat(state, seatId), seatId, legal, ctx.registry, memories.get(seatId) ?? null);
      memories.set(seatId, decision.memory);
      action = decision.action;
    }
    state = resolve(state, action, ctx).state;
    onStep?.(state);
    actionsSubmitted++;
  }
  return { finalState: state, actionsSubmitted };
}
