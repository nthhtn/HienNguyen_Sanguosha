import { abilityUseKey, pickAllows } from 'engine';
import type { CardInstance, ContentRegistry, GameState, GeneralOwner, PendingSelection, Seat, Target, TargetPick } from 'engine';

// What the rule-based bot knows about cards and seats, shared by its rules.

export function definitionIdOf(view: GameState, cardInstanceId: string): string | undefined {
  for (const zone of view.zones) {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (found) return found.definitionId;
  }
  return undefined;
}

// An ally shares the bot's own (known) kingdom and has revealed it. A hidden kingdom could be anyone, so
// it is not an ally. An Ambitionist is a group of one: nobody's ally. A bot not yet decided whose own
// Kingdom already holds half the table (the cap, rounded down) will be an Ambitionist on revealing, so it
// has no allies yet either (the bot's own copy of the rule, as it does not depend on content).
export function isAlly(self: Seat, other: Seat, view: GameState): boolean {
  if (self.allegiance === 'ambitionist' || other.allegiance === 'ambitionist') return false;
  if (self.kingdom === 'hidden' || other.kingdom !== self.kingdom) return false;
  if (self.allegiance) return true;
  const held = view.seats.filter((s) => s.allegiance === 'kingdom' && s.kingdom === self.kingdom).length;
  return held < Math.floor(view.seats.length / 2);
}

// Whether a physical card is a Sha: Sha itself, Fire Attack or Lightning Attack (read from the
// registry's playsAs, as the bots do not depend on content).
export function isShaCard(registry: ContentRegistry, definitionId: string | undefined): boolean {
  return !!definitionId && (registry.cards.get(definitionId)?.playsAs ?? definitionId) === 'sha';
}

// Higher = keep longer. Peach saves a life, Shan blocks a Sha, Sha attacks.
export function keepRank(view: GameState, registry: ContentRegistry, cardInstanceId: string): number {
  const definitionId = definitionIdOf(view, cardInstanceId);
  if (definitionId === 'peach') return 4;
  if (definitionId === 'shan') return 3;
  if (isShaCard(registry, definitionId) || definitionId === 'wine' || definitionId === 'draw-two') return 2;
  if (definitionId && registry.cards.get(definitionId)?.category === 'equipment') return 1;
  return 0;
}

// Instance ids, least useful first (then lowest rank).
export function leastUseful(view: GameState, registry: ContentRegistry, ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => keepRank(view, registry, a) - keepRank(view, registry, b));
}

// Cards a giving skill (Kindness and its variants) has given this turn, by the owner's tally.
export function givenThisTurn(view: GameState, owner: GeneralOwner): number {
  return view.turn.abilityUses?.[`${abilityUseKey(owner)}/given`] ?? 0;
}

// Cards given this turn by `skillId` on either of the seat's Generals.
export function givenByEitherGeneral(view: GameState, seatId: string, skillId: string): number {
  return (['main', 'deputy'] as const).reduce((n, slot) => n + givenThisTurn(view, { kind: 'general', seatId, slot, skillId }), 0);
}

// A seat's hand, as the bot's view has it (its own face up).
export function handCards(view: GameState, seat: Seat): CardInstance[] {
  return view.zones.find((z) => z.id === seat.hand.zoneId)?.cards ?? [];
}

// A seat's hand, then its worn cards.
export function ownCards(view: GameState, seat: Seat): CardInstance[] {
  return [...handCards(view, seat), ...(view.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? [])];
}

// The first `selection.min` of `ordered` (eligible ids, best first) that the
// selection accepts: for a same-suit pick, the first suit with enough cards.
export function fillSelection(view: GameState, selection: PendingSelection, ordered: readonly string[]): string[] {
  if (!selection.sameSuit) return ordered.slice(0, selection.min);
  const suitOf = (id: string) => view.zones.flatMap((z) => z.cards).find((c) => c.instanceId === id)?.suit;
  for (const id of ordered) {
    const group = ordered.filter((other) => suitOf(other) === suitOf(id));
    if (group.length >= selection.min) return group.slice(0, selection.min);
  }
  return ordered.slice(0, selection.min);
}

// How good a target is for a play: higher is better. The rule-based bot picks
// the highest-ranked attackable non-ally. The shipped policies use `weakestFirst`;
// 'rule-based' uses `tableRank` (table-rank.ts); `targetScore` (targeting.ts)
// is the unshipped alternative.
export type TargetRanker = (view: GameState, me: Seat, target: Seat) => number;

// The original ordering: the weakest first, then seat order. Never HOLD_FIRE.
export const weakestFirst: TargetRanker = (_view, _me, target) => -(target.combinedHp * 100 + target.index);

// A ranker's "never attack this seat" (a truce partner, rule 6).
export const HOLD_FIRE = Number.NEGATIVE_INFINITY;

// A ranker that needs the content registry (General danger): built for each decision from the registry the
// policy is given, as a TargetRanker has no registry parameter.
export interface RankerFactory {
  forRegistry(registry: ContentRegistry): TargetRanker;
}

// Whether the bot may aim an attack at `seat`: a non-ally the ranker does not hold fire on.
export function attackable(view: GameState, me: Seat, seat: Seat, rank: TargetRanker): boolean {
  return !isAlly(me, seat, view) && rank(view, me, seat) !== HOLD_FIRE;
}

// Whether the bot may harm `seat` with a legacy skill pick: a non-ally, and, given a ranker, one it does not
// hold fire on (rule E1). Without a ranker (the frozen policies) any non-ally, as before.
export function mayHarm(view: GameState, me: Seat, seat: Seat, rank: TargetRanker | undefined): boolean {
  return rank ? attackable(view, me, seat, rank) : !isAlly(me, seat, view);
}

// The legacy order of a harmful pick: the lowest HP first, then seat order.
export const lowestHpFirst = (a: Seat, b: Seat): number => a.combinedHp - b.combinedHp || a.index - b.index;

// Rule E1: the legacy per-skill picks that choose a seat to harm (E2: picks that help a seat keep their own
// logic). Each routes its candidates through rankHarmTargets (or mayHarm, for a yes/no ask about a seat or
// about whether such a seat exists), and the picks that aim the bot's own card at the seat also drop seats
// targetWasted names (E3, via harmTargetsOf in waste.ts):
//   skills.ts   wantsSkill kingdomWars:dauntless (a fixed seat)
//   skills.ts   wantsSkill unyielding (a fixed seat)
//   skills.ts   wantsSkill kingdomWars:insanity-axe (a fixed seat)
//   skills.ts   wantsSkill kingdomWars:deathly-counsel (a seat exists)
//   skills.ts   wantsSkill kingdomWars:double-edged (a seat exists)
//   skills.ts   wantsSkill raid (seats exist)
//   skills.ts   wantsSkill displace (a seat exists)
//   skills.ts   devilCard devil (a harmful Judgment)
//   skills.ts   devilCard dark-magic (a harmful Judgment)
//   skills.ts   skillSelection kingdomWars:swift-and-deadly (the seat its Sha will reach)
//   skills.ts   skillSelection sow-revolt
//   skills.ts   skillChoice kingdomWars:deathly-counsel
//   skills.ts   skillChoice kingdomWars:double-edged (its Sha)
//   skills.ts   skillChoice displace
//   skills.ts   skillChoice sow-discord (the first pick)
//   skills.ts   wantsActive kingdomWars:swift-and-deadly (a seat exists)
//   skills.ts   wantsActive sow-revolt (a seat exists)
//   skills.ts   wantsActive sow-discord (a seat exists)
//   wind.ts     wantsWind godspeed (a seat exists)
//   wind.ts     wantsWind strong-bow (a fixed seat)
//   wind.ts     windChoice godspeed (its Sha)
//   wind.ts     windChoice fantasy
//   wind.ts     windChoice lightning-strike
//   fire.ts     wantsFire sudden-attack (a fixed seat)
//   fire.ts     wantsFire dueling-heroes (a seat exists)
//   fire.ts     wantsFireActive assault (a seat exists)
//   fire.ts     wantsFireActive rouse-the-tiger (a victim exists)
//   fire.ts     wantsFireActive heavens-justice (a seat exists)
//   fire.ts     fireSelection heavens-justice
//   fire.ts     fireSelection rouse-the-tiger (only seats with a victim in reach)
//   fire.ts     fireChoice assault
//   fire.ts     fireChoice rouse-the-tiger (the victim)
//   forest.ts   forestChoice exile
//   forest.ts   forestChoice upheaval
//   forest.ts   forestChoice alliance (the partner)
//   forest.ts   wantsForestActive alliance (a pair exists)
//   forest.ts   forestSelection alliance (the ally of a pair)
//   forest.ts   upheavalVictimIsFoe upheaval (its forced Sha)
//   forest.ts   upheavalVictimIsFoe instigate (its forced Sha)
//   mountain.ts bestMove clever-change (the seat a delayed Tool moves onto, the seat a worn card moves off)
//   mountain.ts wantsMountain clever-change (seats exist)
//   mountain.ts wantsMountainActive instigate (a seat exists)
//   mountain.ts mountainSelection clever-change (draw-take)
//   mountain.ts mountainSelection instigate
// Left out: help picks (E2); Upheaval's own use (it hits every other seat, as a mass card, A3); the order of
// Rouse the Tiger's compete seat (it is not the seat harmed).
// With `rank`: the attackable seats among `ids`, best first. Without: every seat among `ids` in `fallback`'s
// order (today's order, so the frozen policies are unchanged).
export function rankHarmTargets(view: GameState, me: Seat, ids: readonly string[], rank: TargetRanker | undefined, fallback: (a: Seat, b: Seat) => number): Seat[] {
  const seats = ids.map((id) => view.seats.find((s) => s.id === id)).filter((s): s is Seat => !!s);
  if (!rank) return seats.sort(fallback);
  return seats.filter((s) => attackable(view, me, s, rank)).sort((a, b) => rank(view, me, b) - rank(view, me, a) || a.index - b.index);
}

// A target template filled for the bot: attackable seats, best first by `rank`, up to
// the maximum; null when none qualifies. Any other action comes back as it is.
export function fillPick<A extends { targets: Target[]; pickTargets?: TargetPick }>(view: GameState, me: Seat, action: A, rank: TargetRanker): A | null {
  const pick = action.pickTargets;
  if (!pick) return action;
  const seats = pick.eligibleIds
    .map((id) => view.seats.find((s) => s.id === id))
    .filter((s): s is Seat => !!s && attackable(view, me, s, rank))
    .sort((a, b) => rank(view, me, b) - rank(view, me, a) || a.index - b.index);
  // Best first, each one only while the pick still allows it (a cap on some seats).
  const chosen: Seat[] = [];
  for (const s of seats) if (pickAllows(pick, chosen.map((c) => c.id), s.id)) chosen.push(s);
  seats.splice(0, seats.length, ...chosen);
  if (seats.length < Math.max(1, pick.min)) return null;
  const { pickTargets: _pick, ...rest } = action;
  return { ...rest, targets: seats.map((s) => ({ kind: 'seat' as const, seatId: s.id })) } as A;
}
