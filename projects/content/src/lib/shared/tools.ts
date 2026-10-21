import type { ContentRegistry, Effect, GameState, Target, UsedCard } from 'engine';
import { livingSeatOrderFrom } from 'engine';
import { colourFor } from './suits';

// The cards that cancel a Tool in a Wuxie check (Wuxie Kingdom only where its own answerCondition allows).
export const COUNTER_CARD_IDS = ['wuxie', 'wuxie-guo'];

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

// The colour a card is used as when `ctx.seatId` plays it: its first physical
// card's colour (a conversion's cards share one colour where it matters), or
// none for a card with no physical card.
export function playColour(state: GameState, ctx: { seatId: string; cardInstanceId: string }, registry: ContentRegistry): 'red' | 'black' | 'none' {
  const found = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === ctx.cardInstanceId);
  return found ? colourFor(state, ctx.seatId, found, registry) : 'none';
}
