import type { CardInstance, ContentRegistry, GameState, Seat } from 'engine';

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
