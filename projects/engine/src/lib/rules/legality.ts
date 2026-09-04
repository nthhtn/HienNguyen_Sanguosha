import { GameState, Target } from '../domain/types';
import { Action } from '../pipeline/actions';

export function getLegalTargets(state: GameState, seatId: string): Target[] {
  return state.seats
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => ({ kind: 'seat', seatId: s.id }));
}

export function getLegalActions(state: GameState, seatId: string): Action[] {
  if (state.result) return [];

  // An unknown or eliminated seat can never act, whether or not it happens to
  // be named as the turn owner or as a pending response's responder.
  const actingSeat = state.seats.find((s) => s.id === seatId);
  if (!actingSeat || actingSeat.eliminated) return [];

  if (state.pendingResponse) {
    const pending = state.pendingResponse;
    if (pending.respondingSeatId !== seatId) return [];
    const actions: Action[] = [];
    if (pending.allowedActionKinds.includes('PassAction')) {
      actions.push({ kind: 'PassAction', seatId, pendingResponseId: pending.id });
    }
    if (pending.allowedActionKinds.includes('RespondAction')) {
      const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
      for (const card of handZone?.cards ?? []) {
        if (!pending.allowedCardIds || pending.allowedCardIds.includes(card.definitionId)) {
          actions.push({
            kind: 'RespondAction',
            seatId,
            pendingResponseId: pending.id,
            cardInstanceId: card.instanceId,
          });
        }
      }
    }
    return actions;
  }

  if (state.turn.ownerSeatId !== seatId) return [];

  const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
  const targets = getLegalTargets(state, seatId);
  const actions: Action[] = [{ kind: 'EndPhaseAction', seatId }];
  for (const card of handZone?.cards ?? []) {
    actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets: [] });
    for (const target of targets) {
      actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets: [target] });
    }
  }
  return actions;
}
