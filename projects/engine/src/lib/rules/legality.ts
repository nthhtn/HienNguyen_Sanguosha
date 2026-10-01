import { GameState, Target } from '../domain/types';
import { Action } from '../pipeline/actions';
import { ContentRegistry } from '../registry/types';
import { getActiveSeatId } from './activeSeat';
import { getLegalGeneralChoices } from './generalSelection';

export function getLegalTargets(state: GameState, seatId: string): Target[] {
  return state.seats
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => ({ kind: 'seat', seatId: s.id }));
}

export function getLegalActions(state: GameState, seatId: string, registry?: ContentRegistry): Action[] {
  if (state.result) return [];

  // An unknown or eliminated seat can never act, whether or not it happens to
  // be named as the turn owner or as a pending response's responder.
  const actingSeat = state.seats.find((s) => s.id === seatId);
  if (!actingSeat || actingSeat.eliminated) return [];

  if (state.phase === 'GeneralSelection') {
    if (getActiveSeatId(state) !== seatId) return [];
    // Pairing candidates needs each general's kingdom, which lives in content.
    if (!registry) throw new Error('getLegalActions needs the content registry during GeneralSelection');
    return getLegalGeneralChoices(state, seatId, registry);
  }

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

  const actions: Action[] = [{ kind: 'EndPhaseAction', seatId }];
  // Cards are played only in the owner's Play phase.
  if (state.phase !== 'Play') return actions;
  const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
  for (const card of handZone?.cards ?? []) {
    for (const targets of legalTargetListsFor(state, seatId, card.instanceId, card.definitionId, registry)) {
      actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets });
    }
  }
  return actions;
}

// The card's own rule when it has one; legacy offers otherwise.
export function legalTargetListsFor(
  state: GameState,
  seatId: string,
  cardInstanceId: string,
  definitionId: string,
  registry?: ContentRegistry
): Target[][] {
  const definition = registry?.cards.get(definitionId);
  if (registry && definition?.legalPlayTargets) {
    return definition.legalPlayTargets(state, { seatId, cardInstanceId }, registry);
  }
  return [[], ...getLegalTargets(state, seatId).map((t) => [t])];
}
