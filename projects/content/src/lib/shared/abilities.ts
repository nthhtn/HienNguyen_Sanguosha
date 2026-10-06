import type { Abilities, ContentRegistry, Damage, GameState } from 'engine';

// Every ability active for a seat: those of the cards it wears. (Generals'
// skills join in stage 6.) Queries read modifiers through this, never by card id.
export function activeAbilities(state: GameState, seatId: string, registry: ContentRegistry): Abilities[] {
  const seat = state.seats.find((s) => s.id === seatId);
  const worn = seat ? (state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? []) : [];
  return worn.flatMap((card) => {
    const abilities = registry.cards.get(card.definitionId)?.abilities;
    return abilities ? [abilities] : [];
  });
}

// Whether armour has no effect on `damage`: it comes from a Sha whose user has
// an ability that ignores armour (Black Pommel).
export function armorIgnored(state: GameState, damage: Damage, registry: ContentRegistry): boolean {
  if (damage.cause?.card?.as !== 'sha' || damage.source?.kind !== 'seat') return false;
  return activeAbilities(state, damage.source.seatId, registry).some((a) => a.modifiers?.ignoresArmor);
}
