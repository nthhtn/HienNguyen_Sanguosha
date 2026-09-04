import { GameState, GameEvent } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action } from './actions';
import { applyEffect } from './effects';

export interface EngineContext {
  registry: ContentRegistry;
  mode: GameModeDefinition;
}

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
}

export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  switch (action.kind) {
    case 'DrawCardsAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      return applyEffect(state, { kind: 'DrawCardsEffect', seatId: action.seatId, count: action.count });
    }
    default:
      throw new Error(`Action kind not yet handled by resolve(): ${action.kind}`);
  }
}
