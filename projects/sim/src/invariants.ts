import type { GameState } from 'engine';

export function checkInvariants(state: GameState): string[] {
  const violations: string[] = [];

  for (const seat of state.seats) {
    if (seat.combinedHp < 0) {
      violations.push(`Seat ${seat.id} has negative combinedHp: ${seat.combinedHp}`);
    }
  }

  if (state.pendingResponse) {
    const seat = state.seats.find((s) => s.id === state.pendingResponse!.respondingSeatId);
    if (!seat) {
      violations.push(`pendingResponse references unknown seat ${state.pendingResponse.respondingSeatId}`);
    } else if (seat.eliminated) {
      violations.push(`pendingResponse references eliminated seat ${seat.id}`);
    }
  }

  // Card conservation (partial): a CardInstance is a unique physical card, so
  // its instanceId must appear exactly once across the whole game state. A
  // duplicate means a card was copied — either into two zones at once, or twice
  // within a single zone. A card silently *vanishing* is not detectable from a
  // single GameState (checkInvariants receives no before/after pair and no deck
  // size to compare against); the engine guards that case directly instead, by
  // making moveCard/drawTop throw on an unknown destination zone.
  const zoneIdsByInstanceId = new Map<string, string[]>();
  for (const zone of state.zones) {
    const seenInThisZone = new Set<string>();
    for (const card of zone.cards) {
      if (seenInThisZone.has(card.instanceId)) {
        violations.push(`Zone ${zone.id} contains card instance ${card.instanceId} more than once`);
      }
      seenInThisZone.add(card.instanceId);
      const zonesHolding = zoneIdsByInstanceId.get(card.instanceId);
      if (zonesHolding) zonesHolding.push(zone.id);
      else zoneIdsByInstanceId.set(card.instanceId, [zone.id]);
    }
  }
  for (const [instanceId, zoneIds] of zoneIdsByInstanceId) {
    const distinctZoneIds = [...new Set(zoneIds)];
    if (distinctZoneIds.length > 1) {
      violations.push(`Card instance ${instanceId} is in more than one zone at once: ${distinctZoneIds.join(', ')}`);
    }
  }

  if (state.result) {
    const allIds = new Set(state.seats.map((s) => s.id));
    const seen = new Set<string>();
    for (const id of [...state.result.winningSeatIds, ...state.result.losingSeatIds]) {
      if (!allIds.has(id)) violations.push(`GameResult references unknown seat ${id}`);
      if (seen.has(id)) violations.push(`GameResult lists seat ${id} more than once`);
      seen.add(id);
    }
  }

  return violations;
}
