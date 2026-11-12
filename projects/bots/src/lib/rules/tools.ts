import { isChained, pickAllows } from 'engine';
import type { Action, GameState, Seat } from 'engine';
import { attackable, definitionIdOf, handCards, isAlly } from '../helpers';
import type { BotRule, BotRuleContext } from './registry';

// The Kingdom Wars Tools the bot plays from its hand. "Allies" are the living seats `isAlly` with the bot,
// the bot itself not included; "foes" are the other living seats that are not allies. Attacks (Chains, Blaze)
// go only at "targets": foes the ranker does not hold fire on (HOLD_FIRE).

type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;

const living = (view: GameState) => view.seats.filter((s) => !s.eliminated);
const alliesOf = (ctx: BotRuleContext) => living(ctx.view).filter((s) => s.id !== ctx.me.id && isAlly(ctx.me, s, ctx.view));
const isFoe = (ctx: BotRuleContext, seat: Seat) => !seat.eliminated && seat.id !== ctx.me.id && !isAlly(ctx.me, seat, ctx.view);
const foesOf = (ctx: BotRuleContext) => living(ctx.view).filter((s) => isFoe(ctx, s));
const isTarget = (ctx: BotRuleContext, seat: Seat) => isFoe(ctx, seat) && attackable(ctx.view, ctx.me, seat, ctx.rank);

// The plays of a card, from `actions`, by its definition id.
const playsOf = (ctx: BotRuleContext, actions: Action[], definitionId: string): PlayCard[] =>
  actions.filter((a): a is PlayCard => a.kind === 'PlayCardAction' && definitionIdOf(ctx.view, a.cardInstanceId) === definitionId);
const untargetedPlay = (plays: PlayCard[]) => plays.find((p) => p.targets.length === 0 && !p.pickTargets);
const seatOf = (view: GameState, seatId: string | undefined) => view.seats.find((s) => s.id === seatId);
const targetOf = (ctx: BotRuleContext, p: PlayCard) => {
  const [target] = p.targets;
  return target?.kind === 'seat' ? seatOf(ctx.view, target.seatId) : undefined;
};
// Best first by the ranker, then seat order.
const byRank = (ctx: BotRuleContext) => (a: Seat, b: Seat) => ctx.rank(ctx.view, ctx.me, b) - ctx.rank(ctx.view, ctx.me, a) || a.index - b.index;

// Amass (early): played when at least one ally exists, as they all draw 2 and discard 2 with the bot.
// Alone, it is kept: it costs a card for a reshuffle of two, unless the card is surplus (rule D1).
export const amassRule: BotRule = {
  id: 'amass',
  play: {
    when: 'early',
    pick: (ctx) => (alliesOf(ctx).length > 0 || ctx.surplus > 0 ? untargetedPlay(playsOf(ctx, ctx.legal, 'amass')) : undefined),
  },
};

// Ally Far Attack Near (early): played whenever a target is offered, at the offered seat the ranker likes
// least, so the 1 card it draws goes where it hurts least. The bot draws 3.
export const allyFarAttackNearRule: BotRule = {
  id: 'ally-far-attack-near',
  play: {
    when: 'early',
    pick: (ctx) =>
      playsOf(ctx, ctx.legal, 'ally-far-attack-near')
        .map((p) => ({ p, target: targetOf(ctx, p) }))
        .filter((t): t is { p: PlayCard; target: Seat } => !!t.target)
        .sort((x, y) => ctx.rank(ctx.view, ctx.me, x.target) - ctx.rank(ctx.view, ctx.me, y.target) || x.target.index - y.target.index)[0]?.p,
  },
};

// Harvest (early): played when allies + 1 (the bot) outnumber the foes. Each seat takes a card, so it only
// pays when the bot's side takes more than half.
export const harvestRule: BotRule = {
  id: 'harvest',
  play: {
    when: 'early',
    pick: (ctx) => (alliesOf(ctx).length + 1 > foesOf(ctx).length ? untargetedPlay(playsOf(ctx, ctx.legal, 'harvest')) : undefined),
  },
};

// Ascertain (late): Recast (the play with no target). The bot has no use yet for what it would see.
export const ascertainRule: BotRule = {
  id: 'ascertain',
  play: { when: 'late', pick: (ctx) => untargetedPlay(playsOf(ctx, ctx.legal, 'ascertain')) },
};

// A Chains play at exactly `seatIds`, built from one card's offers: its pick template, or a single-target
// offer when only one seat is eligible (no pick then). None when the offers do not allow it.
function chainsAt(plays: PlayCard[], seatIds: string[]): PlayCard | undefined {
  const template = plays.find((p) => p.pickTargets);
  if (template?.pickTargets) {
    const pick = template.pickTargets;
    if (seatIds.length < pick.min || !seatIds.every((id, i) => pickAllows(pick, seatIds.slice(0, i), id))) return undefined;
    const { pickTargets: _pick, ...rest } = template;
    return { ...rest, targets: seatIds.map((seatId) => ({ kind: 'seat' as const, seatId })) };
  }
  if (seatIds.length !== 1) return undefined;
  return plays.find((p) => p.targets.length === 1 && p.targets[0].kind === 'seat' && p.targets[0].seatId === seatIds[0]);
}

// The seats a card's Chains offers may target.
const chainsEligible = (plays: PlayCard[]): string[] => {
  const template = plays.find((p) => p.pickTargets);
  if (template?.pickTargets) return template.pickTargets.eligibleIds;
  return plays.flatMap((p) => (p.targets.length === 1 && p.targets[0].kind === 'seat' ? [p.targets[0].seatId] : []));
};

// Chains (late), for each Chains card in hand:
// - the bot chained: itself plus the best-ranked unchained foe if one is offered, else itself alone
//   (unchaining before a fire or lightning hit);
// - else two unchained foes offered: the two the ranker likes most;
// - else Recast.
// Never an ally, never a chained foe (that would set it free), never the bot itself while it is unchained.
// With no Recast offered (a converted Chains) and no fitting target, undefined.
export const chainsRule: BotRule = {
  id: 'chains',
  play: {
    when: 'late',
    pick: (ctx) => {
      const offers = playsOf(ctx, ctx.offered, 'chains');
      for (const cardId of new Set(offers.map((p) => p.cardInstanceId))) {
        const plays = offers.filter((p) => p.cardInstanceId === cardId);
        const eligible = chainsEligible(plays);
        const foes = eligible
          .map((id) => seatOf(ctx.view, id))
          .filter((s): s is Seat => !!s && isTarget(ctx, s) && !isChained(ctx.view, s.id))
          .sort(byRank(ctx));
        if (isChained(ctx.view, ctx.me.id) && eligible.includes(ctx.me.id)) {
          const withFoe = foes.length > 0 ? chainsAt(plays, [ctx.me.id, foes[0].id]) : undefined;
          const play = withFoe ?? chainsAt(plays, [ctx.me.id]);
          if (play) return play;
        }
        if (foes.length >= 2) {
          const play = chainsAt(plays, [foes[0].id, foes[1].id]);
          if (play) return play;
        }
        const recast = untargetedPlay(plays);
        if (recast) return recast;
        // Rule D1: a surplus card goes on one foe when no better play exists.
        const single = ctx.surplus > 0 && foes.length > 0 ? chainsAt(plays, [foes[0].id]) : undefined;
        if (single) return single;
      }
      return undefined;
    },
  },
};

// Blaze (late): at the foe the ranker likes most that holds at least 1 hand card, only while the bot holds 3
// or more other hand cards (it needs one of the shown suit), or any surplus card (rule D1). Never at itself.
// As Fire Strategy today.
export const blazeRule: BotRule = {
  id: 'blaze',
  play: {
    when: 'late',
    pick: (ctx) => {
      if (ctx.surplus === 0 && handCards(ctx.view, ctx.me).length - 1 < 3) return undefined;
      return playsOf(ctx, ctx.offered, 'blaze')
        .filter((p) => !p.pickTargets && p.targets.length === 1)
        .map((p) => ({ p, target: targetOf(ctx, p) }))
        .filter((t): t is { p: PlayCard; target: Seat } => !!t.target && isTarget(ctx, t.target) && handCards(ctx.view, t.target).length > 0)
        .sort((x, y) => byRank(ctx)(x.target, y.target))[0]?.p;
    },
  },
};
