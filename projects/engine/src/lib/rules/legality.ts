import { AbilityOwner, CardInstance, GameState, Target } from '../domain/types';
import { Action } from '../pipeline/actions';
import { ContentRegistry, Conversion } from '../registry/types';
import { abilityUseKey, skillsInPlay } from '../skills/generalSkills';
import { decisionPending, getActiveSeatId } from './activeSeat';
import { getLegalGeneralChoices } from './generalSelection';
import { discardOwed } from './phaseSequence';

export function getLegalTargets(state: GameState, seatId: string): Target[] {
  return state.seats
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => ({ kind: 'seat', seatId: s.id }));
}

export function getLegalActions(state: GameState, seatId: string, registry?: ContentRegistry): Action[] {
  if (state.result) return [];

  // An unknown or eliminated seat can never act, whether or not it happens to
  // be named as the turn owner or as a pending response's responder.
  const actingSeat = state.seats.find((s) => s.id === seatId);
  if (!actingSeat || actingSeat.eliminated) return [];

  if (state.phase === 'GeneralSelection') {
    if (getActiveSeatId(state) !== seatId) return [];
    // Pairing candidates needs each general's kingdom, which lives in content.
    if (!registry) throw new Error('getLegalActions needs the content registry during GeneralSelection');
    return getLegalGeneralChoices(state, seatId, registry);
  }

  if (state.pendingChoice) {
    const choice = state.pendingChoice;
    if (choice.seatId !== seatId) return [];
    return choice.options.map((o) => ({ kind: 'ChooseOptionAction' as const, seatId, choiceId: choice.id, optionId: o.id }));
  }

  if (state.pendingSelection) {
    const selection = state.pendingSelection;
    if (selection.seatId !== seatId) return [];
    // A template: the seat fills in the picked ids (validateSelection checks them).
    const actions: Action[] = [{ kind: 'SelectAction', seatId, selectionId: selection.id, ids: [] }];
    if (selection.onCancel) actions.push({ kind: 'CancelSelectionAction', seatId, selectionId: selection.id });
    return actions;
  }

  if (state.pendingArrangement) {
    const arrangement = state.pendingArrangement;
    if (arrangement.seatId !== seatId) return [];
    // A template: the seat fills in top and bottom (validateArrangement checks them).
    return [{ kind: 'ArrangeCardsAction', seatId, arrangementId: arrangement.id, top: [], bottom: [] }];
  }

  if (state.pendingResponse) {
    const pending = state.pendingResponse;
    if (pending.respondingSeatId !== seatId) return [];
    const actions: Action[] = [];
    if (pending.allowedActionKinds.includes('PassAction')) {
      actions.push({ kind: 'PassAction', seatId, pendingResponseId: pending.id });
    }
    if (pending.allowedActionKinds.includes('RespondAction')) {
      const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
      for (const card of handZone?.cards ?? []) {
        if (!pending.allowedCardIds || pending.allowedCardIds.includes(card.definitionId)) {
          actions.push({
            kind: 'RespondAction',
            seatId,
            pendingResponseId: pending.id,
            cardInstanceId: card.instanceId,
          });
        }
      }
    }
    if (registry) actions.push(...conversionActions(state, seatId, registry));
    return actions;
  }

  if (state.turn.ownerSeatId !== seatId) return [];

  // Over the hand limit in the Discard phase: discarding is the only move.
  if (state.phase === 'Discard' && discardOwed(state, seatId) > 0) {
    const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
    return (handZone?.cards ?? []).map((card) => ({ kind: 'DiscardCardAction' as const, seatId, cardInstanceId: card.instanceId }));
  }

  // Only the Play phase waits for the turn owner; every other phase passes on its own.
  if (state.phase !== 'Play') return [];
  const actions: Action[] = [{ kind: 'EndPhaseAction', seatId }];
  const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
  for (const card of handZone?.cards ?? []) {
    for (const targets of legalTargetListsFor(state, seatId, card.instanceId, card.definitionId, registry)) {
      actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets });
    }
  }
  if (registry) actions.push(...conversionActions(state, seatId, registry), ...activeSkillActions(state, seatId, registry));
  return actions;
}

type UseSkill = Extract<Action, { kind: 'UseSkillAction' }>;

// The active skills `seatId` may use now: in its own Play Phase with nothing
// pending, each one whose canUse holds and whose uses this turn are under its
// limit. A hidden General's are offered too (using one reveals it).
export function activeSkillActions(state: GameState, seatId: string, registry: ContentRegistry): UseSkill[] {
  if (state.phase !== 'Play' || state.turn.ownerSeatId !== seatId) return [];
  if (decisionPending(state)) return [];
  return skillsInPlay(state, seatId, registry)
    .filter(({ owner, skill }) => {
      const active = skill.active;
      if (!active) return false;
      const uses = state.turn.abilityUses?.[abilityUseKey(owner)] ?? 0;
      return (active.usesPerTurn === undefined || uses < active.usesPerTurn) && active.canUse(state, { seatId, owner }, registry);
    })
    .map(({ owner }): UseSkill => ({ kind: 'UseSkillAction', seatId, owner }));
}

// The card's own rule when it has one; legacy offers otherwise.
export function legalTargetListsFor(
  state: GameState,
  seatId: string,
  cardInstanceId: string,
  definitionId: string,
  registry?: ContentRegistry
): Target[][] {
  const definition = registry?.cards.get(definitionId);
  if (registry && definition?.legalPlayTargets) {
    return definition.legalPlayTargets(state, { seatId, cardInstanceId }, registry);
  }
  return [[], ...getLegalTargets(state, seatId).map((t) => [t])];
}

type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;

export interface OwnedConversion {
  owner: AbilityOwner;
  // The ability's id: the skill's id, or the worn card's definition id.
  abilityId: string;
  conversion: Conversion;
  // A hidden General's: using it reveals the General.
  needsReveal?: boolean;
}

export function sameAbilityOwner(a: AbilityOwner, b: AbilityOwner): boolean {
  if (a.kind === 'equipment' && b.kind === 'equipment') return a.seatId === b.seatId && a.cardInstanceId === b.cardInstanceId;
  if (a.kind === 'general' && b.kind === 'general') return a.seatId === b.seatId && a.slot === b.slot && a.skillId === b.skillId;
  return false;
}

// Every conversion `seatId` has: its Generals' skills in play (Main, then
// Deputy), then the cards it wears, in zone order.
export function conversionsOf(state: GameState, seatId: string, registry: ContentRegistry): OwnedConversion[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.eliminated) return [];
  const fromSkills = skillsInPlay(state, seatId, registry).flatMap(({ owner, skill, needsReveal }) =>
    (skill.conversions ?? []).map((conversion): OwnedConversion => ({ owner, abilityId: skill.id, conversion, ...(needsReveal ? { needsReveal } : {}) }))
  );
  const worn = state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? [];
  const fromCards = worn.flatMap((card) =>
    (registry.cards.get(card.definitionId)?.abilities?.conversions ?? []).map((conversion): OwnedConversion => ({
      owner: { kind: 'equipment', seatId, cardInstanceId: card.instanceId },
      abilityId: card.definitionId,
      conversion,
    }))
  );
  return [...fromSkills, ...fromCards];
}

// The cards `seatId` could use for `conversion`: its hand, then its worn
// equipment when the conversion allows, that the conversion accepts.
export function conversionCards(state: GameState, seatId: string, conversion: Conversion): CardInstance[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) return [];
  const cardsIn = (zoneId: string) => state.zones.find((z) => z.id === zoneId)?.cards ?? [];
  const pool = [...cardsIn(seat.hand.zoneId), ...(conversion.from === 'hand-and-equipment' ? cardsIn(seat.equipped.zoneId) : [])];
  return conversion.accepts ? pool.filter((c) => conversion.accepts!(c)) : pool;
}

// The cards `seatId` may use for `conversion` in a play at `targets`: those
// whose leaving still leaves the targets legal (a worn horse or Crossbow the
// play needs can't be the card used).
export function playConversionCards(state: GameState, seatId: string, conversion: Conversion, targets: Target[], registry: ContentRegistry): CardInstance[] {
  const wanted = JSON.stringify(targets);
  return conversionCards(state, seatId, conversion).filter((card) => {
    const without: GameState = { ...state, zones: state.zones.map((z) => ({ ...z, cards: z.cards.filter((c) => c.instanceId !== card.instanceId) })) };
    return legalTargetListsFor(without, seatId, '', conversion.as, registry).some((t) => JSON.stringify(t) === wanted);
  });
}

// Whether `owned` can be used now: enough cards, and not barred by whose turn it is.
function usableNow(state: GameState, seatId: string, owned: OwnedConversion): boolean {
  if (owned.conversion.outsideOwnTurnOnly && state.turn.ownerSeatId === seatId) return false;
  return conversionCards(state, seatId, owned.conversion).length >= owned.conversion.cards;
}

// The conversions `seatId` could answer with, in a window that allows
// `allowedCardIds` (absent: any card).
export function answeringConversions(state: GameState, seatId: string, allowedCardIds: string[] | undefined, registry: ContentRegistry): OwnedConversion[] {
  return conversionsOf(state, seatId, registry).filter(
    (o) => o.conversion.when !== 'play' && (!allowedCardIds || allowedCardIds.includes(o.conversion.as)) && usableNow(state, seatId, o)
  );
}

// The conversions `seatId` may use now. In its Play Phase: one per legal target
// list of the card made. Answering a window that allows the card made: one
// each. Either way the seat must hold enough cards the conversion accepts, and
// a conversion only for outside its owner's turn isn't offered on that turn.
export function conversionActions(state: GameState, seatId: string, registry: ContentRegistry): UseConversion[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || state.pendingChoice || state.pendingSelection || state.pendingArrangement) return [];
  const via = (o: OwnedConversion) => ({ owner: o.owner, conversionId: o.conversion.id });
  const pending = state.pendingResponse;
  if (pending) {
    if (pending.respondingSeatId !== seatId || !pending.allowedActionKinds.includes('RespondAction')) return [];
    return answeringConversions(state, seatId, pending.allowedCardIds, registry).map((o): UseConversion => ({
      kind: 'UseConversionAction', seatId, via: via(o), targets: [], pendingResponseId: pending.id,
    }));
  }
  if (state.phase !== 'Play' || state.turn.ownerSeatId !== seatId) return [];
  return conversionsOf(state, seatId, registry)
    .filter((o) => o.conversion.when !== 'respond' && usableNow(state, seatId, o))
    .flatMap((o) =>
      legalTargetListsFor(state, seatId, '', o.conversion.as, registry)
        .filter((targets) => playConversionCards(state, seatId, o.conversion, targets, registry).length >= o.conversion.cards)
        .map((targets): UseConversion => ({ kind: 'UseConversionAction', seatId, via: via(o), targets }))
    );
}
