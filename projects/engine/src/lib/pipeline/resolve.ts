import { GameState, GameEvent, QueueItem } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action, isAction } from './actions';
import { Effect, applyEffect } from './effects';
import { lookupCard } from '../registry/lookup';
import { gatherTriggeredSkills } from '../skills/triggers';
import { requireZoneOfKind } from '../cards/zones';
import { advancePhaseOrTurn, phaseWaitsForPlayer } from '../rules/phaseSequence';
import { legalTargetListsFor } from '../rules/legality';
import { applyGeneralChoice } from '../rules/generalSelection';
import { cardsOverHandLimit } from '../rules/handLimit';
import { CardPlayedEvent, ChoiceMadeEvent, PhaseChangedEvent, PhaseSkippedEvent, TurnAdvancedEvent } from './events';
import { queueFront, withQueue } from './queue';
import { applyLifecycleEffect, isLifecycleEffect } from './toolLifecycle';

export interface EngineContext {
  registry: ContentRegistry;
  mode: GameModeDefinition;
}

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
}

// Queue items one `resolve` call may work through. Far above any real chain
// (a 10-seat Barbarians with every Wuxie played is a few hundred); a content
// trigger cycle hits it and fails loudly, naming the item, instead of looping.
export const MAX_RESOLUTION_STEPS = 10_000;

interface StepBudget {
  used: number;
}

// Every phase entered by advanceToDecision is one step. One full turn is at
// most six steps, and every turn rests in Play unless its owner is eliminated,
// so a legitimate run stays far below this bound.
export const MAX_AUTO_PHASE_STEPS_PER_SEAT = 6;

export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  if (state.result) {
    throw new Error('Cannot submit an action after the game has ended');
  }
  const budget: StepBudget = { used: 0 };
  const acted = resolveAction(state, action, ctx);
  const settled = advanceToDecision(acted.state, ctx, budget);
  return { state: settled.state, events: [...acted.events, ...settled.events] };
}

// Drains the queue, then moves the game on through every phase that needs no
// decision, until a player must act (Play, or Discard over the hand limit), a
// response is pending, or the game has ended. An eliminated turn owner forfeits
// the rest of their turn.
export function advanceToDecision(state: GameState, ctx: EngineContext, budget: StepBudget = { used: 0 }): ResolveResult {
  let current = state;
  let events: GameEvent[] = [];
  const maxSteps = MAX_AUTO_PHASE_STEPS_PER_SEAT * current.seats.length + MAX_AUTO_PHASE_STEPS_PER_SEAT;
  for (let steps = 0; ; steps++) {
    const drained = drain(current, ctx, budget);
    current = drained.state;
    events = [...events, ...drained.events];
    if (current.result || current.phase === 'GeneralSelection' || current.pendingResponse || current.pendingChoice) break;
    const ownerEliminated = !!current.seats.find((s) => s.id === current.turn.ownerSeatId)?.eliminated;
    if (!ownerEliminated && phaseWaitsForPlayer(current)) break;
    if (steps >= maxSteps) {
      throw new Error(`Phases advanced ${steps} times without reaching a player decision`);
    }
    const from: GameState = ownerEliminated ? { ...current, phase: 'End' } : current;
    const step = enterNextPhase(from, ctx);
    current = step.state;
    events = [...events, ...step.events];
  }
  return { state: current, events };
}

// Resolves queue items front first until a response is pending, the queue is
// empty, or the game is over (whatever is left is then dropped).
function drain(state: GameState, ctx: EngineContext, budget: StepBudget): ResolveResult {
  let current = withWinCheck(state, ctx);
  const events: GameEvent[] = [];
  while (!current.result && !current.pendingResponse && !current.pendingChoice && (current.resolutionQueue?.length ?? 0) > 0) {
    const [item, ...rest] = current.resolutionQueue!;
    budget.used += 1;
    if (budget.used > MAX_RESOLUTION_STEPS) {
      throw new Error(
        `Resolution step budget exceeded (${MAX_RESOLUTION_STEPS} steps) while resolving ${item.kind} — ` +
          'a content trigger cycle is the likely cause'
      );
    }
    const popped = withQueue(current, rest);
    const step = isAction(item) ? resolveAction(popped, item, ctx) : resolveEffect(popped, item, ctx);
    current = withWinCheck(step.state, ctx);
    events.push(...step.events);
  }
  if (current.result) current = withQueue(current, []);
  return { state: current, events };
}

// Seats still choosing have kingdom 'hidden'; reading that as a one-kingdom
// table would end the game before it starts.
function withWinCheck(state: GameState, ctx: EngineContext): GameState {
  if (state.result || state.phase === 'GeneralSelection') return state;
  const result = ctx.mode.checkWinCondition(state);
  return result ? { ...state, result } : state;
}

// Appends events to the log.
function logged(state: GameState, events: GameEvent[]): GameState {
  return { ...state, log: [...state.log, ...(events as GameState['log'])] };
}

// Every after-trigger follow-up for `events`, in event order then trigger
// order. All are gathered against `state`, before any of them resolves.
function afterTriggerFollowUps(state: GameState, events: GameEvent[], ctx: EngineContext): QueueItem[] {
  const followUps: QueueItem[] = [];
  for (const event of events) {
    for (const gathered of gatherTriggeredSkills(state, ctx.registry, ctx.mode, `after:${event.kind}`, event)) {
      followUps.push(...(gathered.trigger.effect(state, event, gathered.owner) as QueueItem[]));
    }
  }
  return followUps;
}

// Logs events that happened outside applyEffect, and queues their after-trigger
// follow-ups at the front.
function logWithTriggers(state: GameState, events: GameEvent[], ctx: EngineContext): ResolveResult {
  const withLog = logged(state, events);
  return { state: queueFront(withLog, afterTriggerFollowUps(withLog, events, ctx)), events };
}

// Moves to the next phase (or the next turn's Start) and enters it. Phases
// flagged to skip are logged as skipped and never entered.
function enterNextPhase(state: GameState, ctx: EngineContext): ResolveResult {
  const { phase, turn, skipped } = advancePhaseOrTurn(state);
  const events: GameEvent[] = [];
  if (turn.turnNumber !== state.turn.turnNumber) {
    const turnEvent: TurnAdvancedEvent = { kind: 'TurnAdvancedEvent', seatId: turn.ownerSeatId, turnNumber: turn.turnNumber };
    events.push(turnEvent);
  }
  for (const skippedPhase of skipped) {
    const skipEvent: PhaseSkippedEvent = { kind: 'PhaseSkippedEvent', seatId: turn.ownerSeatId, phase: skippedPhase };
    events.push(skipEvent);
  }
  const phaseEvent: PhaseChangedEvent = { kind: 'PhaseChangedEvent', seatId: turn.ownerSeatId, phase };
  events.push(phaseEvent);
  return logWithTriggers({ ...state, phase, turn }, events, ctx);
}

// One effect: before-triggers may rewrite or cancel it, then it applies and its
// events' after-trigger follow-ups go to the front of the queue.
function resolveEffect(state: GameState, effect: Effect, ctx: EngineContext): ResolveResult {
  const beforeTriggers = gatherTriggeredSkills(state, ctx.registry, ctx.mode, `before:${effect.kind}`, effect);
  let current: Effect | null = effect;
  for (const gathered of beforeTriggers) {
    if (current === null) break;
    const outputs = gathered.trigger.effect(state, current, gathered.owner) as Effect[];
    current = outputs.length > 0 ? outputs[0] : null;
  }
  if (current === null) return { state, events: [] };

  const applied = isLifecycleEffect(current) ? applyLifecycleEffect(state, current, ctx.registry) : applyEffect(state, current);
  return { state: queueFront(applied.state, afterTriggerFollowUps(applied.state, applied.events, ctx)), events: applied.events };
}

// Validates an action and queues what it leads to. Nothing here resolves an
// effect directly: the caller drains the queue.
function resolveAction(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  if (state.pendingChoice && action.kind !== 'ChooseOptionAction') {
    throw new Error(`Action ${action.kind} is not legal while a choice is pending`);
  }
  if (state.pendingResponse && !state.pendingResponse.allowedActionKinds.includes(action.kind)) {
    throw new Error(`Action ${action.kind} is not legal while a response is pending`);
  }
  if (state.phase === 'GeneralSelection' && action.kind !== 'ChooseGeneralsAction') {
    throw new Error(`Action ${action.kind} is not legal during general selection`);
  }

  switch (action.kind) {
    case 'DrawCardsAction': {
      if (!state.seats.some((s) => s.id === action.seatId)) throw new Error(`Unknown seat: ${action.seatId}`);
      return { state: queueFront(state, [{ kind: 'DrawCardsEffect', seatId: action.seatId, count: action.count }]), events: [] };
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
      const event: CardPlayedEvent = { kind: 'CardPlayedEvent', seatId: action.seatId, card: cardInHand, targets: action.targets };
      const afterLog = logged(state, [event]);
      const effects = cardDefinition.play(afterLog, {
        seatId: action.seatId,
        cardInstanceId: action.cardInstanceId,
        targets: action.targets,
      }) as Effect[];
      // Counted when played, for per-turn limits, whatever happens next.
      const plays = afterLog.turn.cardPlays ?? {};
      const counted: GameState = {
        ...afterLog,
        turn: { ...afterLog.turn, cardPlays: { ...plays, [cardInHand.definitionId]: (plays[cardInHand.definitionId] ?? 0) + 1 } },
      };
      // A used card leaves the hand at once, so it can't be reused mid-resolution.
      // Equipment is placed by its own play() instead.
      const leaveHand: Effect[] =
        cardDefinition.category === 'equipment'
          ? []
          : [{ kind: 'MoveCardEffect', cardInstanceId: action.cardInstanceId, toZoneId: requireZoneOfKind(state.zones, 'discardPile').id }];
      const followUps = afterTriggerFollowUps(counted, [event], ctx);
      return { state: queueFront(counted, [...leaveHand, ...followUps, ...effects]), events: [event] };
    }

    case 'PassAction': {
      const pending = state.pendingResponse;
      if (!pending || pending.id !== action.pendingResponseId) {
        throw new Error(`No matching pending response: ${action.pendingResponseId}`);
      }
      return { state: queueFront({ ...state, pendingResponse: null }, [pending.context.effect]), events: [] };
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
      const reason = pending.reason;
      const inResponseTo =
        reason?.kind === 'wuxie'
          ? {
              seatId: reason.toolUserSeatId,
              ...(reason.tool.physical[0] ? { cardInstanceId: reason.tool.physical[0].instanceId } : {}),
              ...(reason.target.kind === 'seat' ? { targetSeatId: reason.target.seatId } : {}),
            }
          : reason?.kind === 'counter-wuxie'
            ? { seatId: reason.wuxieSeatId, counters: true }
            : reason?.kind === 'card-effect'
              ? { seatId: reason.userSeatId, ...(reason.card.physical[0] ? { cardInstanceId: reason.card.physical[0].instanceId } : {}) }
              : {
                  ...(answered?.source?.kind === 'seat' ? { seatId: answered.source.seatId } : {}),
                  ...(answered?.cause?.cardInstanceId ? { cardInstanceId: answered.cause.cardInstanceId } : {}),
                  ...(reason?.kind === 'dying' ? { dyingSeatId: reason.seatId } : {}),
                };
      const event: CardPlayedEvent = { kind: 'CardPlayedEvent', seatId: action.seatId, card: cardInHand, targets: [], inResponseTo };
      const afterLog = logged({ ...state, pendingResponse: null }, [event]);
      const effects = cardDefinition.play(afterLog, {
        seatId: action.seatId,
        cardInstanceId: action.cardInstanceId,
        targets: [],
        respondingTo: action.pendingResponseId,
      }) as Effect[];
      // The opening card's say in what the answer leads to (e.g. a Duel turning back).
      const fromSource = pending.sourceCard
        ? ((lookupCard(ctx.registry, pending.sourceCard.definitionId).onResponse?.(afterLog, {
            pending,
            seatId: action.seatId,
            cardInstanceId: action.cardInstanceId,
          }) ?? []) as Effect[])
        : [];
      const leaveHand: Effect = { kind: 'MoveCardEffect', cardInstanceId: action.cardInstanceId, toZoneId: requireZoneOfKind(state.zones, 'discardPile').id };
      const followUps = afterTriggerFollowUps(afterLog, [event], ctx);
      return {
        state: queueFront(afterLog, [leaveHand, ...followUps, ...effects, ...(pending.onAnswer ?? []), ...fromSource]),
        events: [event],
      };
    }

    case 'EndPhaseAction': {
      if (!state.seats.some((s) => s.id === action.seatId)) throw new Error(`Unknown seat: ${action.seatId}`);
      if (state.turn.ownerSeatId !== action.seatId) {
        throw new Error(`It is not seat ${action.seatId}'s turn`);
      }
      if (state.phase !== 'Play') {
        throw new Error('EndPhaseAction is only legal in the Play phase');
      }
      return enterNextPhase(state, ctx);
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
      return { state: queueFront(state, [{ kind: 'MoveCardEffect', cardInstanceId: action.cardInstanceId, toZoneId: discardPile.id }]), events: [] };
    }

    case 'RevealGeneralAction': {
      if (!state.seats.some((s) => s.id === action.seatId)) throw new Error(`Unknown seat: ${action.seatId}`);
      return { state: queueFront(state, [{ kind: 'RevealGeneralEffect', seatId: action.seatId, slot: action.slot }]), events: [] };
    }

    case 'ChooseGeneralsAction': {
      // applyGeneralChoice logs its own event.
      const { state: chosen, event } = applyGeneralChoice(state, action, ctx.registry);
      const choiceFollowUps = afterTriggerFollowUps(chosen, [event], ctx);
      if (chosen.generalSelection !== null) return { state: queueFront(chosen, choiceFollowUps), events: [event] };
      // The last seat has chosen: turn 1 begins at Start.
      const phaseEvent: PhaseChangedEvent = { kind: 'PhaseChangedEvent', seatId: chosen.turn.ownerSeatId, phase: chosen.phase };
      const entered = logged(chosen, [phaseEvent]);
      return {
        state: queueFront(entered, [...choiceFollowUps, ...afterTriggerFollowUps(entered, [phaseEvent], ctx)]),
        events: [event, phaseEvent],
      };
    }

    case 'ChooseOptionAction': {
      const choice = state.pendingChoice;
      if (!choice || choice.id !== action.choiceId) throw new Error(`No matching pending choice: ${action.choiceId}`);
      if (action.seatId !== choice.seatId) throw new Error(`Seat ${action.seatId} is not the chooser for ${action.choiceId}`);
      const option = choice.options.find((o) => o.id === action.optionId);
      if (!option) throw new Error(`Choice ${action.choiceId} has no option ${action.optionId}`);
      const { pendingChoice: _settled, ...cleared } = state;
      const event: ChoiceMadeEvent = { kind: 'ChoiceMadeEvent', seatId: action.seatId, reason: choice.reason, verb: choice.verb, shows: option.shows };
      const made = logged(cleared, [event]);
      return { state: queueFront(made, [...afterTriggerFollowUps(made, [event], ctx), ...option.effects]), events: [event] };
    }

    default:
      throw new Error(`Action kind not yet handled by resolve(): ${(action as Action).kind}`);
  }
}
