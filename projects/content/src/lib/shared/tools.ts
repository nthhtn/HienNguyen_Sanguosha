import type { Effect, GameState, Target } from 'engine';
import { livingSeatOrderFrom, usedCardOf } from 'engine';

// The cards that cancel a Tool in a Wuxie check.
export const COUNTER_CARD_IDS = ['wuxie'];

// One ToolOnTargetEffect per target, in the order given, for the Tool card
// `cardInstanceId` that `userSeatId` is playing. `extra` rides along with each
// (Coerce's victim).
export function toolOnTargets(state: GameState, userSeatId: string, cardInstanceId: string, targets: Target[], extra?: Target[]): Effect[] {
  const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === cardInstanceId);
  if (!card) throw new Error(`Tool card ${cardInstanceId} is in no zone`);
  const tool = usedCardOf(card);
  return targets.map((target) => ({ kind: 'ToolOnTargetEffect', tool, userSeatId, target, ...(extra ? { extra } : {}), counterCardIds: COUNTER_CARD_IDS }));
}

// Every other living seat as a target, in turn order from the seat after `seatId`.
export function otherSeatsInTurnOrder(state: GameState, seatId: string): Target[] {
  return livingSeatOrderFrom(state, seatId).slice(1).map((id) => ({ kind: 'seat', seatId: id }));
}
