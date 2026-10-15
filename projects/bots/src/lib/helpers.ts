import type { CardInstance, ContentRegistry, GameState, PendingSelection, Seat, Target, TargetPick } from 'engine';

// What the rule-based bot knows about cards and seats, shared by its rules.

export function definitionIdOf(view: GameState, cardInstanceId: string): string | undefined {
  for (const zone of view.zones) {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (found) return found.definitionId;
  }
  return undefined;
}

// An ally shares the bot's own (known) kingdom and has revealed it. Qun is
// allied with no one; a hidden kingdom could be anyone, so it is not an ally.
export function isAlly(self: Seat, other: Seat): boolean {
  return self.kingdom !== 'Qun' && self.kingdom !== 'hidden' && other.kingdom === self.kingdom;
}

// Higher = keep longer. Peach saves a life, Shan blocks a Sha, Sha attacks.
export function keepRank(view: GameState, registry: ContentRegistry, cardInstanceId: string): number {
  const definitionId = definitionIdOf(view, cardInstanceId);
  if (definitionId === 'peach') return 4;
  if (definitionId === 'shan') return 3;
  if (definitionId === 'sha' || definitionId === 'wine' || definitionId === 'draw-two') return 2;
  if (definitionId && registry.cards.get(definitionId)?.category === 'equipment') return 1;
  return 0;
}

// Instance ids, least useful first (then lowest rank).
export function leastUseful(view: GameState, registry: ContentRegistry, ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => keepRank(view, registry, a) - keepRank(view, registry, b));
}

// Whether the bot will reveal a hidden General to use a skill: once its
// kingdom is known anyway (a General already revealed), or while it holds at
// least 4 HP.
export function mayReveal(self: Seat): boolean {
  return !!self.generals && (self.generals.main.revealed || self.generals.deputy.revealed || self.combinedHp >= 4);
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
// the highest-ranked non-ally; which ranker it uses is the one difference
// between 'rule-based' and 'rule-based-v1'.
export type TargetRanker = (view: GameState, me: Seat, target: Seat) => number;

// The original ordering: the weakest first, then seat order.
export const weakestFirst: TargetRanker = (_view, _me, target) => -(target.combinedHp * 100 + target.index);

// A target template filled for the bot: non-allies, best first by `rank`, up to
// the maximum; null when none qualifies. Any other action comes back as it is.
export function fillPick<A extends { targets: Target[]; pickTargets?: TargetPick }>(view: GameState, me: Seat, action: A, rank: TargetRanker): A | null {
  const pick = action.pickTargets;
  if (!pick) return action;
  const seats = pick.eligibleIds
    .map((id) => view.seats.find((s) => s.id === id))
    .filter((s): s is Seat => !!s && !isAlly(me, s))
    .sort((a, b) => rank(view, me, b) - rank(view, me, a) || a.index - b.index)
    .slice(0, pick.max);
  if (seats.length < Math.max(1, pick.min)) return null;
  const { pickTargets: _pick, ...rest } = action;
  return { ...rest, targets: seats.map((s) => ({ kind: 'seat' as const, seatId: s.id })) } as A;
}
