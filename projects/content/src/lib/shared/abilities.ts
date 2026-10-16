import type { Abilities, AbilityOwner, CardInstance, ContentRegistry, Damage, GameState } from 'engine';
import { skillsInPlay } from 'engine';
import { seatGender } from './gender';

// Every ability active for a seat: its revealed Generals' skills (a hidden
// General's modifiers don't apply), then the cards it wears. Queries read
// modifiers through this, never by card or skill id.
export function activeAbilities(state: GameState, seatId: string, registry: ContentRegistry): Abilities[] {
  const skills = skillsInPlay(state, seatId, registry).filter((s) => !s.needsReveal).map((s) => s.skill);
  const seat = state.seats.find((s) => s.id === seatId);
  const worn = seat ? (state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? []) : [];
  return [
    ...skills,
    ...worn.flatMap((card) => {
      const abilities = registry.cards.get(card.definitionId)?.abilities;
      return abilities ? [abilities] : [];
    }),
  ];
}

// Whether `damage` is a Sha's own: a Sha (of any nature) dealt it, and it is not
// a hit passed along a chain. A propagated hit is no Sha damage: skills and
// weapons that key on a Sha's damage (Black Pommel, Intense Edge, Lament) skip it.
export function isShaDamage(damage: Damage): boolean {
  return damage.cause?.card?.as === 'sha' && !damage.chained;
}

// Whether armour has no effect on `damage`: it comes from a Sha whose user has
// an ability that ignores armour (Black Pommel).
export function armorIgnored(state: GameState, damage: Damage, registry: ContentRegistry): boolean {
  if (!isShaDamage(damage) || damage.source?.kind !== 'seat') return false;
  return activeAbilities(state, damage.source.seatId, registry).some((a) => a.modifiers?.ignoresArmor);
}

// Whether `cardId` can't target `seatId`: an ability of its says so (Wood
// Armor, Humility), says so while its hand is empty (Empty City), or says so
// of black Tools (Curtain; `colour` is the colour the Tool is used as).
export function untargetableBy(state: GameState, seatId: string, cardId: string, registry: ContentRegistry, colour?: 'red' | 'black' | 'none'): boolean {
  const seat = state.seats.find((s) => s.id === seatId);
  const handEmpty = !seat || (state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0) === 0;
  const isTool = registry.cards.get(cardId)?.category === 'tool';
  return activeAbilities(state, seatId, registry).some(
    ({ modifiers }) =>
      !!modifiers?.untargetableBy?.includes(cardId) ||
      (handEmpty && !!modifiers?.untargetableWithEmptyHandBy?.includes(cardId)) ||
      (colour === 'black' && isTool && !!modifiers?.untargetableByBlackTools)
  );
}

// How many answers `seatId`'s attacks need: Shan to dodge its Sha, Sha each
// time in a Duel with it. Two with Matchless; two for a Sha against (or by) a
// female with Garden of Lust (`versus` is the other seat); else one.
export function answersNeededAgainst(state: GameState, seatId: string, registry: ContentRegistry, versus?: string): 1 | 2 {
  if (activeAbilities(state, seatId, registry).some((a) => a.modifiers?.doubleAnswers)) return 2;
  if (!versus) return 1;
  const garden = (holder: string, other: string) =>
    seatGender(state, other, registry) === 'female' && activeAbilities(state, holder, registry).some((a) => a.modifiers?.doubleAnswersWithFemale);
  return garden(seatId, versus) || garden(versus, seatId) ? 2 : 1;
}

// The extra reach `seatId` has for using the card `cardId` (Blockade).
export function rangeBonusFor(state: GameState, seatId: string, cardId: string, registry: ContentRegistry): number {
  return activeAbilities(state, seatId, registry).reduce((sum, a) => sum + (a.modifiers?.rangeBonusFor?.[cardId] ?? 0), 0);
}

// The turn owner's seat id while its Complete Kill is in play (only it and the
// dying seat may use Peach), else null.
export function peachLockedTo(state: GameState, registry: ContentRegistry): string | null {
  const owner = state.turn.ownerSeatId;
  return activeAbilities(state, owner, registry).some((a) => a.modifiers?.peachOnlyOwnerAndDying) ? owner : null;
}

// Whether `seatId`'s Tools ignore distance (Wondrous Talent).
export function toolsIgnoreDistance(state: GameState, seatId: string, registry: ContentRegistry): boolean {
  return activeAbilities(state, seatId, registry).some((a) => a.modifiers?.toolsIgnoreDistance);
}

// The worn card behind an equipment owner, wherever it now lies.
export function ownerCard(state: GameState, owner: AbilityOwner): CardInstance | undefined {
  if (owner.kind !== 'equipment') return undefined;
  return state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === owner.cardInstanceId);
}
