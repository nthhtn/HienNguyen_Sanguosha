import { AbilityOwner, CardInstance, GameState, PendingChoice, PendingResponse, Target } from '../domain/types';
import { Action } from '../pipeline/actions';
import { answersAs } from '../domain/usedCard';
import { ContentRegistry, Conversion, PlayOptionsContext, TargetPick } from '../registry/types';
import { abilityUseKey, skillsInPlay } from '../skills/generalSkills';
import { sameValue } from './offered';
import { decisionPending, getActiveSeatId, ownSkillChoice } from './activeSeat';
import { getLegalGeneralChoices } from './generalSelection';
import { discardOwed } from './phaseSequence';

export function getLegalTargets(state: GameState, seatId: string): Target[] {
  return state.seats
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => ({ kind: 'seat', seatId: s.id }));
}

function chooseOptions(choice: PendingChoice, seatId: string): Action[] {
  return choice.options.map((o) => ({ kind: 'ChooseOptionAction' as const, seatId, choiceId: choice.id, optionId: o.id }));
}

export function getLegalActions(state: GameState, seatId: string, registry?: ContentRegistry): Action[] {
  if (state.result) return [];

  // An unknown or eliminated seat can never act, whether or not it happens to
  // be named as the turn owner or as a pending response's responder; but an
  // eliminated seat makes a choice its own skill opened (ownSkillChoice: an afterDeath skill asks its player).
  const actingSeat = state.seats.find((s) => s.id === seatId);
  if (!actingSeat) return [];
  if (actingSeat.eliminated) {
    const choice = state.pendingChoice;
    return choice?.seatId === seatId && ownSkillChoice(choice) && !state.judgmentView?.settled && state.phase !== 'GeneralSelection' ? chooseOptions(choice, seatId) : [];
  }

  if (state.phase === 'GeneralSelection') {
    if (getActiveSeatId(state) !== seatId) return [];
    // Pairing candidates needs each general's kingdom, which lives in content.
    if (!registry) throw new Error('getLegalActions needs the content registry during GeneralSelection');
    return getLegalGeneralChoices(state, seatId, registry);
  }

  // A judgment waiting to be acknowledged: one action, for the seat that acts on it.
  if (state.judgmentView?.settled) {
    return getActiveSeatId(state) === seatId ? [{ kind: 'AcknowledgeJudgmentAction', seatId }] : [];
  }

  if (state.pendingChoice) {
    const choice = state.pendingChoice;
    if (choice.seatId !== seatId) return [];
    return chooseOptions(choice, seatId);
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
        if ((!pending.allowedCardIds || answersAs(card.definitionId, pending.allowedCardIds, registry)) && answerConditionMet(state, pending, seatId, card.definitionId, registry)) {
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

  // The Start window: confirm which hidden Generals to reveal (none is allowed), then Start begins.
  if (state.phase === 'Start' && state.turn.startWindow) return [{ kind: 'ConfirmRevealsAction', seatId, slots: [] }];

  // Besides the Start window and a Discard over the limit (above), only the Play phase waits for the turn owner; every other phase passes on its own.
  if (state.phase !== 'Play') return [];
  const actions: Action[] = [{ kind: 'EndPhaseAction', seatId }];
  const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
  for (const card of handZone?.cards ?? []) {
    // Several targets allowed now: one template carrying the pick, and the
    // card's no-target play beside it when it has one (Chains' Recast).
    const pick = targetPickFor(state, seatId, card.instanceId, card.definitionId, registry);
    if (pick) {
      actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets: [], pickTargets: pick });
      if (untargetedAllowed(state, seatId, card.instanceId, card.definitionId, registry)) actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets: [] });
      continue;
    }
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

// The card's own rule when it has one; legacy offers otherwise. `via` is set
// when asked for a conversion.
export function legalTargetListsFor(
  state: GameState,
  seatId: string,
  cardInstanceId: string,
  definitionId: string,
  registry?: ContentRegistry,
  via?: PlayOptionsContext['via']
): Target[][] {
  const definition = registry?.cards.get(definitionId);
  if (registry && definition?.legalPlayTargets) {
    return definition.legalPlayTargets(state, { seatId, cardInstanceId, ...(via ? { via } : {}) }, registry);
  }
  return [[], ...getLegalTargets(state, seatId).map((t) => [t])];
}

// The card's pick of several targets, when it may take more than one now.
export function targetPickFor(
  state: GameState,
  seatId: string,
  cardInstanceId: string,
  definitionId: string,
  registry?: ContentRegistry,
  via?: PlayOptionsContext['via']
): TargetPick | null {
  if (!registry) return null;
  const pick = registry.cards.get(definitionId)?.targetPick?.(state, { seatId, cardInstanceId, ...(via ? { via } : {}) }, registry);
  return pick && pick.max > 1 ? pick : null;
}

// Whether a card that offers a pick also offers a play with no target
// (its legalPlayTargets lists []): Chains' Recast beside its pick of seats.
function untargetedAllowed(state: GameState, seatId: string, cardInstanceId: string, definitionId: string, registry?: ContentRegistry, via?: PlayOptionsContext['via']): boolean {
  return legalTargetListsFor(state, seatId, cardInstanceId, definitionId, registry, via).some((t) => t.length === 0);
}

// Whether `targets` fit `pick`: distinct seats, all listed, between min and max.
export function fitsPick(pick: TargetPick, targets: Target[]): boolean {
  const ids = targets.map((t) => (t.kind === 'seat' ? t.seatId : ''));
  return new Set(ids).size === ids.length && ids.length >= pick.min && ids.length <= pick.max && ids.every((id) => pick.eligibleIds.includes(id));
}

// Whether a card may be played at `targets` now: within its pick when it may
// take several targets, else one of its legal target lists.
export function targetsAllowed(
  state: GameState,
  seatId: string,
  cardInstanceId: string,
  definitionId: string,
  targets: Target[],
  registry?: ContentRegistry,
  via?: PlayOptionsContext['via']
): boolean {
  const pick = targetPickFor(state, seatId, cardInstanceId, definitionId, registry, via);
  if (pick) return fitsPick(pick, targets) || (targets.length === 0 && untargetedAllowed(state, seatId, cardInstanceId, definitionId, registry, via));
  return legalTargetListsFor(state, seatId, cardInstanceId, definitionId, registry, via).some((t) => sameValue(t, targets));
}

// What a conversion tells a card's targetPick about the cards it takes.
export function conversionVia(conversion: Conversion): NonNullable<PlayOptionsContext['via']> {
  return { cards: conversion.cards, fromHandOnly: conversion.from === undefined || conversion.from === 'hand' };
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
// equipment when the conversion allows (or only its stash), that the conversion accepts.
export function conversionCards(state: GameState, seatId: string, conversion: Conversion, registry: ContentRegistry): CardInstance[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) return [];
  const cardsIn = (zoneId: string) => state.zones.find((z) => z.id === zoneId)?.cards ?? [];
  const pool =
    conversion.from === 'stash'
      ? cardsIn(seat.stash?.zoneId ?? '')
      : [...cardsIn(seat.hand.zoneId), ...(conversion.from === 'hand-and-equipment' ? cardsIn(seat.equipped.zoneId) : [])];
  const accepted = conversion.accepts ? pool.filter((c) => conversion.accepts!(c, state, seatId, registry)) : pool;
  if (!conversion.sameSuit) return accepted;
  // Same suit: only suits with enough accepted cards (the printed suit).
  return accepted.filter((c) => accepted.filter((o) => o.suit === c.suit).length >= conversion.cards);
}

// The cards `seatId` may use for `conversion` in a play at `targets`: those
// whose leaving still leaves the targets legal (a worn horse or Crossbow the
// play needs can't be the card used).
export function playConversionCards(state: GameState, seatId: string, conversion: Conversion, targets: Target[], registry: ContentRegistry): CardInstance[] {
  const via = conversionVia(conversion);
  const pick = targetPickFor(state, seatId, '', conversion.as, registry, via);
  const wornIds = new Set(state.zones.find((z) => z.id === state.seats.find((s) => s.id === seatId)?.equipped.zoneId)?.cards.map((c) => c.instanceId) ?? []);
  return conversionCards(state, seatId, conversion, registry).filter((card) => {
    // A hand card for a pick of several: the pick is read with the hand as it
    // is (Sky Scorcher's "last hand cards"); a worn card must not be needed.
    if (pick && !wornIds.has(card.instanceId) && targets.length > 0) return fitsPick(pick, targets);
    const without: GameState = { ...state, zones: state.zones.map((z) => ({ ...z, cards: z.cards.filter((c) => c.instanceId !== card.instanceId) })) };
    if (pick) return targetsAllowed(without, seatId, '', conversion.as, targets, registry, via);
    return legalTargetListsFor(without, seatId, '', conversion.as, registry, via).some((t) => sameValue(t, targets));
  });
}

// Whether `owned` can be used now: enough cards, and not barred by whose turn it is.
function usableNow(state: GameState, seatId: string, owned: OwnedConversion, registry: ContentRegistry): boolean {
  if (owned.conversion.outsideOwnTurnOnly && state.turn.ownerSeatId === seatId) return false;
  return conversionCards(state, seatId, owned.conversion, registry).length >= owned.conversion.cards;
}

// The conversions `seatId` could answer with, in a window that allows
// `allowedCardIds` (absent: any card). `revealedOnly`: leave out a hidden
// General's, for deciding whom to ask at all (being asked would give it away).
export function answeringConversions(
  state: GameState,
  seatId: string,
  allowedCardIds: string[] | undefined,
  registry: ContentRegistry,
  { revealedOnly = false }: { revealedOnly?: boolean } = {}
): OwnedConversion[] {
  return conversionsOf(state, seatId, registry).filter(
    (o) =>
      (!revealedOnly || !o.needsReveal) &&
      o.conversion.when !== 'play' &&
      (!allowedCardIds || allowedCardIds.includes(o.conversion.as)) &&
      usableNow(state, seatId, o, registry)
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
    return answeringConversions(state, seatId, pending.allowedCardIds, registry).filter((o) => answerConditionMet(state, pending, seatId, o.conversion.as, registry)).map((o): UseConversion => ({
      kind: 'UseConversionAction', seatId, via: via(o), targets: [], pendingResponseId: pending.id,
    }));
  }
  if (state.phase !== 'Play' || state.turn.ownerSeatId !== seatId) return [];
  return conversionsOf(state, seatId, registry)
    .filter((o) => o.conversion.when !== 'respond' && usableNow(state, seatId, o, registry))
    .flatMap((o): UseConversion[] => {
      const enoughAt = (targets: Target[]) => playConversionCards(state, seatId, o.conversion, targets, registry).length >= o.conversion.cards;
      // Several targets allowed now: one template carrying the pick.
      const pick = targetPickFor(state, seatId, '', o.conversion.as, registry, conversionVia(o.conversion));
      if (pick) {
        const any = pick.eligibleIds.some((id) => enoughAt([{ kind: 'seat', seatId: id }]));
        const template: UseConversion[] = any ? [{ kind: 'UseConversionAction', seatId, via: via(o), targets: [], pickTargets: pick }] : [];
        // Beside the pick, the card's no-target use when it offers one.
        const untargeted: UseConversion[] = untargetedAllowed(state, seatId, '', o.conversion.as, registry, conversionVia(o.conversion)) && enoughAt([]) ? [{ kind: 'UseConversionAction', seatId, via: via(o), targets: [] }] : [];
        return [...template, ...untargeted];
      }
      return legalTargetListsFor(state, seatId, '', o.conversion.as, registry, conversionVia(o.conversion))
        .filter(enoughAt)
        .map((targets): UseConversion => ({ kind: 'UseConversionAction', seatId, via: via(o), targets }));
    });
}

/** The hidden Generals of the seat, Main first: what the Start window offers to reveal. */
export function hiddenSlots(state: GameState, seatId: string): Array<'main' | 'deputy'> {
  const generals = state.seats.find((s) => s.id === seatId)?.generals;
  if (!generals) return [];
  return (['main', 'deputy'] as const).filter((slot) => generals[slot].revealed === false);
}

// Whether a card of `definitionId` (or what it plays as) may answer `pending`
// for `seatId` under its own answerCondition, if it has one. Without the
// registry no condition is known, so any card allowed by id may answer.
export function answerConditionMet(state: GameState, pending: PendingResponse, seatId: string, definitionId: string, registry?: ContentRegistry): boolean {
  const definition = registry?.cards.get(definitionId);
  if (definition?.answerCondition && !definition.answerCondition(state, pending, seatId, registry!)) return false;
  const playsAs = definition?.playsAs ? registry!.cards.get(definition.playsAs) : undefined;
  return !playsAs?.answerCondition || playsAs.answerCondition(state, pending, seatId, registry!);
}
