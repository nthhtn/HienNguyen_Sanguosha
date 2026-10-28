# Tools Stage 2: Choices — Steal, Break, Harvest, Coerce — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give the engine a pending **choice**: a seat picks one of several options, and the queue waits for the pick.
- Make Steal, Break, Harvest and Coerce playable at their printed counts. The deck goes from 70 to 85 cards.
- Keep hidden cards hidden: a hand is offered as one face-down option, and redaction masks any hidden card the queue or a pending decision mentions.

**Architecture:**
- **The engine.**
  - `GameState.pendingChoice` (optional, absent when none) pauses the queue the way a response window does.
  - `OpenChoiceEffect` sets it. `ChooseOptionAction` picks an option, logs `ChoiceMadeEvent`, and queues the option's effects at the front.
  - A hand is a single `hidden-hand` option whose effect is `MoveRandomCardEffect` (seeded RNG).
- **Harvest's cards.** A new face-up zone kind, `processing`, holds them. `RevealToProcessingEffect` turns them up, and `DiscardZoneEffect` clears what's left.
- **Content.**
  - Steal and Break share one builder, `pickACardTool`.
  - Harvest opens one choice per seat over the processing cards.
  - Coerce opens a Sha window for the weapon holder. Its `onResponse` turns the holder's Sha into a normal Sha window on the victim.
- **Around the engine.** Bots pick by a fixed ranking. The app gets a Choice window, a choice clock, a two-step Coerce picker, the turned-up cards in the table centre, and Action History lines for picks.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app tasks).

**Spec:**
- `docs/superpowers/specs/2026-10-05-tools-design.md`: "Stage 2", "Engine design → Choices (stage 2)", "Response windows", Bots, UI, Testing.
- The roadmap amendment in `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`: reasons carry a `UsedCard`.

**Where this plan departs from the spec's sketch, and why:**
- **`pendingChoice` is optional** (`pendingChoice?: PendingChoice`), not `PendingChoice | null`. This matches `resolutionQueue`, and every existing state fixture stays valid.
- **New fields on `PendingChoice` and the reasons:**
  - `PendingChoice` gains `verb: 'take' | 'discard'`, so the UI labels its button without naming a card.
  - The `choice` reason gains `targetSeatId?`, the seat whose cards are picked from.
  - The `card-effect` reason gains `victimSeatId?`, for Coerce.
- **Coerce uses `sourceCard` and `onResponse`, not `onAnswer`.** The victim's Sha window must name the Sha the holder actually played, and only `onResponse` knows it.

## Global Constraints

- **The engine names no card or skill.** Content supplies everything card-specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** `pendingChoice` holds no functions, and is absent (never `null`) when no choice is pending.
- **A decision's id names what it asks.** Choice ids are `${toolId}-${physicalInstanceId}-${seatId}-${log.length}`. This is the lesson of stage 1's window-id fix.
- **Printed counts:** Steal 5, Break 6, Harvest 2, Coerce 2. The deck goes from 70 to 85.
- **Rule text (spec, Stage 2):**
  - **Steal:** another living seat at distance 1 (`seatDistance`, so horses count) that holds a card in hand, equipment or judgment area. The user takes one of its cards: a hand card face-down, equipment or judgment cards by face.
  - **Break:** any other living seat holding a card. The chosen card goes to the discard pile.
  - **Harvest:** one card per living seat is turned up. Each living seat, starting with the user, takes one, and each pick has its own Wuxie check. Leftovers go to the discard pile.
  - **Coerce:** another living seat wearing a weapon (the holder), and a victim: a living seat other than the holder, within the holder's attack range. The holder must play a Sha at the victim, answered like any Sha. Without one, the holder's weapon goes to the user's hand. That Sha doesn't count toward the holder's Sha limit.
- **Bots (spec):**
  - **Picking:** a weapon, then armour, then a mount, then the hand. For Harvest, the face-up card with the highest keep rank.
  - **Steal and Break:** the lowest-HP non-ally, preferring one that wears equipment.
  - **Coerce:** when a non-ally's weapon can reach another non-ally.
  - **Harvest:** the spec's bot list doesn't include it, so rule-based bots don't play it. Random bots in the sim do.
- **UI text** follows CLAUDE.md's UI text style. Buttons and labels are Title Case. Prompts and Action History lines are sentence case, and card and seat names keep their capitals.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Steal or Break on a seat with nothing left when the rule resolves.** Example: the target's only card was the Wuxie it spent, and another Wuxie let the Tool through. No choice opens, nothing crashes, and play goes on. (Test in Task 3.)
2. **Harvest when the draw pile and discard pile can't supply one card per seat.** Fewer cards are turned up, and the seats after them get no pick. (Test in Task 4.)
3. **A paused choice survives a JSON round trip, and never shows another seat's hand cards** to anyone, in the choice or in the queue. (Tests in Tasks 1, 2 and 3.)
4. **A choice that times out during your own Play phase** must pick an option. It must never submit End Phase, which isn't legal then. (Test in Task 6.)
5. **Coerce with the user as the victim.** The holder's Sha must ask the user for a Shan. (Test in Task 4.)

---

## File Structure

**Engine (`projects/engine/src/lib/`)**
- Modify: `domain/types.ts` (`PendingChoice`, `ChoiceOption`, the `choice` reason, `victimSeatId`, the `processing` zone kind, `GameState.pendingChoice`), `pipeline/actions.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`, `rules/activeSeat.ts`, `rules/legality.ts`, `domain/redact.ts`.
- Create: `pipeline/choice.spec.ts`.
- Modify tests: `pipeline/effects.spec.ts`, `pipeline/queue.spec.ts`, `domain/redact.spec.ts`.

**Content (`projects/content/src/lib/`)**
- Create:
  - `shared/choices.ts` (`seatCardOptions`, `holdsAnyCard`, `pickACardTool`)
  - `cards/steal.ts`, `cards/break.ts`, `cards/harvest.ts`, `cards/coerce.ts`
- Modify:
  - `cards/sha.ts` (export `shaWindow`), `shared/tools.ts` (`toolOnTargets` gains `extra`), `modes/guozhan.ts` (the `processing` zone), `registry.ts`
  - tests: `cards/tools.spec.ts`, `registry.spec.ts`, `wiki.spec.ts`, `modes/guozhan.spec.ts`

**Bots:** modify `projects/bots/src/lib/rule-based.ts` and `rule-based.spec.ts`.

**Sim:** modify `projects/sim/src/invariants.ts` and `invariants.spec.ts`.

**App (`projects/app/src/app/`)**
- Create: `game-board/choice-description.ts` + spec, `game-board/choice-dialog.ts` + spec.
- Modify:
  - `labels.ts`, `game-board/action-list.ts` (+spec), `game-board/game-board.ts` (+spec), `decision-timer.service.ts` (+spec)
  - `game-board/response-description.ts` (+spec), `game-board/round-table.ts` (+spec), `game-board/hand-view.ts` (+spec), `game-board/action-history.ts` (+spec)
  - `wiki/wiki-pages.spec.ts`

**Docs:** modify `docs/architecture/event-chain.md`.

---

### Task 1: The engine's pending choice

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts`, `pipeline/actions.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`, `rules/activeSeat.ts`, `rules/legality.ts`
- Create: `projects/engine/src/lib/pipeline/choice.spec.ts`
- Modify: `projects/sim/src/invariants.ts`, `projects/sim/src/invariants.spec.ts`
- Modify: `projects/app/src/app/labels.ts`, `projects/app/src/app/game-board/action-list.ts`, `projects/app/src/app/game-board/action-list.spec.ts`

**Interfaces:**
- Produces:
  - `PendingChoice { id; seatId; reason: DecisionReason; verb: 'take' | 'discard'; options: ChoiceOption[] }`.
  - `ChoiceOption { id; shows: { kind: 'card'; card: CardInstance } | { kind: 'hidden-hand'; seatId: string; count: number }; effects: Effect[] }`.
  - `GameState.pendingChoice?: PendingChoice`.
  - The `DecisionReason` member `{ kind: 'choice'; card: UsedCard; userSeatId: string; targetSeatId?: string }`.
  - The action `{ kind: 'ChooseOptionAction'; seatId; choiceId; optionId }`.
  - The effects `{ kind: 'OpenChoiceEffect'; choice: PendingChoice }` and `{ kind: 'MoveRandomCardEffect'; fromZoneId; toZoneId }`.
  - The event `ChoiceMadeEvent { kind; seatId; reason; verb; shows }`.
  - `getActiveSeatId` and `getLegalActions` both put a pending choice first.

- [ ] **Step 1: Write the failing engine tests**

Create `projects/engine/src/lib/pipeline/choice.spec.ts`:

```ts
import { resolve } from './resolve';
import { applyEffect, Effect } from './effects';
import { createRng } from '../rng/rng';
import { getActiveSeatId } from '../rules/activeSeat';
import { getLegalActions } from '../rules/legality';
import { GameState, PendingChoice } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';

const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};

// Seat a holds the fixture card; seat b has three hand cards and one worn card.
function state(): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 3, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: `${id}-m`, revealed: true }, deputy: { generalDefinitionId: `${id}-d`, revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
  });
  const card = (instanceId: string, rank: number) => ({ instanceId, definitionId: 'filler', suit: 'club' as const, rank });
  return {
    seats: [seat('a', 0), seat('b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [{ instanceId: 'picker', definitionId: 'picker', suit: 'spade', rank: 1 }] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [card('b1', 1), card('b2', 2), card('b3', 3)] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [card('b-eq', 9)] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const healA: Effect = { kind: 'HealEffect', target: { kind: 'seat', seatId: 'a' }, amount: 1 };
const choice: PendingChoice = {
  id: 'c1',
  seatId: 'a',
  reason: { kind: 'choice', card: { as: 'picker', colour: 'black', physical: [] }, userSeatId: 'a', targetSeatId: 'b' },
  verb: 'take',
  options: [
    { id: 'hand', shows: { kind: 'hidden-hand', seatId: 'b', count: 3 }, effects: [{ kind: 'MoveRandomCardEffect', fromZoneId: 'b:hand', toZoneId: 'a:hand' }] },
    {
      id: 'b-eq',
      shows: { kind: 'card', card: { instanceId: 'b-eq', definitionId: 'filler', suit: 'club', rank: 9 } },
      effects: [{ kind: 'MoveCardEffect', cardInstanceId: 'b-eq', toZoneId: 'a:hand' }],
    },
  ],
};
// A fixture card: opens `choice`, then heals its user.
const picker: CardDefinition = { id: 'picker', name: 'Picker', category: 'tool', legalPlayTargets: () => [[]], play: () => [{ kind: 'OpenChoiceEffect', choice }, healA] };
const ctx = { registry: { cards: new Map([[picker.id, picker]]), generals: new Map() } as ContentRegistry, mode };

const opened = () => resolve(state(), { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'picker', targets: [] }, ctx).state;
const choose = (s: GameState, optionId: string, seatId = 'a', choiceId = 'c1') =>
  resolve(s, { kind: 'ChooseOptionAction', seatId, choiceId, optionId }, ctx).state;
const hand = (s: GameState, id: string) => s.zones.find((z) => z.id === `${id}:hand`)!.cards.map((c) => c.instanceId);
const hp = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!.combinedHp;

describe('a pending choice', () => {
  it('pauses the queue: the chooser is the active seat and may only pick an option', () => {
    const s = opened();
    expect(s.pendingChoice).toEqual(choice);
    expect(hp(s, 'a')).toBe(3); // the heal waits
    expect(s.resolutionQueue).toEqual([healA]);
    expect(getActiveSeatId(s)).toBe('a');
    expect(getLegalActions(s, 'a')).toEqual([
      { kind: 'ChooseOptionAction', seatId: 'a', choiceId: 'c1', optionId: 'hand' },
      { kind: 'ChooseOptionAction', seatId: 'a', choiceId: 'c1', optionId: 'b-eq' },
    ]);
    expect(getLegalActions(s, 'b')).toEqual([]);
    expect(() => resolve(s, { kind: 'EndPhaseAction', seatId: 'a' }, ctx)).toThrow('not legal while a choice is pending');
  });

  it('runs the picked option, logs the pick, then resumes the queue', () => {
    const s = choose(opened(), 'b-eq');
    expect(s.pendingChoice).toBeUndefined();
    expect(hand(s, 'a')).toEqual(['b-eq']);
    expect(hp(s, 'a')).toBe(4);
    expect(s.log.find((e) => e.kind === 'ChoiceMadeEvent')).toEqual({
      kind: 'ChoiceMadeEvent', seatId: 'a', reason: choice.reason, verb: 'take', shows: choice.options[1].shows,
    });
    expect(s.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'ChoiceMadeEvent', 'CardMovedEvent', 'HealEvent']);
  });

  it('rejects a pick by another seat, of an unknown option, or for a stale choice', () => {
    const s = opened();
    expect(() => choose(s, 'hand', 'b')).toThrow('is not the chooser');
    expect(() => choose(s, 'nope')).toThrow('has no option nope');
    expect(() => choose(s, 'hand', 'a', 'old')).toThrow('No matching pending choice: old');
  });

  it('takes a seeded random card from a hidden hand', () => {
    const once = choose(opened(), 'hand');
    const again = choose(opened(), 'hand');
    expect(hand(once, 'a')).toHaveLength(1);
    expect(hand(once, 'b')).toHaveLength(2);
    expect(hand(once, 'a')).toEqual(hand(again, 'a'));
    expect(once.rng.counter).toBeGreaterThan(opened().rng.counter);
  });

  it('survives a JSON round trip while pending, and resumes identically (Review Focus 3)', () => {
    const s = opened();
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(choose(copy, 'hand')).toEqual(choose(s, 'hand'));
  });
});

describe('MoveRandomCardEffect', () => {
  it('does nothing when the zone is empty', () => {
    const empty = { ...state(), zones: state().zones.map((z) => (z.id === 'b:hand' ? { ...z, cards: [] } : z)) };
    expect(applyEffect(empty, { kind: 'MoveRandomCardEffect', fromZoneId: 'b:hand', toZoneId: 'a:hand' })).toEqual({ state: empty, events: [] });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/choice.spec.ts`
Expected: FAIL. TypeScript rejects `PendingChoice`, `OpenChoiceEffect` and `ChooseOptionAction`.

- [ ] **Step 3: Add the types**

In `projects/engine/src/lib/domain/types.ts`:

1. In the `DecisionReason` union, after the `card-effect` member and before its closing `;`, add:

```ts
  // A Tool's pick (Steal, Break, Harvest): `userSeatId` used `card`; the
  // chooser takes or discards one of `targetSeatId`'s cards (none for Harvest).
  | { kind: 'choice'; card: UsedCard; userSeatId: string; targetSeatId?: string }
```

2. After the `DecisionReason` type, add:

```ts
// A pick a seat owes (Steal, Break, Harvest). Pauses the queue like a
// response window.
export interface PendingChoice {
  id: string;
  seatId: string;
  reason: DecisionReason;
  // What picking does with the card, for display: take it, or discard it.
  verb: 'take' | 'discard';
  options: ChoiceOption[];
}

export interface ChoiceOption {
  id: string;
  // A face-up card, or a seat's whole hand as one face-down option (the card
  // inside it is picked at random, so the chooser never sees the hand).
  shows: { kind: 'card'; card: CardInstance } | { kind: 'hidden-hand'; seatId: string; count: number };
  // Queued at the front when picked.
  effects: Effect[];
}
```

3. In `GameState`, after `resolutionQueue?: QueueItem[];`, add:

```ts
  // The pick a seat owes, if any. Absent (never null) when none, like the queue.
  pendingChoice?: PendingChoice;
```

In `projects/engine/src/lib/pipeline/actions.ts`, add `| { kind: 'ChooseOptionAction'; seatId: string; choiceId: string; optionId: string }` to `Action`, and `'ChooseOptionAction',` to `ACTION_KINDS`.

- [ ] **Step 4: Add the effects and the event**

In `projects/engine/src/lib/pipeline/effects.ts`:
- The first import becomes `import { GameState, Damage, PendingChoice, PendingResponse, Target, UsedCard, WuxieSubject } from '../domain/types';`.
- Add `import { nextInt } from '../rng/rng';`.
- Change the union's last member `| { kind: 'SkipNextEffect' };` to `| { kind: 'SkipNextEffect' }`, then append:

```ts
  // Asks `choice.seatId` to pick one option; the queue waits for the pick.
  | { kind: 'OpenChoiceEffect'; choice: PendingChoice }
  // Moves a random card (seeded) of `fromZoneId` to `toZoneId`: a pick from a
  // hand the chooser can't see. Nothing happens when the zone is empty.
  | { kind: 'MoveRandomCardEffect'; fromZoneId: string; toZoneId: string };
```

- In `applyEffect`, before `case 'DyingEffect':`, add:

```ts
    case 'OpenChoiceEffect':
      return { state: { ...state, pendingChoice: effect.choice }, events: [] };
    case 'MoveRandomCardEffect': {
      const from = state.zones.find((z) => z.id === effect.fromZoneId);
      if (!from) throw new Error(`Zone ${effect.fromZoneId} not found`);
      if (from.cards.length === 0) return { state, events: [] };
      const { value, rng } = nextInt(state.rng, from.cards.length);
      return applyEffect({ ...state, rng }, { kind: 'MoveCardEffect', cardInstanceId: from.cards[value].instanceId, toZoneId: effect.toZoneId });
    }
```

In `projects/engine/src/lib/pipeline/events.ts`:
- The import becomes `import { CardInstance, ChoiceOption, Damage, DecisionReason, Phase, Target } from '../domain/types';`.
- Before `export type EngineEvent`, add:

```ts
// A seat picked an option of a pending choice. `shows` is what the option
// showed, so a pick from a hidden hand never names the card.
export interface ChoiceMadeEvent {
  kind: 'ChoiceMadeEvent';
  seatId: string;
  reason: DecisionReason;
  verb: 'take' | 'discard';
  shows: ChoiceOption['shows'];
}
```

- Add `| ChoiceMadeEvent` to the `EngineEvent` union.

- [ ] **Step 5: Pause on a choice, and resolve the pick**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- The events import becomes `import { CardPlayedEvent, ChoiceMadeEvent, PhaseChangedEvent, TurnAdvancedEvent } from './events';`.
- In `advanceToDecision`, change `if (current.result || current.phase === 'GeneralSelection' || current.pendingResponse) break;` to:

```ts
    if (current.result || current.phase === 'GeneralSelection' || current.pendingResponse || current.pendingChoice) break;
```

- In `drain`, change the `while` condition to:

```ts
  while (!current.result && !current.pendingResponse && !current.pendingChoice && (current.resolutionQueue?.length ?? 0) > 0) {
```

- In `resolveAction`, as its first statement, add:

```ts
  if (state.pendingChoice && action.kind !== 'ChooseOptionAction') {
    throw new Error(`Action ${action.kind} is not legal while a choice is pending`);
  }
```

- Before `default:` in its `switch`, add:

```ts
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
```

In `projects/engine/src/lib/rules/activeSeat.ts`, change the `candidateId` line to:

```ts
  const candidateId = state.pendingChoice?.seatId ?? state.pendingResponse?.respondingSeatId ?? state.turn.ownerSeatId;
```

Also change the function's comment to mention the choice: "afterwards a pending chooser, then a pending responder, acts before the turn owner".

In `projects/engine/src/lib/rules/legality.ts`, insert this just before `if (state.pendingResponse) {`:

```ts
  if (state.pendingChoice) {
    const choice = state.pendingChoice;
    if (choice.seatId !== seatId) return [];
    return choice.options.map((o) => ({ kind: 'ChooseOptionAction' as const, seatId, choiceId: choice.id, optionId: o.id }));
  }
```

- [ ] **Step 6: Run the engine tests**

Run: `npx jest projects/engine`
Expected: PASS, including all 6 choice tests.

- [ ] **Step 7: Teach the sim and the app about the new action**

1. **Sim tests.** Append to `projects/sim/src/invariants.spec.ts`. It uses the file's existing `baseState()`.

```ts
describe('a pending choice', () => {
  const choiceFor = (seatId: string) => ({
    id: 'c', seatId, verb: 'take' as const, options: [],
    reason: { kind: 'choice' as const, card: { as: 'steal', colour: 'black' as const, physical: [] }, userSeatId: seatId },
  });

  it('counts as a decision, so a game may rest with items queued behind it', () => {
    const s = baseState();
    expect(checkRestingState({ ...s, resolutionQueue: [{ kind: 'SkipNextEffect' }], pendingChoice: choiceFor(s.seats[0].id) })).toEqual([]);
  });

  it('flags a pending choice for an eliminated seat', () => {
    const s = baseState();
    const out = { ...s, seats: s.seats.map((x, i) => (i === 1 ? { ...x, eliminated: true } : x)), pendingChoice: choiceFor(s.seats[1].id) };
    expect(checkInvariants(out)).toContain(`pendingChoice references eliminated seat ${s.seats[1].id}`);
  });
});
```

2. **Sim invariants.** In `projects/sim/src/invariants.ts`:
- In `checkRestingState`, change both `!state.pendingResponse` and `state.pendingResponse ||` so that a choice counts too:

```ts
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
```

- In `checkInvariants`, after the `if (state.pendingResponse) { ... }` block, add:

```ts
  if (state.pendingChoice) {
    const seat = state.seats.find((s) => s.id === state.pendingChoice!.seatId);
    if (!seat) violations.push(`pendingChoice references unknown seat ${state.pendingChoice.seatId}`);
    else if (seat.eliminated) violations.push(`pendingChoice references eliminated seat ${seat.id}`);
  }
```

3. **App label.** In `projects/app/src/app/labels.ts`, add to `actionLabel`'s switch:

```ts
    case 'ChooseOptionAction':
      return 'Choose';
```

4. **App action list.** In `projects/app/src/app/game-board/action-list.ts`:
- Add `action.kind === 'ChooseOptionAction' ||` to `isCardAction`.
- Extend its comment: "…responses (Pass included) in the Response dialog, and picks in the Choice dialog".
- Add this test to `action-list.spec.ts`, inside `describe('ActionList')`, in the file's style:

```ts
  it('leaves choice picks to the Choice dialog', () => {
    const fixture = TestBed.createComponent(ActionList);
    fixture.componentRef.setInput('actions', [{ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c', optionId: 'hand' }] as Action[]);
    fixture.componentRef.setInput('state', emptyState());
    fixture.componentRef.setInput('registry', emptyRegistry());
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(0);
  });
```

- [ ] **Step 8: Run the whole suite and the build**

Run: `npx jest`
Expected: PASS.

Run: `npm run build && npx ng build app`
Expected: success.

- [ ] **Step 9: Commit**

```bash
git add projects/engine projects/sim projects/app
git commit -m "feat(engine): a pending choice that pauses the queue, with seeded picks from a hidden hand

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The processing zone, Coerce's reason, and redacting hidden cards

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`, `domain/redact.ts`
- Modify tests: `pipeline/effects.spec.ts`, `pipeline/queue.spec.ts`, `domain/redact.spec.ts`
- Modify: `docs/architecture/event-chain.md`

**Interfaces:**
- Consumes: `PendingChoice` (Task 1).
- Produces:
  - `CardZone.kind` gains `'processing'`, a face-up zone.
  - The effects `{ kind: 'RevealToProcessingEffect'; count: number }` and `{ kind: 'DiscardZoneEffect'; zoneId: string }`.
  - The event `CardsTurnedUpEvent { kind; zoneId; cards: CardInstance[] }`.
  - The `card-effect` reason gains `victimSeatId?: string`.
  - Answering a `card-effect` window records `inResponseTo: { seatId: userSeatId, cardInstanceId: <the Tool's card> }`.
  - `redactStateForSeat` masks any hidden card mentioned in `resolutionQueue`, `pendingResponse` or `pendingChoice`.

- [ ] **Step 1: Write the failing tests**

1. Append to `projects/engine/src/lib/pipeline/effects.spec.ts`. It uses the file's `state()` and `card()`.

```ts
describe('the processing zone', () => {
  const withProcessing = (s: GameState): GameState => ({ ...s, zones: [...s.zones, { id: 'processing', kind: 'processing', cards: [] }] });

  it('RevealToProcessingEffect turns cards up from the draw pile, face up for all to see', () => {
    const { state: next, events } = applyEffect(withProcessing(state([card('c1'), card('c2'), card('c3')], [])), { kind: 'RevealToProcessingEffect', count: 2 });
    expect(next.zones.find((z) => z.id === 'processing')!.cards).toEqual([card('c1'), card('c2')]);
    expect(events).toEqual([{ kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [card('c1'), card('c2')] }]);
  });

  it('DiscardZoneEffect moves every card in the zone to the discard pile, in order', () => {
    const turnedUp = applyEffect(withProcessing(state([card('c1'), card('c2')], [])), { kind: 'RevealToProcessingEffect', count: 2 }).state;
    const { state: next, events } = applyEffect(turnedUp, { kind: 'DiscardZoneEffect', zoneId: 'processing' });
    expect(next.zones.find((z) => z.id === 'processing')!.cards).toEqual([]);
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards).toEqual([card('c1'), card('c2')]);
    expect(events.map((e) => e.kind)).toEqual(['CardMovedEvent', 'CardMovedEvent']);
  });
});
```

2. Append to `projects/engine/src/lib/pipeline/queue.spec.ts`. It uses the file's `state()`, `registry()`, `cardThat()`, `mode()` and `play()`.

```ts
describe('answering a card-effect window', () => {
  it('records the seat and card it answered, from the window’s reason', () => {
    const demand: Effect = {
      kind: 'OpenResponseEffect',
      pendingResponse: {
        id: 'w2', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['answer'],
        reason: {
          kind: 'card-effect', userSeatId: 'seat-a', victimSeatId: 'seat-a',
          card: { as: 'demand', colour: 'black', suit: 'spade', rank: 1, physical: [{ instanceId: 'played', definitionId: 'demand', suit: 'spade', rank: 1 }] },
        },
        context: { effect: { kind: 'MoveCardEffect', cardInstanceId: 'd1', toZoneId: 'seat-a:hand' } },
      },
    };
    const ctx = { registry: registry(cardThat('demand', [demand]), cardThat('answer', [])), mode: mode() };
    const s = state('demand');
    const withAnswer = {
      ...s,
      zones: s.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [{ instanceId: 'ans', definitionId: 'answer', suit: 'heart' as const, rank: 2 }] } : z)),
    };
    const answered = resolve(play(withAnswer, ctx), { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'w2', cardInstanceId: 'ans' }, ctx).state;
    expect(answered.log.find((e) => e.kind === 'CardPlayedEvent' && e.seatId === 'seat-b')).toMatchObject({ inResponseTo: { seatId: 'seat-a', cardInstanceId: 'played' } });
    expect(answered.zones.find((z) => z.id === 'seat-a:hand')!.cards).toEqual([]); // the held-back move was cancelled
  });
});
```

3. Append to `projects/engine/src/lib/domain/redact.spec.ts`. Add `GameState` to its engine-types import if it isn't there.

```ts
describe('redactStateForSeat: hidden cards in the queue and pending decisions (Review Focus 3)', () => {
  const secret = { instanceId: 'b-secret', definitionId: 'peach', suit: 'heart' as const, rank: 3 };
  const used = { as: 'mystery', colour: 'red' as const, physical: [secret] };
  const leaky: GameState = {
    seats: [], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [secret] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    resolutionQueue: [{ kind: 'ToolRuleEffect', tool: used, userSeatId: 'b', target: { kind: 'seat', seatId: 'b' } }],
    pendingChoice: {
      id: 'c', seatId: 'a', verb: 'take', reason: { kind: 'choice', card: used, userSeatId: 'b' },
      options: [{ id: 'x', shows: { kind: 'card', card: secret }, effects: [] }],
    },
  };

  it('masks another seat’s hand card wherever the queue or a pending choice mentions it', () => {
    const forA = redactStateForSeat(leaky, 'a');
    expect(JSON.stringify(forA.resolutionQueue)).not.toContain('"definitionId":"peach"');
    expect(forA.pendingChoice!.options[0].shows).toEqual({ kind: 'card', card: { instanceId: 'b-secret', definitionId: 'hidden', suit: 'spade', rank: 0 } });
  });

  it('leaves the card visible to its owner', () => {
    const forB = redactStateForSeat(leaky, 'b');
    expect(forB.resolutionQueue).toEqual(leaky.resolutionQueue);
    expect(forB.pendingChoice).toEqual(leaky.pendingChoice);
  });
});
```

Run: `npx jest projects/engine`
Expected: FAIL. The new effect kinds, the `processing` zone kind and `victimSeatId` don't compile yet.

- [ ] **Step 2: Add the zone kind, the reason field, the effects and the event**

In `projects/engine/src/lib/domain/types.ts`:
- `CardZone.kind` becomes `'hand' | 'equip' | 'drawPile' | 'discardPile' | 'judgment' | 'processing';`.
- The `card-effect` member and its comment become:

```ts
  // A card's own demand, e.g. Barbarians: play a Sha or take 1 damage. For
  // Coerce, `victimSeatId` is the seat the Sha must be played at.
  | { kind: 'card-effect'; card: UsedCard; userSeatId: string; victimSeatId?: string }
```

In `projects/engine/src/lib/pipeline/effects.ts`, change the union's last member `| { kind: 'MoveRandomCardEffect'; fromZoneId: string; toZoneId: string };` to end without the `;`, then append:

```ts
  // Turns `count` cards from the draw pile face up into the processing zone
  // (Harvest), shuffling the discard pile in first when the draw pile is short.
  | { kind: 'RevealToProcessingEffect'; count: number }
  // Moves every card in `zoneId` to the discard pile, in order.
  | { kind: 'DiscardZoneEffect'; zoneId: string };
```

In `applyEffect`, before `case 'DyingEffect':`, add:

```ts
    case 'RevealToProcessingEffect': {
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const processing = requireZoneOfKind(state.zones, 'processing');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, processing.id, effect.count, state.rng);
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'CardsTurnedUpEvent', zoneId: processing.id, cards: drawn },
      ];
      return { state: { ...state, zones, rng, log: [...state.log, ...events] }, events };
    }
    case 'DiscardZoneEffect': {
      const zone = state.zones.find((z) => z.id === effect.zoneId);
      if (!zone) throw new Error(`Zone ${effect.zoneId} not found`);
      const discardPile = requireZoneOfKind(state.zones, 'discardPile');
      let current = state;
      const events: EngineEvent[] = [];
      for (const card of zone.cards) {
        const moved = applyEffect(current, { kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: discardPile.id });
        current = moved.state;
        events.push(...moved.events);
      }
      return { state: current, events };
    }
```

In `projects/engine/src/lib/pipeline/events.ts`, before `ChoiceMadeEvent`, add:

```ts
// Cards turned face up from the draw pile into `zoneId` (Harvest's cards).
export interface CardsTurnedUpEvent {
  kind: 'CardsTurnedUpEvent';
  zoneId: string;
  cards: CardInstance[];
}
```

and add `| CardsTurnedUpEvent` to `EngineEvent`.

- [ ] **Step 3: Record what a card-effect answer answered**

In `projects/engine/src/lib/pipeline/resolve.ts`, in the `RespondAction` case, the `inResponseTo` expression gets one more branch before its final fallback:

```ts
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
```

For Barbarians and Hail of Arrows this gives the same values as before, because their held-back damage comes from the user and is caused by the Tool's card.

- [ ] **Step 4: Mask hidden cards wherever the state mentions them**

In `projects/engine/src/lib/domain/redact.ts`:

1. Add after `redactZone`:

```ts
// The instance ids `viewerSeatId` can't see where they lie: other seats'
// hands and the draw pile.
function hiddenInstanceIds(state: GameState, viewerSeatId: string): ReadonlySet<string> {
  return new Set(
    state.zones
      .filter((z) => !isFaceUpZoneKind(z.kind) && !(z.kind === 'hand' && z.ownerSeatId === viewerSeatId))
      .flatMap((z) => z.cards.map((c) => c.instanceId))
  );
}

function isCardInstance(value: object): value is CardInstance {
  const v = value as Partial<CardInstance>;
  return typeof v.instanceId === 'string' && typeof v.definitionId === 'string' && typeof v.suit === 'string' && typeof v.rank === 'number';
}

// Masks every hidden card instance anywhere inside `value` (queued effects, a
// pending response or choice), the same way its zone masks it.
function maskHiddenCards<T>(value: T, hidden: ReadonlySet<string>): T {
  if (Array.isArray(value)) return value.map((v) => maskHiddenCards(v, hidden)) as T;
  if (value === null || typeof value !== 'object') return value;
  if (isCardInstance(value)) return (hidden.has(value.instanceId) ? maskCard(value) : value) as T;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskHiddenCards(v, hidden)])) as T;
}
```

2. `redactStateForSeat` becomes:

```ts
export function redactStateForSeat(state: GameState, viewerSeatId: string): GameState {
  const hidden = hiddenInstanceIds(state, viewerSeatId);
  return {
    ...state,
    seats: state.seats.map((seat) => redactSeat(seat, viewerSeatId)),
    zones: state.zones.map((zone) => redactZone(zone, viewerSeatId)),
    generalSelection: redactSelection(state.generalSelection, viewerSeatId),
    pendingResponse: maskHiddenCards(state.pendingResponse, hidden),
    ...(state.pendingChoice ? { pendingChoice: maskHiddenCards(state.pendingChoice, hidden) } : {}),
    ...(state.resolutionQueue ? { resolutionQueue: maskHiddenCards(state.resolutionQueue, hidden) } : {}),
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx jest projects/engine`
Expected: PASS.

Run: `npx jest`
Expected: PASS.

- [ ] **Step 6: Document choices in the event chain**

In `docs/architecture/event-chain.md`:

1. Add this section after "The Tool lifecycle", before "Plugging into the chain":

```markdown
## Choices

Some Tools ask a seat to pick one of several things: Steal and Break pick one
of a seat's cards, and Harvest picks one of the turned-up cards. A pick is a
**pending choice**, and the queue waits for it the way it waits for a response:

- `OpenChoiceEffect` stores a `PendingChoice` in `state.pendingChoice`: who
  picks, why (its `reason`), whether the card is taken or discarded (`verb`),
  and the options. Each option says what it shows and which effects it queues.
- While a choice is pending, the chooser is the active seat and its only legal
  actions are one `ChooseOptionAction` per option.
- `ChooseOptionAction` logs `ChoiceMadeEvent` and queues the option's effects
  at the front. The queue then carries on.
- **A hand is never shown.** It is a single `hidden-hand` option with only its
  size. Its effect, `MoveRandomCardEffect`, picks a card with the seeded RNG.
- **Harvest's cards** are turned up into the face-up `processing` zone
  (`RevealToProcessingEffect`). Whatever no seat took is discarded at the end
  (`DiscardZoneEffect`).

Redaction masks any card a viewer can't see wherever it appears in the queue
or a pending decision, so a choice can't leak a hand card.
```

2. In the "Plugging into the chain" table, add a row after the Tool row:

```markdown
| A pick among cards or options | `OpenChoiceEffect` with options whose `effects` say what each pick does | Steal offers the target's hand (face down) and each worn card |
```

3. In the pipeline diagram, change `stop when a response is pending, the queue is empty, or the game is over` to `stop when a response or choice is pending, the queue is empty, or the game is over`.

- [ ] **Step 7: Commit**

```bash
git add projects/engine docs/architecture/event-chain.md
git commit -m "feat(engine): the processing zone, Coerce's victim, and redaction of hidden cards in the queue and pending decisions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Steal and Break

**Files:**
- Create: `projects/content/src/lib/shared/choices.ts`, `projects/content/src/lib/cards/steal.ts`, `projects/content/src/lib/cards/break.ts`
- Modify: `projects/content/src/lib/registry.ts`, `cards/tools.spec.ts`, `registry.spec.ts`, `wiki.spec.ts`, `modes/guozhan.spec.ts`
- Modify: `projects/app/src/app/wiki/wiki-pages.spec.ts`, `projects/app/src/app/game-board/game-board.spec.ts`, `projects/app/src/app/decision-timer.service.spec.ts`

**Interfaces:**
- Consumes: `PendingChoice`, `OpenChoiceEffect` and `MoveRandomCardEffect` (Task 1). `toolOnTargets` (stage 1).
- Produces:
  - `seatCardOptions(state, ownerSeatId, toZoneId): ChoiceOption[]`
  - `holdsAnyCard(state, seatId): boolean`
  - `pickACardTool({ id, name, verb, maxDistance? }): CardDefinition`
  - `stealCard` and `breakCard`
  - The test helpers `withEquip`, `aimedTargets`, `pickOption` and `idsIn` at the top level of `tools.spec.ts`.

- [ ] **Step 1: Write the failing tests**

In `projects/content/src/lib/cards/tools.spec.ts`:

1. Add imports:

```ts
import { stealCard } from './steal';
import { breakCard } from './break';
import { getLegalActions, redactStateForSeat } from 'engine';
import type { Target } from 'engine';
```

Merge `getLegalActions` and `redactStateForSeat` into the existing `import { resolve } from 'engine';` line, and `Target` into the existing `import type` line.

2. Add `stealCard, breakCard` to the `cards` array in `registry()`.

3. After `function fourSeats(...)`, add these top-level helpers:

```ts
const withEquip = (s: GameState, seatId: string, [definitionId, instanceId]: [string, string]): GameState => ({
  ...s,
  zones: s.zones.map((z) => (z.id === `${seatId}:equip` ? { ...z, cards: [...z.cards, { instanceId, definitionId, suit: 'spade' as const, rank: 5 }] } : z)),
});
// The target lists the engine offers for seat a's card 'tool'.
const aimedTargets = (s: GameState): Target[][] =>
  getLegalActions(s, 'a', registry())
    .filter((x): x is Extract<typeof x, { kind: 'PlayCardAction' }> => x.kind === 'PlayCardAction' && x.cardInstanceId === 'tool')
    .map((x) => x.targets);
const pickOption = (s: GameState, optionId: string): GameState =>
  resolve(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId }, { registry: registry(), mode: stubMode() }).state;
const idsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
```

4. Append this block before `describe('Equipment'`:

```ts
describe('Steal and Break', () => {
  const ctx = () => ({ registry: registry(), mode: stubMode() });
  const aim = (s: GameState, seatId: string) =>
    resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [{ kind: 'seat', seatId }] }, ctx()).state;
  const answer = (s: GameState, cardInstanceId: string) =>
    resolve(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx()).state;
  const seat = (seatId: string): Target => ({ kind: 'seat', seatId });

  it('Steal targets only seats at distance 1 that hold a card', () => {
    // a's neighbours are b and d; c is 2 away. d holds nothing.
    expect(aimedTargets(fourSeats('steal', { b: [['shan', 'b-1']], c: [['shan', 'c-1']] }))).toEqual([[seat('b')]]);
  });

  it('Break targets any other seat that holds a card, at any distance', () => {
    expect(aimedTargets(fourSeats('break', { b: [['shan', 'b-1']], c: [['shan', 'c-1']] }))).toEqual([[seat('b')], [seat('c')]]);
  });

  it('Steal: the user picks the hand (face down) or a worn card (face up), and takes it', () => {
    const s = aim(withEquip(fourSeats('steal', { b: [['shan', 'b-1'], ['shan', 'b-2']] }), 'b', ['silver-lion', 'b-lion']), 'b');
    expect(s.pendingChoice).toMatchObject({
      seatId: 'a', verb: 'take', reason: { kind: 'choice', userSeatId: 'a', targetSeatId: 'b', card: { as: 'steal' } },
      options: [
        { id: 'hand', shows: { kind: 'hidden-hand', seatId: 'b', count: 2 } },
        { id: 'b-lion', shows: { kind: 'card', card: { instanceId: 'b-lion', definitionId: 'silver-lion' } } },
      ],
    });
    const taken = pickOption(s, 'b-lion');
    expect(idsIn(taken, 'a:hand')).toEqual(['b-lion']);
    expect(idsIn(taken, 'b:equip')).toEqual([]);
    expect(taken.pendingChoice).toBeUndefined();
  });

  it('Steal from the hand takes one card at random, the same one for the same seed', () => {
    const s = aim(fourSeats('steal', { b: [['shan', 'b-1'], ['shan', 'b-2'], ['shan', 'b-3']] }), 'b');
    const taken = pickOption(s, 'hand');
    expect(idsIn(taken, 'a:hand')).toHaveLength(1);
    expect(idsIn(taken, 'b:hand')).toHaveLength(2);
    expect(idsIn(pickOption(s, 'hand'), 'a:hand')).toEqual(idsIn(taken, 'a:hand'));
  });

  it('Break: the picked card goes to the discard pile', () => {
    const s = aim(withEquip(fourSeats('break', { c: [['shan', 'c-1']] }), 'c', ['silver-lion', 'c-lion']), 'c');
    expect(s.pendingChoice).toMatchObject({ seatId: 'a', verb: 'discard', reason: { targetSeatId: 'c' } });
    const broken = pickOption(s, 'c-lion');
    expect(idsIn(broken, 'discardPile')).toContain('c-lion');
    expect(idsIn(broken, 'a:hand')).toEqual([]);
  });

  it('opens no choice when the target has nothing left by the time Steal takes effect (Review Focus 1)', () => {
    // b's only card is a Wuxie: b cancels the Steal on itself, d cancels b's Wuxie, so the Steal goes ahead on an empty b.
    let s = aim(fourSeats('steal', { b: [['wuxie', 'b-wx']], d: [['wuxie', 'd-wx']] }), 'b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie' } });
    s = answer(s, 'b-wx');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd', reason: { kind: 'counter-wuxie' } });
    s = answer(s, 'd-wx');
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toBeNull();
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('a game paused on a Steal survives a JSON round trip, and no one else sees the hand (Review Focus 3)', () => {
    const s = aim(fourSeats('steal', { b: [['shan', 'b-1'], ['shan', 'b-2']] }), 'b');
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(pickOption(copy, 'hand')).toEqual(pickOption(s, 'hand'));
    for (const viewer of ['a', 'c']) {
      const seen = JSON.stringify(redactStateForSeat(s, viewer).pendingChoice);
      expect(seen).not.toContain('b-1');
      expect(seen).not.toContain('shan');
    }
  });
});
```

5. Run: `npx jest projects/content/src/lib/cards/tools.spec.ts`
Expected: FAIL with "Cannot find module './steal'".

- [ ] **Step 2: Write the shared choice builder**

Create `projects/content/src/lib/shared/choices.ts`:

```ts
import type { CardDefinition, ChoiceOption, GameState, PendingChoice } from 'engine';
import { requireZoneOfKind } from 'engine';
import { otherLivingSeatTargets, seatDistance } from './queries';
import { toolOnTargets } from './tools';

const PICKABLE_ZONE_KINDS = ['hand', 'equip', 'judgment'];

// Whether `seatId` holds a card Steal or Break could pick: in hand, worn, or
// in its judgment area.
export function holdsAnyCard(state: GameState, seatId: string): boolean {
  return state.zones.some((z) => z.ownerSeatId === seatId && PICKABLE_ZONE_KINDS.includes(z.kind) && z.cards.length > 0);
}

// One option per thing of `ownerSeatId`'s that may be picked: the hand as a
// single face-down option (its card is picked at random), then each worn and
// judgment card face up. Each option moves its card to `toZoneId`.
export function seatCardOptions(state: GameState, ownerSeatId: string, toZoneId: string): ChoiceOption[] {
  const owned = (kind: string) => state.zones.filter((z) => z.ownerSeatId === ownerSeatId && z.kind === kind);
  const options: ChoiceOption[] = [];
  for (const hand of owned('hand')) {
    if (hand.cards.length === 0) continue;
    options.push({
      id: 'hand',
      shows: { kind: 'hidden-hand', seatId: ownerSeatId, count: hand.cards.length },
      effects: [{ kind: 'MoveRandomCardEffect', fromZoneId: hand.id, toZoneId }],
    });
  }
  for (const zone of [...owned('equip'), ...owned('judgment')]) {
    for (const card of zone.cards) {
      options.push({ id: card.instanceId, shows: { kind: 'card', card }, effects: [{ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId }] });
    }
  }
  return options;
}

interface PickACardToolSpec {
  id: string;
  name: string;
  verb: 'take' | 'discard';
  // Steal's reach (horses counted); absent = any distance.
  maxDistance?: number;
}

// Steal and Break: target another living seat holding a card (within
// `maxDistance` when set). Once the Tool takes effect, the user picks one of
// its cards: taken into the user's hand, or discarded.
export function pickACardTool({ id, name, verb, maxDistance }: PickACardToolSpec): CardDefinition {
  return {
    id,
    name,
    category: 'tool',
    legalPlayTargets: (state, ctx, registry) =>
      otherLivingSeatTargets(state, ctx.seatId).filter(
        ([target]) =>
          target.kind === 'seat' &&
          holdsAnyCard(state, target.seatId) &&
          (maxDistance === undefined || seatDistance(state, ctx.seatId, target.seatId, registry) <= maxDistance)
      ),
    play: (state, ctx) => (ctx.respondingTo || ctx.targets.length === 0 ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, [ctx.targets[0]])),
    onTarget: (state, { tool, userSeatId, target }) => {
      const user = state.seats.find((s) => s.id === userSeatId);
      if (target.kind !== 'seat' || !user) return [];
      const toZoneId = verb === 'take' ? user.hand.zoneId : requireZoneOfKind(state.zones, 'discardPile').id;
      const options = seatCardOptions(state, target.seatId, toZoneId);
      if (options.length === 0) return []; // nothing left to pick
      const choice: PendingChoice = {
        id: `${id}-${tool.physical[0]?.instanceId ?? 'virtual'}-${target.seatId}-${state.log.length}`,
        seatId: userSeatId,
        reason: { kind: 'choice', card: tool, userSeatId, targetSeatId: target.seatId },
        verb,
        options,
      };
      return [{ kind: 'OpenChoiceEffect', choice }];
    },
  };
}
```

- [ ] **Step 3: Write Steal and Break**

Create `projects/content/src/lib/cards/steal.ts`:

```ts
import { pickACardTool } from '../shared/choices';

// Steal: another seat at distance 1 holding a card; the user takes one of its cards.
export const stealCard = pickACardTool({ id: 'steal', name: 'Steal', verb: 'take', maxDistance: 1 });
```

Create `projects/content/src/lib/cards/break.ts`:

```ts
import { pickACardTool } from '../shared/choices';

// Break: any other seat holding a card; the user discards one of its cards.
export const breakCard = pickACardTool({ id: 'break', name: 'Break', verb: 'discard' });
```

- [ ] **Step 4: Register them and update the card counts**

- **`registry.ts`:** import `stealCard` and `breakCard`, and add them to the `cards` array after `peachGardenCard`.
- **`registry.spec.ts`:** the test becomes `'registers the thirteen playable cards'`, and its list gains `'break'` and `'steal'`.
- **`wiki.spec.ts`:** the `inGame` expectation becomes `['barbarians', 'break', 'draw-two', 'duel', 'hail-of-arrows', 'peach-garden', 'steal', 'wuxie']`. The list is sorted by display name; match the order the test actually receives.
- **`modes/guozhan.spec.ts`:** `toHaveLength(70)` becomes `toHaveLength(81)` (70 + Steal 5 + Break 6).
- **`projects/app/src/app/wiki/wiki-pages.spec.ts`:** `'15 cards · 6 in the game'` becomes `'15 cards · 8 in the game'`.

- [ ] **Step 5: Keep the app's seed searches on Sha and Duel**

Three app tests search seeds for "a targeted play" and expect it to open a response window. A Steal or Break now opens a choice instead.
- In `projects/app/src/app/game-board/game-board.spec.ts`, line 233.
- In `projects/app/src/app/decision-timer.service.spec.ts`, lines 79 and 130.

In each, add `&& ['sha', 'duel'].includes(cardDefinitionId(<state>, a.cardInstanceId) ?? '')` to the `find` predicate. `<state>` is `gameService.state()!` in the board spec and `game.state()!` in the timer spec. Import `cardDefinitionId` from `'../labels'` in the board spec and from `'./labels'` in the timer spec.

- [ ] **Step 6: Run the tests**

Run: `npx jest projects/content`
Expected: PASS.

Run: `npx jest`
Expected: PASS. The sim's random bots now play Steal and Break in every seat count. Any invariant failure is a real bug, so debug it with superpowers:systematic-debugging.

- [ ] **Step 7: Commit**

```bash
git add projects/content projects/app
git commit -m "feat(content): Steal and Break — pick a card from another seat, the hand face down

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Harvest and Coerce

**Files:**
- Create: `projects/content/src/lib/cards/harvest.ts`, `projects/content/src/lib/cards/coerce.ts`
- Modify: `projects/content/src/lib/cards/sha.ts`, `shared/tools.ts`, `modes/guozhan.ts`, `registry.ts`
- Modify tests: `cards/tools.spec.ts`, `registry.spec.ts`, `wiki.spec.ts`, `modes/guozhan.spec.ts`, `projects/app/src/app/wiki/wiki-pages.spec.ts`

**Interfaces:**
- Consumes:
  - `RevealToProcessingEffect`, `DiscardZoneEffect`, `victimSeatId` and the `processing` zone kind (Task 2).
  - The tools.spec helpers (Task 3).
- Produces:
  - `harvestCard` and `coerceCard`.
  - `shaWindow(shaInstanceId, fromSeatId, target): Effect`.
  - `toolOnTargets(state, userSeatId, cardInstanceId, targets, extra?)`.
  - Guozhan sets up `{ id: 'processing', kind: 'processing', cards: [] }`.

- [ ] **Step 1: Write the failing tests**

In `projects/content/src/lib/cards/tools.spec.ts`:

1. Import `harvestCard` from `'./harvest'` and `coerceCard` from `'./coerce'`, and add them to `registry()`'s `cards`.
2. In `fourSeats`, add `{ id: 'processing', kind: 'processing', cards: [] },` after the discard pile zone.
3. Append before `describe('Equipment'`:

```ts
describe('Harvest and Coerce', () => {
  const ctx = () => ({ registry: registry(), mode: stubMode() });
  const use = (s: GameState) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [] }, ctx()).state;
  const coerce = (s: GameState, holder: string, victim: string) =>
    resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [{ kind: 'seat', seatId: holder }, { kind: 'seat', seatId: victim }] }, ctx()).state;
  const answer = (s: GameState, cardInstanceId: string) =>
    resolve(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx()).state;
  const pass = (s: GameState) =>
    resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx()).state;
  const pickFirst = (s: GameState) => pickOption(s, s.pendingChoice!.options[0].id);
  const hps = (s: GameState) => s.seats.map((x) => x.combinedHp);
  const seat = (seatId: string): Target => ({ kind: 'seat', seatId });
  const armed = (hands: Record<string, [string, string][]> = {}) => withEquip(fourSeats('coerce', hands), 'c', ['green-dragon-blade', 'c-blade']);

  it('Harvest turns up one card per living seat, and each seat from the user takes one in turn', () => {
    let s = use(fourSeats('harvest'));
    expect(idsIn(s, 'processing')).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(s.pendingChoice).toMatchObject({ seatId: 'a', verb: 'take', reason: { kind: 'choice', userSeatId: 'a', card: { as: 'harvest' } } });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['d1', 'd2', 'd3', 'd4']);
    s = pickOption(s, 'd3');
    expect(s.pendingChoice).toMatchObject({ seatId: 'b' });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['d1', 'd2', 'd4']);
    s = pickOption(s, 'd1');
    s = pickOption(s, 'd2');
    expect(s.pendingChoice).toMatchObject({ seatId: 'd' });
    s = pickOption(s, 'd4');
    expect(['a', 'b', 'c', 'd'].map((id) => idsIn(s, `${id}:hand`))).toEqual([['d3'], ['d1'], ['d2'], ['d4']]);
    expect(idsIn(s, 'processing')).toEqual([]);
    expect(s.pendingChoice).toBeUndefined();
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('Harvest: a seat whose pick is cancelled takes nothing, and the leftover is discarded', () => {
    // c holds a Wuxie Kongjie: it lets a's pick through, then cancels b's.
    let s = use(fourSeats('harvest', { c: [['wuxie', 'c-wx']] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: seat('a') } });
    s = pass(s);
    s = pickOption(s, 'd1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: seat('b') } });
    s = answer(s, 'c-wx');
    expect(s.pendingChoice).toMatchObject({ seatId: 'c' });
    s = pickOption(s, 'd2');
    s = pickOption(s, 'd3');
    expect(idsIn(s, 'b:hand')).toEqual([]);
    expect(idsIn(s, 'processing')).toEqual([]);
    expect(idsIn(s, 'discardPile')).toEqual(expect.arrayContaining(['tool', 'c-wx', 'd4']));
  });

  it('Harvest with too few cards to go round: the later seats get no pick (Review Focus 2)', () => {
    const start = fourSeats('harvest');
    const short = { ...start, zones: start.zones.map((z) => (z.kind === 'drawPile' ? { ...z, cards: z.cards.slice(0, 2) } : z)) };
    // Two cards left, plus the discard pile (Harvest itself) shuffled in: three cards for four seats.
    let s = use(short);
    expect(idsIn(s, 'processing')).toHaveLength(3);
    s = pickFirst(pickFirst(pickFirst(s)));
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toBeNull();
    expect(idsIn(s, 'd:hand')).toEqual([]);
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('Coerce pairs each other seat wearing a weapon with every seat it can reach, the user included', () => {
    expect(aimedTargets(armed())).toEqual([
      [seat('c'), seat('a')],
      [seat('c'), seat('b')],
      [seat('c'), seat('d')],
    ]);
    expect(aimedTargets(fourSeats('coerce'))).toEqual([]);
  });

  it('Coerce: a holder who plays no Sha hands its weapon to the user', () => {
    const s = coerce(armed({ c: [['sha', 'c-sha']] }), 'c', 'b');
    expect(s.pendingResponse).toMatchObject({
      respondingSeatId: 'c', allowedCardIds: ['sha'],
      reason: { kind: 'card-effect', userSeatId: 'a', victimSeatId: 'b', card: { as: 'coerce' } },
    });
    const after = pass(s);
    expect(idsIn(after, 'a:hand')).toEqual(['c-blade']);
    expect(idsIn(after, 'c:equip')).toEqual([]);
  });

  it('Coerce: the holder’s Sha is answered like any Sha, and the holder keeps its weapon', () => {
    let s = answer(coerce(armed({ c: [['sha', 'c-sha']] }), 'c', 'b'), 'c-sha');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', allowedCardIds: ['shan'] });
    s = pass(s);
    expect(hps(s)).toEqual([3, 2, 3, 3]);
    expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: seat('c'), target: seat('b') } });
    expect(idsIn(s, 'c:equip')).toEqual(['c-blade']);
    expect(s.turn.cardPlays?.['sha'] ?? 0).toBe(0);
  });

  it('Coerce can make the holder attack the user (Review Focus 5)', () => {
    let s = answer(coerce(armed({ c: [['sha', 'c-sha']] }), 'c', 'a'), 'c-sha');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'a', allowedCardIds: ['shan'] });
    s = pass(s);
    expect(hps(s)[0]).toBe(2);
  });
});
```

4. In `projects/content/src/lib/modes/guozhan.spec.ts`:
- Change `toHaveLength(81)` to `toHaveLength(85)`.
- Add this test to the file's setup `describe`:

```ts
  it('sets up an empty processing zone for Harvest', () => {
    const state = createGame(guozhanMode, buildContentRegistry(), ['seat-0', 'seat-1'], 1);
    expect(state.zones.find((z) => z.kind === 'processing')).toEqual({ id: 'processing', kind: 'processing', cards: [] });
  });
```

5. Run: `npx jest projects/content`
Expected: FAIL with "Cannot find module './harvest'".

- [ ] **Step 2: Share the Sha window, and let Tools carry an extra target**

In `projects/content/src/lib/cards/sha.ts`, replace the whole file with:

```ts
import type { CardDefinition, Effect, Target } from 'engine';
import { attackRange, otherLivingSeatTargets, seatDistance, shaLimit } from '../shared/queries';

// The window a Sha opens: `target` plays a Shan or takes 1 damage from
// `fromSeatId`. Shared with Coerce, whose Sha is played as an answer.
export function shaWindow(shaInstanceId: string, fromSeatId: string, target: Target): Effect {
  return {
    kind: 'OpenResponseEffect',
    pendingResponse: {
      id: `sha-response-${shaInstanceId}`,
      respondingSeatId: target.seatId,
      allowedActionKinds: ['RespondAction', 'PassAction'],
      allowedCardIds: ['shan'],
      context: {
        effect: {
          kind: 'DamageEffect',
          damage: { source: { kind: 'seat', seatId: fromSeatId }, target, amount: 1, nature: 'normal', cause: { cardInstanceId: shaInstanceId } },
        },
      },
    },
  };
}

export const shaCard: CardDefinition = {
  id: 'sha',
  name: 'Sha',
  category: 'basic',
  legalPlayTargets: (state, ctx, registry) => {
    if ((state.turn.cardPlays?.['sha'] ?? 0) >= shaLimit(state, ctx.seatId, registry)) return [];
    const range = attackRange(state, ctx.seatId, registry);
    return otherLivingSeatTargets(state, ctx.seatId).filter(
      ([target]) => target.kind === 'seat' && seatDistance(state, ctx.seatId, target.seatId, registry) <= range
    );
  },
  play: (_state, ctx) => {
    if (ctx.respondingTo) return []; // played as an answer (a Duel, Barbarians, Coerce) — the window decides what it does
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    return [shaWindow(ctx.cardInstanceId, ctx.seatId, ctx.targets[0])];
  },
};
```

In `projects/content/src/lib/shared/tools.ts`, `toolOnTargets` becomes:

```ts
// One ToolOnTargetEffect per target, in the order given, for the Tool card
// `cardInstanceId` that `userSeatId` is playing. `extra` rides along with each
// (Coerce's victim).
export function toolOnTargets(state: GameState, userSeatId: string, cardInstanceId: string, targets: Target[], extra?: Target[]): Effect[] {
  const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === cardInstanceId);
  if (!card) throw new Error(`Tool card ${cardInstanceId} is in no zone`);
  const tool = usedCardOf(card);
  return targets.map((target) => ({ kind: 'ToolOnTargetEffect', tool, userSeatId, target, ...(extra ? { extra } : {}), counterCardIds: COUNTER_CARD_IDS }));
}
```

- [ ] **Step 3: Write Harvest**

Create `projects/content/src/lib/cards/harvest.ts`:

```ts
import type { CardDefinition, PendingChoice } from 'engine';
import { livingSeatOrderFrom, requireZoneOfKind } from 'engine';
import { toolOnTargets } from '../shared/tools';

// Harvest: one card per living seat is turned face up. Then each living seat,
// starting with the user, takes one of them; each pick has its own Wuxie
// check. Whatever is left goes to the discard pile.
export const harvestCard: CardDefinition = {
  id: 'harvest',
  name: 'Harvest',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) => {
    if (ctx.respondingTo) return [];
    const order = livingSeatOrderFrom(state, ctx.seatId);
    const processing = requireZoneOfKind(state.zones, 'processing');
    return [
      { kind: 'RevealToProcessingEffect', count: order.length },
      ...toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, order.map((seatId) => ({ kind: 'seat' as const, seatId }))),
      { kind: 'DiscardZoneEffect', zoneId: processing.id },
    ];
  },
  onTarget: (state, { tool, userSeatId, target }) => {
    const seat = state.seats.find((s) => target.kind === 'seat' && s.id === target.seatId);
    const cards = requireZoneOfKind(state.zones, 'processing').cards;
    if (!seat || cards.length === 0) return []; // nothing left to take
    const choice: PendingChoice = {
      id: `harvest-${tool.physical[0]?.instanceId ?? 'virtual'}-${seat.id}-${state.log.length}`,
      seatId: seat.id,
      reason: { kind: 'choice', card: tool, userSeatId },
      verb: 'take',
      options: cards.map((card) => ({
        id: card.instanceId,
        shows: { kind: 'card', card },
        effects: [{ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: seat.hand.zoneId }],
      })),
    };
    return [{ kind: 'OpenChoiceEffect', choice }];
  },
};
```

- [ ] **Step 4: Write Coerce**

Create `projects/content/src/lib/cards/coerce.ts`:

```ts
import type { CardDefinition, Effect, Target } from 'engine';
import { attackRange, seatDistance } from '../shared/queries';
import { toolOnTargets } from '../shared/tools';
import { equipSlotOf } from './equipment';
import { shaWindow } from './sha';

const seat = (seatId: string): Target => ({ kind: 'seat', seatId });

// Coerce: another living seat wearing a weapon (the holder) and a victim, a
// living seat other than the holder within the holder's attack range. Once
// Coerce takes effect the holder must play a Sha at the victim, answered like
// any Sha; without one, the holder's weapon goes to the user's hand. That Sha
// is an answer, so it doesn't count toward the holder's Sha limit.
export const coerceCard: CardDefinition = {
  id: 'coerce',
  name: 'Coerce',
  category: 'tool',
  legalPlayTargets: (state, ctx, registry) => {
    const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
    const wearsWeapon = (holderId: string) => {
      const holder = state.seats.find((s) => s.id === holderId)!;
      const worn = state.zones.find((z) => z.id === holder.equipped.zoneId)?.cards ?? [];
      return worn.some((c) => registry.cards.get(c.definitionId)?.equipSlot === 'weapon');
    };
    return living
      .filter((holder) => holder.id !== ctx.seatId && wearsWeapon(holder.id))
      .flatMap((holder) => {
        const range = attackRange(state, holder.id, registry);
        return living
          .filter((victim) => victim.id !== holder.id && seatDistance(state, holder.id, victim.id, registry) <= range)
          .map((victim) => [seat(holder.id), seat(victim.id)]);
      });
  },
  play: (state, ctx) => {
    if (ctx.respondingTo || ctx.targets.length < 2) return [];
    return toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, [ctx.targets[0]], [ctx.targets[1]]);
  },
  onTarget: (state, { tool, userSeatId, target, extra }) => {
    const coerceId = tool.physical[0]?.instanceId;
    const victim = extra?.[0];
    const holder = state.seats.find((s) => target.kind === 'seat' && s.id === target.seatId);
    const user = state.seats.find((s) => s.id === userSeatId);
    if (!coerceId || !victim || !holder || !user) return [];
    const weapon = state.zones.find((z) => z.id === holder.equipped.zoneId)?.cards.find((c) => equipSlotOf(c.definitionId) === 'weapon');
    if (!weapon) return [];
    const window: Effect = {
      kind: 'OpenResponseEffect',
      pendingResponse: {
        id: `coerce-${coerceId}-${holder.id}`,
        respondingSeatId: holder.id,
        allowedActionKinds: ['RespondAction', 'PassAction'],
        allowedCardIds: ['sha'],
        reason: { kind: 'card-effect', card: tool, userSeatId, victimSeatId: victim.seatId },
        sourceCard: { instanceId: coerceId, definitionId: 'coerce' },
        // No Sha: the weapon goes to the user's hand.
        context: { effect: { kind: 'MoveCardEffect', cardInstanceId: weapon.instanceId, toZoneId: user.hand.zoneId } },
      },
    };
    return [window];
  },
  // The holder's Sha: the victim answers it like any Sha, from the holder.
  onResponse: (state, { pending, seatId, cardInstanceId }) => {
    const victimSeatId = pending.reason?.kind === 'card-effect' ? pending.reason.victimSeatId : undefined;
    const victim = state.seats.find((s) => s.id === victimSeatId && !s.eliminated);
    return victim ? [shaWindow(cardInstanceId, seatId, seat(victim.id))] : [];
  },
};
```

- [ ] **Step 5: Give Guozhan a processing zone, and register the cards**

- In `projects/content/src/lib/modes/guozhan.ts`, add `{ id: 'processing', kind: 'processing' as const, cards: [] },` after the discard pile zone in `setup`.
- In `registry.ts`, import `harvestCard` and `coerceCard`, and add them after `breakCard`.
- In `registry.spec.ts`, the test becomes `'registers the fifteen playable cards'`, and its list gains `'coerce'` and `'harvest'`.
- In `wiki.spec.ts`, `inGame` becomes `['barbarians', 'break', 'coerce', 'draw-two', 'duel', 'hail-of-arrows', 'harvest', 'peach-garden', 'steal', 'wuxie']`, in the order the test receives.
- In `projects/app/src/app/wiki/wiki-pages.spec.ts`, `'15 cards · 8 in the game'` becomes `'15 cards · 10 in the game'`.

- [ ] **Step 6: Run the tests**

Run: `npx jest projects/content`
Expected: PASS.

Run: `npx jest`
Expected: PASS. The sim's random bots now play all four new Tools.

- [ ] **Step 7: Commit**

```bash
git add projects/content projects/app
git commit -m "feat(content): Harvest and Coerce; the processing zone in Guozhan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Bots — picks, Steal, Break and Coerce

**Files:** modify `projects/bots/src/lib/rule-based.ts` and `projects/bots/src/lib/rule-based.spec.ts`.

**Interfaces:**
- Consumes:
  - `PendingChoice` and `ChooseOptionAction` (Task 1).
  - The card ids `'steal' | 'break' | 'coerce'` and the `processing` zone kind (Tasks 2–4).

- [ ] **Step 1: Write the failing tests**

In `projects/bots/src/lib/rule-based.spec.ts`:
1. Add `CardZone` and `PendingChoice` to the `import type { ... } from 'engine'`.
2. Add `card('steal', 'tool'), card('break', 'tool'), card('coerce', 'tool'), card('harvest', 'tool'),` to the registry's card list.
3. Add these options to `ViewOptions`:

```ts
  pendingChoice?: PendingChoice;
  // More zones, e.g. another seat's equipment or the processing zone.
  zones?: CardZone[];
```

4. In `view()`:
- Append `...(o.zones ?? [])` to the `zones` array.
- Add `...(o.pendingChoice ? { pendingChoice: o.pendingChoice } : {}),` to the returned state.

5. Append:

```ts
describe('ruleBasedPolicy: picks, Steal, Break and Coerce', () => {
  const pick = (optionId: string): Action => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c1', optionId });
  const faceUp = (instanceId: string, definitionId: string) => ({ instanceId, definitionId, suit: 'spade' as const, rank: 1 });
  const choiceOf = (options: PendingChoice['options']): PendingChoice => ({
    id: 'c1', seatId: 'seat-0', verb: 'take', options,
    reason: { kind: 'choice', card: { as: 'steal', colour: 'black', physical: [] }, userSeatId: 'seat-0', targetSeatId: 'seat-1' },
  });

  it('takes a weapon before armour, and armour before the hand', () => {
    const options: PendingChoice['options'] = [
      { id: 'hand', shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 2 }, effects: [] },
      { id: 'l', shows: { kind: 'card', card: faceUp('l', 'lion') }, effects: [] },
      { id: 'b', shows: { kind: 'card', card: faceUp('b', 'blade') }, effects: [] },
    ];
    const v = view({
      pendingChoice: choiceOf(options),
      zones: [{ id: 'seat-1:equip', kind: 'equip', ownerSeatId: 'seat-1', cards: [faceUp('l', 'lion'), faceUp('b', 'blade')] }],
    });
    expect(decide(v, ['hand', 'l', 'b'].map(pick)).action).toEqual(pick('b'));
    expect(decide(v, ['hand', 'l'].map(pick)).action).toEqual(pick('l'));
  });

  it('takes the Harvest card worth keeping most', () => {
    const options: PendingChoice['options'] = [
      { id: 's', shows: { kind: 'card', card: faceUp('s', 'sha') }, effects: [] },
      { id: 'p', shows: { kind: 'card', card: faceUp('p', 'peach') }, effects: [] },
    ];
    const v = view({ pendingChoice: choiceOf(options), zones: [{ id: 'processing', kind: 'processing', cards: [faceUp('s', 'sha'), faceUp('p', 'peach')] }] });
    expect(decide(v, ['s', 'p'].map(pick)).action).toEqual(pick('p'));
  });

  it('Steals from the lowest-HP non-ally, preferring one that wears equipment', () => {
    // seat-2 (3 HP) wears nothing; seat-1 (6 HP) wears a blade.
    const armed = view({ hand: [{ instanceId: 'st', definitionId: 'steal' }], zones: [{ id: 'seat-1:equip', kind: 'equip', ownerSeatId: 'seat-1', cards: [faceUp('b', 'blade')] }] });
    expect(decide(armed, [play('st', 'seat-1'), play('st', 'seat-2'), end]).action).toEqual(play('st', 'seat-1'));
    const bare = view({ hand: [{ instanceId: 'st', definitionId: 'steal' }] });
    expect(decide(bare, [play('st', 'seat-1'), play('st', 'seat-2'), end]).action).toEqual(play('st', 'seat-2'));
  });

  it('Coerces only when a non-ally’s weapon can reach another non-ally', () => {
    const pair = (holder: string, victim: string): Action => ({
      kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'co', targets: [{ kind: 'seat', seatId: holder }, { kind: 'seat', seatId: victim }],
    });
    const v = view({ hand: [{ instanceId: 'co', definitionId: 'coerce' }] });
    expect(decide(v, [pair('seat-1', 'seat-0'), pair('seat-1', 'seat-2'), end]).action).toEqual(pair('seat-1', 'seat-2'));
    expect(decide(v, [pair('seat-1', 'seat-0'), end]).action).toEqual(end);
  });
});
```

Run: `npx jest projects/bots`
Expected: FAIL. The bot takes the first option, and ends the phase instead of Stealing or Coercing.

- [ ] **Step 2: Implement**

In `projects/bots/src/lib/rule-based.ts`:

1. Add `type ChooseOption = Extract<Action, { kind: 'ChooseOptionAction' }>;` beside the other action aliases.
2. After the general-selection block (step 1 of `decide`) and before `// 2. Responding.`, add:

```ts
  // 1b. A pick (Steal, Break, Harvest): a weapon, then armour, then a mount,
  // then the hand; among Harvest's face-up cards, the one worth keeping most.
  const picks = legal.filter((a): a is ChooseOption => a.kind === 'ChooseOptionAction');
  if (picks.length > 0 && view.pendingChoice) {
    const options = view.pendingChoice.options;
    const worth = (p: ChooseOption): number => {
      const shows = options.find((o) => o.id === p.optionId)?.shows;
      if (!shows) return -1;
      if (shows.kind === 'hidden-hand') return 1;
      const zone = view.zones.find((z) => z.cards.some((c) => c.instanceId === shows.card.instanceId));
      if (zone?.kind === 'processing') return keepRank(view, registry, shows.card.instanceId);
      const slot = registry.cards.get(shows.card.definitionId)?.equipSlot;
      return slot === 'weapon' ? 4 : slot === 'armor' ? 3 : slot ? 2 : 0;
    };
    return take(picks.reduce((best, p) => (worth(p) > worth(best) ? p : best)));
  }
```

3. In step 5, after the mass-attack block and before `if (mem.shaPlayed === 0) {`, add:

```ts
    // Steal and Break: the lowest-HP non-ally, preferring one that wears equipment.
    const wearsEquipment = (p: PlayCard) => {
      const target = view.seats.find((s) => s.id === p.targets[0]?.seatId);
      return !!target && (view.zones.find((z) => z.id === target.equipped.zoneId)?.cards.length ?? 0) > 0;
    };
    const [grab] = [...targetedPlays(view, self, plays, 'steal'), ...targetedPlays(view, self, plays, 'break')].sort(
      (a, b) => Number(wearsEquipment(b)) - Number(wearsEquipment(a))
    );
    if (grab) return take(grab);
```

4. After `if (duel) return take(duel);`, add:

```ts
    // Coerce: when one non-ally's weapon can reach another non-ally.
    const coerce = plays.find((p) => {
      if (p.targets.length !== 2 || definitionIdOf(view, p.cardInstanceId) !== 'coerce') return false;
      const [holder, victim] = p.targets.map((t) => view.seats.find((s) => s.id === t.seatId));
      return !!holder && !!victim && victim.id !== seatId && !isAlly(self, holder) && !isAlly(self, victim);
    });
    if (coerce) return take(coerce);
```

Run: `npx jest projects/bots`
Expected: PASS.

- [ ] **Step 3: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS. The sim's rule-based games now Steal, Break, Coerce and pick.

```bash
git add projects/bots
git commit -m "feat(bots): pick weapons first, Steal and Break the weakest armed non-ally, Coerce between non-allies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: App — the Choice window, its clock, and the table

**Files:**
- Create: `projects/app/src/app/game-board/choice-description.ts` + `choice-description.spec.ts`
- Create: `projects/app/src/app/game-board/choice-dialog.ts` + `choice-dialog.spec.ts`
- Modify: `game-board/game-board.ts` (+spec), `decision-timer.service.ts` (+spec), `game-board/response-description.ts` (+spec), `game-board/round-table.ts` (+spec)

**Interfaces:**
- Consumes: `PendingChoice`, `ChoiceOption` and `ChooseOptionAction` (Task 1).
- Produces:
  - `describeChoice(state, viewerSeatId): ChoiceDescription | null`, where `ChoiceDescription` is `{ title; prompt; confirmLabel: 'Take' | 'Discard' }`.
  - `choiceOptionLabel(shows, players): string`.
  - The `ChoiceDialog` component, taking `ChoiceDialogData { description; options: ChoiceDialogOption[]; pickedChanged? }`.
  - `DECISION_SECONDS.choice = 60`.

- [ ] **Step 1: Write the failing tests**

1. Create `projects/app/src/app/game-board/choice-description.spec.ts`:

```ts
import { GameState, PendingChoice } from 'engine';
import { choiceOptionLabel, describeChoice } from './choice-description';

const players = [
  { id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' },
  { id: 'p1', seatId: 'seat-1', kind: 'bot' as const, name: 'Seat 1' },
];
const choice = (as: string, verb: 'take' | 'discard', targetSeatId?: string): PendingChoice => ({
  id: 'c', seatId: 'seat-0', verb, options: [],
  reason: { kind: 'choice', card: { as, colour: 'black', physical: [] }, userSeatId: 'seat-0', ...(targetSeatId ? { targetSeatId } : {}) },
});
const state = (pendingChoice?: PendingChoice): GameState => ({
  seats: [], zones: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play', players,
  turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
  ...(pendingChoice ? { pendingChoice } : {}),
});

describe('describeChoice', () => {
  it('names the Tool, says what to do, and labels the button Take or Discard', () => {
    expect(describeChoice(state(choice('steal', 'take', 'seat-1')), 'seat-0')).toEqual({ title: 'Steal', prompt: 'Choose a card to take from Seat 1', confirmLabel: 'Take' });
    expect(describeChoice(state(choice('break', 'discard', 'seat-1')), 'seat-0')).toEqual({ title: 'Break', prompt: 'Choose a card to discard from Seat 1', confirmLabel: 'Discard' });
    expect(describeChoice(state(choice('harvest', 'take')), 'seat-0')).toEqual({ title: 'Harvest', prompt: 'Choose a card to take', confirmLabel: 'Take' });
  });

  it('is null when the viewer has no choice to make', () => {
    expect(describeChoice(state(choice('steal', 'take', 'seat-1')), 'seat-1')).toBeNull();
    expect(describeChoice(state(), 'seat-0')).toBeNull();
  });
});

describe('choiceOptionLabel', () => {
  it('labels a hand by its owner and size, and a card by its name and face', () => {
    expect(choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count: 3 }, players)).toBe("Seat 1's Hand (3 Cards)");
    expect(choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count: 1 }, players)).toBe("Seat 1's Hand (1 Card)");
    expect(choiceOptionLabel({ kind: 'card', card: { instanceId: 'l', definitionId: 'silver-lion', suit: 'club', rank: 1 } }, players)).toBe('Silver Lion (A ♣)');
  });
});
```

2. Create `projects/app/src/app/game-board/choice-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { ChoiceDialog, ChoiceDialogData } from './choice-dialog';

const pickHand: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c1', optionId: 'hand' };
const pickLion: Action = { ...pickHand, optionId: 'lion-1' };

function render() {
  const close = jest.fn();
  const pickedChanged = jest.fn();
  const data: ChoiceDialogData = {
    description: { title: 'Steal', prompt: 'Choose a card to take from Seat 1', confirmLabel: 'Take' },
    options: [
      { id: 'hand', action: pickHand, hiddenCount: 3, label: "Seat 1's Hand (3 Cards)" },
      { id: 'lion-1', action: pickLion, card: { instanceId: 'lion-1', definitionId: 'silver-lion', suit: 'club', rank: 1 }, label: 'Silver Lion (A ♣)' },
    ],
    pickedChanged,
  };
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
  const fixture = TestBed.createComponent(ChoiceDialog);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, close, pickedChanged };
}

describe('ChoiceDialog', () => {
  it('shows the Tool, the prompt, a face-down hand with its size, and each face-up card', () => {
    const { el } = render();
    expect(el.querySelector('h2')!.textContent).toContain('Steal');
    expect(el.querySelector('.prompt')!.textContent).toContain('Choose a card to take from Seat 1');
    expect(el.querySelector('[data-option-id="hand"] .card-back .count')!.textContent!.trim()).toBe('3');
    expect(el.querySelector('[data-option-id="lion-1"] app-playing-card')).not.toBeNull();
  });

  it('takes nothing until a card is picked, then closes with that pick', () => {
    const { el, fixture, close, pickedChanged } = render();
    const confirm = el.querySelector('button.confirm') as HTMLButtonElement;
    expect(confirm.textContent!.trim()).toBe('Take');
    expect(confirm.disabled).toBe(true);
    (el.querySelector('[data-option-id="lion-1"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(pickedChanged).toHaveBeenCalledWith(pickLion);
    expect(confirm.disabled).toBe(false);
    confirm.click();
    expect(close).toHaveBeenCalledWith(pickLion);
  });
});
```

3. In `projects/app/src/app/decision-timer.service.spec.ts`, inside `describe('with a board on screen')`, add:

```ts
    it('picks the first option when a choice times out, never ending the Play phase (Review Focus 4)', () => {
      for (let seed = 1; seed < 200; seed++) {
        game.startGame(2, seed);
        game.reveal(game.activeSeatId()!);
        while (game.state()!.phase === 'GeneralSelection') {
          game.submit(game.legalActions()[0]);
          game.reveal(game.activeSeatId()!);
        }
        const grab = game.legalActions().find((a) => a.kind === 'PlayCardAction' && ['steal', 'break'].includes(cardDefinitionId(game.state()!, a.cardInstanceId) ?? ''));
        if (!grab) continue;
        game.submit(grab);
        if (!game.state()!.pendingChoice) continue; // a Wuxie window came first
        game.reveal(game.activeSeatId()!);
        TestBed.tick();
        expect(timer.secondsLeft()).toBe(DECISION_SECONDS.choice);
        advance(DECISION_SECONDS.choice);
        expect(game.state()!.pendingChoice).toBeUndefined();
        expect(game.state()!.phase).toBe('Play');
        expect(game.state()!.turn.ownerSeatId).toBe('seat-0');
        return;
      }
      throw new Error('no seed gave seat-0 a Steal or Break');
    });
```

4. In `projects/app/src/app/game-board/game-board.spec.ts`, add (importing `cardDefinitionId` from `'../labels'` if Task 3 didn't):

```ts
  it('opens the Choice dialog for a Steal or Break, and its button submits the picked option', async () => {
    let chose = false;
    for (let seed = 1; seed < 200 && !chose; seed++) {
      gameService.startGame(2, seed);
      finishSelection(gameService);
      gameService.reveal(gameService.activeSeatId()!);
      const grab = gameService.legalActions().find(
        (a) => a.kind === 'PlayCardAction' && ['steal', 'break'].includes(cardDefinitionId(gameService.state()!, a.cardInstanceId) ?? '')
      );
      if (!grab) continue;
      gameService.submit(grab);
      chose = !!gameService.state()!.pendingChoice;
    }
    expect(chose).toBe(true);
    gameService.reveal(gameService.activeSeatId()!);

    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = document.querySelector('.cdk-overlay-container') as HTMLElement;
    const dialog = overlay.querySelector('app-choice-dialog')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('.prompt')!.textContent).toMatch(/Choose a card to (take|discard) from Seat 1/);
    (dialog.querySelector('button.option') as HTMLButtonElement).click();
    fixture.detectChanges();
    (dialog.querySelector('button.confirm') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(gameService.lastError()).toBeNull();
    expect(gameService.state()!.pendingChoice).toBeUndefined();
    overlay.replaceChildren();
  });
```

5. In `projects/app/src/app/game-board/response-description.spec.ts`, add to `describe('waitingLine')`:

```ts
  it('says who is choosing a card', () => {
    const choosing: GameState = {
      ...state([], null),
      pendingChoice: { id: 'c', seatId: 'seat-0', verb: 'take', options: [], reason: { kind: 'choice', card: { as: 'steal', colour: 'black', physical: [] }, userSeatId: 'seat-0' } },
    };
    expect(waitingLine(choosing)).toBe('Waiting on Hing to choose a card');
  });
```

6. In `projects/app/src/app/game-board/round-table.spec.ts`, add:

```ts
  it('shows the turned-up cards in the centre, and marks the seat choosing one', () => {
    const base = state();
    const turnedUp = [
      { instanceId: 't1', definitionId: 'peach', suit: 'heart' as const, rank: 3 },
      { instanceId: 't2', definitionId: 'sha', suit: 'spade' as const, rank: 7 },
    ];
    const el = render(state({
      zones: [...base.zones, { id: 'processing', kind: 'processing', cards: turnedUp }],
      pendingChoice: { id: 'c', seatId: 'seat-0', verb: 'take', options: [], reason: { kind: 'choice', card: { as: 'harvest', colour: 'red', physical: [] }, userSeatId: 'seat-1' } },
    }));
    expect(el.querySelectorAll('.centre .turned-up app-playing-card')).toHaveLength(2);
    expect(tile(el, 'seat-0').querySelector('.tile')!.classList).toContain('responding');
  });
```

Run: `npx jest projects/app`
Expected: FAIL. `choice-description` and `choice-dialog` don't exist, there is no `choice` clock, and the waiting line and centre don't know about choices.

- [ ] **Step 2: Write the description and the dialog**

Create `projects/app/src/app/game-board/choice-description.ts`:

```ts
import { ChoiceOption, GameState, Player } from 'engine';
import { cardDisplayData } from 'content';
import { cardFaceLabel, cardIdDisplayName, seatName } from '../labels';

export interface ChoiceDescription {
  // The Tool's name, e.g. "Steal".
  title: string;
  // What to do, e.g. "Choose a card to take from Seat 1".
  prompt: string;
  // The primary button.
  confirmLabel: 'Take' | 'Discard';
}

const cardName = (definitionId: string) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);

// What the Choice window says, read off the pending choice. Null unless the
// viewer is the one choosing.
export function describeChoice(state: GameState, viewerSeatId: string): ChoiceDescription | null {
  const choice = state.pendingChoice;
  if (!choice || choice.seatId !== viewerSeatId || choice.reason.kind !== 'choice') return null;
  const { card, targetSeatId } = choice.reason;
  const from = targetSeatId ? ` from ${seatName(state.players, targetSeatId)}` : '';
  return {
    title: cardName(card.as),
    prompt: `Choose a card to ${choice.verb}${from}`,
    confirmLabel: choice.verb === 'take' ? 'Take' : 'Discard',
  };
}

// An option's label: a hand by its owner and size, a card by its name and face.
export function choiceOptionLabel(shows: ChoiceOption['shows'], players: readonly Player[]): string {
  if (shows.kind === 'hidden-hand') {
    return `${seatName(players, shows.seatId)}'s Hand (${shows.count} ${shows.count === 1 ? 'Card' : 'Cards'})`;
  }
  return `${cardName(shows.card.definitionId)} (${cardFaceLabel(shows.card)})`;
}
```

Create `projects/app/src/app/game-board/choice-dialog.ts`:

```ts
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { PlayingCard } from './playing-card';
import { DecisionCountdown } from './decision-countdown';
import { ChoiceDescription } from './choice-description';

export interface ChoiceDialogOption {
  id: string;
  action: Action;
  // A face-up card; or, for a hand, its size shown on a face-down card.
  card?: CardInstance;
  hiddenCount?: number;
  label: string;
}

export interface ChoiceDialogData {
  description: ChoiceDescription;
  options: ChoiceDialogOption[];
  // Told the picked option's action on every change, so a timeout can use it.
  pickedChanged?: (action: Action) => void;
}

// A Tool's pick (Steal, Break, Harvest): pick one option, then Take or Discard.
// Closes only through that button, with the engine's own ChooseOptionAction.
@Component({
  selector: 'app-choice-dialog',
  imports: [MatDialogModule, MatButtonModule, PlayingCard, DecisionCountdown],
  template: `
    <h2 mat-dialog-title>{{ data.description.title }}</h2>
    <mat-dialog-content>
      <p class="prompt">{{ data.description.prompt }}</p>
      <ul class="options">
        @for (option of data.options; track option.id) {
          <li>
            <button
              type="button"
              class="option"
              [class.picked]="picked() === option.id"
              [attr.aria-pressed]="picked() === option.id"
              [attr.aria-label]="option.label"
              [attr.data-option-id]="option.id"
              (click)="pick(option)"
            >
              @if (option.card; as card) {
                <app-playing-card [card]="card" />
              } @else {
                <span class="card-back"><span class="count">{{ option.hiddenCount }}</span></span>
              }
              <span class="label">{{ option.label }}</span>
            </button>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <!-- At zero: the picked option, else the first. -->
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" class="confirm" [disabled]="!picked()" (click)="confirm()">{{ data.description.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .prompt { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .options { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }
    .option {
      display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%;
      padding: 6px 4px; border: 2px solid transparent; border-radius: 10px; background: none; color: inherit; cursor: pointer;
    }
    .option:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .option.picked { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); }
    .card-back {
      display: flex; align-items: center; justify-content: center; width: 72px; height: 100px; border-radius: 6px;
      background: repeating-linear-gradient(45deg, #7a2e2e, #7a2e2e 6px, #8e3a3a 6px, #8e3a3a 12px); color: #fff;
    }
    .count { font: 700 22px/1 system-ui, sans-serif; text-shadow: 0 1px 2px rgb(0 0 0 / 60%); }
    .label { font: var(--mat-sys-body-small); text-align: center; }
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class ChoiceDialog {
  protected readonly data = inject<ChoiceDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ChoiceDialog, Action>>(MatDialogRef);

  protected readonly picked = signal<string | null>(null);

  protected pick(option: ChoiceDialogOption): void {
    this.picked.set(option.id);
    this.data.pickedChanged?.(option.action);
  }

  protected confirm(): void {
    const option = this.data.options.find((o) => o.id === this.picked());
    if (option) this.dialogRef.close(option.action);
  }
}
```

- [ ] **Step 3: Open the dialog from the board**

In `projects/app/src/app/game-board/game-board.ts`:
1. Add these imports:
   - `import { ChoiceDialog, ChoiceDialogData, ChoiceDialogOption } from './choice-dialog';`
   - `import { choiceOptionLabel, describeChoice } from './choice-description';`
2. Beside `responseDialog`, add:

```ts
  private choiceDialog: MatDialogRef<ChoiceDialog, Action> | null = null;
  // The choice whose dialog is showing, so each opens only once.
  private choiceDialogFor: string | null = null;
  // The choice the viewer owes, while the board is on screen and the engine
  // offers them its options.
  protected readonly choiceDue = computed(() => {
    const choice = this.visibleState()?.pendingChoice;
    if (!choice || choice.seatId !== this.viewerSeatId()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'ChooseOptionAction') ? choice.id : null;
  });
```

3. In the constructor, after the response-dialog `effect`, add:

```ts
    effect(() => {
      const choiceId = this.choiceDue();
      untracked(() => {
        if (this.choiceDialogFor && this.choiceDialogFor !== choiceId) this.closeDialog(this.choiceDialog);
        if (choiceId) this.openChoiceDialog(choiceId);
      });
    });
```

4. After `openResponseDialog`, add:

```ts
  // Opens the Choice dialog (Steal, Break, Harvest) for one pending choice;
  // the picked action is the engine's own ChooseOptionAction.
  private openChoiceDialog(choiceId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    const choice = visible?.pendingChoice;
    if (this.choiceDialogFor === choiceId || !visible || !choice || !seatId) return;
    const description = describeChoice(visible, seatId);
    if (!description) return;
    const legal = this.gameService.legalActions();
    const options: ChoiceDialogOption[] = choice.options.flatMap((option) => {
      const action = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === option.id);
      if (!action) return [];
      const shown = option.shows.kind === 'card' ? { card: option.shows.card } : { hiddenCount: option.shows.count };
      return [{ id: option.id, action, ...shown, label: choiceOptionLabel(option.shows, visible.players) }];
    });
    this.choiceDialogFor = choiceId;
    const ref = this.dialog.open<ChoiceDialog, ChoiceDialogData, Action>(ChoiceDialog, {
      data: { description, options, pickedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 640px)',
      disableClose: true,
    });
    this.choiceDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.choiceDialogFor = null;
      this.choiceDialog = null;
      if (action) this.submit(action);
    });
  }
```

- [ ] **Step 4: Give choices their own clock**

In `projects/app/src/app/decision-timer.service.ts`:
1. `DECISION_SECONDS` gains `choice: 60,` after `response: 60,`.
2. In `decision`, before `if (state.pendingResponse) ...`, add:

```ts
    if (state.pendingChoice) return { kind: 'choice', state, key: this.keyOf(state) };
```

3. In `defaultActions`, as its first two lines after `const legal = ...`, add:

```ts
    const pick = legal.find((a) => a.kind === 'ChooseOptionAction');
    if (pick) return [pick];
```

4. In the class comment's list of defaults, add "a choice → the UI's current pick if it gave one, else the first option;". In its list of clocks, add "Responses, choices and discards: a clock per decision.", replacing the line "Responses and discards: a clock per decision."

- [ ] **Step 5: Tell the table about choices**

In `projects/app/src/app/game-board/response-description.ts`, at the start of `waitingLine`, add:

```ts
  const choice = state.pendingChoice;
  if (choice) return `Waiting on ${seatName(state.players, choice.seatId)} to choose a card`;
```

In `projects/app/src/app/game-board/round-table.ts`:
1. Add `PlayingCard` (from `'./playing-card'`) to `imports`.
2. In the centre, after the `.piles` div, add:

```html
        @if (turnedUp().length > 0) {
          <div class="turned-up" aria-label="Turned Up Cards">
            @for (card of turnedUp(); track card.instanceId) {
              <app-playing-card [card]="card" size="small" />
            }
          </div>
        }
```

3. Change `[isResponding]="p.seat.id === state().pendingResponse?.respondingSeatId"` to `[isResponding]="p.seat.id === (state().pendingChoice?.seatId ?? state().pendingResponse?.respondingSeatId)"`.
4. Add the style `.turned-up { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: 4px; }`.
5. Add `protected readonly turnedUp = computed(() => this.state().zones.find((z) => z.kind === 'processing')?.cards ?? []);`.

- [ ] **Step 6: Run the app tests, the suite and the build**

Run: `npx jest projects/app`
Expected: PASS.

Run: `npx jest`
Expected: PASS.

Run: `npx ng build app`
Expected: success, no new warnings.

- [ ] **Step 7: Commit**

```bash
git add projects/app
git commit -m "feat(app): the Choice window for Steal, Break and Harvest, with its own clock; turned-up cards on the table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: App — the Coerce picker, its window text, and Action History lines

**Files:**
- Modify: `projects/app/src/app/game-board/hand-view.ts` (+spec), `game-board/response-description.ts` (+spec), `game-board/action-history.ts` (+spec)

**Interfaces:**
- Consumes:
  - `ChoiceMadeEvent` and `CardsTurnedUpEvent` (Tasks 1–2).
  - The `card-effect` reason's `victimSeatId` (Task 2).

- [ ] **Step 1: Write the failing tests**

1. In `projects/app/src/app/game-board/hand-view.spec.ts`, add inside `describe('HandView')`:

```ts
  it('picks a two-seat play (Coerce) in two steps: the first seat, then the second', async () => {
    const pair = (first: string, second: string): Action => ({
      kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'c-peach', targets: [{ kind: 'seat', seatId: first }, { kind: 'seat', seatId: second }],
    });
    fixture.componentRef.setInput('actions', [pair('seat-1', 'seat-0'), pair('seat-1', 'seat-2'), pair('seat-2', 'seat-1')]);
    fixture.detectChanges();
    playButton('c-peach').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const firsts = [...overlay().querySelectorAll('button[mat-menu-item]')] as HTMLButtonElement[];
    expect(firsts.map((i) => i.textContent!.trim())).toEqual(['Play Peach Targeting Seat 1', 'Play Peach Targeting Seat 2']);
    firsts[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    const seconds = ([...overlay().querySelectorAll('button[mat-menu-item]')] as HTMLButtonElement[]).filter((i) => i.textContent!.trim().startsWith('At '));
    expect(seconds.map((i) => i.textContent!.trim())).toEqual(['At Seat 0', 'At Seat 2']);
    seconds[1].click();
    expect(played).toEqual([pair('seat-1', 'seat-2')]);
  });
```

2. In `projects/app/src/app/game-board/response-description.spec.ts`, add:

```ts
describe('describeResponse: Coerce', () => {
  it('asks the holder to play a Sha at the victim, or hand over the weapon', () => {
    const coerce: CardInstance = { instanceId: 'co-1', definitionId: 'coerce', suit: 'club', rank: 12 };
    const blade: CardInstance = { instanceId: 'blade-1', definitionId: 'green-dragon-blade', suit: 'spade', rank: 5 };
    const pending: PendingResponse = {
      id: 'k1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
      reason: { kind: 'card-effect', card: used(coerce), userSeatId: 'seat-1', victimSeatId: 'seat-2' },
      sourceCard: { instanceId: 'co-1', definitionId: 'coerce' },
      context: { effect: { kind: 'MoveCardEffect', cardInstanceId: 'blade-1', toZoneId: 'seat-1:hand' } },
    };
    const s: GameState = {
      ...state([], pending),
      zones: [
        { id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [blade] },
        { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [] },
      ],
    };
    expect(describeResponse(s, 'seat-0')).toMatchObject({
      source: 'Seat 1 used Coerce on you',
      prompt: 'Play Sha at Seat 2?',
      outcome: 'Green Dragon Blade goes to Seat 1',
    });
  });
});
```

3. In `projects/app/src/app/game-board/action-history.spec.ts`, add inside `describe('actionHistory')`:

```ts
  describe('picks and handed-over cards', () => {
    const players = [
      { id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot' as const, name: 'Seat 1' },
    ];
    const withProcessing = [...zones, { id: 'processing', kind: 'processing' as const, cards: [] }];
    const lines = (log: EngineEvent[]) => actionHistory(log, withProcessing, players).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
    const reason = (as: string) => ({ kind: 'choice' as const, card: { as, colour: 'black' as const, physical: [] }, userSeatId: 'seat-1', targetSeatId: 'seat-0' });

    it('says what a Steal took, by face when worn, unnamed from the hand', () => {
      expect(lines([
        { kind: 'ChoiceMadeEvent', seatId: 'seat-1', reason: reason('steal'), verb: 'take', shows: { kind: 'card', card: lion } },
        { kind: 'CardMovedEvent', cardInstanceId: 'lion-1', fromZoneId: 'seat-0:equip', toZoneId: 'seat-1:hand' },
      ])).toEqual(["Seat 1 took Hing's Silver Lion (A ♣) with Steal"]);
      expect(lines([
        { kind: 'ChoiceMadeEvent', seatId: 'seat-1', reason: reason('steal'), verb: 'take', shows: { kind: 'hidden-hand', seatId: 'seat-0', count: 2 } },
        { kind: 'CardMovedEvent', cardInstanceId: 'x', fromZoneId: 'seat-0:hand', toZoneId: 'seat-1:hand' },
      ])).toEqual(['Seat 1 took a hand card from Hing with Steal']);
    });

    it('names a card broken from the hand, since the discard shows it', () => {
      expect(lines([
        { kind: 'ChoiceMadeEvent', seatId: 'seat-1', reason: reason('break'), verb: 'discard', shows: { kind: 'hidden-hand', seatId: 'seat-0', count: 2 } },
        move(sha, 'seat-0:hand', 'discardPile'),
      ])).toEqual(["Seat 1 discarded Sha (7 ♠) from Hing's hand with Break"]);
    });

    it('tells the Harvest: what was turned up, and who took what', () => {
      expect(lines([
        { kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [peach, sha] },
        {
          kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', shows: { kind: 'card', card: peach },
          reason: { kind: 'choice', card: { as: 'harvest', colour: 'red', physical: [] }, userSeatId: 'seat-0' },
        },
        { kind: 'CardMovedEvent', cardInstanceId: 'peach-1', fromZoneId: 'processing', toZoneId: 'seat-0:hand' },
      ])).toEqual(['Hing took Peach (Q ♥) with Harvest', 'Turned up 2 cards: Peach (Q ♥), Sha (7 ♠)']);
    });

    it('says who took a worn card handed over (Coerce’s weapon)', () => {
      expect(lines([
        move(blade, 'seat-1:hand', 'seat-1:equip'),
        { kind: 'CardMovedEvent', cardInstanceId: 'blade-1', fromZoneId: 'seat-1:equip', toZoneId: 'seat-0:hand' },
      ])).toEqual(["Hing took Seat 1's Green Dragon Blade (5 ♠)"]);
    });
  });
```

Run: `npx jest projects/app/src/app/game-board/hand-view.spec.ts projects/app/src/app/game-board/response-description.spec.ts projects/app/src/app/game-board/action-history.spec.ts`
Expected: FAIL.

- [ ] **Step 2: The two-step picker**

In `projects/app/src/app/game-board/hand-view.ts`:
1. The engine import also takes `Target`. Add `import { targetLabel } from '../labels';` next to `actionLabel`, and add `type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;`.
2. Add to `HandCardViewModel`:

```ts
  // Two-seat plays (Coerce: the holder, then the victim), grouped by first seat.
  pairs: { seatId: string; label: string; seconds: { action: Action; label: string }[] }[] | null;
```

3. Add above the component:

```ts
// Two-seat plays grouped by their first seat, in order: "Play Coerce
// Targeting Seat 1", then "At Seat 2".
function groupPairs(plays: PlayCard[], state: GameState, registry: ContentRegistry): NonNullable<HandCardViewModel['pairs']> {
  const groups: NonNullable<HandCardViewModel['pairs']> = [];
  for (const play of plays) {
    const [first, second]: Target[] = play.targets;
    let group = groups.find((g) => g.seatId === first.seatId);
    if (!group) {
      group = { seatId: first.seatId, label: actionLabel({ ...play, targets: [first] }, state, registry), seconds: [] };
      groups.push(group);
    }
    group.seconds.push({ action: play, label: `At ${targetLabel(second, state.players)}` });
  }
  return groups;
}
```

4. In `cardViewModels`, compute and return `pairs`:

```ts
      const plays = this.actions().filter((a): a is PlayCard => a.kind === 'PlayCardAction' && a.cardInstanceId === card.instanceId);
      const pairs = plays.length > 0 && plays.every((p) => p.targets.length === 2) ? groupPairs(plays, this.state(), this.registry()) : null;
```

and add `pairs,` to the returned object.

5. In the template, the overlay's first branch becomes a `vm.pairs` branch ahead of the existing two:

```html
            @if (vm.pairs) {
              <button mat-flat-button type="button" class="play" [matMenuTriggerFor]="firsts">
                <mat-icon>play_arrow</mat-icon> Play
              </button>
              <mat-menu #firsts="matMenu">
                @for (group of vm.pairs; track group.seatId) {
                  <button mat-menu-item type="button" [matMenuTriggerFor]="seconds" [matMenuTriggerData]="{ group }">{{ group.label }}</button>
                }
              </mat-menu>
              <mat-menu #seconds="matMenu">
                <ng-template matMenuContent let-group="group">
                  @for (second of group.seconds; track second.label) {
                    <button mat-menu-item type="button" (click)="play.emit(second.action)">{{ second.label }}</button>
                  }
                </ng-template>
              </mat-menu>
            } @else if (vm.actions.length > 1) {
```

The existing `@if (vm.actions.length > 1) {` becomes this `@else if`, and its `@else` stays.

- [ ] **Step 3: Coerce's window text**

In `projects/app/src/app/game-board/response-description.ts`:

1. In `outcomeOf`, before `default:`, add:

```ts
    case 'MoveCardEffect': {
      const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === effect.cardInstanceId);
      const owner = state.zones.find((z) => z.id === effect.toZoneId)?.ownerSeatId;
      if (!owner) return 'The effect goes ahead';
      return `${card ? cardName(card) : 'A card'} goes to ${owner === viewerSeatId ? 'you' : name(owner)}`;
    }
```

2. In `describeResponse`, after the `counter-wuxie` branch, add:

```ts
  if (pending.reason?.kind === 'card-effect' && pending.reason.victimSeatId) {
    const { card, userSeatId, victimSeatId } = pending.reason;
    const holder = pending.respondingSeatId;
    return {
      source: `${name(userSeatId)} used ${cardName({ definitionId: card.as })} on ${holder === viewerSeatId ? 'you' : name(holder)}`,
      latest: null,
      prompt: `Play ${askedCardName(state)} at ${victimSeatId === viewerSeatId ? 'you' : name(victimSeatId)}?`,
      outcome: outcomeOf(pending.context.effect, viewerSeatId, state),
      outcomeForce: forceOf(state.seats.find((s) => s.id === holder)?.kingdom),
    };
  }
```

- [ ] **Step 4: Action History lines**

In `projects/app/src/app/game-board/action-history.ts`:

1. The engine import becomes `import { CardInstance, CardZone, ChoiceMadeEvent, EngineEvent, Player, Seat } from 'engine';`.
2. Inside `actionHistory`, after `const awaitingMove = new Set<string>();`, add:

```ts
  // A pick waiting for its card's move, which says what was picked.
  let picked: ChoiceMadeEvent | null = null;
  // The last face seen of each card, from moves into face-up zones.
  const knownFaces = new Map<string, CardInstance>();
  // "Seat 1 took Hing's Silver Lion (A ♣) with Steal", "Seat 1 took a hand card
  // from Hing with Steal", "Seat 1 discarded Sha (7 ♠) from Hing's hand with Break".
  const pickLine = (made: ChoiceMadeEvent, face: CardInstance | undefined, ownerSeatId: string | undefined): string => {
    const tool = made.reason.kind === 'choice' ? ` with ${cardName(made.reason.card.as)}` : '';
    const chooser = name(made.seatId);
    if (made.shows.kind === 'hidden-hand') {
      return made.verb === 'take'
        ? `${chooser} took a hand card from ${name(made.shows.seatId)}${tool}`
        : `${chooser} discarded ${face ? named(face) : 'a card'} from ${name(made.shows.seatId)}'s hand${tool}`;
    }
    const what = face ? named(face) : 'a card';
    return `${chooser} ${made.verb === 'take' ? 'took' : 'discarded'} ${ownerSeatId ? `${name(ownerSeatId)}'s ${what}` : what}${tool}`;
  };
```

3. The `CardMovedEvent` case becomes:

```ts
      case 'CardMovedEvent': {
        if (event.card) knownFaces.set(event.cardInstanceId, event.card);
        if (awaitingMove.delete(event.cardInstanceId)) break;
        const from = zoneById.get(event.fromZoneId);
        const to = zoneById.get(event.toZoneId);
        if (picked) {
          const face = event.card ?? (picked.shows.kind === 'card' ? picked.shows.card : undefined);
          action(pickLine(picked, face, from?.ownerSeatId), face ?? null);
          picked = null;
          break;
        }
        // A worn card handed to another seat (Coerce's weapon).
        if (from?.kind === 'equip' && to?.kind === 'hand' && from.ownerSeatId && to.ownerSeatId && from.ownerSeatId !== to.ownerSeatId) {
          const face = knownFaces.get(event.cardInstanceId);
          action(`${name(to.ownerSeatId)} took ${name(from.ownerSeatId)}'s ${face ? named(face) : 'card'}`, face ?? null);
          break;
        }
        if (!event.card || to?.kind !== 'discardPile' || !from?.ownerSeatId) break;
        if (from.kind === 'hand') action(`${name(from.ownerSeatId)} discarded ${named(event.card)}`, event.card);
        if (from.kind === 'equip') action(`${name(from.ownerSeatId)}'s ${cardName(event.card.definitionId)} was discarded`, event.card);
        break;
      }
```

4. Add two cases to the `switch`:

```ts
      case 'ChoiceMadeEvent':
        picked = event;
        break;
      case 'CardsTurnedUpEvent':
        action(`Turned up ${event.cards.length} ${event.cards.length === 1 ? 'card' : 'cards'}: ${event.cards.map(named).join(', ')}`);
        break;
```

- [ ] **Step 5: Run the app tests, the suite and the build**

Run: `npx jest projects/app`
Expected: PASS.

Run: `npx jest`
Expected: PASS.

Run: `npx ng build app`
Expected: success, no new warnings.

- [ ] **Step 6: Look at it running**

1. Run `npx ng serve app --port 4300`.
2. Play vs-bots games with 5 seats until you have used Steal, Break, Harvest and Coerce, or watched bots use them.
3. Check:
   - **Choice window:** the hand shows face down with its count. The button reads Take or Discard. It can't be dismissed.
   - **Harvest:** the turned-up cards show in the table centre, and each seat picks in turn.
   - **Coerce:** the two-step picker offers only legal pairs. The holder's window reads "… used Coerce on you / Play Sha at …?".
   - **Action History:** lines appear for each pick and for the handed-over weapon.
   - **Browser console:** no errors.
4. Fix anything wrong before committing.

- [ ] **Step 7: Commit**

```bash
git add projects/app
git commit -m "feat(app): a two-step Coerce picker, Coerce's window text, and Action History lines for picks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
