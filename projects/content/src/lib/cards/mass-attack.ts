import type { CardDefinition, Effect, Target, UsedCard } from 'engine';
import { usedCardKey } from 'engine';
import { otherSeatsInTurnOrder, toolOnTargets } from '../shared/tools';
import { cardStep } from '../shared/steps';

// Targets every other living seat in turn order; each must play `answerCardId`
// or take 1 damage from the user. With `step` (Hail of Arrows), the ask is a
// card step with data { needed, provided }, so an ability can provide the
// answer first (Eight Trigrams).
function massAttack(id: string, name: string, answerCardId: string, step?: string): CardDefinition {
  const window = (tool: UsedCard, userSeatId: string, target: Target): Effect => {
    const physicalId = tool.physical[0]?.instanceId;
    return {
      kind: 'OpenResponseEffect',
      pendingResponse: {
        id: `${id}-${usedCardKey(tool)}-${target.seatId}`,
        respondingSeatId: target.seatId,
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
              ...(physicalId ? { cause: { cardInstanceId: physicalId, card: tool } } : { cause: { card: tool } }),
            },
          },
        },
      },
    };
  };
  return {
    id,
    name,
    category: 'tool',
    legalPlayTargets: (state, ctx) => (otherSeatsInTurnOrder(state, ctx.seatId).length > 0 ? [[]] : []),
    play: (state, ctx) => (ctx.respondingTo ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, otherSeatsInTurnOrder(state, ctx.seatId))),
    onTarget: (_state, { tool, userSeatId, target }) =>
      step ? [cardStep(step, tool, userSeatId, target, { needed: 1, provided: 0 })] : [window(tool, userSeatId, target)],
    ...(step
      ? {
          onStep: (_state, s) => {
            const { needed = 1, provided = 0 } = (s.data ?? {}) as { needed?: number; provided?: number };
            return provided >= needed ? [] : [window(s.card, s.userSeatId, s.target)];
          },
        }
      : {}),
  };
}

export const barbariansCard = massAttack('barbarians', 'Barbarians', 'sha');
export const hailOfArrowsCard = massAttack('hail-of-arrows', 'Hail of Arrows', 'shan', 'hail-shan');
