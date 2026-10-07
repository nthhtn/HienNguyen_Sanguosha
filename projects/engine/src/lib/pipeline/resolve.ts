import { GameState, GameEvent, PendingChoice, PendingResponse, PendingSelection, QueueItem, Target, UsedCard } from '../domain/types';
import { usedCardFrom, usedCardOf } from '../domain/usedCard';
import { validateSelection } from '../rules/selection';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action, isAction } from './actions';
import { Effect, applyDying, applyEffect } from './effects';
import { lookupCard } from '../registry/lookup';
import { gatherTriggeredSkills } from '../skills/triggers';
import { requireZoneOfKind } from '../cards/zones';
import { decisionPending } from '../rules/activeSeat';
import { cardsOverHandLimit } from '../rules/handLimit';
import { validateArrangement } from '../rules/arrangement';
import { advancePhaseOrTurn, discardOwed, phaseWaitsForPlayer } from '../rules/phaseSequence';
import { activeSkillActions, answeringConversions, conversionActions, conversionCards, conversionsOf, legalTargetListsFor, playConversionCards, sameAbilityOwner } from '../rules/legality';
import { abilityUseKey, skillsInPlay } from '../skills/generalSkills';
import { applyGeneralChoice } from '../rules/generalSelection';
import { ArrangementMadeEvent, CardPlayedEvent, SeatTurnedEvent, ChoiceMadeEvent, EngineEvent, SelectionMadeEvent, PhaseChangedEvent, PhaseSkippedEvent, TurnAdvancedEvent } from './events';
import { queueFront, withQueue } from './queue';
import { applyLifecycleEffect, isLifecycleEffect } from './toolLifecycle';
import { applyJudgmentStepEffect, isJudgmentStepEffect } from './judgment';
import { applyCardStep } from './cardStep';
import { applySkillStep } from './skillStep';

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
    if (current.result || current.phase === 'GeneralSelection' || decisionPending(current)) break;
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
  while (!current.result && !decisionPending(current) && (current.resolutionQueue?.length ?? 0) > 0) {
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
      followUps.push(...(gathered.trigger.effect(state, event, gathered.owner, ctx.registry) as QueueItem[]));
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
  let current = state;
  let next = advancePhaseOrTurn(current);
  const events: GameEvent[] = [];
  // A face-down seat's turn: it turns face up instead, and the turn passes on.
  // Every seat turned up stops being face down, so this ends.
  while (next.turn.turnNumber !== current.turn.turnNumber) {
    const owner = current.seats.find((s) => s.id === next.turn.ownerSeatId);
    if (!owner?.faceDown) break;
    const { faceDown: _up, ...faceUp } = owner;
    current = { ...current, seats: current.seats.map((s) => (s.id === owner.id ? faceUp : s)), turn: next.turn, phase: 'End' };
    const passed: TurnAdvancedEvent = { kind: 'TurnAdvancedEvent', seatId: owner.id, turnNumber: next.turn.turnNumber };
    const turnedUp: SeatTurnedEvent = { kind: 'SeatTurnedEvent', seatId: owner.id, faceDown: false, passedTurn: true };
    events.push(passed, turnedUp);
    next = advancePhaseOrTurn(current);
  }
  const { phase, turn, skipped } = next;
  if (turn.turnNumber !== current.turn.turnNumber) {
    const turnEvent: TurnAdvancedEvent = { kind: 'TurnAdvancedEvent', seatId: turn.ownerSeatId, turnNumber: turn.turnNumber };
    events.push(turnEvent);
  }
  for (const skippedPhase of skipped) {
    const skipEvent: PhaseSkippedEvent = { kind: 'PhaseSkippedEvent', seatId: turn.ownerSeatId, phase: skippedPhase };
    events.push(skipEvent);
  }
  const phaseEvent: PhaseChangedEvent = { kind: 'PhaseChangedEvent', seatId: turn.ownerSeatId, phase };
  events.push(phaseEvent);
  // The Discard Phase owes what the owner is over its limit now (discardOwed).
  const entered: GameState = { ...current, phase, turn };
  const counted = phase === 'Discard' ? { ...entered, turn: { ...turn, discardsLeft: cardsOverHandLimit(entered, turn.ownerSeatId) } } : entered;
  return logWithTriggers(counted, events, ctx);
}

// `effect` as its before-triggers would rewrite it (e.g. Silver Lion's cap),
// or null if one would cancel it. Applies nothing: the UI uses it to state what
// a pending effect would really do. Each trigger after the first is checked
// again against the effect as rewritten so far. A rewrite into another kind of
// effect (an ask) ends it: the rest get their say when the effect comes back.
export function previewEffect(state: GameState, effect: Effect, ctx: EngineContext): Effect | null {
  return rewriteEffect(state, effect, ctx)?.effect ?? null;
}

// The before-triggers' say: the effect as it will apply (null: cancelled),
// and what any trigger returned after its first output, to run after it.
function rewriteEffect(state: GameState, effect: Effect, ctx: EngineContext): { effect: Effect; after: Effect[] } | null {
  const beforeTriggers = gatherTriggeredSkills(state, ctx.registry, ctx.mode, `before:${effect.kind}`, effect);
  let current: Effect = effect;
  const after: Effect[] = [];
  for (const [index, gathered] of beforeTriggers.entries()) {
    if (index > 0 && !gathered.trigger.condition(state, current, gathered.owner, ctx.registry)) continue;
    const outputs = gathered.trigger.effect(state, current, gathered.owner, ctx.registry) as Effect[];
    if (outputs.length === 0) return null;
    current = outputs[0];
    after.unshift(...outputs.slice(1));
    if (current.kind !== effect.kind) return { effect: current, after };
  }
  return { effect: current, after };
}

// One effect: before-triggers may rewrite or cancel it, then it applies and its
// events' after-trigger follow-ups go to the front of the queue, ahead of
// whatever the rewriting triggers returned after the rewrite.
function resolveEffect(state: GameState, effect: Effect, ctx: EngineContext): ResolveResult {
  const rewritten = rewriteEffect(state, effect, ctx);
  if (rewritten === null) return { state, events: [] };
  const current = rewritten.effect;

  // A card used by an effect goes through useCard, which logs and queues its own follow-ups.
  if (current.kind === 'UseCardEffect') {
    const counted = !!current.counted;
    const used = useCard(
      state,
      current.seatId,
      current.card,
      { targets: current.targets, counted, ...(counted ? {} : { free: true }), ...(current.answering ? { respondTo: current.answering } : {}) },
      ctx
    );
    return { state: queueFront(used.state, rewritten.after), events: used.events };
  }

  const applied = isLifecycleEffect(current)
    ? applyLifecycleEffect(state, current, ctx.registry)
    : isJudgmentStepEffect(current)
      ? applyJudgmentStepEffect(state, current, ctx.registry)
      : current.kind === 'CardStepEffect'
        ? applyCardStep(state, current, ctx.registry)
        : current.kind === 'SkillStepEffect'
          ? applySkillStep(state, current, ctx.registry)
          : current.kind === 'DyingEffect'
            ? applyDying(state, current, (seatId) => answeringConversions(state, seatId, current.rescueCardIds.any, ctx.registry, { revealedOnly: true }).length > 0)
            : applyEffect(state, current);
  const followUps = [...afterTriggerFollowUps(applied.state, applied.events, ctx), ...unequipFollowUps(state, applied.state, applied.events, ctx.registry)];
  return { state: queueFront(applied.state, [...followUps, ...rewritten.after]), events: applied.events };
}

// Cards that just left an equip zone: each one's onUnequip runs for its former
// wearer, after the moves' own after-triggers (Silver Lion's parting heal). A
// trigger can't do this: once the card has left, its triggers aren't gathered.
function unequipFollowUps(before: GameState, after: GameState, events: GameEvent[], registry: ContentRegistry): QueueItem[] {
  const followUps: QueueItem[] = [];
  for (const event of events as EngineEvent[]) {
    if (event.kind !== 'CardMovedEvent') continue;
    const from = before.zones.find((z) => z.id === event.fromZoneId);
    if (from?.kind !== 'equip' || !from.ownerSeatId) continue;
    const card = after.zones.flatMap((z) => z.cards).find((c) => c.instanceId === event.cardInstanceId);
    const definition = card && registry.cards.get(card.definitionId);
    if (definition?.onUnequip) {
      followUps.push(...(definition.onUnequip(after, { seatId: from.ownerSeatId, cardInstanceId: event.cardInstanceId }) as QueueItem[]));
    }
  }
  return followUps;
}

interface UseOptions {
  targets: Target[];
  // The window this use answers; absent for a play.
  respondTo?: PendingResponse;
  // Counted toward per-turn limits (turn.cardPlays): a proactive play.
  counted: boolean;
  // Played by an ability, outside the Play Phase's limits.
  free?: boolean;
}

// What an answer to `pending` answered, for the log.
function inResponseToOf(pending: PendingResponse): NonNullable<CardPlayedEvent['inResponseTo']> {
  const reason = pending.reason;
  if (reason?.kind === 'wuxie') {
    return {
      seatId: reason.toolUserSeatId,
      ...(reason.tool.physical[0] ? { cardInstanceId: reason.tool.physical[0].instanceId } : {}),
      ...(reason.target.kind === 'seat' ? { targetSeatId: reason.target.seatId } : {}),
    };
  }
  if (reason?.kind === 'counter-wuxie') return { seatId: reason.wuxieSeatId, counters: true };
  if (reason?.kind === 'card-effect') {
    return { seatId: reason.userSeatId, ...(reason.card.physical[0] ? { cardInstanceId: reason.card.physical[0].instanceId } : {}) };
  }
  const answered = pending.context.effect.kind === 'DamageEffect' ? pending.context.effect.damage : null;
  return {
    ...(answered?.source?.kind === 'seat' ? { seatId: answered.source.seatId } : {}),
    ...(answered?.cause?.cardInstanceId ? { cardInstanceId: answered.cause.cardInstanceId } : {}),
    ...(reason?.kind === 'dying' ? { dyingSeatId: reason.seatId } : {}),
  };
}

// One card used, as itself or as what a conversion made it: logs the
// CardPlayedEvent, then queues the physical cards' trip to the discard pile,
// the event's after-triggers, the card's own effects and, for an answer, what
// the window says answering leads to. The caller has checked legality.
function useCard(state: GameState, seatId: string, used: UsedCard, options: UseOptions, ctx: EngineContext): ResolveResult {
  const definition = lookupCard(ctx.registry, used.as);
  const pending = options.respondTo;
  const event: CardPlayedEvent = {
    kind: 'CardPlayedEvent',
    seatId,
    card: used,
    targets: options.targets,
    ...(pending ? { inResponseTo: inResponseToOf(pending) } : {}),
  };
  const afterLog = logged(pending ? { ...state, pendingResponse: null } : state, [event]);
  const cardInstanceId = used.physical[0]?.instanceId ?? '';
  const effects = definition.play(
    afterLog,
    {
      seatId,
      cardInstanceId,
      card: used,
      targets: options.targets,
      ...(pending ? { respondingTo: pending.id } : {}),
      ...(options.free ? { free: true } : {}),
    },
    ctx.registry
  ) as Effect[];
  // Counted when played, for per-turn limits, whatever happens next.
  const plays = afterLog.turn.cardPlays ?? {};
  const counted: GameState = options.counted
    ? { ...afterLog, turn: { ...afterLog.turn, cardPlays: { ...plays, [used.as]: (plays[used.as] ?? 0) + 1 } } }
    : afterLog;
  // Every card the turn owner uses, answers included (Self-Restraint).
  const ownerUses = counted.turn.ownerUses ?? {};
  const tallied: GameState =
    seatId === counted.turn.ownerSeatId ? { ...counted, turn: { ...counted.turn, ownerUses: { ...ownerUses, [used.as]: (ownerUses[used.as] ?? 0) + 1 } } } : counted;
  // A used card leaves the hand at once, so it can't be reused mid-resolution.
  // Equipment and delayed Tools played as themselves are placed by their own play().
  // Equipment and delayed Tools played (not answered) place their own card,
  // a converted delayed Tool included (it lies there as what it was used as).
  const placesItself = !pending && (definition.category === 'equipment' || !!definition.delayed);
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const leaveHand: Effect[] = placesItself
    ? []
    : used.physical.map((c) => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: discardPileId }));
  // The opening card's say in what the answer leads to (e.g. a Duel turning back).
  const fromSource = pending?.sourceCard
    ? ((lookupCard(ctx.registry, pending.sourceCard.definitionId).onResponse?.(afterLog, { pending, seatId, cardInstanceId, card: used }, ctx.registry) ?? []) as Effect[])
    : [];
  const followUps = afterTriggerFollowUps(tallied, [event], ctx);
  return {
    state: queueFront(tallied, [...leaveHand, ...followUps, ...effects, ...(pending?.onAnswer ?? []), ...fromSource]),
    events: [event],
  };
}

// What a selection's picks lead to (its continuation).
function continueSelection(state: GameState, selection: PendingSelection, ids: string[], ctx: EngineContext): ResolveResult {
  const then = selection.then;
  switch (then.kind) {
    case 'discard': {
      const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
      const moves: Effect[] = ids.map((id) => ({ kind: 'MoveCardEffect', cardInstanceId: id, toZoneId: discardPileId }));
      return { state: queueFront(state, [...moves, ...(then.then ?? [])]), events: [] };
    }
    case 'card-step':
      return { state: queueFront(state, [{ ...then.step, data: { ...then.step.data, picked: ids } }]), events: [] };
    case 'give': {
      // Who gets the picked cards: one choice, each option a seat.
      const choice: PendingChoice = {
        id: `give-${selection.id}`,
        seatId: selection.seatId,
        reason: selection.reason,
        verb: 'give',
        options: then.toSeatIds.map((seatId) => {
          const seat = state.seats.find((s) => s.id === seatId);
          if (!seat) throw new Error(`Unknown seat: ${seatId}`);
          const moves: Effect[] = ids.map((id) => ({ kind: 'MoveCardEffect', cardInstanceId: id, toZoneId: seat.hand.zoneId }));
          const tally: Effect[] = then.tally ? [{ kind: 'IncrementEffect', scope: 'turn', key: then.tally, by: ids.length }] : [];
          return { id: seatId, shows: { kind: 'seat' as const, seatId }, effects: [...moves, ...tally, ...(then.then ?? [])] };
        }),
      };
      return { state: queueFront(state, [{ kind: 'OpenChoiceEffect', choice }]), events: [] };
    }
    case 'skill-step': {
      const window = then.suspendWindow ? state.pendingResponse : null;
      const step = { ...then.step, data: { ...then.step.data, picked: ids, ...(window ? { window } : {}) } };
      return { state: queueFront(window ? { ...state, pendingResponse: null } : state, [step]), events: [] };
    }
    case 'replace-judgment':
      return {
        state: queueFront(state, [{ kind: 'ReplaceJudgmentEffect', judgment: then.judgment, withCardInstanceId: ids[0], owner: then.owner, abilityId: then.abilityId, ...(then.oldTo ? { oldTo: then.oldTo } : {}) }]),
        events: [],
      };
    case 'use-card': {
      const cards = ids.map((id) => {
        const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === id);
        if (!card) throw new Error(`Card ${id} is in no zone`);
        return card;
      });
      const used = then.as ? usedCardFrom(cards, then.as, then.via) : usedCardOf(cards[0]);
      const respondTo = then.respondTo ? state.pendingResponse : null;
      if (then.respondTo && respondTo?.id !== then.respondTo) throw new Error(`Window ${then.respondTo} is no longer open`);
      return useCard(
        state,
        selection.seatId,
        used,
        { targets: then.targets, ...(respondTo ? { respondTo } : {}), counted: then.counted, ...(then.free ? { free: true } : {}) },
        ctx
      );
    }
  }
}

// Validates an action and queues what it leads to. Nothing here resolves an
// effect directly: the caller drains the queue.
function resolveAction(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  if (state.pendingSelection && action.kind !== 'SelectAction' && action.kind !== 'CancelSelectionAction') {
    throw new Error(`Action ${action.kind} is not legal while a selection is pending`);
  }
  if (state.pendingArrangement && action.kind !== 'ArrangeCardsAction') {
    throw new Error(`Action ${action.kind} is not legal while an arrangement is pending`);
  }
  if (state.pendingChoice && action.kind !== 'ChooseOptionAction') {
    throw new Error(`Action ${action.kind} is not legal while a choice is pending`);
  }
  const windowKind = action.kind === 'UseConversionAction' ? 'RespondAction' : action.kind;
  if (state.pendingResponse && !state.pendingSelection && !state.pendingResponse.allowedActionKinds.includes(windowKind)) {
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
      return useCard(state, action.seatId, usedCardOf(cardInHand), { targets: action.targets, counted: true }, ctx);
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
      return useCard(state, action.seatId, usedCardOf(cardInHand), { targets: [], respondTo: pending, counted: false }, ctx);
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
      if (discardOwed(state, action.seatId) === 0) {
        throw new Error(`Seat ${action.seatId} is within its hand limit and has nothing to discard`);
      }
      const handZone = state.zones.find((z) => z.id === seat.hand.zoneId);
      if (!handZone?.cards.some((c) => c.instanceId === action.cardInstanceId)) {
        throw new Error(`Seat ${action.seatId} does not hold card ${action.cardInstanceId}`);
      }
      const discardPile = requireZoneOfKind(state.zones, 'discardPile');
      const left = state.turn.discardsLeft;
      const owing: GameState = left === undefined ? state : { ...state, turn: { ...state.turn, discardsLeft: Math.max(0, left - 1) } };
      return { state: queueFront(owing, [{ kind: 'MoveCardEffect', cardInstanceId: action.cardInstanceId, toZoneId: discardPile.id }]), events: [] };
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

    case 'SelectAction': {
      const error = validateSelection(state, action);
      if (error) throw new Error(error);
      const selection = state.pendingSelection!;
      const { pendingSelection: _done, ...cleared } = state;
      // Logged for the history; nothing reacts to it.
      const event: SelectionMadeEvent = { kind: 'SelectionMadeEvent', seatId: action.seatId, reason: selection.reason, of: selection.of, ids: action.ids };
      let current = logged(cleared, [event]);
      const events: GameEvent[] = [event];
      // What confirming does at once (a reveal, a use counted), before the continuation.
      for (const effect of selection.onSelect ?? []) {
        const step = resolveEffect(current, effect, ctx);
        current = step.state;
        events.push(...step.events);
        // A window the selection answers is already open; anything else is new.
        const opened = !!current.pendingChoice || !!current.pendingSelection || !!current.pendingArrangement || current.pendingResponse !== cleared.pendingResponse;
        if (opened) throw new Error(`An onSelect effect of ${selection.id} opened a decision (${effect.kind})`);
      }
      const continued = continueSelection(current, selection, action.ids, ctx);
      return { state: continued.state, events: [...events, ...continued.events] };
    }

    case 'UseConversionAction': {
      const offered = conversionActions(state, action.seatId, ctx.registry).some(
        (a) =>
          a.via.conversionId === action.via.conversionId &&
          sameAbilityOwner(a.via.owner, action.via.owner) &&
          a.pendingResponseId === action.pendingResponseId &&
          JSON.stringify(a.targets) === JSON.stringify(action.targets)
      );
      if (!offered) throw new Error(`Seat ${action.seatId} can’t use that conversion now`);
      const owned = conversionsOf(state, action.seatId, ctx.registry).find(
        (o) => o.conversion.id === action.via.conversionId && sameAbilityOwner(o.owner, action.via.owner)
      )!;
      const selection: PendingSelection = {
        id: `convert-${owned.conversion.id}-${action.seatId}-${state.log.length}`,
        seatId: action.seatId,
        reason: { kind: 'ability', owner: owned.owner, abilityId: owned.abilityId },
        of: 'cards',
        // A play may only use cards whose leaving keeps its targets legal.
        eligibleIds: (action.pendingResponseId ? conversionCards(state, action.seatId, owned.conversion, ctx.registry) : playConversionCards(state, action.seatId, owned.conversion, action.targets, ctx.registry)).map((c) => c.instanceId),
        min: owned.conversion.cards,
        max: owned.conversion.cards,
        then: {
          kind: 'use-card',
          as: owned.conversion.as,
          via: { owner: owned.owner, abilityId: owned.abilityId, conversionId: owned.conversion.id },
          targets: action.targets,
          ...(action.pendingResponseId ? { respondTo: action.pendingResponseId } : {}),
          counted: !action.pendingResponseId,
        },
        // Cancel: back where the seat was (its Play Phase, or the open window).
        onCancel: [],
      };
      // A deferred conversion: the owning skill's step decides what the card does.
      if (owned.conversion.deferred) {
        if (owned.owner.kind !== 'general') throw new Error(`Only a General's skill may defer a conversion (${owned.conversion.id})`);
        const step = {
          kind: 'SkillStepEffect' as const,
          owner: owned.owner,
          step: 'deferred',
          data: { as: owned.conversion.as, conversionId: owned.conversion.id, targets: action.targets },
        };
        selection.then = { kind: 'skill-step', step, ...(action.pendingResponseId ? { suspendWindow: true as const } : {}) };
      }
      // A hidden General's conversion reveals it once the cards are confirmed.
      const reveal: Effect[] =
        owned.needsReveal && owned.owner.kind === 'general'
          ? [{ kind: 'RevealGeneralEffect', seatId: action.seatId, slot: owned.owner.slot, forAbilityId: owned.abilityId }]
          : [];
      return { state: { ...state, pendingSelection: reveal.length ? { ...selection, onSelect: reveal } : selection }, events: [] };
    }

    case 'ArrangeCardsAction': {
      const error = validateArrangement(state, action);
      if (error) throw new Error(error);
      const arrangement = state.pendingArrangement!;
      const { pendingArrangement: _done, ...cleared } = state;
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const inPile = (id: string) => {
        const found = drawPile.cards.find((c) => c.instanceId === id);
        if (!found) throw new Error(`Card ${id} is no longer in the draw pile`);
        return found;
      };
      const rest = drawPile.cards.filter((c) => !arrangement.cardInstanceIds.includes(c.instanceId));
      const zones = state.zones.map((z) => (z.id === drawPile.id ? { ...z, cards: [...action.top.map(inPile), ...rest, ...action.bottom.map(inPile)] } : z));
      const event: ArrangementMadeEvent = { kind: 'ArrangementMadeEvent', seatId: action.seatId, reason: arrangement.reason, top: action.top.length, bottom: action.bottom.length };
      return logWithTriggers({ ...cleared, zones }, [event], ctx);
    }

    case 'UseSkillAction': {
      const offered = activeSkillActions(state, action.seatId, ctx.registry).some((a) => sameAbilityOwner(a.owner, action.owner));
      if (!offered || action.owner.kind !== 'general') throw new Error(`Seat ${action.seatId} can’t use that skill now`);
      const owner = action.owner;
      const { skill, needsReveal } = skillsInPlay(state, action.seatId, ctx.registry).find((s) => sameAbilityOwner(s.owner, owner))!;
      // The use itself: reveal a hidden General, count it, log it.
      const spend: Effect[] = [
        ...(needsReveal ? [{ kind: 'RevealGeneralEffect' as const, seatId: action.seatId, slot: owner.slot, forAbilityId: owner.skillId }] : []),
        { kind: 'IncrementEffect', scope: 'turn', key: abilityUseKey(owner), by: 1 },
        { kind: 'AbilityUsedEffect', owner, abilityId: owner.skillId, outcome: 'used' },
      ];
      const [first, ...rest] = skill.active!.start(state, { seatId: action.seatId, owner }, ctx.registry) as Effect[];
      // A cancellable first selection: the use happens only once its picks are confirmed.
      if (first?.kind === 'OpenSelectionEffect' && first.selection.onCancel) {
        // Anything queued behind it would run even after a Cancel: what follows
        // the picks belongs in the selection's continuation.
        if (rest.length > 0) throw new Error(`A cancellable first selection must be the only effect of ${owner.skillId}'s start`);
        const selection = { ...first.selection, onSelect: [...spend, ...(first.selection.onSelect ?? [])] };
        return { state: queueFront(state, [{ ...first, selection }, ...rest]), events: [] };
      }
      return { state: queueFront(state, [...spend, ...(first ? [first] : []), ...rest]), events: [] };
    }

    case 'CancelSelectionAction': {
      const selection = state.pendingSelection;
      if (!selection || selection.id !== action.selectionId) throw new Error(`No matching pending selection: ${action.selectionId}`);
      if (action.seatId !== selection.seatId) throw new Error(`Seat ${action.seatId} is not the selector for ${selection.id}`);
      if (!selection.onCancel) throw new Error(`Selection ${selection.id} can’t be cancelled`);
      const { pendingSelection: _done, ...cleared } = state;
      return { state: queueFront(cleared, selection.onCancel), events: [] };
    }

    default:
      throw new Error(`Action kind not yet handled by resolve(): ${(action as Action).kind}`);
  }
}
