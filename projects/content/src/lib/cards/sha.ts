import type { CardDefinition, Effect, Target } from 'engine';
import { attackRange, otherLivingSeatTargets, seatDistance, shaLimit } from '../shared/queries';

// The window a Sha opens: `target` plays a Shan or takes 1 damage from
// `fromSeatId`. Shared with Coerce, whose Sha is played as an answer.
export function shaWindow(shaInstanceId: string, fromSeatId: string, target: Target): Effect {
  return {
    kind: 'OpenResponseEffect',
    pendingResponse: {
      id: `sha-response-${shaInstanceId}`,
      respondingSeatId: target.seatId,
      allowedActionKinds: ['RespondAction', 'PassAction'],
      allowedCardIds: ['shan'],
      context: {
        effect: {
          kind: 'DamageEffect',
          damage: { source: { kind: 'seat', seatId: fromSeatId }, target, amount: 1, nature: 'normal', cause: { cardInstanceId: shaInstanceId } },
        },
      },
    },
  };
}

export const shaCard: CardDefinition = {
  id: 'sha',
  name: 'Sha',
  category: 'basic',
  legalPlayTargets: (state, ctx, registry) => {
    if ((state.turn.cardPlays?.['sha'] ?? 0) >= shaLimit(state, ctx.seatId, registry)) return [];
    const range = attackRange(state, ctx.seatId, registry);
    return otherLivingSeatTargets(state, ctx.seatId).filter(
      ([target]) => target.kind === 'seat' && seatDistance(state, ctx.seatId, target.seatId, registry) <= range
    );
  },
  play: (_state, ctx) => {
    if (ctx.respondingTo) return []; // played as an answer (a Duel, Barbarians, Coerce) — the window decides what it does
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    return [shaWindow(ctx.cardInstanceId, ctx.seatId, ctx.targets[0])];
  },
};
