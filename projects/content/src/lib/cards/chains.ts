import type { CardDefinition, Target } from 'engine';
import { isChained, livingSeatOrderFrom } from 'engine';
import { playColour, toolOnTargets } from '../shared/tools';
import { untargetableBy } from '../shared/abilities';

const seat = (seatId: string): Target => ({ kind: 'seat', seatId });

// Chains (spec "Chains"): a Tool at 1 or 2 living seats at any distance (the
// user included; a seat that can't be targeted by it stays out). After its own
// Wuxie check, each target in turn toggles: unchained becomes chained, chained
// becomes unchained. Or Recast, played with no target: Chains is discarded and
// the user draws 1 (no Wuxie check: nothing is targeted).
//
// Offers: [] (Recast) when the card is itself, then each seat singly, then each
// pair once, in turn order from the user. A converted Chains (Shackle) offers
// no Recast: the skill recasts a club itself.
export const chainsCard: CardDefinition = {
  id: 'chains',
  name: 'Chains',
  category: 'tool',
  legalPlayTargets: (state, ctx, registry) => {
    const colour = playColour(state, ctx, registry);
    const eligible = livingSeatOrderFrom(state, ctx.seatId).filter((id) => !untargetableBy(state, id, 'chains', registry, colour));
    const singles = eligible.map((id) => [seat(id)]);
    const pairs = eligible.flatMap((first, i) => eligible.slice(i + 1).map((second) => [seat(first), seat(second)]));
    const recast: Target[][] = ctx.cardInstanceId ? [[]] : [];
    return [...recast, ...singles, ...pairs];
  },
  play: (state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return [{ kind: 'DrawCardsEffect', seatId: ctx.seatId, count: 1 }];
    return toolOnTargets(ctx.card, ctx.seatId, ctx.targets);
  },
  onTarget: (state, { target }) => {
    if (target.kind !== 'seat' || !state.seats.some((s) => s.id === target.seatId && !s.eliminated)) return [];
    return [{ kind: 'SetChainedEffect', seatId: target.seatId, chained: !isChained(state, target.seatId) }];
  },
};
