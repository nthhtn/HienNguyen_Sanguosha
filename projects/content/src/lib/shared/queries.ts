import type { CardInstance, ContentRegistry, EquipSlot, GameState, Target } from 'engine';
import { activeAbilities } from './abilities';

// Seat-to-seat distance measured around the table over living seats only.
// Returns Infinity when either seat is missing from the living set (an
// already-eliminated or unknown seat): such a seat is unreachable rather than
// "at some distance", and a range check should treat it as out of range instead
// of crashing mid-resolution.
export function getSeatDistance(state: GameState, fromSeatId: string, toSeatId: string): number {
  const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
  const fromIdx = living.findIndex((s) => s.id === fromSeatId);
  const toIdx = living.findIndex((s) => s.id === toSeatId);
  if (fromIdx === -1 || toIdx === -1) {
    return Number.POSITIVE_INFINITY;
  }
  const n = living.length;
  const diff = Math.abs(fromIdx - toIdx);
  return Math.min(diff, n - diff);
}


function equippedSlot(state: GameState, seatId: string, slot: EquipSlot, registry: ContentRegistry) {
  const seat = state.seats.find((s) => s.id === seatId);
  const zone = seat && state.zones.find((z) => z.id === seat.equipped.zoneId);
  return zone?.cards.map((c) => registry.cards.get(c.definitionId)).find((d) => d?.equipSlot === slot);
}

// Distance for targeting: living-seat ring distance, +1 if the target rides a
// defensive mount, −1 if the attacker rides an offensive mount, plus the
// attacker's distance modifiers (Horsemanship), never below 1.
export function seatDistance(state: GameState, fromSeatId: string, toSeatId: string, registry: ContentRegistry): number {
  const base = getSeatDistance(state, fromSeatId, toSeatId);
  if (!Number.isFinite(base)) return base;
  const defensive = equippedSlot(state, toSeatId, 'defensiveMount', registry) ? 1 : 0;
  const offensive = equippedSlot(state, fromSeatId, 'offensiveMount', registry) ? 1 : 0;
  const skills = activeAbilities(state, fromSeatId, registry).reduce(
    (sum, a) => sum + (a.modifiers?.distanceToOthers ?? 0) + (a.modifiers?.distanceToOthersFrom?.(state, fromSeatId) ?? 0),
    0
  );
  return Math.max(1, base + defensive - offensive + skills);
}

// How far the seat can attack: its weapon's reach, or 1 unarmed.
export function attackRange(state: GameState, seatId: string, registry: ContentRegistry): number {
  return equippedSlot(state, seatId, 'weapon', registry)?.weaponRange ?? 1;
}

// Turn flags that change the turn owner's Sha for the rest of the turn (set by
// skills: Heaven's Justice). Named for what they do, so any skill may set them.
export const SHA_FLAGS = {
  extraPlay: 'sha-extra-play',
  anyDistance: 'sha-any-distance',
  extraTarget: 'sha-extra-target',
  none: 'sha-none',
} as const;

// Whether `flag` holds for `seatId`'s Sha now (only in its own turn).
export function shaFlag(state: GameState, seatId: string, flag: string): boolean {
  return state.turn.ownerSeatId === seatId && !!state.turn.flags?.[flag];
}

// Sha plays allowed per turn: the highest any active ability allows, else 1;
// one more after a won Heaven's Justice (SHA_FLAGS.extraPlay).
export function shaLimit(state: GameState, seatId: string, registry: ContentRegistry): number {
  const base = Math.max(1, ...activeAbilities(state, seatId, registry).map((a) => a.modifiers?.shaLimit ?? 1));
  return base + (shaFlag(state, seatId, SHA_FLAGS.extraPlay) ? 1 : 0);
}

// Every living seat other than `seatId`, as single-target lists, in seat order.
export function otherLivingSeatTargets(state: GameState, seatId: string): Target[][] {
  return [...state.seats]
    .sort((a, b) => a.index - b.index)
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => [{ kind: 'seat' as const, seatId: s.id }]);
}

// The cards in `seatId`'s hand.
export function handOf(state: GameState, seatId: string): CardInstance[] {
  const seat = state.seats.find((s) => s.id === seatId);
  return (seat && state.zones.find((z) => z.id === seat.hand.zoneId)?.cards) ?? [];
}
