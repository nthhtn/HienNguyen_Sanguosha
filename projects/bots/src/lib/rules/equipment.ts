import { isChained, livingSeatOrderFrom } from 'engine';
import type { GameState, Seat } from 'engine';
import { handCards, isAlly, keepRank, leastUseful } from '../helpers';
import type { BotRule, BotRuleContext } from './registry';

const seatOf = (view: GameState, id: string | undefined) => view.seats.find((s) => s.id === id);
const isFoe = (ctx: BotRuleContext, seat: Seat | undefined): seat is Seat => !!seat && !seat.eliminated && seat.id !== ctx.me.id && !isAlly(ctx.me, seat, ctx.view);

// Fire Fan (wantsToUse): used when the Sha's target is a foe, unless the target is chained and the bot or an
// ally is chained too (the fire would spread to its own side).
export const fireFanRule: BotRule = {
  id: 'fire-fan',
  wantsToUse: (ctx, choice) => {
    const target = seatOf(ctx.view, choice.reason.kind === 'ability' ? choice.reason.targetSeatId : undefined);
    if (!isFoe(ctx, target)) return false;
    if (!isChained(ctx.view, target.id)) return true;
    const own = ctx.view.seats.filter((s) => !s.eliminated && (s.id === ctx.me.id || isAlly(ctx.me, s, ctx.view)));
    return !own.some((s) => isChained(ctx.view, s.id));
  },
};

// The seats next to `seatId` round the table (ring distance 1, as Trident Glaive's neighbours), the seat itself excluded.
const neighboursOf = (view: GameState, seatId: string): string[] => {
  const order = livingSeatOrderFrom(view, seatId);
  return order.length < 2 ? [] : [...new Set([order[1], order[order.length - 1]])];
};
// Hand cards the bot can spare: keepRank 2 or less.
const spare = (ctx: BotRuleContext) => handCards(ctx.view, ctx.me).filter((c) => keepRank(ctx.view, ctx.registry, c.instanceId) <= 2);

// Trident Glaive:
// - wantsToUse: at least one foe sits next to the damaged seat and the bot holds a spare hand card (keepRank 2 or less).
// - select: the least useful card.
// - choose: among the offered neighbours, the foe the ranker likes most; with no foe offered, the first
//   non-ally (never the bot itself), else undefined and the first-option fallback runs.
export const tridentGlaiveRule: BotRule = {
  id: 'trident-glaive',
  wantsToUse: (ctx, choice) => {
    const damagedId = choice.reason.kind === 'ability' ? choice.reason.targetSeatId : undefined;
    if (!damagedId) return false;
    const foeNextDoor = neighboursOf(ctx.view, damagedId).some((id) => isFoe(ctx, seatOf(ctx.view, id)));
    return foeNextDoor && spare(ctx).length > 0;
  },
  select: (ctx, selection) => {
    const [pick] = leastUseful(ctx.view, ctx.registry, selection.eligibleIds);
    return pick ? [pick] : undefined;
  },
  choose: (ctx, choice) => {
    const seats = choice.options.map((o) => seatOf(ctx.view, o.id)).filter((s): s is Seat => !!s && !s.eliminated);
    const foes = seats.filter((s) => isFoe(ctx, s));
    if (foes.length > 0) {
      return [...foes].sort((a, b) => ctx.rank(ctx.view, ctx.me, b) - ctx.rank(ctx.view, ctx.me, a) || a.index - b.index)[0].id;
    }
    return seats.find((s) => s.id !== ctx.me.id && !isAlly(ctx.me, s, ctx.view))?.id;
  },
};
