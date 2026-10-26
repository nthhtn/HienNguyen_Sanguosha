import { livingSeatOrderFrom } from 'engine';
import type { ContentRegistry, GameState, GeneralOwner, Kingdom, Seat } from 'engine';

/** The seat's exposed Kingdom, or null while it has none: hidden, or no General revealed yet. Read live from the Seat. */
export function exposedKingdom(state: GameState, seatId: string): Exclude<Kingdom, 'hidden'> | null {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.kingdom === 'hidden' || !seat.generals || seat.allegiance === 'ambitionist') return null; // generals is null until the seat has chosen
  if (!seat.generals.main.revealed && !seat.generals.deputy.revealed) return null;
  return seat.kingdom;
}

/** Living seats, in turn order from `seatId`, sharing its exposed Kingdom; starts with `seatId`. */
export function sameKingdomSeatIds(state: GameState, seatId: string): string[] {
  const kingdom = exposedKingdom(state, seatId);
  if (kingdom === null) return [seatId];
  return livingSeatOrderFrom(state, seatId).filter((id) => exposedKingdom(state, id) === kingdom);
}

/** The group a seat belongs to for "same Kingdom" comparisons: its exposed Kingdom, a group of one for an Ambitionist, null while it has none. */
export function exposedGroup(state: GameState, seatId: string): string | null {
  const seat = state.seats.find((s) => s.id === seatId);
  if (seat?.allegiance === 'ambitionist' && seat.generals && (seat.generals.main.revealed || seat.generals.deputy.revealed)) return `ambitionist:${seatId}`;
  return exposedKingdom(state, seatId);
}

/** The most seats one Kingdom may hold: half the table, rounded down. A seat revealing into a full Kingdom is an Ambitionist. */
export function kingdomCap(state: GameState): number {
  return Math.floor(state.seats.length / 2);
}

/** Seats that hold a slot of `kingdom`, living or dead (an Ambitionist holds none). */
export function seatsInKingdom(state: GameState, kingdom: Exclude<Kingdom, 'hidden'>): number {
  return state.seats.filter((s) => s.allegiance === 'kingdom' && s.kingdom === kingdom).length;
}

/** Whether the seat is (or, revealing now, would be) an Ambitionist: decided already, else its Kingdom is at the cap. */
export function isAmbitionist(state: GameState, seat: Seat): boolean {
  if (seat.allegiance) return seat.allegiance === 'ambitionist';
  return seat.kingdom !== 'hidden' && seatsInKingdom(state, seat.kingdom) >= kingdomCap(state);
}

/** Living exposed seats per Kingdom (an Ambitionist has no exposed Kingdom, so is no group's member). */
export function exposedKingdomCounts(state: GameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const seat of state.seats) {
    if (seat.eliminated) continue;
    const kingdom = exposedKingdom(state, seat.id);
    if (kingdom !== null) counts.set(kingdom, (counts.get(kingdom) ?? 0) + 1);
  }
  return counts;
}

/** The Kingdom a General's own skill reads for its owner: the seat's own once it has one, else the slot General's (a hidden General's skill reveals it on use). */
export function ownKingdom(state: GameState, owner: GeneralOwner, registry: ContentRegistry): Exclude<Kingdom, 'hidden'> | null {
  const seat = state.seats.find((x) => x.id === owner.seatId);
  if (!seat?.generals) return null;
  if (seat.allegiance === 'ambitionist') return null; // plays for no Kingdom
  const own = seat.kingdom !== 'hidden' ? seat.kingdom : registry.generals.get(seat.generals[owner.slot].generalDefinitionId)?.kingdom;
  return !own || own === 'hidden' ? null : own;
}

/** Like `ownKingdom`, but an Ambitionist's group of one (the same string `exposedGroup` gives its seat) instead of null. */
export function ownGroup(state: GameState, owner: GeneralOwner, registry: ContentRegistry): string | null {
  return state.seats.find((x) => x.id === owner.seatId)?.allegiance === 'ambitionist' ? `ambitionist:${owner.seatId}` : ownKingdom(state, owner, registry);
}
