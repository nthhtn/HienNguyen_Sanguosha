import type { Effect, GameState, Target, UsedCard } from 'engine';
import { livingSeatOrderFrom } from 'engine';

// The cards that cancel a Tool in a Wuxie check.
export const COUNTER_CARD_IDS = ['wuxie'];

// One ToolOnTargetEffect per target, in the order given, for `tool` (the Tool
// card as `userSeatId` uses it: itself, a conversion's card, or a skill's card
// with no physical card). `extra` rides along with each (Coerce's victim).
export function toolOnTargets(tool: UsedCard, userSeatId: string, targets: Target[], extra?: Target[]): Effect[] {
  return targets.map((target) => ({ kind: 'ToolOnTargetEffect', tool, userSeatId, target, ...(extra ? { extra } : {}), counterCardIds: COUNTER_CARD_IDS }));
}

// Every other living seat as a target, in turn order from the seat after `seatId`.
export function otherSeatsInTurnOrder(state: GameState, seatId: string): Target[] {
  return livingSeatOrderFrom(state, seatId).slice(1).map((id) => ({ kind: 'seat', seatId: id }));
}
