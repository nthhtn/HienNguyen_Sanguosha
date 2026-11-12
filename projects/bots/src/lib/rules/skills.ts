import type { Action, GameState, Seat } from 'engine';
import { isEquipUpgrade } from '../card-play';
import { attackable, givenByEitherGeneral, givenThisTurn, handCards, isAlly, leastUseful } from '../helpers';
import type { BotRule, BotRuleContext } from './registry';

// Kingdom Wars General skills the bot uses by rule. "Allies" are the living seats `isAlly` with the bot, the
// bot itself not included; "foes" are the other living seats that are not allies.

type UseSkill = Extract<Action, { kind: 'UseSkillAction' }>;

const offeredSkill = (ctx: BotRuleContext, skillId: string): UseSkill | undefined =>
  ctx.legal.find((a): a is UseSkill => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);
const seatOf = (view: GameState, seatId: string | undefined) => view.seats.find((s) => s.id === seatId);
const isFoe = (ctx: BotRuleContext, seat: Seat) => !seat.eliminated && seat.id !== ctx.me.id && !isAlly(ctx.me, seat, ctx.view);
const hasAlly = (ctx: BotRuleContext) => ctx.view.seats.some((s) => !s.eliminated && s.id !== ctx.me.id && isAlly(ctx.me, s, ctx.view));
const hurt = (seat: Seat) => seat.combinedHp < seat.maxCombinedHp;
// Best first by the ranker, then seat order.
const byRank = (ctx: BotRuleContext) => (a: Seat, b: Seat) => ctx.rank(ctx.view, ctx.me, b) - ctx.rank(ctx.view, ctx.me, a) || a.index - b.index;

// Femme Fatale (early): used whenever it is offered (her General is hidden). Revealing early blocks other
// seats from revealing in her turn, and a bot has no reason to hide.
export const femmeFataleRule: BotRule = {
  id: 'kingdomWars:femme-fatale',
  play: { when: 'early', pick: (ctx) => offeredSkill(ctx, 'kingdomWars:femme-fatale') },
};

// Foes showing both Generals that the ranker does not hold fire on (HOLD_FIRE), best first by the ranker.
const fullyExposedFoes = (ctx: BotRuleContext): Seat[] =>
  ctx.view.seats.filter((s) => isFoe(ctx, s) && attackable(ctx.view, ctx.me, s, ctx.rank) && !!s.generals?.main.revealed && !!s.generals.deputy.revealed).sort(byRank(ctx));
// Hand Equipment cards the bot would not equip now: their slot is filled and they are no upgrade. Worn
// cards are never spare.
const spareEquipment = (ctx: BotRuleContext): string[] => {
  const worn = ctx.view.zones.find((z) => z.id === ctx.me.equipped.zoneId)?.cards.map((c) => c.definitionId) ?? [];
  const wornSlots = new Set(worn.map((id) => ctx.registry.cards.get(id)?.equipSlot));
  return handCards(ctx.view, ctx.me)
    .filter((c) => {
      const slot = ctx.registry.cards.get(c.definitionId)?.equipSlot;
      return !!slot && wornSlots.has(slot) && !isEquipUpgrade(ctx.registry, c.definitionId, worn);
    })
    .map((c) => c.instanceId);
};

// Impetus for Conflicts:
// - play (late): used when some foe has both Generals exposed and the bot holds an Equipment card in hand
//   that it would not equip now (its slot is filled and it is no upgrade). A worn card is never discarded.
// - select: the cards, that spare hand card; the seats, the fully exposed foe the ranker likes most. With
//   neither on offer, 'cancel'.
// - choose: the General with the higher table value (the policy's per-deck table, rule R5), Main on a tie.
export const impetusForConflictsRule: BotRule = {
  id: 'kingdomWars:impetus-for-conflicts',
  play: {
    when: 'late',
    pick: (ctx) => (fullyExposedFoes(ctx).length > 0 && spareEquipment(ctx).length > 0 ? offeredSkill(ctx, 'kingdomWars:impetus-for-conflicts') : undefined),
  },
  select: (ctx, selection) => {
    const pick =
      selection.of === 'cards'
        ? spareEquipment(ctx).find((id) => selection.eligibleIds.includes(id))
        : fullyExposedFoes(ctx).find((s) => selection.eligibleIds.includes(s.id))?.id;
    return pick ? [pick] : 'cancel';
  },
  choose: (ctx, choice) => {
    const valueOf = (optionId: string) => {
      const shows = choice.options.find((o) => o.id === optionId)?.shows;
      return shows?.kind === 'general' ? ctx.generalValue(shows.generalId) : 0;
    };
    if (!choice.options.some((o) => o.id === 'main') || !choice.options.some((o) => o.id === 'deputy')) return undefined;
    return valueOf('deputy') > valueOf('main') ? 'deputy' : 'main';
  },
};

// Benevolence heals once 3 cards have been given this turn (Identity Kindness: 2).
const BENEVOLENCE_THRESHOLD = 3;

// Benevolence (Kingdom Wars Kindness, threshold 3):
// - play (late): used when an ally exists and either the bot holds more than 3 hand cards, or it is hurt,
//   has given fewer than 3 cards this turn and holds enough to reach 3.
// - select: while hurt and below 3 given, exactly enough to reach 3, the least useful first; otherwise as
//   Kindness does, the cards above 3 (at least 1), the least useful first.
// - choose: who gets them, the first ally offered (none offered: the generic fallback).
export const benevolenceRule: BotRule = {
  id: 'kingdomWars:benevolence',
  play: {
    when: 'late',
    pick: (ctx) => {
      const action = offeredSkill(ctx, 'kingdomWars:benevolence');
      if (!action || !hasAlly(ctx)) return undefined;
      const held = handCards(ctx.view, ctx.me).length;
      const given = givenByEitherGeneral(ctx.view, ctx.me.id, 'kingdomWars:benevolence');
      const short = BENEVOLENCE_THRESHOLD - given;
      return held > 3 || (hurt(ctx.me) && short > 0 && held >= short) ? action : undefined;
    },
  },
  select: (ctx, selection) => {
    const owner = selection.reason.kind === 'ability' ? selection.reason.owner : undefined;
    if (owner?.kind !== 'general') return undefined;
    const eligible = selection.eligibleIds;
    const short = BENEVOLENCE_THRESHOLD - givenThisTurn(ctx.view, owner);
    const count = hurt(ctx.me) && short > 0 ? short : Math.max(eligible.length - 3, 1);
    return leastUseful(ctx.view, ctx.registry, eligible).slice(0, Math.min(count, eligible.length));
  },
  choose: (ctx, choice) =>
    choice.options.map((o) => (o.shows.kind === 'seat' ? seatOf(ctx.view, o.shows.seatId) : undefined)).find((s): s is Seat => !!s && s.id !== ctx.me.id && isAlly(ctx.me, s, ctx.view))?.id,
};
