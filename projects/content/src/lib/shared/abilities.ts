import type { Abilities, AbilityOwner, CardInstance, ContentRegistry, Damage, GameState } from 'engine';

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

// Whether `cardId` can't target `seatId`: an ability of its says so (Wood Armor).
export function untargetableBy(state: GameState, seatId: string, cardId: string, registry: ContentRegistry): boolean {
  return activeAbilities(state, seatId, registry).some((a) => a.modifiers?.untargetableBy?.includes(cardId));
}

// The worn card behind an equipment owner, wherever it now lies.
export function ownerCard(state: GameState, owner: AbilityOwner): CardInstance | undefined {
  if (owner.kind !== 'equipment') return undefined;
  return state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === owner.cardInstanceId);
}
