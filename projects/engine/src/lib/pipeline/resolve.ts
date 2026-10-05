import { GameState, GameEvent, Seat } from '../domain/types';
import { ContentRegistry, GameModeDefinition, CardDefinition } from '../registry/types';
import { Action, isAction } from './actions';
import { Effect, applyEffect } from './effects';
import { lookupCard } from '../registry/lookup';
import { gatherTriggeredSkills } from '../skills/triggers';
import { requireZoneOfKind } from '../cards/zones';
import { advancePhaseOrTurn, phaseWaitsForPlayer } from '../rules/phaseSequence';
import { legalTargetListsFor } from '../rules/legality';
import { applyGeneralChoice } from '../rules/generalSelection';
import { cardsOverHandLimit } from '../rules/handLimit';
import { CardPlayedEvent, PhaseChangedEvent, TurnAdvancedEvent } from './events';

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

// Every phase entered by advanceToDecision is one step. One full turn is at
// most six steps, and every turn rests in Play unless its owner is eliminated,
// so a legitimate run stays far below this bound.
export const MAX_AUTO_PHASE_STEPS_PER_SEAT = 6;

export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  if (state.result) {
    throw new Error('Cannot submit an action after the game has ended');
  }
  const acted = resolveAction(state, action, ctx, 0);
  const settled = advanceToDecision(acted.state, ctx);
  return { state: settled.state, events: [...acted.events, ...settled.events] };
}

// Moves the game on through every phase that needs no decision, until a
// player must act (Play, or Discard over the hand limit), a response is
// pending, or the game has ended. An eliminated turn owner forfeits the rest
// of their turn.
export function advanceToDecision(state: GameState, ctx: EngineContext): ResolveResult {
  let current = withWinCheck(state, ctx);
  let events: GameEvent[] = [];
  const maxSteps = MAX_AUTO_PHASE_STEPS_PER_SEAT * current.seats.length + MAX_AUTO_PHASE_STEPS_PER_SEAT;
  for (let steps = 0; ; steps++) {
    if (current.result || current.phase === 'GeneralSelection' || current.pendingResponse) break;
    const ownerEliminated = !!current.seats.find((s) => s.id === current.turn.ownerSeatId)?.eliminated;
    if (!ownerEliminated && phaseWaitsForPlayer(current)) break;
    if (steps >= maxSteps) {
      throw new Error(`Phases advanced ${steps} times without reaching a player decision`);
    }
    const from: GameState = ownerEliminated ? { ...current, phase: 'End' } : current;
    const step = enterNextPhase(from, ctx, 0);
    current = withWinCheck(step.state, ctx);
    events = [...events, ...step.events];
  }
  return { state: current, events };
}

// Seats still choosing have kingdom 'hidden'; reading that as a one-kingdom
// table would end the game before it starts.
function withWinCheck(state: GameState, ctx: EngineContext): GameState {
  if (state.result || state.phase === 'GeneralSelection') return state;
  const result = ctx.mode.checkWinCondition(state);
  return result ? { ...state, result } : state;
}

// Logs entering the phase the state is already in, then runs its "after" triggers.
function enterPhase(state: GameState, ctx: EngineContext, depth: number): ResolveResult {
  const event: PhaseChangedEvent = { kind: 'PhaseChangedEvent', seatId: state.turn.ownerSeatId, phase: state.phase };
  const followUp = runAfterTriggers({ ...state, log: [...state.log, event] }, event, ctx, depth);
  return { state: followUp.state, events: [event, ...followUp.events] };
}

// Moves to the next phase (or the next turn's Start) and enters it.
function enterNextPhase(state: GameState, ctx: EngineContext, depth: number): ResolveResult {
  const { phase, turn } = advancePhaseOrTurn(state);
  let current: GameState = { ...state, phase, turn };
  let events: GameEvent[] = [];
  if (turn.turnNumber !== state.turn.turnNumber) {
    const turnEvent: TurnAdvancedEvent = { kind: 'TurnAdvancedEvent', seatId: turn.ownerSeatId, turnNumber: turn.turnNumber };
    const followUp = runAfterTriggers({ ...current, log: [...current.log, turnEvent] }, turnEvent, ctx, depth);
    current = followUp.state;
    events = [turnEvent, ...followUp.events];
  }
  const entered = enterPhase(current, ctx, depth);
  return { state: entered.state, events: [...events, ...entered.events] };
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
      const played = logCardPlayed(state, { kind: 'CardPlayedEvent', seatId: action.seatId, card: cardInHand, targets: action.targets }, ctx, depth);
      const effects = cardDefinition.play(played.state, {
        seatId: action.seatId,
        cardInstanceId: action.cardInstanceId,
        targets: action.targets,
      }) as Effect[];

      let currentState = played.state;
      let allEvents: GameEvent[] = played.events;
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
      const cardDefinition = lookupCard(ctx.registry, cardInHand.definitionId);
      const answered = pending.context.effect.kind === 'DamageEffect' ? pending.context.effect.damage : null;
      const inResponseTo = {
        ...(answered?.source?.kind === 'seat' ? { seatId: answered.source.seatId } : {}),
        ...(answered?.cause?.cardInstanceId ? { cardInstanceId: answered.cause.cardInstanceId } : {}),
        ...(pending.reason?.kind === 'dying' ? { dyingSeatId: pending.reason.seatId } : {}),
      };
      const played = logCardPlayed(
        { ...state, pendingResponse: null },
        { kind: 'CardPlayedEvent', seatId: action.seatId, card: cardInHand, targets: [], inResponseTo },
        ctx,
        depth
      );
      const clearedState = played.state;
      const effects = cardDefinition.play(clearedState, {
        seatId: action.seatId,
        cardInstanceId: action.cardInstanceId,
        targets: [],
        respondingTo: action.pendingResponseId,
      }) as Effect[];
      let currentState = clearedState;
      let allEvents: GameEvent[] = played.events;
      for (const effect of effects) {
        const result = resolveEffectWithTriggers(currentState, effect, ctx, depth);
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }
      const discarded = discardAfterPlay(currentState, seat, cardDefinition, action.cardInstanceId, ctx, depth);
      currentState = discarded.state;
      allEvents = [...allEvents, ...discarded.events];
      // Effects the window itself asks for on an answer, then the opening
      // card's say in what the answer leads to.
      for (const effect of pending.onAnswer ?? []) {
        const result = resolveEffectWithTriggers(currentState, effect, ctx, depth);
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }
      if (pending.sourceCard) {
        const source = lookupCard(ctx.registry, pending.sourceCard.definitionId);
        const followUps = (source.onResponse?.(currentState, {
          pending,
          seatId: action.seatId,
          cardInstanceId: action.cardInstanceId,
        }) ?? []) as Effect[];
        for (const effect of followUps) {
          const result = resolveEffectWithTriggers(currentState, effect, ctx, depth);
          currentState = result.state;
          allEvents = [...allEvents, ...result.events];
        }
      }
      return { state: currentState, events: allEvents };
    }

    case 'EndPhaseAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      if (state.turn.ownerSeatId !== action.seatId) {
        throw new Error(`It is not seat ${action.seatId}'s turn`);
      }
      if (state.phase !== 'Play') {
        throw new Error('EndPhaseAction is only legal in the Play phase');
      }
      return enterNextPhase(state, ctx, depth);
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
      if (chosen.generalSelection !== null) return { state: followUp.state, events: [event, ...followUp.events] };
      // The last seat has chosen: turn 1 begins at Start.
      const started = enterPhase(followUp.state, ctx, depth);
      return { state: started.state, events: [event, ...followUp.events, ...started.events] };
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

// Logs a card use, then runs its after-triggers.
function logCardPlayed(state: GameState, event: CardPlayedEvent, ctx: EngineContext, depth: number): ResolveResult {
  const followUp = runAfterTriggers({ ...state, log: [...state.log, event] }, event, ctx, depth);
  return { state: followUp.state, events: [event, ...followUp.events] };
}

// Gathers and dispatches every `after:<event kind>` trigger for one event,
// resolving each follow-up action/effect in turn. Shared by the effect
// resolution path and by phase and turn changes.
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
