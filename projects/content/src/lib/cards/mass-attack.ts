import type { CardDefinition, ContentRegistry, Effect, GameState, Target, UsedCard } from 'engine';
import { usedCardKey } from 'engine';
import { otherSeatsInTurnOrder, toolOnTargets } from '../shared/tools';
import { cardStep } from '../shared/steps';
import { untargetableBy } from '../shared/abilities';

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
  // Every other living seat in turn order that this card may target.
  const targetsOf = (state: GameState, seatId: string, registry: ContentRegistry) =>
    otherSeatsInTurnOrder(state, seatId).filter((t) => !untargetableBy(state, t.seatId, id, registry));
  return {
    id,
    name,
    category: 'tool',
    legalPlayTargets: (state, ctx, registry) => (targetsOf(state, ctx.seatId, registry).length > 0 ? [[]] : []),
    play: (state, ctx, registry) => (ctx.respondingTo ? [] : toolOnTargets(ctx.card, ctx.seatId, targetsOf(state, ctx.seatId, registry))),
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
