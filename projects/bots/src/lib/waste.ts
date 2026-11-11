import type { Action, CardInstance, ContentRegistry, GameState, PendingChoice, Seat, Target, UsedCard } from 'engine';
import { conversionsOf, sameAbilityOwner, usedCardFrom, usedCardOf } from 'engine';
import { extraCostOf, wouldStop } from 'content';
import { attackable, handCards, isAlly, keepRank, rankHarmTargets, TargetRanker } from './helpers';

type Play = Extract<Action, { kind: 'PlayCardAction' | 'UseConversionAction' }>;
const isPlay = (a: Action): a is Play => a.kind === 'PlayCardAction' || a.kind === 'UseConversionAction';

// The card a play uses, as the engine would build it: the physical card as itself, or a conversion's card with
// its cards not yet chosen. Null when it cannot be told.
function usedCardOfPlay(view: GameState, me: Seat, play: Play, registry: ContentRegistry): UsedCard | null {
  if (play.kind === 'PlayCardAction') {
    const instance = handCards(view, me).find((c) => c.instanceId === play.cardInstanceId);
    return instance ? usedCardOf(instance, registry) : null;
  }
  const owned = conversionsOf(view, me.id, registry).find((o) => o.conversion.id === play.via.conversionId && sameAbilityOwner(o.owner, play.via.owner));
  return owned ? usedCardFrom([], owned.conversion.as, { owner: owned.owner, abilityId: owned.abilityId, conversionId: owned.conversion.id }) : null;
}

const seatOf = (view: GameState, t: Target): Seat | undefined => (t.kind === 'seat' ? view.seats.find((s) => s.id === t.seatId) : undefined);

// Whether aiming `card` at `target` is a wasted play: a visible armor or skill cancels it, or it costs more than
// the bot can pay (rule A1). A card the bot cannot tell (null) is never wasted.
export function targetWasted(view: GameState, me: Seat, card: UsedCard | null, target: Seat, registry: ContentRegistry): boolean {
  if (!card) return false;
  const use = { card, userSeatId: me.id, targetSeatId: target.id };
  if (wouldStop(view, use, registry)) return true;
  const cost = extraCostOf(view, use, registry);
  if (!cost) return false;
  return payment(view, me, card, cost.basicCards, registry) === null;
}

// The Basic hand cards the bot would pay with (the least useful first, never the card played); null when it
// has too few.
function payment(view: GameState, me: Seat, card: UsedCard, basicCards: number, registry: ContentRegistry): CardInstance[] | null {
  const own = new Set(card.physical.map((c) => c.instanceId));
  const basics = handCards(view, me).filter((c) => !own.has(c.instanceId) && registry.cards.get(c.definitionId)?.category === 'basic');
  const sorted = [...basics].sort((a, b) => keepRank(view, registry, a.instanceId) - keepRank(view, registry, b.instanceId));
  return sorted.length >= basicCards ? sorted.slice(0, basicCards) : null;
}

// Whether paying for a costly target is worth it (rule B2): its rank beats every cost-free target of the same
// card (or it is the only one), and paying leaves a Shan or a Peach, or the target is at 1 HP or less.
function costlyTargetWorthIt(view: GameState, me: Seat, card: UsedCard, target: Seat, cost: number, costFree: Seat[], registry: ContentRegistry, rank: TargetRanker): boolean {
  if (costFree.some((o) => rank(view, me, o) >= rank(view, me, target))) return false;
  const paid = payment(view, me, card, cost, registry);
  if (!paid) return false;
  if (target.combinedHp <= 1) return true;
  const gone = new Set([...card.physical, ...paid].map((c) => c.instanceId));
  return handCards(view, me).some((c) => !gone.has(c.instanceId) && (c.definitionId === 'shan' || c.definitionId === 'peach'));
}

// `legal` without the plays a visible stop would cancel (A1) and the costly targets not worth it (B2). A play
// that aims at no seat (an untargeted mass card) is kept (A3). Only a play in `fromPick` (filled from a pick
// template, so any subset is legal) loses single targets; any other play is kept whole or dropped by its first
// seat, the one the card aims at (Coerce's victim is extra).
export function withoutWaste(view: GameState, me: Seat, legal: Action[], registry: ContentRegistry, rank: TargetRanker, fromPick: ReadonlySet<Action> = new Set()): Action[] {
  const cards = new Map<Play, UsedCard | null>();
  const cardOf = (p: Play) => {
    if (!cards.has(p)) cards.set(p, usedCardOfPlay(view, me, p, registry));
    return cards.get(p) ?? null;
  };
  // The seats each play of the same card could still aim at without any cost, for B2's comparison.
  const sameCard = (a: Play, b: Play) => (a.kind === 'PlayCardAction' ? b.kind === 'PlayCardAction' && b.cardInstanceId === a.cardInstanceId : b.kind === 'UseConversionAction' && b.via.conversionId === a.via.conversionId && sameAbilityOwner(b.via.owner, a.via.owner));
  const costOf = (p: Play, seat: Seat) => {
    const card = cardOf(p);
    return card ? extraCostOf(view, { card, userSeatId: me.id, targetSeatId: seat.id }, registry) : null;
  };
  const costFreeFor = (play: Play): Seat[] =>
    legal
      .filter(isPlay)
      .filter((p) => sameCard(play, p))
      .flatMap((p) => p.targets.map((t) => seatOf(view, t)).filter((s): s is Seat => !!s && attackable(view, me, s, rank) && !targetWasted(view, me, cardOf(p), s, registry) && !costOf(p, s)));

  return legal.flatMap((a): Action[] => {
    if (!isPlay(a)) return [a];
    const seats = a.targets.filter((t) => t.kind === 'seat');
    if (seats.length === 0) return [a];
    const card = cardOf(a);
    const worth = (t: Target): boolean => {
      const seat = seatOf(view, t);
      if (!seat) return true;
      if (targetWasted(view, me, card, seat, registry)) return false;
      const cost = card ? costOf(a, seat) : null;
      return !cost || (card !== null && costlyTargetWorthIt(view, me, card, seat, cost.basicCards, costFreeFor(a), registry, rank));
    };
    if (!fromPick.has(a)) return worth(seats[0]) ? [a] : [];
    const kept = a.targets.filter(worth);
    return kept.some((t) => t.kind === 'seat') ? [{ ...a, targets: kept }] : [];
  });
}

type ChoiceOption = PendingChoice['options'][number];

// The card the bot itself uses on an option's seat (Godspeed's or Double Edged's Sha), read off the option's
// effects; null when the option uses none of its own.
function ownCardOf(option: ChoiceOption, me: Seat): UsedCard | null {
  for (const e of option.effects) {
    if (e.kind === 'UseCardEffect' && e.seatId === me.id) return e.card;
    if (e.kind === 'CardStepEffect' && e.userSeatId === me.id) return e.card;
  }
  return null;
}

// Rules E1, E3: the seats a harmful skill choice may pick, best first (rankHarmTargets over its non-ally seat
// options other than the bot), and, given a ranker, without the seats the bot's own card would be wasted on
// (A1). Without a ranker, every non-ally seat option in `fallback`'s order, as before.
export function harmTargetsOf(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry, rank: TargetRanker | undefined, fallback: (a: Seat, b: Seat) => number): Seat[] {
  const ids = choice.options.flatMap((o) => {
    if (o.shows.kind !== 'seat') return [];
    const seatId = (o.shows as { seatId: string }).seatId;
    const seat = view.seats.find((s) => s.id === seatId);
    if (!seat || seat.id === me.id || isAlly(me, seat, view)) return [];
    return rank && targetWasted(view, me, ownCardOf(o, me), seat, registry) ? [] : [seat.id];
  });
  return rankHarmTargets(view, me, ids, rank, fallback);
}
