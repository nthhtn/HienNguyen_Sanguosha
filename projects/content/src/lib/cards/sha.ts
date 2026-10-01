import type { CardDefinition } from 'engine';
import { attackRange, otherLivingSeatTargets, seatDistance, shaLimit } from '../shared/queries';

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
    if (ctx.respondingTo) {
      return []; // played as the counter-card in a Duel response window (Task 16) — cancels the pending damage
    }
    if (ctx.targets.length === 0) {
      return []; // no target chosen (e.g. the legality module's untargeted variant) — a no-op rather than a crash
    }
    const target = ctx.targets[0];
    return [
      {
        kind: 'OpenResponseEffect',
        pendingResponse: {
          id: `sha-response-${ctx.cardInstanceId}`,
          respondingSeatId: (target as { kind: 'seat'; seatId: string }).seatId,
          allowedActionKinds: ['RespondAction', 'PassAction'],
          allowedCardIds: ['shan'],
          context: {
            effect: {
              kind: 'DamageEffect',
              damage: {
                source: { kind: 'seat', seatId: ctx.seatId },
                target,
                amount: 1,
                nature: 'normal',
                cause: { cardInstanceId: ctx.cardInstanceId },
              },
            },
          },
        },
      },
    ];
  },
};
