import type { CardDefinition, CardPlayedEvent, ContentRegistry, Effect, GameState, PlayOptionsContext, Target } from 'engine';
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
// Offers: a pick of 1 or 2 distinct seats (the Choose Targets window), and
// beside it [] (Recast) when the card is itself. A converted Chains (Shackle,
// `ctx.via` set) offers no Recast: the skill recasts a club itself.
// The cards that may be recast: played with no target, they go to the discard
// pile and their user draws 1 (no Wuxie check: nothing is targeted).
const RECASTABLE_CARD_IDS: readonly string[] = ['chains', 'ascertain'];

// Whether a logged play is a Recast (Chains, Ascertain): the card played with
// no target, not as an answer. A Recast is instead of using the card, and is
// not discarding it, so skills that react to a card's use (Gathering Wisdom)
// or to a discard leave it alone.
export function isRecast(event: CardPlayedEvent): boolean {
  return isRecastPlay(event.card.as, event.targets) && !event.inResponseTo;
}

// Whether playing a card as `as` at `targets` is a Recast (the offer with no
// target), for labelling the offer before it is played.
export function isRecastPlay(as: string, targets: readonly Target[]): boolean {
  return RECASTABLE_CARD_IDS.includes(as) && targets.length === 0;
}

// What a Recast does: its user draws 1 (the engine puts the card itself into the discard pile).
export function recastEffects(seatId: string): Effect[] {
  return [{ kind: 'DrawCardsEffect', seatId, count: 1 }];
}

// Living seats Chains may target, in turn order from the user.
function eligibleSeats(state: GameState, ctx: PlayOptionsContext, registry: ContentRegistry): string[] {
  const colour = playColour(state, ctx, registry);
  return livingSeatOrderFrom(state, ctx.seatId).filter((id) => !untargetableBy(state, id, 'chains', registry, colour));
}

export const chainsCard: CardDefinition = {
  id: 'chains',
  name: 'Chains',
  category: 'tool',
  // The seats as single targets: what is offered when only one seat is eligible
  // (then there is no pick), and the Recast.
  legalPlayTargets: (state, ctx, registry) => {
    const recast: Target[][] = ctx.via ? [] : [[]];
    return [...recast, ...eligibleSeats(state, ctx, registry).map((id) => [seat(id)])];
  },
  targetPick: (state, ctx, registry) => {
    const eligibleIds = eligibleSeats(state, ctx, registry);
    return eligibleIds.length > 1 ? { eligibleIds, min: 1, max: 2 } : null;
  },
  play: (state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return recastEffects(ctx.seatId);
    // The targets toggle in turn order from the user, whatever order they were picked in.
    const order = livingSeatOrderFrom(state, ctx.seatId);
    const position = (t: Target) => order.indexOf(t.kind === 'seat' ? t.seatId : '');
    return toolOnTargets(ctx.card, ctx.seatId, [...ctx.targets].sort((a, b) => position(a) - position(b)));
  },
  onTarget: (state, { target }) => {
    if (target.kind !== 'seat' || !state.seats.some((s) => s.id === target.seatId && !s.eliminated)) return [];
    return [{ kind: 'SetChainedEffect', seatId: target.seatId, chained: !isChained(state, target.seatId) }];
  },
};
