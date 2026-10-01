import type { CardDefinition } from 'engine';
import { otherLivingSeatTargets } from '../shared/queries';

export const duelCard: CardDefinition = {
  id: 'duel',
  name: 'Duel',
  category: 'trick',
  legalPlayTargets: (state, ctx) => otherLivingSeatTargets(state, ctx.seatId),
  play: (_state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    const target = ctx.targets[0];
    return [
      {
        kind: 'OpenResponseEffect',
        pendingResponse: {
          id: `duel-response-${ctx.cardInstanceId}`,
          respondingSeatId: (target as { kind: 'seat'; seatId: string }).seatId,
          allowedActionKinds: ['RespondAction', 'PassAction'],
          allowedCardIds: ['sha', 'wuxie'],
          context: {
            effect: {
              kind: 'DamageEffect',
              damage: {
                source: { kind: 'seat', seatId: ctx.seatId },
                target,
                amount: 2,
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
