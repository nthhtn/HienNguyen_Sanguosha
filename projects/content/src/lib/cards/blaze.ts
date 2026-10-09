import type { CardDefinition, Effect } from 'engine';
import { usedCardKey } from 'engine';
import { toolOnTargets } from '../shared/tools';
import { handOf } from '../shared/queries';
import { suitOf } from '../shared/suits';
import { cardStep } from '../shared/steps';
import { untargetableBy } from '../shared/abilities';
import { discardMoves, isLiving } from '../shared/skills';

// Blaze (a Tool made only by Fire Strategy; never dealt): any living seat
// holding a hand card, you included. Once its Wuxie check passes, the target
// shows a hand card of its choice; you may then discard a hand card of the same
// suit to deal it 1 plain damage (no elemental damage).
export const blazeCard: CardDefinition = {
  id: 'blaze',
  name: 'Blaze',
  category: 'tool',
  outOfDeck: true,
  legalPlayTargets: (state, _ctx, registry) =>
    [...state.seats]
      .sort((a, b) => a.index - b.index)
      .filter((s) => !s.eliminated && handOf(state, s.id).length > 0 && !untargetableBy(state, s.id, 'blaze', registry))
      .map((s) => [{ kind: 'seat' as const, seatId: s.id }]),
  play: (_state, ctx) => (ctx.respondingTo || ctx.targets.length === 0 ? [] : toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]])),
  onTarget: (state, { tool, userSeatId, target }) => {
    if (target.kind !== 'seat') return [];
    const hand = handOf(state, target.seatId);
    if (hand.length === 0) return [];
    return [
      {
        kind: 'OpenSelectionEffect',
        selection: {
          id: `blaze-show-${usedCardKey(tool)}-${target.seatId}-${state.log.length}`,
          seatId: target.seatId,
          reason: { kind: 'choice', card: tool, userSeatId, targetSeatId: target.seatId },
          of: 'cards',
          eligibleIds: hand.map((c) => c.instanceId),
          min: 1,
          max: 1,
          then: { kind: 'card-step', step: cardStep('blaze-shown', tool, userSeatId, target) },
        },
      },
    ];
  },
  onStep: (state, step, registry) => {
    const target = step.target.seatId;
    const picked = (step.data?.['picked'] as string[] | undefined) ?? [];
    if (step.step === 'blaze-shown') {
      const shown = handOf(state, target).find((c) => c.instanceId === picked[0]);
      if (!shown) return [];
      const show: Effect = { kind: 'ShowCardEffect', seatId: target, cardInstanceId: shown.instanceId, abilityId: 'blaze' };
      const suit = suitOf(state, target, shown, registry);
      const matches = handOf(state, step.userSeatId).filter((c) => suitOf(state, step.userSeatId, c, registry) === suit);
      if (matches.length === 0) return [show];
      return [
        show,
        {
          kind: 'OpenSelectionEffect',
          selection: {
            id: `blaze-hit-${usedCardKey(step.card)}-${target}-${state.log.length}`,
            seatId: step.userSeatId,
            reason: { kind: 'choice', card: step.card, userSeatId: step.userSeatId, targetSeatId: target },
            of: 'cards',
            eligibleIds: matches.map((c) => c.instanceId),
            min: 1,
            max: 1,
            then: { kind: 'card-step', step: cardStep('blaze-hit', step.card, step.userSeatId, step.target) },
            // Cancel: no discard, no damage.
            onCancel: [],
          },
        },
      ];
    }
    if (step.step !== 'blaze-hit') throw new Error(`Blaze has no step ${step.step}`);
    const first = step.card.physical[0]?.instanceId;
    return [
      ...discardMoves(state, picked),
      ...(isLiving(state, target)
        ? [{
            kind: 'DamageEffect' as const,
            damage: { source: { kind: 'seat' as const, seatId: step.userSeatId }, target: step.target, amount: 1, nature: 'normal' as const, cause: { ...(first ? { cardInstanceId: first } : {}), card: step.card } },
          }]
        : []),
    ];
  },
};
