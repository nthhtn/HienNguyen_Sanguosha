import { decisionPending as isDecisionPending, getActiveSeatId, getLegalActions, ownSkillChoice, phaseWaitsForPlayer } from 'engine';
import type { ContentRegistry, GameState } from 'engine';

// Whether a skill kept `seatId` alive below 1 HP since its HP last dropped
// (Refusing Death logs outcome 'stays-alive').
function keptAlive(state: GameState, seatId: string): boolean {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.kind === 'AbilityUsedEvent' && e.owner.seatId === seatId && e.outcome === 'stays-alive') return true;
    if ((e.kind === 'DamageDealtEvent' && e.damage.target.seatId === seatId) || (e.kind === 'HpLostEvent' && e.seatId === seatId)) return false;
  }
  return false;
}

export function checkInvariants(state: GameState, registry?: ContentRegistry): string[] {
  const violations: string[] = [];

  for (const seat of state.seats) {
    // At 0 HP or below a seat is dying until its rescue round ends: it may
    // only be living while that round is still asking.
    const rescuePending = state.pendingResponse?.reason?.kind === 'dying' && state.pendingResponse.reason.seatId === seat.id;
    if (!seat.eliminated && seat.combinedHp <= 0 && !rescuePending && !keptAlive(state, seat.id)) {
      violations.push(`Seat ${seat.id} is living at ${seat.combinedHp} HP with no rescue round pending`);
    }
  }

  // A judgment on show (the judgmentNotice rule): gone when the game is over, and while it waits for an
  // acknowledgement some living seat can give it.
  if (state.judgmentView) {
    if (state.result) {
      violations.push('A finished game still has a judgment view');
    } else if (state.judgmentView.settled) {
      const acting = getActiveSeatId(state);
      if (!acting || !getLegalActions(state, acting, registry).some((a) => a.kind === 'AcknowledgeJudgmentAction')) {
        violations.push('A settled judgment has no seat able to acknowledge it');
      }
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
    // An eliminated seat may be asked only by its own skill (an afterDeath skill asks its player: Alternate Sorrow).
    else if (seat.eliminated && !ownSkillChoice(state.pendingChoice)) violations.push(`pendingChoice references eliminated seat ${seat.id}`);
  }

  if (state.pendingSelection) {
    const seat = state.seats.find((s) => s.id === state.pendingSelection!.seatId);
    if (!seat) violations.push(`pendingSelection references unknown seat ${state.pendingSelection.seatId}`);
    else if (seat.eliminated) violations.push(`pendingSelection references eliminated seat ${seat.id}`);
  }
  if (state.pendingArrangement) {
    const seat = state.seats.find((s) => s.id === state.pendingArrangement!.seatId);
    if (!seat) violations.push(`pendingArrangement references unknown seat ${state.pendingArrangement.seatId}`);
    else if (seat.eliminated) violations.push(`pendingArrangement references eliminated seat ${seat.id}`);
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

  // An eliminated seat's cards are discarded (once the game is over, whatever
  // was still queued is dropped, so this holds only while it runs).
  if (!state.result) {
    for (const zone of state.zones) {
      const owner = state.seats.find((s) => s.id === zone.ownerSeatId);
      if (owner?.eliminated && zone.cards.length > 0) {
        violations.push(`Eliminated seat ${owner.id} still holds ${zone.cards.length} card(s) in ${zone.id}`);
      }
    }
  }

  // A seat never holds two of the same delayed Tool (Capture, Lightning, Starvation).
  for (const zone of state.zones.filter((z) => z.kind === 'judgment')) {
    const seen = new Set<string>();
    for (const card of zone.cards) {
      if (seen.has(card.definitionId)) violations.push(`Judgment zone ${zone.id} holds two ${card.definitionId} cards`);
      seen.add(card.definitionId);
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

  if (registry) violations.push(...checkCompulsoryWhileHidden(state, registry));
  return violations;
}

// A hidden General never fires a compulsory skill: in log order, every
// AbilityUsedEvent of a compulsory General skill comes while that General is
// revealed: after its reveal and before any hiding (or it was revealed before
// the log began, as in a built state).
export function checkCompulsoryWhileHidden(state: GameState, registry: ContentRegistry): string[] {
  const slotKey = (seatId: string, slot: 'main' | 'deputy') => `${seatId}/${slot}`;
  const revealedByEvent = new Set(state.log.flatMap((e) => (e.kind === 'GeneralRevealedEvent' ? [slotKey(e.seatId, e.slot)] : [])));
  const revealed = new Set(
    state.seats.flatMap((s) =>
      (['main', 'deputy'] as const).filter((slot) => s.generals?.[slot].revealed && !revealedByEvent.has(slotKey(s.id, slot))).map((slot) => slotKey(s.id, slot))
    )
  );
  const violations: string[] = [];
  for (const event of state.log) {
    if (event.kind === 'GeneralRevealedEvent') revealed.add(slotKey(event.seatId, event.slot));
    if (event.kind === 'GeneralHiddenEvent') revealed.delete(slotKey(event.seatId, event.slot));
    if (event.kind !== 'AbilityUsedEvent' || event.owner.kind !== 'general') continue;
    const { seatId, slot, skillId } = event.owner;
    const generalId = state.seats.find((s) => s.id === seatId)?.generals?.[slot].generalDefinitionId;
    const skill = generalId ? registry.generals.get(generalId)?.skills.find((s) => s.id === skillId) : undefined;
    if (skill?.compulsory && !revealed.has(slotKey(seatId, slot))) violations.push(`${seatId}'s hidden ${generalId} fired its compulsory ${skillId}`);
  }
  return violations;
}

// Between actions the engine must only ever rest where someone has to decide.
export function checkRestingState(state: GameState): string[] {
  const decisionPending = isDecisionPending(state);
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
