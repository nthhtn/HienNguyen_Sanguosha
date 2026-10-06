import type { CardDefinition, Effect, PendingResponse } from 'engine';
import { otherLivingSeatTargets } from '../shared/queries';
import { toolOnTargets } from '../shared/tools';

const DUEL_DAMAGE = 1;

// One step of a Duel: `responderSeatId` must play a Sha or take the damage,
// dealt by `otherSeatId`. `answeredWith` names the Sha that led here.
function duelWindow(duelInstanceId: string, responderSeatId: string, otherSeatId: string, answeredWith?: string): Effect {
  const pendingResponse: PendingResponse = {
    // Each step gets its own id: the opening one, then one per Sha answered.
    id: answeredWith ? `duel-response-${duelInstanceId}-${answeredWith}` : `duel-response-${duelInstanceId}`,
    respondingSeatId: responderSeatId,
    allowedActionKinds: ['RespondAction', 'PassAction'],
    allowedCardIds: ['sha'],
    sourceCard: { instanceId: duelInstanceId, definitionId: 'duel' },
    context: {
      effect: {
        kind: 'DamageEffect',
        damage: {
          source: { kind: 'seat', seatId: otherSeatId },
          target: { kind: 'seat', seatId: responderSeatId },
          amount: DUEL_DAMAGE,
          nature: 'normal',
          cause: { cardInstanceId: duelInstanceId },
        },
      },
    },
  };
  return { kind: 'OpenResponseEffect', pendingResponse };
}

// Duel: after its Wuxie check, starting with the target, the two seats take
// turns playing a Sha; the first who doesn't takes 1 damage from the other.
export const duelCard: CardDefinition = {
  id: 'duel',
  name: 'Duel',
  category: 'tool',
  legalPlayTargets: (state, ctx) => otherLivingSeatTargets(state, ctx.seatId),
  play: (state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    return toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, [ctx.targets[0]]);
  },
  onTarget: (_state, { tool, userSeatId, target }) => {
    if (target.kind !== 'seat' || !tool.physical[0]) return [];
    return [duelWindow(tool.physical[0].instanceId, target.seatId, userSeatId)];
  },
  // A Sha turns the Duel back on the other seat.
  onResponse: (_state, { pending, seatId, cardInstanceId }) => {
    const damage = pending.context.effect.kind === 'DamageEffect' ? pending.context.effect.damage : null;
    if (damage?.source?.kind !== 'seat') return [];
    return [duelWindow(pending.sourceCard!.instanceId, damage.source.seatId, seatId, cardInstanceId)];
  },
};
