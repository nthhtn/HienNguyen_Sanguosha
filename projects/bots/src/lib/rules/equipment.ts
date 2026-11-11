import { seatDistance } from 'content';
import { isChained } from 'engine';
import type { ContentRegistry, GameState, Seat } from 'engine';
import { attackable, handCards, isAlly, keepRank, leastUseful } from '../helpers';
import type { BotRule, BotRuleContext } from './registry';

const seatOf = (view: GameState, id: string | undefined) => view.seats.find((s) => s.id === id);
const isFoe = (ctx: BotRuleContext, seat: Seat | undefined): seat is Seat => !!seat && !seat.eliminated && seat.id !== ctx.me.id && !isAlly(ctx.me, seat, ctx.view);
// A foe the bot may attack: the ranker does not hold fire on it (HOLD_FIRE).
const isTarget = (ctx: BotRuleContext, seat: Seat | undefined): seat is Seat => isFoe(ctx, seat) && attackable(ctx.view, ctx.me, seat, ctx.rank);

// The seats the bot's Sha in play is aimed at: the targets of the bot's most recent CardPlayedEvent of a Sha
// (not a response). The Fire Fan ask itself names no target, as it is asked once per Sha.
function shaTargets(view: GameState, me: Seat): Seat[] {
  for (let i = view.log.length - 1; i >= 0; i--) {
    const e = view.log[i] as { kind: string; seatId?: string; card?: { as: string }; targets?: { kind: string; seatId?: string }[]; inResponseTo?: unknown };
    if (e.kind !== 'CardPlayedEvent' || e.seatId !== me.id || e.card?.as !== 'sha' || e.inResponseTo) continue;
    return (e.targets ?? []).flatMap((t) => (t.kind === 'seat' ? [seatOf(view, t.seatId)] : [])).filter((s): s is Seat => !!s);
  }
  return [];
}

// Fire Fan (wantsToUse): used when every target of the Sha is a foe, unless some target is chained and the bot
// or an ally is chained too (the fire would spread to its own side). With no target found, declined.
export const fireFanRule: BotRule = {
  id: 'fire-fan',
  wantsToUse: (ctx) => {
    const targets = shaTargets(ctx.view, ctx.me);
    if (targets.length === 0 || !targets.every((t) => isFoe(ctx, t))) return false;
    if (!targets.some((t) => isChained(ctx.view, t.id))) return true;
    const own = ctx.view.seats.filter((s) => !s.eliminated && (s.id === ctx.me.id || isAlly(ctx.me, s, ctx.view)));
    return !own.some((s) => isChained(ctx.view, s.id));
  },
};

// The living seats the glaive may hit after `seatId` is damaged: distance 1 from it as content measures it
// (mounts and distance skills count), the seat itself excluded.
const neighboursOf = (view: GameState, seatId: string, registry: ContentRegistry): string[] =>
  view.seats.filter((s) => !s.eliminated && s.id !== seatId && seatDistance(view, seatId, s.id, registry) === 1).map((s) => s.id);
// Hand cards the bot can spare: keepRank 2 or less.
const spare = (ctx: BotRuleContext) => handCards(ctx.view, ctx.me).filter((c) => keepRank(ctx.view, ctx.registry, c.instanceId) <= 2);

// Trident Glaive:
// - wantsToUse: at least one foe sits next to the damaged seat and the bot holds a spare hand card (keepRank 2 or less).
// - select: the least useful card.
// - choose: among the offered neighbours, the foe the ranker likes most; with no foe offered,
//   undefined (the first-option fallback runs; an offered ally or the bot itself is never chosen by this rule).
export const tridentGlaiveRule: BotRule = {
  id: 'trident-glaive',
  wantsToUse: (ctx, choice) => {
    const damagedId = choice.reason.kind === 'ability' ? choice.reason.targetSeatId : undefined;
    if (!damagedId) return false;
    const foeNextDoor = neighboursOf(ctx.view, damagedId, ctx.registry).some((id) => isTarget(ctx, seatOf(ctx.view, id)));
    return foeNextDoor && spare(ctx).length > 0;
  },
  select: (ctx, selection) => {
    const [pick] = leastUseful(ctx.view, ctx.registry, selection.eligibleIds);
    return pick ? [pick] : undefined;
  },
  choose: (ctx, choice) => {
    const seats = choice.options.map((o) => seatOf(ctx.view, o.id)).filter((s): s is Seat => !!s && !s.eliminated);
    const foes = seats.filter((s) => isTarget(ctx, s));
    return [...foes].sort((a, b) => ctx.rank(ctx.view, ctx.me, b) - ctx.rank(ctx.view, ctx.me, a) || a.index - b.index)[0]?.id;
  },
};
