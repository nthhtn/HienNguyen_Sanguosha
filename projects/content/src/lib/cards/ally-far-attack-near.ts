import type { CardDefinition } from 'engine';
import { otherLivingSeatTargets } from '../shared/queries';
import { playColour, toolOnTargets } from '../shared/tools';
import { untargetableBy } from '../shared/abilities';
import { exposedGroup } from '../shared/kingdom';

// Ally Far Attack Near: one other living seat with an exposed General whose
// Kingdom differs from the user's (any exposed seat while the user has none).
// The target draws 1, then the user draws 3; one Wuxie cancels both.
export const allyFarAttackNearCard: CardDefinition = {
  id: 'ally-far-attack-near',
  name: 'Ally Far Attack Near',
  category: 'tool',
  legalPlayTargets: (state, ctx, registry) => {
    const mine = exposedGroup(state, ctx.seatId);
    return otherLivingSeatTargets(state, ctx.seatId).filter(([target]) => {
      if (target.kind !== 'seat') return false;
      const theirs = exposedGroup(state, target.seatId);
      return theirs !== null && theirs !== mine && !untargetableBy(state, target.seatId, 'ally-far-attack-near', registry, playColour(state, ctx, registry));
    });
  },
  play: (_state, ctx) => (ctx.respondingTo || ctx.targets.length === 0 ? [] : toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]])),
  onTarget: (_state, { userSeatId, target }) =>
    target.kind !== 'seat'
      ? []
      : [
          { kind: 'DrawCardsEffect', seatId: target.seatId, count: 1 },
          { kind: 'DrawCardsEffect', seatId: userSeatId, count: 3 },
        ],
};
