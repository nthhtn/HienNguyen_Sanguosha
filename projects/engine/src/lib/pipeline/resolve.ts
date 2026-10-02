import { GameState, GameEvent, Seat } from '../domain/types';
import { ContentRegistry, GameModeDefinition, CardDefinition } from '../registry/types';
import { Action, isAction } from './actions';
import { Effect, applyEffect } from './effects';
import { lookupCard } from '../registry/lookup';
import { gatherTriggeredSkills } from '../skills/triggers';
import { requireZoneOfKind } from '../cards/zones';
import { advancePhaseOrTurn } from '../rules/phaseSequence';
import { legalTargetListsFor } from '../rules/legality';
import { applyGeneralChoice } from '../rules/generalSelection';
import { cardsOverHandLimit } from '../rules/handLimit';

export interface EngineContext {
  registry: ContentRegistry;
  mode: GameModeDefinition;
}

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
}

// `resolveEffectWithTriggers` and `resolveAction` recurse into each other every
// time a trigger produces a follow-up effect or action. A content trigger cycle
// (say, `after:HealEvent -> DamageEffect` combined with
// `after:DamageDealtEvent -> HealEffect`) would otherwise recurse until the
// native call stack blows up, with no indication of which content caused it.
// The limit is deliberately far above any legitimate chain: the longest real
// interaction in this content pack is three levels deep
// (damage -> forced reveal -> elimination).
export const MAX_TRIGGER_DEPTH = 64;

function guardDepth(depth: number, what: string): void {
  if (depth > MAX_TRIGGER_DEPTH) {
    throw new Error(
      `Trigger recursion limit exceeded (depth ${depth} > ${MAX_TRIGGER_DEPTH}) while resolving ${what} — ` +
        'a content trigger cycle is the likely cause'
    );
  }
}

export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  if (state.result) {
    throw new Error('Cannot submit an action after the game has ended');
  }
  const result = resolveAction(state, action, ctx, 0);
  // Seats still choosing have kingdom 'hidden'; reading that as a one-kingdom
  // table would end the game before it starts.
  const gameResult =
    result.state.phase === 'GeneralSelection' ? null : ctx.mode.checkWinCondition(result.state);
  const finalState = gameResult ? { ...result.state, result: gameResult } : result.state;
  return { state: finalState, events: result.events };
}

function resolveAction(state: GameState, action: Action, ctx: EngineContext, depth: number): ResolveResult {
  guardDepth(depth, `action ${action.kind}`);
  if (state.pendingResponse && !state.pendingResponse.allowedActionKinds.includes(action.kind)) {
    throw new Error(`Action ${action.kind} is not legal while a response is pending`);
  }
  if (state.phase === 'GeneralSelection' && action.kind !== 'ChooseGeneralsAction') {
    throw new Error(`Action ${action.kind} is not legal during general selection`);
  }

  switch (action.kind) {
    case 'DrawCardsAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      return resolveEffectWithTriggers(
        state,
        { kind: 'DrawCardsEffect', seatId: action.seatId, count: action.count },
        ctx,
        depth
      );
    }

    case 'PlayCardAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      const handZone = state.zones.find((z) => z.id === seat.hand.zoneId);
      const cardInHand = handZone?.cards.find((c) => c.instanceId === action.cardInstanceId);
      if (!cardInHand) {
        throw new Error(`Seat ${action.seatId} does not hold card ${action.cardInstanceId}`);
      }
      for (const target of action.targets) {
        if (target.kind === 'seat') {
          const targetSeat = state.seats.find((s) => s.id === target.seatId);
          if (!targetSeat || targetSeat.eliminated) {
            throw new Error(`Illegal target seat: ${target.seatId}`);
          }
        }
      }
      if (state.phase !== 'Play' || state.turn.ownerSeatId !== action.seatId) {
        throw new Error('Cards can only be played during your Play phase');
      }
      const allowed = legalTargetListsFor(state, action.seatId, action.cardInstanceId, cardInHand.definitionId, ctx.registry);
      if (!allowed.some((targets) => JSON.stringify(targets) === JSON.stringify(action.targets))) {
        throw new Error(`Card ${cardInHand.definitionId} cannot be played with those targets`);
      }
      const cardDefinition = lookupCard(ctx.registry, cardInHand.definitionId);
      const effects = cardDefinition.play(state, {
        seatId: action.seatId,
        cardInstanceId: action.cardInstanceId,
        targets: action.targets,
      }) as Effect[];

      let currentState = state;
      let allEvents: GameEvent[] = [];
      for (const effect of effects) {
        const result = resolveEffectWithTriggers(currentState, effect, ctx, depth);
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }
      const discarded = discardAfterPlay(currentState, seat, cardDefinition, action.cardInstanceId, ctx, depth);
      currentState = discarded.state;
      allEvents = [...allEvents, ...discarded.events];
      // Count this proactive play for per-turn limits (only if still the same turn).
      if (currentState.turn.turnNumber === state.turn.turnNumber) {
        const plays = currentState.turn.cardPlays ?? {};
        currentState = {
          ...currentState,
          turn: { ...currentState.turn, cardPlays: { ...plays, [cardInHand.definitionId]: (plays[cardInHand.definitionId] ?? 0) + 1 } },
        };
      }
      return { state: currentState, events: allEvents };
    }

    case 'PassAction': {
      const pending = state.pendingResponse;
      if (!pending || pending.id !== action.pendingResponseId) {
        throw new Error(`No matching pending response: ${action.pendingResponseId}`);
      }
      const clearedState: GameState = { ...state, pendingResponse: null };
      return resolveEffectWithTriggers(clearedState, pending.context.effect, ctx, depth);
    }

    case 'RespondAction': {
      const pending = state.pendingResponse;
      if (!pending || pending.id !== action.pendingResponseId) {
        throw new Error(`No matching pending response: ${action.pendingResponseId}`);
      }
      if (action.seatId !== pending.respondingSeatId) {
        throw new Error(`Seat ${action.seatId} is not the responder for ${action.pendingResponseId}`);
      }
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      const handZone = state.zones.find((z) => z.id === seat.hand.zoneId);
      const cardInHand = handZone?.cards.find((c) => c.instanceId === action.cardInstanceId);
      if (!cardInHand) {
        throw new Error(`Seat ${action.seatId} does not hold card ${action.cardInstanceId}`);
      }
      if (pending.allowedCardIds && !pending.allowedCardIds.includes(cardInHand.definitionId)) {
        throw new Error(`Card ${cardInHand.definitionId} is not a legal response here`);
      }
      const clearedState: GameState = { ...state, pendingResponse: null };
      const cardDefinition = lookupCard(ctx.registry, cardInHand.definitionId);
      const effects = cardDefinition.play(clearedState, {
        seatId: action.seatId,
        cardInstanceId: action.cardInstanceId,
        targets: [],
        respondingTo: action.pendingResponseId,
      }) as Effect[];
      let currentState = clearedState;
      let allEvents: GameEvent[] = [];
      for (const effect of effects) {
        const result = resolveEffectWithTriggers(currentState, effect, ctx, depth);
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }
      const discarded = discardAfterPlay(currentState, seat, cardDefinition, action.cardInstanceId, ctx, depth);
      currentState = discarded.state;
      allEvents = [...allEvents, ...discarded.events];
      return { state: currentState, events: allEvents };
    }

    case 'EndPhaseAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      if (state.turn.ownerSeatId !== action.seatId) {
        throw new Error(`It is not seat ${action.seatId}'s turn`);
      }
      const { phase, turn } = advancePhaseOrTurn(state);
      const event =
        turn.turnNumber !== state.turn.turnNumber
          ? { kind: 'TurnAdvancedEvent' as const, seatId: turn.ownerSeatId, turnNumber: turn.turnNumber }
          : { kind: 'PhaseChangedEvent' as const, seatId: action.seatId, phase };
      const stateWithPhaseChange = { ...state, phase, turn, log: [...state.log, event] };

      const followUp = runAfterTriggers(stateWithPhaseChange, event, ctx, depth);
      return { state: followUp.state, events: [event, ...followUp.events] };
    }

    case 'DiscardCardAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      if (state.phase !== 'Discard' || state.turn.ownerSeatId !== action.seatId) {
        throw new Error('Cards can only be discarded during your Discard phase');
      }
      if (cardsOverHandLimit(state, action.seatId) === 0) {
        throw new Error(`Seat ${action.seatId} is within its hand limit and has nothing to discard`);
      }
      const handZone = state.zones.find((z) => z.id === seat.hand.zoneId);
      if (!handZone?.cards.some((c) => c.instanceId === action.cardInstanceId)) {
        throw new Error(`Seat ${action.seatId} does not hold card ${action.cardInstanceId}`);
      }
      const discardPile = requireZoneOfKind(state.zones, 'discardPile');
      return resolveEffectWithTriggers(
        state,
        { kind: 'MoveCardEffect', cardInstanceId: action.cardInstanceId, toZoneId: discardPile.id },
        ctx,
        depth
      );
    }

    case 'RevealGeneralAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      return resolveEffectWithTriggers(
        state,
        { kind: 'RevealGeneralEffect', seatId: action.seatId, slot: action.slot },
        ctx,
        depth
      );
    }

    case 'ChooseGeneralsAction': {
      const { state: chosen, event } = applyGeneralChoice(state, action, ctx.registry);
      const followUp = runAfterTriggers(chosen, event, ctx, depth);
      return { state: followUp.state, events: [event, ...followUp.events] };
    }

    default:
      throw new Error(`Action kind not yet handled by resolve(): ${(action as Action).kind}`);
  }
}

// Generic post-play discard: any non-equipment card still sitting in the acting
// seat's hand once its play() effects have finished resolving is moved to the
// discard pile. Equipment cards are exempt — their own play() already relocates
// them to the seat's equip zone, where they must stay.
//
// The destination is looked up by zone `kind`, not by a hardcoded id: a
// GameModeDefinition may name its discard pile anything it likes.
function discardAfterPlay(
  state: GameState,
  seat: Seat,
  cardDefinition: CardDefinition,
  cardInstanceId: string,
  ctx: EngineContext,
  depth: number
): ResolveResult {
  if (cardDefinition.category === 'equipment') {
    return { state, events: [] };
  }
  const handZone = state.zones.find((z) => z.id === seat.hand.zoneId);
  const stillInHand = !!handZone?.cards.some((c) => c.instanceId === cardInstanceId);
  if (!stillInHand) {
    return { state, events: [] };
  }
  const discardPile = requireZoneOfKind(state.zones, 'discardPile');
  return resolveEffectWithTriggers(
    state,
    { kind: 'MoveCardEffect', cardInstanceId, toZoneId: discardPile.id },
    ctx,
    depth
  );
}

// Gathers and dispatches every `after:<event kind>` trigger for one event,
// resolving each follow-up action/effect in turn. Shared by the effect
// resolution path and by EndPhaseAction's phase/turn events.
function runAfterTriggers(
  state: GameState,
  event: GameEvent,
  ctx: EngineContext,
  depth: number
): ResolveResult {
  let currentState = state;
  let allEvents: GameEvent[] = [];
  const afterTriggers = gatherTriggeredSkills(currentState, ctx.registry, ctx.mode, `after:${event.kind}`, event);
  for (const gathered of afterTriggers) {
    const followUps = gathered.trigger.effect(currentState, event, gathered.owner) as Array<Action | Effect>;
    for (const followUp of followUps) {
      const result = isAction(followUp)
        ? resolveAction(currentState, followUp, ctx, depth + 1)
        : resolveEffectWithTriggers(currentState, followUp, ctx, depth + 1);
      currentState = result.state;
      allEvents = [...allEvents, ...result.events];
    }
  }
  return { state: currentState, events: allEvents };
}

function resolveEffectWithTriggers(
  state: GameState,
  effect: Effect,
  ctx: EngineContext,
  depth: number
): ResolveResult {
  guardDepth(depth, `effect ${effect.kind}`);
  const beforeTriggers = gatherTriggeredSkills(state, ctx.registry, ctx.mode, `before:${effect.kind}`, effect);
  let currentEffect: Effect | null = effect;
  for (const gathered of beforeTriggers) {
    if (currentEffect === null) break;
    const outputs = gathered.trigger.effect(state, currentEffect, gathered.owner) as Effect[];
    currentEffect = outputs.length > 0 ? outputs[0] : null;
  }
  if (currentEffect === null) {
    return { state, events: [] };
  }

  const applied = applyEffect(state, currentEffect);
  let currentState = applied.state;
  let allEvents: GameEvent[] = [...applied.events];

  for (const event of applied.events) {
    const followUp = runAfterTriggers(currentState, event, ctx, depth);
    currentState = followUp.state;
    allEvents = [...allEvents, ...followUp.events];
  }

  return { state: currentState, events: allEvents };
}
