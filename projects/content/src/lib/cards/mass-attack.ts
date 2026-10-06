import type { CardDefinition, Target } from 'engine';
import { otherSeatsInTurnOrder, toolOnTargets } from '../shared/tools';

// Targets every other living seat in turn order; each must play `answerCardId`
// or take 1 damage from the user.
function massAttack(id: string, name: string, answerCardId: string): CardDefinition {
  return {
    id,
    name,
    category: 'tool',
    legalPlayTargets: (state, ctx) => (otherSeatsInTurnOrder(state, ctx.seatId).length > 0 ? [[]] : []),
    play: (state, ctx) => (ctx.respondingTo ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, otherSeatsInTurnOrder(state, ctx.seatId))),
    onTarget: (_state, { tool, userSeatId, target }) => {
      const seatId = (target as Extract<Target, { kind: 'seat' }>).seatId;
      const physicalId = tool.physical[0]?.instanceId;
      return [
        {
          kind: 'OpenResponseEffect',
          pendingResponse: {
            id: `${id}-${physicalId ?? 'virtual'}-${seatId}`,
            respondingSeatId: seatId,
            allowedActionKinds: ['RespondAction', 'PassAction'],
            allowedCardIds: [answerCardId],
            reason: { kind: 'card-effect', card: tool, userSeatId },
            context: {
              effect: {
                kind: 'DamageEffect',
                damage: {
                  source: { kind: 'seat', seatId: userSeatId },
                  target,
                  amount: 1,
                  nature: 'normal',
                  ...(physicalId ? { cause: { cardInstanceId: physicalId } } : {}),
                },
              },
            },
          },
        },
      ];
    },
  };
}

export const barbariansCard = massAttack('barbarians', 'Barbarians', 'sha');
export const hailOfArrowsCard = massAttack('hail-of-arrows', 'Hail of Arrows', 'shan');
