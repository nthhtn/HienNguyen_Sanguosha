import type { CardDefinition, Effect, PendingResponse } from 'engine';
import { otherLivingSeatTargets } from '../shared/queries';

const DUEL_DAMAGE = 1;

// One step of a Duel: `responderSeatId` must play a Sha or take the damage,
// dealt by `otherSeatId`. Only the opening step also accepts Wuxie Kongjie,
// which cancels the whole Duel.
function duelWindow(
  duelInstanceId: string,
  responderSeatId: string,
  otherSeatId: string,
  opening: boolean,
  answeredWith?: string
): Effect {
  const pendingResponse: PendingResponse = {
    // Each step gets its own id: the opening one, then one per Sha answered.
    id: opening ? `duel-response-${duelInstanceId}` : `duel-response-${duelInstanceId}-${answeredWith}`,
    respondingSeatId: responderSeatId,
    allowedActionKinds: ['RespondAction', 'PassAction'],
    allowedCardIds: opening ? ['sha', 'wuxie'] : ['sha'],
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

// Duel: starting with the target, the two seats take turns playing a Sha; the
// first who doesn't takes 1 damage from the other. Wuxie Kongjie from the
// target, before any Sha, cancels it.
export const duelCard: CardDefinition = {
  id: 'duel',
  name: 'Duel',
  category: 'tool',
  legalPlayTargets: (state, ctx) => otherLivingSeatTargets(state, ctx.seatId),
  play: (_state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    const target = ctx.targets[0];
    if (target.kind !== 'seat') return [];
    return [duelWindow(ctx.cardInstanceId, target.seatId, ctx.seatId, true)];
  },
  // A Sha turns the Duel back on the other seat; Wuxie Kongjie ends it.
  onResponse: (state, { pending, seatId, cardInstanceId }) => {
    const answer = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === cardInstanceId);
    if (answer?.definitionId !== 'sha') return [];
    const damage = pending.context.effect.kind === 'DamageEffect' ? pending.context.effect.damage : null;
    if (damage?.source?.kind !== 'seat') return [];
    return [duelWindow(pending.sourceCard!.instanceId, damage.source.seatId, seatId, false, cardInstanceId)];
  },
};
