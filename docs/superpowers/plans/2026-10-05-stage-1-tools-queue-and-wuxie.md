# Tools Stage 1: Resolution Queue, Wuxie Checks and the First Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Replace the engine's recursive effect resolution with a resumable resolution queue.
- Give every Tool the common lifecycle: a Wuxie check per target, then the Tool's rule.
- Make Draw Two, Barbarians, Hail of Arrows and Peach Garden playable.
- Move Duel onto the same lifecycle.

**Architecture:**
- **The queue.** `GameState.resolutionQueue` holds the effects and actions still to resolve, as plain data. `resolve` drains it front first, and stops when a response window is open or the queue is empty.
  - After-trigger follow-ups go to the **front**.
  - A played card leaves the hand right after its `CardPlayedEvent`, before its effects.
- **The Tool lifecycle.** It is four generic engine effects: `ToolOnTargetEffect`, `WuxieCheckEffect`, `ToolRuleEffect` and `SkipNextEffect`.
  - Each effect carries a `UsedCard`.
  - The counter card ids (`['wuxie']`) come from content, so the engine still names no card.
  - Tools declare `onTarget`.
- **Around the engine:** content adds the four Tools; bots learn Wuxie and the new Tools; the sim checks the queue; the app explains the new windows.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app task only).

**Spec:**
- `docs/superpowers/specs/2026-10-05-tools-design.md`: "Common to every Tool", "Stage 1", "Engine design → The resolution queue / The Tool lifecycle / Response windows", Bots, UI, Testing.
- `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`: the Tools amendment, which says the lifecycle carries `UsedCard` from stage 1.

## Global Constraints

- **The engine names no card or skill.** Content supplies card ids to the engine as data (`counterCardIds`), as it already does with `rescueCardIds` (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** `resolutionQueue` holds only `Effect | Action` objects, which means no functions.
- **`resolutionQueue` is optional** on `GameState`. Absent means empty, and the engine leaves it absent when empty, so every existing fixture and `toEqual` stays valid.
- **Step budget:** `MAX_RESOLUTION_STEPS = 10_000` queue items per `resolve` call. Exceeding it throws an error that names the item being resolved. This replaces `MAX_TRIGGER_DEPTH`.
- **Wuxie check order:**
  - The Tool's check asks the living seats in seat order **starting with the Tool's user**.
  - A counter-check starts with the seat **after** the one that played the Wuxie, and skips that seat.
  - Only seats holding a counter card at that moment are asked.
- **Peach Garden** targets only the seats below max HP when it is played, starting with the user. Seats at full HP get no Wuxie check.
- **UI text** follows CLAUDE.md's UI text style. Card and seat names keep their capitals, and lines that read as sentences use sentence case.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **A seat eliminated partway through Barbarians or Hail of Arrows.** A later `ToolOnTargetEffect` for that seat must do nothing: no window, no damage. The rest of the table goes on. (Test in Task 2.)
- **The game ending mid-Tool.** One kingdom wins while Barbarians still has targets queued. The result stands, the queue is dropped, and no further damage is dealt. (Test in Task 1.)
- **The Tool's user holding Wuxie for their own Tool.** They are asked first. Passing must go on to the next holder, never loop back to the user. (Test in Task 2.)
- **A JSON round trip of a game paused mid-Barbarians,** with a Wuxie window open. It must resume to exactly the same state as the original. (Test in Task 3.)
- **Duel cancelled by a seat other than its target.** Any holder may cancel now. The Duel's damage never happens, and no Duel window opens. (Test in Task 3.)

---

## File Structure

**Engine (`projects/engine/src/lib/`)**
- Create: `pipeline/queue.ts`. Queue helpers `queueFront` and `withQueue`, plus the `QueueItem` type re-export.
- Create: `pipeline/queue.spec.ts`. Queue behaviour tests.
- Rewrite: `pipeline/resolve.ts`. The queue-draining pipeline.
- Create: `pipeline/toolLifecycle.ts`. Applies the four lifecycle effects. It needs the registry, so it lives beside `resolve.ts`, not in `applyEffect`.
- Create: `pipeline/toolLifecycle.spec.ts`
- Create: `rules/seatOrder.ts`. `livingSeatOrderFrom`.
- Create: `domain/usedCard.ts`. `usedCardOf`.
- Modify:
  - `domain/types.ts`: `UsedCard`, `WuxieSubject`, the `DecisionReason` kinds, `resolutionQueue`.
  - `pipeline/effects.ts`: four effect kinds.
  - `pipeline/events.ts`: `inResponseTo.targetSeatId` and `counters`.
  - `registry/types.ts`: `onTarget` and `ToolTargetContext`.
  - `public-api.ts`.
- Modify: `pipeline/resolve.spec.ts`. The depth-limit tests become step-budget tests.

**Content (`projects/content/src/lib/`)**
- Create: `shared/tools.ts`. `COUNTER_CARD_IDS` and `toolOnTargets`.
- Create:
  - `cards/draw-two.ts`
  - `cards/mass-attack.ts`, with Barbarians and Hail of Arrows
  - `cards/peach-garden.ts`
- Modify:
  - `cards/duel.ts`, onto the lifecycle;
  - `registry.ts`, which registers the four Tools;
  - `cards/tools.spec.ts`, with new and updated tests;
  - `wiki.spec.ts`, for which cards are in the game;
  - `modes/guozhan.spec.ts`, where the deck count goes from 61 to 70.

**Bots:** modify `projects/bots/src/lib/rule-based.ts` and `rule-based.spec.ts`.

**Sim:** modify `projects/sim/src/invariants.ts` and `invariants.spec.ts`.

**App (`projects/app/src/app/game-board/`):**
- Modify `response-description.ts` and its spec.
- Modify `action-history.ts` and its spec.
- Modify `round-table.ts` and its spec.

**Docs:** modify `docs/architecture/event-chain.md`.

---

### Task 1: The resolution queue

**Files:**
- Create: `projects/engine/src/lib/pipeline/queue.ts`, `projects/engine/src/lib/pipeline/queue.spec.ts`
- Rewrite: `projects/engine/src/lib/pipeline/resolve.ts`
- Modify: `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/pipeline/resolve.spec.ts`, `projects/engine/src/public-api.ts`

**Interfaces:**
- Produces:
  - `type QueueItem = Effect | Action` (in `domain/types.ts`) and `GameState.resolutionQueue?: QueueItem[]`.
  - `queueFront(state: GameState, items: QueueItem[]): GameState`: puts `items` before the existing queue, in order.
  - `withQueue(state: GameState, queue: QueueItem[]): GameState`: sets the queue, and omits the field when it's empty.
  - `MAX_RESOLUTION_STEPS = 10_000`, exported from `resolve.ts`.
  - `advanceToDecision(state, ctx, budget?: { used: number })`. The new optional third argument is for callers inside `resolve` only.
  - `MAX_TRIGGER_DEPTH` is **removed**.

- [ ] **Step 1: Write the failing queue tests**

Create `projects/engine/src/lib/pipeline/queue.spec.ts`:

```ts
import { resolve, MAX_RESOLUTION_STEPS } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { Effect } from './effects';

function mode(overrides: Partial<GameModeDefinition> = {}): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition: () => null,
    triggers: [],
    ...overrides,
  };
}

function state(handCardId: string): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: (index === 0 ? 'Wei' : 'Shu') as 'Wei' | 'Shu',
    generals: { main: { generalDefinitionId: `${id}-m`, revealed: true }, deputy: { generalDefinitionId: `${id}-d`, revealed: true } },
    combinedHp: 4, maxCombinedHp: 6, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
  });
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [1, 2, 3].map((n) => ({ instanceId: `d${n}`, definitionId: 'filler', suit: 'club' as const, rank: n })) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'played', definitionId: handCardId, suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const damageB: Effect = { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal' } };
const healA: Effect = { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 };

function cardThat(id: string, effects: Effect[]): CardDefinition {
  return { id, name: id, category: 'basic', play: () => effects };
}

function registry(...cards: CardDefinition[]): ContentRegistry {
  return { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
}

const play = (s: GameState, ctx: { registry: ContentRegistry; mode: GameModeDefinition }) =>
  resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'played', targets: [] }, ctx).state;
const hp = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!.combinedHp;

describe('resolution queue', () => {
  const window: Effect = {
    kind: 'OpenResponseEffect',
    pendingResponse: { id: 'w1', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], context: { effect: damageB } },
  };

  it('pauses at a response window: effects queued after it wait for the answer', () => {
    const ctx = { registry: registry(cardThat('asker', [window, healA])), mode: mode() };
    const paused = play(state('asker'), ctx);
    expect(paused.pendingResponse?.id).toBe('w1');
    expect(hp(paused, 'seat-a')).toBe(4); // the heal has not happened yet
    expect(paused.resolutionQueue).toEqual([healA]);

    const resumed = resolve(paused, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'w1' }, ctx).state;
    expect(hp(resumed, 'seat-b')).toBe(3);
    expect(hp(resumed, 'seat-a')).toBe(5);
    expect(resumed.resolutionQueue).toBeUndefined();
    expect(resumed.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'DamageDealtEvent', 'HealEvent']);
  });

  it('moves the used card to the discard pile right after it is played, before its effects', () => {
    const ctx = { registry: registry(cardThat('drawer', [{ kind: 'DrawCardsEffect', seatId: 'seat-a', count: 1 }])), mode: mode() };
    const next = play(state('drawer'), ctx);
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
  });

  it('keeps trigger follow-ups ahead of the next sibling effect (pin)', () => {
    const drawThenDamage = cardThat('combo', [{ kind: 'DrawCardsEffect', seatId: 'seat-a', count: 1 }, damageB]);
    const healOnDraw = mode({
      triggers: [{ point: 'after:CardsDrawnEvent', condition: () => true, effect: () => [healA] }],
    });
    const next = play(state('combo'), { registry: registry(drawThenDamage), mode: healOnDraw });
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'CardsDrawnEvent', 'HealEvent', 'DamageDealtEvent']);
  });

  it('stops and drops the rest of the queue once the game has a result', () => {
    const eliminateThenDraw = cardThat('finisher', [
      { kind: 'EliminateSeatEffect', seatId: 'seat-b' },
      { kind: 'DrawCardsEffect', seatId: 'seat-a', count: 1 },
    ]);
    const endsOnElimination = mode({
      checkWinCondition: (s) => (s.seats.some((x) => x.eliminated) ? { endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] } : null),
    });
    const next = play(state('finisher'), { registry: registry(eliminateThenDraw), mode: endsOnElimination });
    expect(next.result).not.toBeNull();
    expect(next.log.some((e) => e.kind === 'CardsDrawnEvent')).toBe(false);
    expect(next.resolutionQueue).toBeUndefined();
  });

  it('survives a JSON round trip while paused, and resumes identically', () => {
    const ctx = { registry: registry(cardThat('asker', [window, healA])), mode: mode() };
    const paused = play(state('asker'), ctx);
    const copy = JSON.parse(JSON.stringify(paused)) as GameState;
    const pass = { kind: 'PassAction' as const, seatId: 'seat-b', pendingResponseId: 'w1' };
    expect(resolve(copy, pass, ctx).state).toEqual(resolve(paused, pass, ctx).state);
  });

  it('throws, naming the item, when one call resolves more than the step budget', () => {
    const forever = mode({
      triggers: [
        { point: 'after:HealEvent', condition: () => true, effect: () => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 0 }] },
      ],
    });
    expect(() => play(state('healer'), { registry: registry(cardThat('healer', [healA])), mode: forever })).toThrow(
      new RegExp(`Resolution step budget exceeded \\(${MAX_RESOLUTION_STEPS} steps\\) while resolving HealEffect`)
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/queue.spec.ts`
Expected: FAIL. `MAX_RESOLUTION_STEPS` is not exported, so the suite fails to compile.

- [ ] **Step 3: Add the queue type to the domain**

In `projects/engine/src/lib/domain/types.ts`, next to the existing type-only imports, add:

```ts
import type { Action } from '../pipeline/actions';
```

Then add the following after the `GameEvent` interface:

```ts
// One step still to resolve: an effect, or an action a trigger asked for.
export type QueueItem = Effect | Action;
```

In `GameState`, after `pendingResponse`, add:

```ts
  // What is left to resolve, front first. Absent (never []) when nothing is
  // left: the engine only rests with items here while a decision is pending.
  resolutionQueue?: QueueItem[];
```

- [ ] **Step 4: Create the queue helpers**

Create `projects/engine/src/lib/pipeline/queue.ts`:

```ts
import { GameState, QueueItem } from '../domain/types';

// Sets the queue; an empty queue is stored as no queue at all.
export function withQueue(state: GameState, queue: QueueItem[]): GameState {
  if (queue.length > 0) return { ...state, resolutionQueue: queue };
  if (state.resolutionQueue === undefined) return state;
  const { resolutionQueue: _dropped, ...rest } = state;
  return rest;
}

// Puts `items`, in order, ahead of everything already queued.
export function queueFront(state: GameState, items: QueueItem[]): GameState {
  if (items.length === 0) return state;
  return withQueue(state, [...items, ...(state.resolutionQueue ?? [])]);
}
```

- [ ] **Step 5: Rewrite the pipeline around the queue**

Replace the whole of `projects/engine/src/lib/pipeline/resolve.ts` with:

```ts
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
import { CardPlayedEvent, PhaseChangedEvent, TurnAdvancedEvent } from './events';
import { queueFront, withQueue } from './queue';

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
    if (current.result || current.phase === 'GeneralSelection' || current.pendingResponse) break;
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
  while (!current.result && !current.pendingResponse && (current.resolutionQueue?.length ?? 0) > 0) {
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

// Moves to the next phase (or the next turn's Start) and enters it.
function enterNextPhase(state: GameState, ctx: EngineContext): ResolveResult {
  const { phase, turn } = advancePhaseOrTurn(state);
  const events: GameEvent[] = [];
  if (turn.turnNumber !== state.turn.turnNumber) {
    const turnEvent: TurnAdvancedEvent = { kind: 'TurnAdvancedEvent', seatId: turn.ownerSeatId, turnNumber: turn.turnNumber };
    events.push(turnEvent);
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

  const applied = applyEffect(state, current);
  return { state: queueFront(applied.state, afterTriggerFollowUps(applied.state, applied.events, ctx)), events: applied.events };
}

// Validates an action and queues what it leads to. Nothing here resolves an
// effect directly: the caller drains the queue.
function resolveAction(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
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
      const inResponseTo = {
        ...(answered?.source?.kind === 'seat' ? { seatId: answered.source.seatId } : {}),
        ...(answered?.cause?.cardInstanceId ? { cardInstanceId: answered.cause.cardInstanceId } : {}),
        ...(pending.reason?.kind === 'dying' ? { dyingSeatId: pending.reason.seatId } : {}),
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

    default:
      throw new Error(`Action kind not yet handled by resolve(): ${(action as Action).kind}`);
  }
}
```

- [ ] **Step 6: Export the queue helpers**

In `projects/engine/src/public-api.ts`, add after the `effects` export line:

```ts
export * from './lib/pipeline/queue';
```

- [ ] **Step 7: Replace the depth-limit tests with step-budget tests**

In `projects/engine/src/lib/pipeline/resolve.spec.ts`:
- Line 1 becomes `import { resolve, MAX_RESOLUTION_STEPS } from './resolve';`.
- Rename `describe('resolve: trigger recursion depth guard'` to `describe('resolve: step budget'`.
- In `'throws a descriptive error instead of exhausting the call stack on a trigger cycle'`, replace the four `expect(message)...` lines with:

```ts
    expect(message).toMatch(/Resolution step budget exceeded/);
    expect(message).toMatch(new RegExp(String(MAX_RESOLUTION_STEPS)));
    expect(message).toMatch(/DamageEffect|HealEffect/);
    expect(message).toMatch(/trigger cycle/);
```

- [ ] **Step 8: Run the engine tests**

Run: `npx jest projects/engine`
Expected: PASS, including all 6 new queue tests. If a `resolve.spec.ts` or `autoAdvance.spec.ts` test now fails on **event order** alone (a `CardMovedEvent` coming earlier), update its expected order. Note each such change as a ruling. If a test fails on **state**, debug it; don't edit the test.

- [ ] **Step 9: Run the whole suite**

Run: `npx jest`
Expected: PASS. Content and app tests that read event order may need the same order-only updates. For example, `discardIds` sorting is unaffected, but `log.map(kind)` assertions are. Treat them as in Step 8.

- [ ] **Step 10: Commit**

```bash
git add projects/engine projects/content projects/app projects/sim projects/bots
git commit -m "feat(engine): a resumable resolution queue; used cards leave the hand before their effects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The Tool lifecycle and Wuxie checks

**Files:**
- Create:
  - `projects/engine/src/lib/domain/usedCard.ts`
  - `projects/engine/src/lib/rules/seatOrder.ts`
  - `projects/engine/src/lib/pipeline/toolLifecycle.ts`
  - `projects/engine/src/lib/pipeline/toolLifecycle.spec.ts`
- Modify:
  - `projects/engine/src/lib/domain/types.ts`
  - `projects/engine/src/lib/pipeline/effects.ts`
  - `projects/engine/src/lib/pipeline/events.ts`
  - `projects/engine/src/lib/registry/types.ts`
  - `projects/engine/src/lib/pipeline/resolve.ts`
  - `projects/engine/src/public-api.ts`

**Interfaces:**
- Consumes: `queueFront` and `withQueue` (Task 1). `resolveEffect` in `resolve.ts` (Task 1).
- Produces:
  - **Types:** `UsedCard { as; colour; suit?; rank?; physical: CardInstance[] }` and `WuxieSubject`, both in `domain/types.ts`.
  - **Helpers:**
    - `usedCardOf(card: CardInstance): UsedCard`;
    - `livingSeatOrderFrom(state, firstSeatId): string[]`, the living seat ids in turn order from `firstSeatId`, inclusive.
  - **Effects:**
    - `{ kind: 'ToolOnTargetEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[]; counterCardIds: string[] }`
    - `{ kind: 'ToolRuleEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[] }`
    - `{ kind: 'WuxieCheckEffect'; subject: WuxieSubject; order: string[]; counterCardIds: string[] }`
    - `{ kind: 'SkipNextEffect' }`
  - **`DecisionReason`:**
    - `| { kind: 'wuxie'; tool: UsedCard; toolUserSeatId: string; target: Target }`
    - `| { kind: 'counter-wuxie'; wuxieSeatId: string }`
    - `| { kind: 'card-effect'; card: UsedCard; userSeatId: string }`
  - **`CardDefinition.onTarget?(state, ctx: ToolTargetContext): unknown[]`**, with `ToolTargetContext { tool: UsedCard; userSeatId: string; target: Target; extra?: Target[] }`.
  - **`CardPlayedEvent.inResponseTo`** gains `targetSeatId?: string` and `counters?: boolean`.

- [ ] **Step 1: Write the failing lifecycle tests**

Create `projects/engine/src/lib/pipeline/toolLifecycle.spec.ts`:

```ts
import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { usedCardOf } from '../domain/usedCard';
import { livingSeatOrderFrom } from '../rules/seatOrder';

const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};

// A fixture Tool: targets every other living seat (seat order from the user)
// and, on each, heals it by 1. The counter card is 'counter'.
const blessing: CardDefinition = {
  id: 'blessing',
  name: 'Blessing',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) => {
    const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === ctx.cardInstanceId)!;
    return livingSeatOrderFrom(state, ctx.seatId).slice(1).map((seatId) => ({
      kind: 'ToolOnTargetEffect',
      tool: usedCardOf(card),
      userSeatId: ctx.seatId,
      target: { kind: 'seat', seatId },
      counterCardIds: ['counter'],
    }));
  },
  onTarget: (_state, ctx) => [{ kind: 'HealEffect', target: ctx.target, amount: 1 }],
};
const counter: CardDefinition = { id: 'counter', name: 'Counter', category: 'tool', legalPlayTargets: () => [], play: () => [] };
const ctx = { registry: { cards: new Map([[blessing.id, blessing], [counter.id, counter]]), generals: new Map() } as ContentRegistry, mode };

// Seats a (user, index 0), b, c, d — all at 2/4 HP. `counters` lists who holds a counter card.
function table(counters: string[] = [], eliminated: string[] = []): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: 'Wei' as const, combinedHp: 2, maxCombinedHp: 4, eliminated: eliminated.includes(id),
      generals: { main: { generalDefinitionId: `${id}1`, revealed: true }, deputy: { generalDefinitionId: `${id}2`, revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
    })),
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        {
          id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id,
          cards: [
            ...(id === 'a' ? [{ instanceId: 'bless', definitionId: 'blessing', suit: 'heart' as const, rank: 1 }] : []),
            ...(counters.includes(id) ? [{ instanceId: `${id}-counter`, definitionId: 'counter', suit: 'spade' as const, rank: 11 }] : []),
          ],
        },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const playBlessing = (s: GameState) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'bless', targets: [] }, ctx).state;
const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const counterWith = (s: GameState) => {
  const seatId = s.pendingResponse!.respondingSeatId;
  return resolve(s, { kind: 'RespondAction', seatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId: `${seatId}-counter` }, ctx).state;
};
const hp = (s: GameState) => Object.fromEntries(s.seats.map((x) => [x.id, x.combinedHp]));

describe('livingSeatOrderFrom', () => {
  it('lists living seats in turn order from the given seat, wrapping, skipping the eliminated', () => {
    expect(livingSeatOrderFrom(table([], ['c']), 'b')).toEqual(['b', 'd', 'a']);
  });
});

describe('usedCardOf', () => {
  it('wraps one physical card with its colour, suit and rank', () => {
    expect(usedCardOf({ instanceId: 'x', definitionId: 'sha', suit: 'diamond', rank: 9 })).toEqual({
      as: 'sha', colour: 'red', suit: 'diamond', rank: 9, physical: [{ instanceId: 'x', definitionId: 'sha', suit: 'diamond', rank: 9 }],
    });
    expect(usedCardOf({ instanceId: 'y', definitionId: 'sha', suit: 'club', rank: 2 }).colour).toBe('black');
  });
});

describe('the Tool lifecycle', () => {
  it('applies the Tool to each target in order when nobody holds a counter card', () => {
    const next = playBlessing(table());
    expect(next.pendingResponse).toBeNull();
    expect(hp(next)).toEqual({ a: 2, b: 3, c: 3, d: 3 });
    expect(next.resolutionQueue).toBeUndefined();
  });

  it('asks only counter holders, starting with the user, with a wuxie reason', () => {
    const asked = playBlessing(table(['a', 'c']));
    expect(asked.pendingResponse).toMatchObject({
      respondingSeatId: 'a',
      allowedCardIds: ['counter'],
      reason: { kind: 'wuxie', toolUserSeatId: 'a', target: { kind: 'seat', seatId: 'b' }, tool: { as: 'blessing' } },
    });
    const next = pass(asked); // a passes: c is asked about the same target
    expect(next.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'b' } } });
  });

  it('cancels the Tool for that target only', () => {
    let s = counterWith(playBlessing(table(['c']))); // c cancels the Blessing on b
    expect(hp(s).b).toBe(2);
    expect(s.pendingResponse).toBeNull(); // c has no counter left, so c and d are not asked
    expect(hp(s)).toEqual({ a: 2, b: 2, c: 3, d: 3 });
  });

  it('opens a counter-check from the seat after the counter’s player; a counter on a counter lets the Tool through', () => {
    let s = playBlessing(table(['b', 'd']));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b' }); // about the Blessing on b
    s = counterWith(s); // b cancels it
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd', reason: { kind: 'counter-wuxie', wuxieSeatId: 'b' } });
    s = counterWith(s); // d cancels b's counter: the Blessing on b goes ahead
    expect(hp(s).b).toBe(3);
    const played = s.log.filter((e) => e.kind === 'CardPlayedEvent');
    expect(played[1]).toMatchObject({ seatId: 'b', inResponseTo: { seatId: 'a', cardInstanceId: 'bless', targetSeatId: 'b' } });
    expect(played[2]).toMatchObject({ seatId: 'd', inResponseTo: { seatId: 'b', counters: true } });
  });

  it('never asks the counter’s own player in its counter-check, and passing walks on without looping', () => {
    let s = counterWith(playBlessing(table(['a', 'b']))); // a cancels its own Blessing on b
    // Counter-check order is b, c, d: b holds a counter, a (the counter's player) is never asked.
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'counter-wuxie', wuxieSeatId: 'a' } });
    s = pass(s); // nobody else holds one: a's counter stands
    expect(hp(s).b).toBe(2);
    // On to c: b is asked again (a has no counter left).
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'c' } } });
  });

  it('does nothing for a target eliminated before its turn comes (Review Focus 1)', () => {
    const s = table();
    const withCEliminatedLater = { ...s, seats: s.seats.map((x) => (x.id === 'c' ? { ...x, eliminated: true } : x)) };
    const next = resolve(
      {
        ...withCEliminatedLater,
        resolutionQueue: [
          { kind: 'ToolOnTargetEffect', tool: usedCardOf({ instanceId: 'bless', definitionId: 'blessing', suit: 'heart', rank: 1 }), userSeatId: 'a', target: { kind: 'seat', seatId: 'c' }, counterCardIds: ['counter'] },
        ],
        zones: s.zones.map((z) => (z.id === 'a:hand' ? { ...z, cards: [] } : z)),
      },
      { kind: 'EndPhaseAction', seatId: 'a' },
      ctx
    ).state;
    expect(next.seats.find((x) => x.id === 'c')!.combinedHp).toBe(2);
    expect(next.log.some((e) => e.kind === 'HealEvent')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/toolLifecycle.spec.ts`
Expected: FAIL. `../domain/usedCard` and `../rules/seatOrder` don't exist.

- [ ] **Step 3: Add the types**

In `projects/engine/src/lib/domain/types.ts`, add after `CardInstance`:

```ts
// A card as it is being used: what it counts as, its colour, and the physical
// cards behind it (one normally; none for a card a skill makes, two for a
// Serpent Spear Sha, from stage 5).
export interface UsedCard {
  as: string;
  colour: 'red' | 'black' | 'none';
  suit?: CardInstance['suit'];
  rank?: number;
  physical: CardInstance[];
}

// What a Wuxie check is about: a Tool on one target, or a counter card someone
// just played (so a counter can itself be countered).
export type WuxieSubject =
  | { kind: 'tool'; tool: UsedCard; userSeatId: string; target: Target }
  | { kind: 'counter'; seatId: string };
```

Replace the `DecisionReason` line with:

```ts
export type DecisionReason =
  | { kind: 'dying'; seatId: string }
  // May this seat cancel `tool` (used by toolUserSeatId) on `target`?
  | { kind: 'wuxie'; tool: UsedCard; toolUserSeatId: string; target: Target }
  // May this seat cancel the counter card wuxieSeatId just played?
  | { kind: 'counter-wuxie'; wuxieSeatId: string }
  // A card's own demand, e.g. Barbarians: play a Sha or take 1 damage.
  | { kind: 'card-effect'; card: UsedCard; userSeatId: string };
```

- [ ] **Step 4: Add the helpers**

Create `projects/engine/src/lib/domain/usedCard.ts`:

```ts
import { CardInstance, UsedCard } from './types';

// One physical card used as itself.
export function usedCardOf(card: CardInstance): UsedCard {
  return {
    as: card.definitionId,
    colour: card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black',
    suit: card.suit,
    rank: card.rank,
    physical: [card],
  };
}
```

Create `projects/engine/src/lib/rules/seatOrder.ts`:

```ts
import { GameState } from '../domain/types';

// Living seat ids in turn order, starting at `firstSeatId` (included when
// living) and wrapping round the table.
export function livingSeatOrderFrom(state: GameState, firstSeatId: string): string[] {
  const ordered = [...state.seats].sort((a, b) => a.index - b.index);
  const start = ordered.findIndex((s) => s.id === firstSeatId);
  if (start === -1) throw new Error(`Unknown seat: ${firstSeatId}`);
  return [...ordered.slice(start), ...ordered.slice(0, start)].filter((s) => !s.eliminated).map((s) => s.id);
}
```

- [ ] **Step 5: Add the effects, the event fields and the card hook**

In `projects/engine/src/lib/pipeline/effects.ts`:
- Change the first import to also import `Target`, `UsedCard` and `WuxieSubject` from `'../domain/types'`. `Target` is already imported.
- Add these members to the `Effect` union, after `DyingEffect`:

```ts
  // The Tool lifecycle (see the Tools spec). One per target: a Wuxie check,
  // then the Tool's own rule (CardDefinition.onTarget). Content supplies the
  // counter card ids, so the engine names no card.
  | { kind: 'ToolOnTargetEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[]; counterCardIds: string[] }
  | { kind: 'ToolRuleEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[] }
  // Asks, in `order`, the next living seat holding a counter card; none left = no cancel.
  | { kind: 'WuxieCheckEffect'; subject: WuxieSubject; order: string[]; counterCardIds: string[] }
  // Removes the next queued item: a counter card's way of cancelling what it guards.
  | { kind: 'SkipNextEffect' };
```

In `projects/engine/src/lib/pipeline/events.ts`, change `CardPlayedEvent.inResponseTo` to:

```ts
  // Set for a response: the seat and card whose effect it answered, when known;
  // the dying seat a Peach was played to save; for a cancel, the target the Tool
  // was cancelled on; `counters` when it cancelled another counter card.
  inResponseTo?: { seatId?: string; cardInstanceId?: string; dyingSeatId?: string; targetSeatId?: string; counters?: boolean };
```

In `projects/engine/src/lib/registry/types.ts`:
- Import `UsedCard` alongside the domain imports.
- Add to `CardDefinition`, after `onResponse`:

```ts
  // A Tool's rule on one target, once its Wuxie check has passed
  // (ToolRuleEffect). Its effects go to the front of the queue.
  onTarget?(state: GameState, ctx: ToolTargetContext): unknown[];
```

- Add after `ResponseContext`:

```ts
export interface ToolTargetContext {
  tool: UsedCard;
  userSeatId: string;
  target: Target;
  extra?: Target[];
}
```

- [ ] **Step 6: Implement the lifecycle**

Create `projects/engine/src/lib/pipeline/toolLifecycle.ts`:

```ts
import { DecisionReason, GameState, PendingResponse } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { livingSeatOrderFrom } from '../rules/seatOrder';
import { ApplyResult, Effect } from './effects';
import { queueFront, withQueue } from './queue';

type LifecycleEffect = Extract<Effect, { kind: 'ToolOnTargetEffect' | 'ToolRuleEffect' | 'WuxieCheckEffect' | 'SkipNextEffect' }>;

export function isLifecycleEffect(effect: Effect): effect is LifecycleEffect {
  return effect.kind === 'ToolOnTargetEffect' || effect.kind === 'ToolRuleEffect' || effect.kind === 'WuxieCheckEffect' || effect.kind === 'SkipNextEffect';
}

const isLiving = (state: GameState, seatId: string) => !!state.seats.find((s) => s.id === seatId && !s.eliminated);

// The Tool lifecycle's effects. They only reshape the queue or open a window,
// so they log no events.
export function applyLifecycleEffect(state: GameState, effect: LifecycleEffect, registry: ContentRegistry): ApplyResult {
  switch (effect.kind) {
    case 'ToolOnTargetEffect': {
      // A target gone before its turn comes is simply skipped.
      if (effect.target.kind === 'seat' && !isLiving(state, effect.target.seatId)) return { state, events: [] };
      const extra = effect.extra ? { extra: effect.extra } : {};
      return {
        state: queueFront(state, [
          {
            kind: 'WuxieCheckEffect',
            subject: { kind: 'tool', tool: effect.tool, userSeatId: effect.userSeatId, target: effect.target },
            order: livingSeatOrderFrom(state, effect.userSeatId),
            counterCardIds: effect.counterCardIds,
          },
          { kind: 'ToolRuleEffect', tool: effect.tool, userSeatId: effect.userSeatId, target: effect.target, ...extra },
        ]),
        events: [],
      };
    }
    case 'ToolRuleEffect': {
      const definition = lookupCard(registry, effect.tool.as);
      if (!definition.onTarget) throw new Error(`Tool ${effect.tool.as} has no onTarget rule`);
      const extra = effect.extra ? { extra: effect.extra } : {};
      const effects = definition.onTarget(state, { tool: effect.tool, userSeatId: effect.userSeatId, target: effect.target, ...extra }) as Effect[];
      return { state: queueFront(state, effects), events: [] };
    }
    case 'WuxieCheckEffect':
      return applyWuxieCheck(state, effect);
    case 'SkipNextEffect':
      return { state: withQueue(state, (state.resolutionQueue ?? []).slice(1)), events: [] };
  }
}

function applyWuxieCheck(state: GameState, effect: Extract<Effect, { kind: 'WuxieCheckEffect' }>): ApplyResult {
  const holdsCounter = (seatId: string) => {
    const seat = state.seats.find((s) => s.id === seatId);
    const hand = seat && state.zones.find((z) => z.id === seat.hand.zoneId);
    return !!hand?.cards.some((c) => effect.counterCardIds.includes(c.definitionId));
  };
  const index = effect.order.findIndex((seatId) => isLiving(state, seatId) && holdsCounter(seatId));
  if (index === -1) return { state, events: [] };

  const askerId = effect.order[index];
  const subject = effect.subject;
  const reason: DecisionReason =
    subject.kind === 'tool'
      ? { kind: 'wuxie', tool: subject.tool, toolUserSeatId: subject.userSeatId, target: subject.target }
      : { kind: 'counter-wuxie', wuxieSeatId: subject.seatId };
  const pendingResponse: PendingResponse = {
    id: `wuxie-check-${state.log.length}-${askerId}`,
    respondingSeatId: askerId,
    allowedActionKinds: ['RespondAction', 'PassAction'],
    allowedCardIds: effect.counterCardIds,
    reason,
    // Pass: ask the next holder about the same thing.
    context: { effect: { ...effect, order: effect.order.slice(index + 1) } },
    // A counter card: everyone after its player may counter it in turn; if
    // none does, it skips what it guards (the Tool's rule, or another counter's skip).
    onAnswer: [
      { kind: 'WuxieCheckEffect', subject: { kind: 'counter', seatId: askerId }, order: livingSeatOrderFrom(state, askerId).slice(1), counterCardIds: effect.counterCardIds },
      { kind: 'SkipNextEffect' },
    ],
  };
  return { state: { ...state, pendingResponse }, events: [] };
}
```

- [ ] **Step 7: Route the lifecycle effects through the pipeline, and fill in the cancel details**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- Add `import { applyLifecycleEffect, isLifecycleEffect } from './toolLifecycle';`.
- In `resolveEffect`, replace `const applied = applyEffect(state, current);` with:

```ts
  const applied = isLifecycleEffect(current) ? applyLifecycleEffect(state, current, ctx.registry) : applyEffect(state, current);
```

- In the `RespondAction` case, replace the `inResponseTo` object with:

```ts
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
            : {
                ...(answered?.source?.kind === 'seat' ? { seatId: answered.source.seatId } : {}),
                ...(answered?.cause?.cardInstanceId ? { cardInstanceId: answered.cause.cardInstanceId } : {}),
                ...(reason?.kind === 'dying' ? { dyingSeatId: reason.seatId } : {}),
              };
```

- [ ] **Step 8: Export the new modules**

In `projects/engine/src/public-api.ts`, add:

```ts
export * from './lib/domain/usedCard';
export * from './lib/rules/seatOrder';
export * from './lib/pipeline/toolLifecycle';
```

- [ ] **Step 9: Run the tests**

Run: `npx jest projects/engine/src/lib/pipeline/toolLifecycle.spec.ts`
Expected: PASS (8 tests).

Run: `npx jest`
Expected: PASS. No other behaviour changed.

- [ ] **Step 10: Commit**

```bash
git add projects/engine
git commit -m "feat(engine): the Tool lifecycle — a Wuxie check per target, chainable counters, then the Tool's rule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Draw Two, Barbarians, Hail of Arrows, Peach Garden; Duel on the lifecycle

**Files:**
- Create:
  - `projects/content/src/lib/shared/tools.ts`
  - `projects/content/src/lib/cards/draw-two.ts`
  - `projects/content/src/lib/cards/mass-attack.ts`
  - `projects/content/src/lib/cards/peach-garden.ts`
- Modify:
  - `projects/content/src/lib/cards/duel.ts`
  - `projects/content/src/lib/registry.ts`
  - `projects/content/src/lib/cards/tools.spec.ts`
  - `projects/content/src/lib/wiki.spec.ts`
  - `projects/content/src/lib/modes/guozhan.spec.ts`

**Interfaces:**
- Consumes (Task 2):
  - `usedCardOf` and `livingSeatOrderFrom`;
  - the `ToolOnTargetEffect` shape;
  - `CardDefinition.onTarget`;
  - the `'card-effect'` `DecisionReason`.
- Produces:
  - `COUNTER_CARD_IDS = ['wuxie']`;
  - `toolOnTargets(state, userSeatId, cardInstanceId, targets): Effect[]`;
  - the cards `drawTwoCard`, `barbariansCard`, `hailOfArrowsCard` and `peachGardenCard`.

- [ ] **Step 1: Rewrite the Tool tests**

In `projects/content/src/lib/cards/tools.spec.ts`:

1. **Imports and registry.** Replace the imports and `registry()` with:

```ts
// projects/content/src/lib/cards/tools.spec.ts
import { duelCard } from './duel';
import { wuxieCard } from './wuxie';
import { drawTwoCard } from './draw-two';
import { barbariansCard, hailOfArrowsCard } from './mass-attack';
import { peachGardenCard } from './peach-garden';
import { silverLionCard, greenDragonBladeCard } from './equipment';
import { resolve } from 'engine';
import type { CardDefinition, GameState, ContentRegistry, GameModeDefinition } from 'engine';

const plain = (id: string): CardDefinition => ({ id, name: id, category: 'basic', play: () => [] });

function registry(): ContentRegistry {
  const cards = [duelCard, wuxieCard, drawTwoCard, barbariansCard, hailOfArrowsCard, peachGardenCard, silverLionCard, greenDragonBladeCard, plain('sha'), plain('shan')];
  return { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
}
```

2. **Draw pile.** In `twoSeatState`, add a draw pile as the first zone, so Draw Two has cards to draw:

```ts
      { id: 'drawPile', kind: 'drawPile', cards: [1, 2, 3, 4].map((n) => ({ instanceId: `d${n}`, definitionId: 'shan', suit: 'heart' as const, rank: n })) },
```

3. **Wuxie test.** Replace the test `'can be cancelled with Wuxie Kongjie only by the target, before any Sha'` with:

```ts
  it('can be cancelled by any Wuxie Kongjie holder before its first window, never by the window itself', () => {
    // The user (seat-a) may cancel its own Duel too: its Wuxie check asks seat-a first.
    const asked = duel(withHand(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']]), 'seat-a', [['wuxie', 'a-wuxie']]));
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', reason: { kind: 'wuxie' }, allowedCardIds: ['wuxie'] });
    const cancelled = sha(asked, 'seat-a', 'a-wuxie');
    expect(cancelled.pendingResponse).toBeNull();
    expect(hp(cancelled, 'seat-b')).toBe(6);
    expect(cancelled.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);

    const opened = duel(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']]));
    expect(opened.pendingResponse!.allowedCardIds).toEqual(['sha']);
  });
```

4. **New tests.** Append these blocks after the Duel `describe`:

```ts
// Four seats in a row, a (user) b c d, each at 3/4 HP; `hands` adds cards per seat.
function fourSeats(userCard: string, hands: Record<string, [string, string][]> = {}): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], combinedHp: 3, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: `${id}1`, revealed: true }, deputy: { generalDefinitionId: `${id}2`, revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
    })),
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [1, 2, 3, 4].map((n) => ({ instanceId: `d${n}`, definitionId: 'shan', suit: 'heart' as const, rank: n })) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        {
          id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id,
          cards: [
            ...(id === 'a' ? [{ instanceId: 'tool', definitionId: userCard, suit: 'spade' as const, rank: 7 }] : []),
            ...(hands[id] ?? []).map(([definitionId, instanceId]) => ({ instanceId, definitionId, suit: 'club' as const, rank: 3 })),
          ],
        },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('Draw Two, Barbarians, Hail of Arrows, Peach Garden', () => {
  const ctx = () => ({ registry: registry(), mode: stubMode() });
  const use = (s: GameState) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [] }, ctx()).state;
  const answer = (s: GameState, cardInstanceId: string) =>
    resolve(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx()).state;
  const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx()).state;
  const hps = (s: GameState) => s.seats.map((x) => x.combinedHp);
  const handSize = (s: GameState, id: string) => s.zones.find((z) => z.id === `${id}:hand`)!.cards.length;

  it('Draw Two: the user draws 2, and the card goes to the discard pile first', () => {
    const next = use(fourSeats('draw-two'));
    expect(handSize(next, 'a')).toBe(2);
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
  });

  it('Draw Two can be cancelled by another seat’s Wuxie Kongjie', () => {
    const asked = use(fourSeats('draw-two', { c: [['wuxie', 'c-wuxie']] }));
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'a' } } });
    expect(handSize(answer(asked, 'c-wuxie'), 'a')).toBe(0);
  });

  it('Barbarians: each other seat in turn order must play a Sha or take 1 damage from the user', () => {
    let s = use(fourSeats('barbarians', { b: [['sha', 'b-sha']], c: [['sha', 'c-sha']] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', allowedCardIds: ['sha'], reason: { kind: 'card-effect', userSeatId: 'a', card: { as: 'barbarians' } } });
    s = answer(s, 'b-sha');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c' });
    s = pass(s); // c keeps its Sha and takes the damage
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd' });
    s = pass(s);
    expect(hps(s)).toEqual([3, 3, 2, 2]);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent').map((e) => (e as { damage: { source: unknown } }).damage.source)).toEqual([
      { kind: 'seat', seatId: 'a' }, { kind: 'seat', seatId: 'a' },
    ]);
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('Hail of Arrows: the same, answered with a Shan', () => {
    let s = use(fourSeats('hail-of-arrows', { c: [['shan', 'c-shan']] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', allowedCardIds: ['shan'] });
    s = pass(s);
    s = answer(s, 'c-shan');
    s = pass(s);
    expect(hps(s)).toEqual([3, 2, 3, 2]);
  });

  it('a Wuxie Kongjie cancels Barbarians for one target only', () => {
    let s = use(fourSeats('barbarians', { c: [['wuxie', 'c-wuxie']] }));
    // b's Wuxie check: c is the only holder; c cancels the Barbarians on b.
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'b' } } });
    s = answer(s, 'c-wuxie');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'card-effect' } }); // on to c itself
    s = pass(s);
    s = pass(s);
    expect(hps(s)).toEqual([3, 3, 2, 2]);
  });

  it('Peach Garden heals each seat below max HP, starting with the user; full-HP seats are not targets', () => {
    const start = fourSeats('peach-garden', { b: [['wuxie', 'b-wuxie']] });
    const withCFull = { ...start, seats: start.seats.map((x) => (x.id === 'c' ? { ...x, combinedHp: 4 } : x)) };
    let s = use(withCFull);
    // The first target is a (the user): b, a Wuxie holder, is asked about it.
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'a' } } });
    s = pass(s); // a heals; then b's own target — b is asked again
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'b' } } });
    s = pass(s); // b heals; c is full (not a target, no check); b is asked about d
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'd' } } });
    s = pass(s); // d heals
    expect(hps(s)).toEqual([4, 4, 4, 4]);
    expect(s.pendingResponse).toBeNull();
  });

  it('a game paused mid-Barbarians survives a JSON round trip and resumes identically (Review Focus 4)', () => {
    const paused = use(fourSeats('barbarians', { c: [['wuxie', 'c-wuxie']] }));
    expect(paused.resolutionQueue!.length).toBeGreaterThan(0);
    const copy = JSON.parse(JSON.stringify(paused)) as GameState;
    expect(pass(pass(pass(copy)))).toEqual(pass(pass(pass(paused))));
  });

  it('Duel cancelled by a seat other than its target never opens its window (Review Focus 5)', () => {
    const s = fourSeats('duel', { c: [['wuxie', 'c-wuxie']] });
    const asked = resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [{ kind: 'seat', seatId: 'b' }] }, ctx()).state;
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie' } });
    const done = answer(asked, 'c-wuxie');
    expect(done.pendingResponse).toBeNull();
    expect(done.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/cards/tools.spec.ts`
Expected: FAIL with "Cannot find module './draw-two'".

- [ ] **Step 3: Write the shared Tool helpers**

Create `projects/content/src/lib/shared/tools.ts`:

```ts
import type { Effect, GameState, Target } from 'engine';
import { livingSeatOrderFrom, usedCardOf } from 'engine';

// The cards that cancel a Tool in a Wuxie check.
export const COUNTER_CARD_IDS = ['wuxie'];

// One ToolOnTargetEffect per target, in the order given, for the Tool card
// `cardInstanceId` that `userSeatId` is playing.
export function toolOnTargets(state: GameState, userSeatId: string, cardInstanceId: string, targets: Target[]): Effect[] {
  const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === cardInstanceId);
  if (!card) throw new Error(`Tool card ${cardInstanceId} is in no zone`);
  const tool = usedCardOf(card);
  return targets.map((target) => ({ kind: 'ToolOnTargetEffect', tool, userSeatId, target, counterCardIds: COUNTER_CARD_IDS }));
}

// Every other living seat as a target, in turn order from the seat after `seatId`.
export function otherSeatsInTurnOrder(state: GameState, seatId: string): Target[] {
  return livingSeatOrderFrom(state, seatId).slice(1).map((id) => ({ kind: 'seat', seatId: id }));
}
```

- [ ] **Step 4: Write the four Tools**

Create `projects/content/src/lib/cards/draw-two.ts`:

```ts
import type { CardDefinition } from 'engine';
import { toolOnTargets } from '../shared/tools';

// Draw Two: no target (the user). The user draws 2 cards.
export const drawTwoCard: CardDefinition = {
  id: 'draw-two',
  name: 'Draw Two',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) => (ctx.respondingTo ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, [{ kind: 'seat', seatId: ctx.seatId }])),
  onTarget: (_state, { userSeatId }) => [{ kind: 'DrawCardsEffect', seatId: userSeatId, count: 2 }],
};
```

Create `projects/content/src/lib/cards/mass-attack.ts`:

```ts
import type { CardDefinition, Target } from 'engine';
import { otherSeatsInTurnOrder, toolOnTargets } from '../shared/tools';

// Targets every other living seat in turn order; each must play `answerCardId`
// or take 1 damage from the user.
function massAttack(id: string, name: string, answerCardId: string): CardDefinition {
  return {
    id,
    name,
    category: 'tool',
    legalPlayTargets: (state, ctx) => (otherSeatsInTurnOrder(state, ctx.seatId).length > 0 ? [[]] : []),
    play: (state, ctx) => (ctx.respondingTo ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, otherSeatsInTurnOrder(state, ctx.seatId))),
    onTarget: (_state, { tool, userSeatId, target }) => {
      const seatId = (target as Extract<Target, { kind: 'seat' }>).seatId;
      const physicalId = tool.physical[0]?.instanceId;
      return [
        {
          kind: 'OpenResponseEffect',
          pendingResponse: {
            id: `${id}-${physicalId ?? 'virtual'}-${seatId}`,
            respondingSeatId: seatId,
            allowedActionKinds: ['RespondAction', 'PassAction'],
            allowedCardIds: [answerCardId],
            reason: { kind: 'card-effect', card: tool, userSeatId },
            context: {
              effect: {
                kind: 'DamageEffect',
                damage: {
                  source: { kind: 'seat', seatId: userSeatId },
                  target,
                  amount: 1,
                  nature: 'normal',
                  ...(physicalId ? { cause: { cardInstanceId: physicalId } } : {}),
                },
              },
            },
          },
        },
      ];
    },
  };
}

export const barbariansCard = massAttack('barbarians', 'Barbarians', 'sha');
export const hailOfArrowsCard = massAttack('hail-of-arrows', 'Hail of Arrows', 'shan');
```

Create `projects/content/src/lib/cards/peach-garden.ts`:

```ts
import type { CardDefinition, GameState, Target } from 'engine';
import { livingSeatOrderFrom } from 'engine';
import { toolOnTargets } from '../shared/tools';

// Every living seat below its max HP, in turn order starting with the user.
function hurtSeatsFrom(state: GameState, userSeatId: string): Target[] {
  return livingSeatOrderFrom(state, userSeatId)
    .filter((id) => {
      const seat = state.seats.find((s) => s.id === id)!;
      return seat.combinedHp < seat.maxCombinedHp;
    })
    .map((id) => ({ kind: 'seat', seatId: id }));
}

// Peach Garden: each living seat below max HP when it is played recovers 1 HP.
export const peachGardenCard: CardDefinition = {
  id: 'peach-garden',
  name: 'Peach Garden',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) => (ctx.respondingTo ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, hurtSeatsFrom(state, ctx.seatId))),
  onTarget: (_state, { target }) => [{ kind: 'HealEffect', target, amount: 1 }],
};
```

- [ ] **Step 5: Move Duel onto the lifecycle**

Replace `projects/content/src/lib/cards/duel.ts` with:

```ts
import type { CardDefinition, Effect, PendingResponse } from 'engine';
import { otherLivingSeatTargets } from '../shared/queries';
import { toolOnTargets } from '../shared/tools';

const DUEL_DAMAGE = 1;

// One step of a Duel: `responderSeatId` must play a Sha or take the damage,
// dealt by `otherSeatId`. `answeredWith` names the Sha that led here.
function duelWindow(duelInstanceId: string, responderSeatId: string, otherSeatId: string, answeredWith?: string): Effect {
  const pendingResponse: PendingResponse = {
    // Each step gets its own id: the opening one, then one per Sha answered.
    id: answeredWith ? `duel-response-${duelInstanceId}-${answeredWith}` : `duel-response-${duelInstanceId}`,
    respondingSeatId: responderSeatId,
    allowedActionKinds: ['RespondAction', 'PassAction'],
    allowedCardIds: ['sha'],
    sourceCard: { instanceId: duelInstanceId, definitionId: 'duel' },
    context: {
      effect: {
        kind: 'DamageEffect',
        damage: {
          source: { kind: 'seat', seatId: otherSeatId },
          target: { kind: 'seat', seatId: responderSeatId },
          amount: DUEL_DAMAGE,
          nature: 'normal',
          cause: { cardInstanceId: duelInstanceId },
        },
      },
    },
  };
  return { kind: 'OpenResponseEffect', pendingResponse };
}

// Duel: after its Wuxie check, starting with the target, the two seats take
// turns playing a Sha; the first who doesn't takes 1 damage from the other.
export const duelCard: CardDefinition = {
  id: 'duel',
  name: 'Duel',
  category: 'tool',
  legalPlayTargets: (state, ctx) => otherLivingSeatTargets(state, ctx.seatId),
  play: (state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    return toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, [ctx.targets[0]]);
  },
  onTarget: (_state, { tool, userSeatId, target }) => {
    if (target.kind !== 'seat' || !tool.physical[0]) return [];
    return [duelWindow(tool.physical[0].instanceId, target.seatId, userSeatId)];
  },
  // A Sha turns the Duel back on the other seat.
  onResponse: (_state, { pending, seatId, cardInstanceId }) => {
    const damage = pending.context.effect.kind === 'DamageEffect' ? pending.context.effect.damage : null;
    if (damage?.source?.kind !== 'seat') return [];
    return [duelWindow(pending.sourceCard!.instanceId, damage.source.seatId, seatId, cardInstanceId)];
  },
};
```

Check the existing test `'an untargeted Duel is not a legal play, and its play() stays a defensive no-op'`. It calls `duelCard.play(state, {... targets: [] })` and expects `[]`, and the guard above keeps that.

- [ ] **Step 6: Register the four Tools**

In `projects/content/src/lib/registry.ts`:
- Add these imports:

```ts
import { drawTwoCard } from './cards/draw-two';
import { barbariansCard, hailOfArrowsCard } from './cards/mass-attack';
import { peachGardenCard } from './cards/peach-garden';
```

- Change the `cards` array line to:

```ts
  const cards = [shaCard, shanCard, peachCard, duelCard, wuxieCard, drawTwoCard, barbariansCard, hailOfArrowsCard, peachGardenCard, silverLionCard, greenDragonBladeCard];
```

- [ ] **Step 7: Update the expectations that list cards in the game**

- `projects/content/src/lib/modes/guozhan.spec.ts`: change `expect(deckOf(2)).toHaveLength(61);` to `expect(deckOf(2)).toHaveLength(70);`. That is 61 + Draw Two 4 + Barbarians 3 + Hail of Arrows 1 + Peach Garden 1.
- `projects/content/src/lib/wiki.spec.ts`, test `'lists the 15 tools, with Duel and Wuxie in the game and their printings'`:
  - Rename it to `'lists the 15 tools, with the playable ones in the game and their printings'`.
  - Change the `inGame` expectation to `['barbarians', 'draw-two', 'duel', 'hail-of-arrows', 'peach-garden', 'wuxie']`.
  - Check the order: the list is sorted by display name. If the test receives them in a different order, match the order `wikiCards('tool')` actually uses. Read the other ids in that test to see whether it sorts by name or by id.
  - In `'includes the crawled EX and Army cards, not yet in the game'`, make sure none of the four new Tools is in its list. They are standard cards, so none should be.

- [ ] **Step 8: Run the content tests, then everything**

Run: `npx jest projects/content`
Expected: PASS.

Run: `npx jest`
Expected: PASS. Sim property tests now play the new Tools with random bots. Any invariant failure there is a real bug, so debug it with superpowers:systematic-debugging.

- [ ] **Step 9: Commit**

```bash
git add projects/content
git commit -m "feat(content): Draw Two, Barbarians, Hail of Arrows and Peach Garden; Duel on the Tool lifecycle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Bots — Wuxie and the new Tools

**Files:** modify `projects/bots/src/lib/rule-based.ts` and `projects/bots/src/lib/rule-based.spec.ts`.

**Interfaces:**
- Consumes: the `DecisionReason` kinds `'wuxie' | 'counter-wuxie' | 'card-effect'` (Task 2), and the card ids `'draw-two' | 'barbarians' | 'hail-of-arrows' | 'peach-garden'` (Task 3).

- [ ] **Step 1: Write the failing bot tests**

In `projects/bots/src/lib/rule-based.spec.ts`:

1. Add the four new cards to the `registry` card list:

```ts
    card('draw-two', 'tool'), card('barbarians', 'tool'), card('hail-of-arrows', 'tool'), card('peach-garden', 'tool'),
```

2. Add `DecisionReason` to the file's `import type { ... } from 'engine'`, and add a `pendingReason?: DecisionReason;` option to `ViewOptions`.

3. In `view()`, change the pending response to include `...(o.pendingReason ? { reason: o.pendingReason } : {})`.

4. Append this block:

```ts
describe('ruleBasedPolicy: Tools and Wuxie Kongjie', () => {
  const respond = (id: string): Action => ({ kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: id });
  const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
  const tool = (as: string) => ({ as, colour: 'black' as const, physical: [] });
  const wuxieOn = (as: string, targetSeatId: string) =>
    view({ pendingFor: 'seat-0', hand: [{ instanceId: 'wx', definitionId: 'wuxie' }], pendingReason: { kind: 'wuxie', tool: tool(as), toolUserSeatId: 'seat-1', target: { kind: 'seat', seatId: targetSeatId } } });

  it('cancels a harmful Tool aimed at itself', () => {
    expect(decide(wuxieOn('barbarians', 'seat-0'), [respond('wx'), pass]).action).toEqual(respond('wx'));
  });

  it('lets a Tool aimed at someone else, or a harmless one, through', () => {
    expect(decide(wuxieOn('barbarians', 'seat-2'), [respond('wx'), pass]).action).toEqual(pass);
    expect(decide(wuxieOn('draw-two', 'seat-0'), [respond('wx'), pass]).action).toEqual(pass);
  });

  it('never counters a Wuxie Kongjie', () => {
    const v = view({ pendingFor: 'seat-0', hand: [{ instanceId: 'wx', definitionId: 'wuxie' }], pendingReason: { kind: 'counter-wuxie', wuxieSeatId: 'seat-1' } });
    expect(decide(v, [respond('wx'), pass]).action).toEqual(pass);
  });

  it('answers a Barbarians window with a Sha', () => {
    const v = view({ pendingFor: 'seat-0', hand: [{ instanceId: 's', definitionId: 'sha' }], pendingReason: { kind: 'card-effect', card: tool('barbarians'), userSeatId: 'seat-1' } });
    expect(decide(v, [respond('s'), pass]).action).toEqual(respond('s'));
  });

  it('plays Draw Two before attacking', () => {
    const v = view({ hand: [{ instanceId: 'dt', definitionId: 'draw-two' }, { instanceId: 's', definitionId: 'sha' }] });
    expect(decide(v, [play('dt'), play('s', 'seat-1'), end]).action).toEqual(play('dt'));
  });

  it('plays Barbarians when non-allies are at least as many as allies, and not when allies outnumber them', () => {
    const v = view({ hand: [{ instanceId: 'b', definitionId: 'barbarians' }] });
    expect(decide(v, [play('b'), end]).action).toEqual(play('b'));
    const allied = view({
      hand: [{ instanceId: 'b', definitionId: 'barbarians' }],
      seats: [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 6), seat('seat-2', 2, 'Wei', 3), seat('seat-3', 3, 'hidden', 4)],
    });
    expect(decide(allied, [play('b'), end]).action).toEqual(end);
  });

  it('plays Peach Garden only when hurt', () => {
    const hurt = view({ hand: [{ instanceId: 'pg', definitionId: 'peach-garden' }] }); // seat-0 is at 8/8 by default
    expect(decide(hurt, [play('pg'), end]).action).toEqual(end);
    const v = view({ hand: [{ instanceId: 'pg', definitionId: 'peach-garden' }], seats: [seat('seat-0', 0, 'Wei', 5), seat('seat-1', 1, 'hidden', 6)] });
    expect(decide(v, [play('pg'), end]).action).toEqual(play('pg'));
  });
});
```

Run: `npx jest projects/bots`
Expected: FAIL. The bot currently answers every non-dying window, so it plays Wuxie on others' Tools and counters. It ignores the new Tools, and ends the phase instead of playing Draw Two.

- [ ] **Step 2: Implement the rules**

In `projects/bots/src/lib/rule-based.ts`:

1. Add after `isAlly`:

```ts
// Tools worth cancelling when they are aimed at this bot.
const HARMFUL_TOOLS = new Set(['barbarians', 'hail-of-arrows', 'duel', 'steal', 'break', 'capture', 'lightning']);
```

2. Replace the `worthAnswering` line in step 2 with:

```ts
    const worthAnswering =
      !reason || reason.kind === 'card-effect'
        ? true
        : reason.kind === 'dying'
          ? !!self && !!dying && (dying.id === seatId || isAlly(self, dying))
          : reason.kind === 'wuxie'
            ? reason.target.kind === 'seat' && reason.target.seatId === seatId && HARMFUL_TOOLS.has(reason.tool.as)
            : false; // never counter a Wuxie Kongjie
```

3. In step 5, after the `equipment` block and before the Sha block, add:

```ts
    const untargetedOf = (definitionId: string) => plays.find((p) => untargeted(p) && definitionIdOf(view, p.cardInstanceId) === definitionId);

    const drawTwo = untargetedOf('draw-two');
    if (drawTwo) return take(drawTwo);

    const peachGarden = untargetedOf('peach-garden');
    if (peachGarden && self.combinedHp < self.maxCombinedHp) return take(peachGarden);

    // Barbarians and Hail of Arrows hit everyone else: only worth it when
    // non-allies are at least as many as allies.
    const others = view.seats.filter((s) => s.id !== seatId && !s.eliminated);
    const allies = others.filter((s) => isAlly(self, s)).length;
    if (others.length - allies >= allies) {
      const massAttack = untargetedOf('barbarians') ?? untargetedOf('hail-of-arrows');
      if (massAttack) return take(massAttack);
    }
```

Run: `npx jest projects/bots`
Expected: PASS.

- [ ] **Step 3: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/bots
git commit -m "feat(bots): Wuxie Kongjie only against harmful Tools on itself; play Draw Two, Peach Garden, Barbarians and Hail of Arrows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sim — the queue invariant

**Files:** modify `projects/sim/src/invariants.ts` and `projects/sim/src/invariants.spec.ts`.

- [ ] **Step 1: Write the failing test**

Append to `projects/sim/src/invariants.spec.ts`. It uses the file's existing `baseState(overrides?)` fixture. Add `checkRestingState` to the file's import from `'./invariants'` if it isn't there already.

```ts
describe('checkRestingState: the resolution queue', () => {
  it('flags a game resting with items still queued and no decision pending', () => {
    const resting = { ...baseState(), phase: 'Play' as const, resolutionQueue: [{ kind: 'SkipNextEffect' as const }] };
    expect(checkRestingState(resting)).toEqual([expect.stringMatching(/1 item\(s\) still queued/)]);
  });

  it('allows queued items while a response is pending', () => {
    const paused = {
      ...baseState(),
      resolutionQueue: [{ kind: 'SkipNextEffect' as const }],
      pendingResponse: { id: 'r', respondingSeatId: baseState().seats[0].id, allowedActionKinds: ['PassAction'], context: { effect: { kind: 'SkipNextEffect' as const } } },
    };
    expect(checkRestingState(paused)).toEqual([]);
  });
});
```

Run: `npx jest projects/sim/src/invariants.spec.ts`
Expected: FAIL. The first test gets `[]`, because a Play phase "waits for a player".

- [ ] **Step 2: Implement**

In `projects/sim/src/invariants.ts`, at the start of `checkRestingState`, add:

```ts
  const queued = state.resolutionQueue?.length ?? 0;
  if (!state.result && !state.pendingResponse && queued > 0) {
    return [`Game is resting with ${queued} item(s) still queued and no decision pending`];
  }
```

Run: `npx jest projects/sim`
Expected: PASS. The property test checks `checkRestingState` after every action across every seat count from 2 to 10, so it now enforces the queue invariant on every random game.

- [ ] **Step 3: Commit**

```bash
git add projects/sim
git commit -m "test(sim): a resting game has nothing left in the resolution queue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: App — explain Wuxie windows, the waiting reason, and Action History lines

**Files:**
- Modify: `projects/app/src/app/game-board/response-description.ts` and `response-description.spec.ts`
- Modify: `projects/app/src/app/game-board/action-history.ts` and `action-history.spec.ts`
- Modify: `projects/app/src/app/game-board/round-table.ts` and `round-table.spec.ts`

**Interfaces:**
- Consumes: `DecisionReason` (Task 2), and `CardPlayedEvent.inResponseTo.targetSeatId` and `counters` (Task 2).
- Produces: `waitingLine(state: GameState): string | null`, exported from `response-description.ts`.

- [ ] **Step 1: Write the failing tests**

Read each spec file's existing fixture helpers first, and write the tests in their style. These are the behaviours to pin, each with its exact expected text:

`response-description.spec.ts` covers `describeResponse(state, viewer)`. Use players `seat-0` "Hing", `seat-1` "Seat 1" and `seat-2` "Seat 2", plus a `CardPlayedEvent` in the log for the Tool:

| Reason | Expected |
|---|---|
| `wuxie`: Seat 1's Barbarians on `seat-0`, viewer `seat-0`, `allowedCardIds: ['wuxie']` | source `"Seat 1 used Barbarians on you"`, prompt `"Play Wuxie Kongjie to cancel it?"`, outcome `"Barbarians takes effect on you"` |
| `wuxie`: Seat 1's Draw Two on `seat-1` (itself), viewer `seat-0` | source `"Seat 1 used Draw Two"`, outcome `"Draw Two takes effect"` |
| `counter-wuxie`: `wuxieSeatId: 'seat-2'`, viewer `seat-0` | source `"Seat 2 played Wuxie Kongjie"`, prompt `"Play Wuxie Kongjie to cancel it?"`, outcome `"Seat 2's Wuxie Kongjie stands"` |

`response-description.spec.ts` also covers `waitingLine(state)`:

| Pending | Expected |
|---|---|
| none | `null` |
| `dying` (seat-2) for `seat-0` | `"Waiting on Hing to save Seat 2"` |
| `wuxie` for `seat-0` | `"Waiting on Hing: Wuxie Kongjie?"` |
| `card-effect` (Barbarians) for `seat-1` | `"Waiting on Seat 1 to answer Barbarians"` |
| no reason (a Sha's Shan window) for `seat-1` | `"Waiting on Seat 1"` |

`action-history.spec.ts` checks the log lines, most recent first, in these situations:
- Seat 1 plays Barbarians (`spade 7`), and then Hing answers a `wuxie` window with `inResponseTo: { seatId: 'seat-1', cardInstanceId: <barbarians id>, targetSeatId: 'seat-2' }` and Wuxie Kongjie `spade 11`. The line is `"Hing cancelled Seat 1's Barbarians on Seat 2 with Wuxie Kongjie (J ♠)"`.
  - Use `cardFaceLabel`'s real output for rank 11. Check `labels.ts`; it prints J for 11.
- The same, but with `targetSeatId` equal to the Tool's user. The line is `"Hing cancelled Seat 1's Draw Two with Wuxie Kongjie (J ♠)"`.
- Seat 2 answers with `inResponseTo: { seatId: 'seat-0', counters: true }`. The line is `"Seat 2 cancelled Hing's Wuxie Kongjie with Wuxie Kongjie (3 ♣)"`.

`round-table.spec.ts`: with a `wuxie` pending for `seat-0`, the `.waiting` element reads `"Waiting on Hing: Wuxie Kongjie?"`.

Run: `npx jest projects/app/src/app/game-board/response-description.spec.ts projects/app/src/app/game-board/action-history.spec.ts projects/app/src/app/game-board/round-table.spec.ts`
Expected: FAIL. `waitingLine` is not exported, the Wuxie windows fall back to "A response is needed", and the cancel lines read "used … in response".

- [ ] **Step 2: Implement the descriptions**

In `response-description.ts`:

1. Add a helper after `cardName`:

```ts
// The card a window asks for, by name ("Wuxie Kongjie"), when it names one.
function askedCardName(state: GameState): string {
  const id = state.pendingResponse?.allowedCardIds?.[0];
  return id ? cardName({ definitionId: id }) : 'a card';
}
```

2. In `describeResponse`, after the dying branch, add:

```ts
  if (pending.reason?.kind === 'wuxie') {
    const { tool, toolUserSeatId, target } = pending.reason;
    const toolName = cardName({ definitionId: tool.as });
    const targetId = target.kind === 'seat' ? target.seatId : undefined;
    const on = !targetId || targetId === toolUserSeatId ? '' : ` on ${targetId === viewerSeatId ? 'you' : name(targetId)}`;
    return {
      source: `${name(toolUserSeatId)} used ${toolName}${on}`,
      latest: null,
      prompt: `Play ${askedCardName(state)} to cancel it?`,
      outcome: `${toolName} takes effect${on}`,
      outcomeForce: forceOf(state.seats.find((s) => s.id === targetId)?.kingdom),
    };
  }

  if (pending.reason?.kind === 'counter-wuxie') {
    const { wuxieSeatId } = pending.reason;
    const counter = askedCardName(state);
    return {
      source: `${name(wuxieSeatId)} played ${counter}`,
      latest: null,
      prompt: `Play ${counter} to cancel it?`,
      outcome: `${name(wuxieSeatId)}'s ${counter} stands`,
      outcomeForce: forceOf(state.seats.find((s) => s.id === wuxieSeatId)?.kingdom),
    };
  }
```

3. Append:

```ts
// The table centre's "Waiting on …" line, with what the seat is being asked.
export function waitingLine(state: GameState): string | null {
  const pending = state.pendingResponse;
  if (!pending) return null;
  const who = `Waiting on ${seatName(state.players, pending.respondingSeatId)}`;
  const reason = pending.reason;
  if (reason?.kind === 'dying') return `${who} to save ${seatName(state.players, reason.seatId)}`;
  if (reason?.kind === 'wuxie' || reason?.kind === 'counter-wuxie') return `${who}: ${askedCardName(state)}?`;
  if (reason?.kind === 'card-effect') return `${who} to answer ${cardName({ definitionId: reason.card.as })}`;
  return who;
}
```

- [ ] **Step 3: Use it on the table**

In `round-table.ts`:
- Import `waitingLine` from `'./response-description'`.
- Add `protected readonly waiting = computed(() => waitingLine(this.state()));`.
- Replace the `@if (state().pendingResponse; as pending) { ... }` block with:

```html
        @if (waiting(); as line) {
          <div class="waiting">{{ line }}</div>
        }
```

- [ ] **Step 4: Implement the Action History lines**

In `action-history.ts`, in the `CardPlayedEvent` case, add two branches between the `dyingSeatId` branch and the generic `else if (answered)` branch:

```ts
        } else if (answered?.counters && answered.seatId) {
          action(`${name(event.seatId)} cancelled ${name(answered.seatId)}'s ${cardName(event.card.definitionId)} with ${named(event.card)}`, event.card);
        } else if (answered?.targetSeatId && answered.seatId) {
          const tool = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const toolName = tool ? cardName(tool.definitionId) : 'Tool';
          const on = answered.targetSeatId === answered.seatId ? '' : ` on ${name(answered.targetSeatId)}`;
          action(`${name(event.seatId)} cancelled ${name(answered.seatId)}'s ${toolName}${on} with ${named(event.card)}`, event.card);
```

- [ ] **Step 5: Run the app tests, the whole suite and the build**

Run: `npx jest projects/app`
Expected: PASS.

Run: `npx jest`
Expected: PASS.

Run: `npx ng build app`
Expected: success, no new warnings.

- [ ] **Step 6: Look at it running**

Run the app (`npx ng serve app --port 4300`). Start a vs-bots game with 5 seats and keep playing turns until you hold Barbarians or Draw Two, or watch a bot play one. Check:
- The Response window shows "Seat N used Barbarians on you" or "Play Wuxie Kongjie to cancel it?" when you hold Wuxie.
- The table centre shows the waiting reason.
- Action History shows the cancel lines.
- Barbarians asks the seats one at a time.

Fix anything wrong before committing.

- [ ] **Step 7: Commit**

```bash
git add projects/app
git commit -m "feat(app): explain Wuxie Kongjie windows, show what a seat is asked, and log cancels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs — the event chain with the queue

**Files:** modify `docs/architecture/event-chain.md`.

- [ ] **Step 1: Update the doc to match the code**

Edit `docs/architecture/event-chain.md`:

1. **"The pipeline" diagram.** Replace it with:

```
resolve(state, action)                      ← the only entry point
 ├─ resolveAction(action)                     validate, then queue what it leads to
 │    (a card play logs CardPlayedEvent, moves the card out of the hand,
 │     and queues: the move, CardPlayedEvent's trigger follow-ups, play()'s effects)
 └─ advanceToDecision(state)
      loop:
        drain the queue, front first:
          an Effect → before:<EffectKind> triggers → applyEffect → events logged
                      → each event's after-trigger follow-ups go to the FRONT
          an Action → resolveAction (queues more)
          stop when a response is pending, the queue is empty, or the game is over
        response pending / player must decide / game over? stop
        otherwise enter the next phase (logs PhaseChangedEvent, queues its triggers)
```

2. **"Stage by stage".** Rewrite each paragraph so that `resolveAction` *queues*, and `advanceToDecision` *drains* and then advances phases. State the queue rules:
   - Trigger follow-ups go to the front.
   - A pending response pauses draining.
   - The game ending drops what's left.
   - The queue is plain data in `GameState.resolutionQueue`, absent when empty.

3. **"Safety rails".** Replace the depth-limit bullet with:

   > **Step budget.** One `resolve` call may resolve at most `MAX_RESOLUTION_STEPS` (10,000) queue items. Beyond that the engine throws, naming the item, so a content trigger loop fails loudly instead of running forever.

4. **"Prime example: a lethal Sha", Call 1.** Reorder the steps:
   1. Log `CardPlayedEvent`.
   2. The used Sha goes to the discard pile, giving `CardMovedEvent`. This now comes right after the play.
   3. Count the play.
   4. `sha.play()`'s `OpenResponseEffect` stores the window.
   5. The queue stops.

   In "The log after all three calls", the `CardMovedEvent` line already comes second, so keep it.

5. **New section** "The Tool lifecycle", after "Pausing for a response". Explain:
   - `ToolOnTargetEffect` becomes `WuxieCheckEffect` followed by `ToolRuleEffect`.
   - The check asks holders in seat order from the user.
   - An answer queues a counter-check and a `SkipNextEffect`, and Wuxie-on-Wuxie parity falls out of queue order.
   - `onTarget` is where a Tool's rule lives.

   Use Barbarians as the worked example: three targets, one Sha answer, one Wuxie.

6. **"Plugging into the chain" table.** Add a row: "A Tool's rule on each target | `play()` returning `ToolOnTargetEffect`s (content's `toolOnTargets`), and `CardDefinition.onTarget` | Barbarians opens a Sha window on each target".

7. **"Things to watch for".**
   - Delete item 3 ("A response window isn't a full suspension") entirely.
   - Add: "**Trigger conditions are checked when gathered.** A follow-up waits in the queue; its trigger's condition was checked against the state at the moment the event happened, not when the follow-up runs."

- [ ] **Step 2: Check the doc against the code**

Run: `grep -n "MAX_TRIGGER_DEPTH\|depth\|not a full suspension\|sub-project B" docs/architecture/event-chain.md`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/event-chain.md
git commit -m "docs: the event chain runs on the resolution queue; the Tool lifecycle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
