import { GameState, Target } from '../domain/types';
import { Action } from '../pipeline/actions';

export function getLegalTargets(state: GameState, seatId: string): Target[] {
  return state.seats
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => ({ kind: 'seat', seatId: s.id }));
}

export function getLegalActions(state: GameState, seatId: string): Action[] {
  if (state.result) return [];

  if (state.pendingResponse) {
    const pending = state.pendingResponse;
    if (pending.respondingSeatId !== seatId) return [];
    const actions: Action[] = [];
    if (pending.allowedActionKinds.includes('PassAction')) {
      actions.push({ kind: 'PassAction', seatId, pendingResponseId: pending.id });
    }
    if (pending.allowedActionKinds.includes('RespondAction')) {
      const seat = state.seats.find((s) => s.id === seatId);
      const handZone = seat && state.zones.find((z) => z.id === seat.hand.zoneId);
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

  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) return [];
  const handZone = state.zones.find((z) => z.id === seat.hand.zoneId);
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
