import { GameState, GameEvent } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action, isAction } from './actions';
import { Effect, applyEffect } from './effects';
import { lookupCard } from '../registry/lookup';
import { gatherTriggeredSkills } from '../skills/triggers';
import { advancePhaseOrTurn } from '../rules/phaseSequence';

export interface EngineContext {
  registry: ContentRegistry;
  mode: GameModeDefinition;
}

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
}

export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  if (state.pendingResponse && !state.pendingResponse.allowedActionKinds.includes(action.kind)) {
    throw new Error(`Action ${action.kind} is not legal while a response is pending`);
  }
  switch (action.kind) {
    case 'DrawCardsAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      return resolveEffectWithTriggers(
        state,
        { kind: 'DrawCardsEffect', seatId: action.seatId, count: action.count },
        ctx
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
      const cardDefinition = lookupCard(ctx.registry, cardInHand.definitionId);
      const effects = cardDefinition.play(state, {
        seatId: action.seatId,
        cardInstanceId: action.cardInstanceId,
        targets: action.targets,
      }) as Effect[];

      let currentState = state;
      let allEvents: GameEvent[] = [];
      for (const effect of effects) {
        const result = resolveEffectWithTriggers(currentState, effect, ctx);
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }
      return { state: currentState, events: allEvents };
    }
    case 'PassAction': {
      const pending = state.pendingResponse;
      if (!pending || pending.id !== action.pendingResponseId) {
        throw new Error(`No matching pending response: ${action.pendingResponseId}`);
      }
      const clearedState: GameState = { ...state, pendingResponse: null };
      return resolveEffectWithTriggers(clearedState, pending.context.effect as Effect, ctx);
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
        const result = resolveEffectWithTriggers(currentState, effect, ctx);
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }
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
      return { state: { ...state, phase, turn, log: [...state.log, event] }, events: [event] };
    }
    default:
      throw new Error(`Action kind not yet handled by resolve(): ${action.kind}`);
  }
}

function resolveEffectWithTriggers(state: GameState, effect: Effect, ctx: EngineContext): ResolveResult {
  const beforeTriggers = gatherTriggeredSkills(state, ctx.registry, ctx.mode, `before:${effect.kind}`, effect);
  let currentEffect: Effect | null = effect;
  for (const trigger of beforeTriggers) {
    if (currentEffect === null) break;
    const outputs = trigger.effect(state, currentEffect) as Effect[];
    currentEffect = outputs.length > 0 ? outputs[0] : null;
  }
  if (currentEffect === null) {
    return { state, events: [] };
  }

  const applied = applyEffect(state, currentEffect);
  let currentState = applied.state;
  let allEvents: GameEvent[] = [...applied.events];

  for (const event of applied.events) {
    const afterTriggers = gatherTriggeredSkills(currentState, ctx.registry, ctx.mode, `after:${event.kind}`, event);
    for (const trigger of afterTriggers) {
      const followUps = trigger.effect(currentState, event) as Array<Action | Effect>;
      for (const followUp of followUps) {
        if (isAction(followUp)) {
          const result = resolve(currentState, followUp, ctx);
          currentState = result.state;
          allEvents = [...allEvents, ...result.events];
        } else {
          const result = resolveEffectWithTriggers(currentState, followUp, ctx);
          currentState = result.state;
          allEvents = [...allEvents, ...result.events];
        }
      }
    }
  }

  return { state: currentState, events: allEvents };
}
