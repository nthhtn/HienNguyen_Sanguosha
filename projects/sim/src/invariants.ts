import { phaseWaitsForPlayer } from 'engine';
import type { ContentRegistry, GameState } from 'engine';

export function checkInvariants(state: GameState, registry?: ContentRegistry): string[] {
  const violations: string[] = [];

  for (const seat of state.seats) {
    // At 0 HP or below a seat is dying until its rescue round ends: it may
    // only be living while that round is still asking.
    const rescuePending = state.pendingResponse?.reason?.kind === 'dying' && state.pendingResponse.reason.seatId === seat.id;
    if (!seat.eliminated && seat.combinedHp <= 0 && !rescuePending) {
      violations.push(`Seat ${seat.id} is living at ${seat.combinedHp} HP with no rescue round pending`);
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

  if (state.pendingChoice) {
    const seat = state.seats.find((s) => s.id === state.pendingChoice!.seatId);
    if (!seat) violations.push(`pendingChoice references unknown seat ${state.pendingChoice.seatId}`);
    else if (seat.eliminated) violations.push(`pendingChoice references eliminated seat ${seat.id}`);
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

  if (state.phase !== 'GeneralSelection') {
    if (state.generalSelection !== null) {
      violations.push('generalSelection is still set after the GeneralSelection phase ended');
    }
    for (const seat of state.seats) {
      if (!seat.generals) violations.push(`Seat ${seat.id} has no generals after general selection`);
    }
  }

  const holderByGeneralId = new Map<string, string>();
  for (const seat of state.seats) {
    if (!seat.generals) continue;
    for (const slot of ['main', 'deputy'] as const) {
      const generalId = seat.generals[slot].generalDefinitionId;
      const other = holderByGeneralId.get(generalId);
      if (other) violations.push(`General ${generalId} is held by both ${other} and ${seat.id}`);
      holderByGeneralId.set(generalId, seat.id);
      const kingdom = registry?.generals.get(generalId)?.kingdom;
      if (registry && kingdom !== seat.kingdom) {
        violations.push(`Seat ${seat.id} (${seat.kingdom}) holds ${generalId} of kingdom ${kingdom ?? 'unknown'}`);
      }
    }
  }

  if (registry) {
    for (const zone of state.zones.filter((z) => z.kind === 'equip')) {
      const seen = new Set<string>();
      for (const card of zone.cards) {
        const slot = registry.cards.get(card.definitionId)?.equipSlot;
        if (!slot) continue;
        if (seen.has(slot)) violations.push(`Equip zone ${zone.id} holds two ${slot} cards`);
        seen.add(slot);
      }
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

// Between actions the engine must only ever rest where someone has to decide.
export function checkRestingState(state: GameState): string[] {
  const decisionPending = !!state.pendingResponse || !!state.pendingChoice;
  const queued = state.resolutionQueue?.length ?? 0;
  if (!state.result && !decisionPending && queued > 0) {
    return [`Game is resting with ${queued} item(s) still queued and no decision pending`];
  }
  if (state.result || decisionPending || state.phase === 'GeneralSelection' || phaseWaitsForPlayer(state)) {
    return [];
  }
  return [
    `Game is resting in ${state.turn.ownerSeatId}'s ${state.phase} phase (turn ${state.turn.turnNumber}) with no decision to make`,
  ];
}
