import type { Action, ContentRegistry, GameState } from 'engine';

// A bot may take at most this many actions in one turn before it ends its phase.
export const MAX_BOT_ACTIONS_PER_TURN = 30;

export interface BotTurnMemory {
  turnNumber: number;
  shaPlayed: number;
  actionsThisTurn: number;
}

export interface BotDecision {
  action: Action;
  memory: BotTurnMemory;
}

export interface BotPolicy {
  readonly id: string;
  // `view` is the bot seat's redacted view; `legal` is the engine's legal
  // actions for that seat. The returned action is always one of `legal`.
  decide(view: GameState, seatId: string, legal: Action[], registry: ContentRegistry, memory: BotTurnMemory | null): BotDecision;
}
