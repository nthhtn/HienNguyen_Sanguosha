# Turn Phases, Auto-Advance, Hand Limit, Max HP and a Phase Indicator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turns run through six phases (Start, Judgment, Draw, Play, Discard, End). The engine passes every phase that has no decision by itself and enforces a hand limit equal to current HP. Max HP becomes half the two generals' HP, rounded down. The board shows a "seat-X – Y Phase" indicator.

**Architecture:** All rules live in the engine (`projects/engine`). A new `advanceToDecision` loop, run at the end of every `resolve()`, enters phases until one waits for a player (Play, or Discard while over the hand limit), a response is pending, or the game ends. Discarding is a new `DiscardCardAction`, one card per action. Bots, sim and app only react to the legal actions and state the engine already exposes. No game rule is added to the UI.

**Tech Stack:** TypeScript, Jest (`ts-jest` for engine/content/bots/sim, the Angular preset for app), Angular 22 standalone components with signals, Angular Material.

**Spec:** `docs/superpowers/specs/2026-10-02-turn-phases-design.md`

## Global Constraints

- Phase order: `['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End']`.
- Max HP = `Math.floor((main.maxHp + deputy.maxHp) / 2)`. `combinedHp` starts equal to it.
- Hand limit = `max(0, Seat.combinedHp)`, computed only in `projects/engine/src/lib/rules/handLimit.ts`.
- `EndPhaseAction` is legal, and accepted by `resolve()`, only in the Play phase.
- `DiscardCardAction { kind: 'DiscardCardAction'; seatId: string; cardInstanceId: string }` discards one card at a time.
- Indicator text: `<owner seat id>` + ` (you)` when it is the viewer's seat + ` – ` + `<Phase> Phase`, plus ` – discard N more` in Discard while over the limit.
- The engine stays Angular-free. UI components never compute hand limits or phase rules (CLAUDE.md).
- Tests: `npx jest --selectProjects <engine|content|bots|sim|app> <path>` from the repo root. Full suite: `npx jest`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A turn owner eliminated by their own card** (for example a lost Duel) must not freeze the game: the next living seat must rest in its Play phase. Pinned in Task 4, test "skips the rest of the turn when the owner is eliminated by their own play".
2. **Over the hand limit with 0 HP:** a seat at 0 HP (alive but dying, before elimination) has a hand limit of 0 and must discard its whole hand rather than crash or skip. Pinned in Task 2, "has a limit of 0 at 0 HP", and Task 3, "offers one discard per hand card".
3. **Pass-and-play discards:** every `DiscardCardAction` goes through `GameService.submit`, which re-gates the view for the active seat. That's the same seat again, so the gate must not flip to another player mid-discard. Pinned in Task 8, "keeps the same seat's view through a discard in pass-and-play".
4. **A game that ends inside an automatic phase** (a win reached during a Draw-phase trigger) must stop there with the result attached, not keep entering phases. Pinned in Task 4, "stops at once when a phase trigger ends the game".
5. **The bot safety cap in Discard:** after `MAX_BOT_ACTIONS_PER_TURN` actions there is no End phase to fall back on. The bot must still return a legal discard. Pinned in Task 5, "still discards when the per-turn safety cap is reached".

## Deviation from the spec

The spec lists a "loop bound" test using a content stub that keeps every phase from waiting. No such stub can exist: Play always waits, and only elimination skips it, which ends in a win or in `advanceTurn`'s existing "every seat is eliminated" error. Task 4 keeps the step bound as a defensive guard. It pins the reachable failure instead ("fails loudly when every seat is eliminated and the mode names no winner") and updates that line of the spec.

---

### Task 1: Max HP is half the two generals' HP, rounded down

**Files:**
- Modify: `projects/engine/src/lib/domain/factories.ts`
- Modify: `projects/engine/src/lib/rules/generalSelection.ts:55`
- Test: `projects/engine/src/lib/domain/factories.spec.ts`
- Test: `projects/engine/src/lib/rules/generalSelection.spec.ts:81-82`
- Test: `projects/content/src/lib/modes/kingdomWar.spec.ts` (`seated` helper, and the "full selection" test around line 91)

**Interfaces:**
- Produces: `export function combinedMaxHp(mainMaxHp: number, deputyMaxHp: number): number` from `projects/engine/src/lib/domain/factories.ts`. It is exported through `public-api.ts`, which already re-exports `./lib/domain/factories`.

- [ ] **Step 1: Write the failing tests**

In `projects/engine/src/lib/domain/factories.spec.ts`, change the import to `import { createSeat, createPlayer, combinedMaxHp } from './factories';`. In the existing test "creates a seat with combined HP from both generals and both hidden" (generals 4 and 3), change both `7`s to `3`. Then add, inside the `describe('domain factories', ...)` block:

```ts
  it('halves the two generals’ HP and rounds down', () => {
    expect(combinedMaxHp(4, 4)).toBe(4);
    expect(combinedMaxHp(3, 4)).toBe(3);
    expect(combinedMaxHp(3, 3)).toBe(3);
    expect(combinedMaxHp(5, 4)).toBe(4);
  });
```

In `projects/engine/src/lib/rules/generalSelection.spec.ts`, the test "seats the chosen pair unrevealed, derives kingdom and HP, and removes the candidates" picks `w2` (3 HP) and `w1` (4 HP). Change:

```ts
    expect(seatA.combinedHp).toBe(3);
    expect(seatA.maxCombinedHp).toBe(3);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects engine domain/factories rules/generalSelection`
Expected: FAIL. `combinedMaxHp` is not exported, and the HP assertions get 7 instead of 3.

- [ ] **Step 3: Implement**

In `projects/engine/src/lib/domain/factories.ts`, add above `createSeat`:

```ts
// A seat's max HP: half its two generals' printed HP, rounded down.
export function combinedMaxHp(mainMaxHp: number, deputyMaxHp: number): number {
  return Math.floor((mainMaxHp + deputyMaxHp) / 2);
}
```

and in `createSeat` replace the sum line with:

```ts
  const maxCombinedHp = combinedMaxHp(maxHpLookup(mainGeneralId), maxHpLookup(deputyGeneralId));
```

In `projects/engine/src/lib/rules/generalSelection.ts`, add `import { combinedMaxHp } from '../domain/factories';` and replace line 55:

```ts
  const maxCombinedHp = combinedMaxHp(main.maxHp, deputy.maxHp);
```

- [ ] **Step 4: Run the engine tests to verify they pass**

Run: `npx jest --selectProjects engine`
Expected: PASS.

- [ ] **Step 5: Update the content test helper and assertion**

In `projects/content/src/lib/modes/kingdomWar.spec.ts`, change the import to `import { createGame, resolve, getActiveSeatId, getLegalActions, combinedMaxHp } from 'engine';`. In `seated`, replace `const maxCombinedHp = main.maxHp + deputy.maxHp;` with `const maxCombinedHp = combinedMaxHp(main.maxHp, deputy.maxHp);`. In the test "a full selection through resolve seats every seat with a same-kingdom pair and starts Judgment", replace `expect(seat.maxCombinedHp).toBe(main.maxHp + deputy.maxHp);` with:

```ts
      expect(seat.maxCombinedHp).toBe(Math.floor((main.maxHp + deputy.maxHp) / 2));
```

- [ ] **Step 6: Run the whole suite**

Run: `npx jest`
Expected: PASS. If any other test fails on an HP value computed from general selection, update that number to the halved value and name the test in the commit message.

- [ ] **Step 7: Commit**

```bash
git add projects/engine/src/lib/domain/factories.ts projects/engine/src/lib/domain/factories.spec.ts projects/engine/src/lib/rules/generalSelection.ts projects/engine/src/lib/rules/generalSelection.spec.ts projects/content/src/lib/modes/kingdomWar.spec.ts
git commit -m "feat(engine): max HP is half the two generals' HP, rounded down

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Six phases, hand limit, and which phases wait

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts:23`
- Modify: `projects/engine/src/lib/rules/phaseSequence.ts`
- Create: `projects/engine/src/lib/rules/handLimit.ts`
- Modify: `projects/engine/src/public-api.ts`
- Test: `projects/engine/src/lib/rules/phaseSequence.spec.ts`
- Test: `projects/engine/src/lib/rules/handLimit.spec.ts` (create)

**Interfaces:**
- Produces:
  - `Phase = 'GeneralSelection' | 'Start' | 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End'`;
  - `PHASE_ORDER = ['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End']`;
  - `handLimit(state: GameState, seatId: string): number`;
  - `cardsOverHandLimit(state: GameState, seatId: string): number`;
  - `phaseWaitsForPlayer(state: GameState): boolean`.

  All are exported from `engine`.

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/rules/handLimit.spec.ts`:

```ts
import { handLimit, cardsOverHandLimit } from './handLimit';
import { phaseWaitsForPlayer } from './phaseSequence';
import { CardInstance, GameState, Phase } from '../domain/types';
import { createRng } from '../rng/rng';

function cards(n: number): CardInstance[] {
  return Array.from({ length: n }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'sha', suit: 'spade' as const, rank: 1 }));
}

function state(phase: Phase, handSize: number, combinedHp: number): GameState {
  return {
    seats: [{
      id: 'seat-a', index: 0, kingdom: 'Wei',
      generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
      combinedHp, maxCombinedHp: 4,
      hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
    }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
    zones: [{ id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: cards(handSize) }],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('hand limit', () => {
  it('equals the seat’s current HP', () => {
    expect(handLimit(state('Discard', 0, 3), 'seat-a')).toBe(3);
  });

  it('has a limit of 0 at 0 HP (Review Focus 2)', () => {
    expect(handLimit(state('Discard', 2, 0), 'seat-a')).toBe(0);
    expect(cardsOverHandLimit(state('Discard', 2, 0), 'seat-a')).toBe(2);
  });

  it('counts how many cards are over the limit, never below 0', () => {
    expect(cardsOverHandLimit(state('Discard', 6, 4), 'seat-a')).toBe(2);
    expect(cardsOverHandLimit(state('Discard', 4, 4), 'seat-a')).toBe(0);
    expect(cardsOverHandLimit(state('Discard', 1, 4), 'seat-a')).toBe(0);
  });

  it('throws for an unknown seat', () => {
    expect(() => handLimit(state('Discard', 0, 3), 'nobody')).toThrow('Unknown seat: nobody');
  });
});

describe('phaseWaitsForPlayer', () => {
  it('always waits in Play', () => {
    expect(phaseWaitsForPlayer(state('Play', 0, 4))).toBe(true);
  });

  it('waits in Discard only while the owner is over the hand limit', () => {
    expect(phaseWaitsForPlayer(state('Discard', 5, 4))).toBe(true);
    expect(phaseWaitsForPlayer(state('Discard', 4, 4))).toBe(false);
  });

  it('never waits in Start, Judgment, Draw or End', () => {
    for (const phase of ['Start', 'Judgment', 'Draw', 'End'] as const) {
      expect(phaseWaitsForPlayer(state(phase, 9, 1))).toBe(false);
    }
  });
});
```

In `projects/engine/src/lib/rules/phaseSequence.spec.ts`:
- In "cycles through phases in order without advancing the turn", change `state('Judgment', turn, seats)` to `state('Start', turn, seats)`.
- Rename "wraps to Judgment and advances to the next living seat clockwise after End" to "wraps to Start and advances to the next living seat clockwise after End", and change its `expect(result.phase).toBe('Judgment');` to `expect(result.phase).toBe('Start');`.
- Add:

```ts
  it('has six phases, starting at Start', () => {
    expect(PHASE_ORDER).toEqual(['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End']);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects engine rules/handLimit rules/phaseSequence`
Expected: FAIL. `./handLimit` can't be found, and the phase order lacks Start.

- [ ] **Step 3: Implement**

`projects/engine/src/lib/domain/types.ts` line 23:

```ts
export type Phase = 'GeneralSelection' | 'Start' | 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End';
```

Create `projects/engine/src/lib/rules/handLimit.ts`:

```ts
import { GameState, Seat } from '../domain/types';

function requireSeat(state: GameState, seatId: string): Seat {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  return seat;
}

// The most cards a seat may keep through its Discard phase: its current HP.
// Skills that change the limit hook in here, the only place it is computed.
export function handLimit(state: GameState, seatId: string): number {
  return Math.max(0, requireSeat(state, seatId).combinedHp);
}

// How many cards the seat must still discard to get down to its hand limit.
export function cardsOverHandLimit(state: GameState, seatId: string): number {
  const seat = requireSeat(state, seatId);
  const handSize = state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
  return Math.max(0, handSize - handLimit(state, seatId));
}
```

In `projects/engine/src/lib/rules/phaseSequence.ts`, add `import { cardsOverHandLimit } from './handLimit';`, change `PHASE_ORDER` and add `phaseWaitsForPlayer` below it:

```ts
export const PHASE_ORDER: readonly Phase[] = ['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End'];

// Whether the current phase must wait for the turn owner to act: always in
// Play, and in Discard while they are over their hand limit. Every other phase
// passes on its own once its entry triggers have resolved.
export function phaseWaitsForPlayer(state: GameState): boolean {
  if (state.phase === 'Play') return true;
  if (state.phase === 'Discard') return cardsOverHandLimit(state, state.turn.ownerSeatId) > 0;
  return false;
}
```

In `projects/engine/src/public-api.ts`, add after the `phaseSequence` line:

```ts
export * from './lib/rules/handLimit';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects engine`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: PASS. Phases are still advanced by hand in this task, so the extra Start phase only adds one more End phase step. The tests that loop on End phase (game-board, game.service, sim) take it in stride.

- [ ] **Step 6: Commit**

```bash
git add projects/engine/src/lib/domain/types.ts projects/engine/src/lib/rules/phaseSequence.ts projects/engine/src/lib/rules/phaseSequence.spec.ts projects/engine/src/lib/rules/handLimit.ts projects/engine/src/lib/rules/handLimit.spec.ts projects/engine/src/public-api.ts
git commit -m "feat(engine): six turn phases starting at Start; hand limit equals current HP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: DiscardCardAction

**Files:**
- Modify: `projects/engine/src/lib/pipeline/actions.ts`
- Modify: `projects/engine/src/lib/rules/legality.ts`
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (new `case 'DiscardCardAction'` in `resolveAction`)
- Modify: `projects/app/src/app/labels.ts` (`actionLabel` must handle every action kind or the app stops compiling)
- Test: `projects/engine/src/lib/pipeline/discard.spec.ts` (create)
- Test: `projects/app/src/app/labels.spec.ts`

**Interfaces:**
- Consumes: `cardsOverHandLimit` (Task 2).
- Produces: the `Action` union member `{ kind: 'DiscardCardAction'; seatId: string; cardInstanceId: string }`. While the turn owner is in Discard and over the limit, `getLegalActions` returns exactly one `DiscardCardAction` per hand card, in hand order, and nothing else. `actionLabel` returns `"Discard <card name>"`.

- [ ] **Step 1: Write the failing engine tests**

Create `projects/engine/src/lib/pipeline/discard.spec.ts`:

```ts
import { resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { createRng } from '../rng/rng';
import { GameState, Phase } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action } from './actions';

const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};
const ctx = { registry, mode };

// seat-a owns the turn with HP 1 and three cards in hand: two over the limit.
function state(phase: Phase = 'Discard', combinedHp = 1): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
  });
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: ['h1', 'h2', 'h3'].map((instanceId) => ({ instanceId, definitionId: 'sha', suit: 'spade' as const, rank: 1 })) },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const discard = (cardInstanceId: string): Action => ({ kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId });
const zone = (s: GameState, id: string) => s.zones.find((z) => z.id === id)!.cards.map((c) => c.instanceId);

describe('DiscardCardAction', () => {
  it('offers one discard per hand card, and nothing else, while over the hand limit (Review Focus 2)', () => {
    expect(getLegalActions(state(), 'seat-a', registry)).toEqual([discard('h1'), discard('h2'), discard('h3')]);
    expect(getLegalActions(state('Discard', 0), 'seat-a', registry)).toHaveLength(3);
    expect(getLegalActions(state(), 'seat-b', registry)).toEqual([]);
  });

  it('moves the chosen card to the discard pile and logs a CardMovedEvent', () => {
    const { state: next, events } = resolve(state(), discard('h2'), ctx);
    expect(zone(next, 'seat-a:hand')).toEqual(['h1', 'h3']);
    expect(zone(next, 'discardPile')).toEqual(['h2']);
    expect(events[0]).toEqual({ kind: 'CardMovedEvent', cardInstanceId: 'h2', toZoneId: 'discardPile' });
  });

  it('stops offering discards once the hand is down to the limit', () => {
    const once = resolve(state(), discard('h1'), ctx).state;
    const twice = resolve(once, discard('h2'), ctx).state;
    expect(zone(twice, 'seat-a:hand')).toEqual(['h3']);
    expect(getLegalActions(twice, 'seat-a', registry).some((a) => a.kind === 'DiscardCardAction')).toBe(false);
  });

  it('rejects a discard outside the Discard phase', () => {
    expect(() => resolve(state('Play'), discard('h1'), ctx)).toThrow('Cards can only be discarded during your Discard phase');
  });

  it('rejects a discard when the seat is within its hand limit', () => {
    expect(() => resolve(state('Discard', 3), discard('h1'), ctx)).toThrow('is within its hand limit');
  });

  it('rejects discarding a card the seat does not hold', () => {
    expect(() => resolve(state(), discard('nope'), ctx)).toThrow('Seat seat-a does not hold card nope');
  });

  it('rejects a discard from a seat that does not own the turn', () => {
    expect(() =>
      resolve(state(), { kind: 'DiscardCardAction', seatId: 'seat-b', cardInstanceId: 'h1' }, ctx)
    ).toThrow('Cards can only be discarded during your Discard phase');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects engine pipeline/discard`
Expected: FAIL to compile. `'DiscardCardAction'` is not assignable to `Action['kind']`.

- [ ] **Step 3: Implement the action, legality and resolution**

`projects/engine/src/lib/pipeline/actions.ts`: add the union member after `EndPhaseAction`, and add `'DiscardCardAction'` to `ACTION_KINDS`:

```ts
  | { kind: 'EndPhaseAction'; seatId: string }
  | { kind: 'DiscardCardAction'; seatId: string; cardInstanceId: string };
```

```ts
  'EndPhaseAction',
  'DiscardCardAction',
]);
```

`projects/engine/src/lib/rules/legality.ts`: add `import { cardsOverHandLimit } from './handLimit';`. Directly after `if (state.turn.ownerSeatId !== seatId) return [];`, insert:

```ts
  // Over the hand limit in the Discard phase: discarding is the only move.
  if (state.phase === 'Discard' && cardsOverHandLimit(state, seatId) > 0) {
    const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
    return (handZone?.cards ?? []).map((card) => ({ kind: 'DiscardCardAction' as const, seatId, cardInstanceId: card.instanceId }));
  }
```

`projects/engine/src/lib/pipeline/resolve.ts`: add `import { cardsOverHandLimit } from '../rules/handLimit';`, and add this case before `case 'RevealGeneralAction':`:

```ts
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
```

- [ ] **Step 4: Run the engine tests to verify they pass**

Run: `npx jest --selectProjects engine`
Expected: PASS.

- [ ] **Step 5: Write the failing label test**

In `projects/app/src/app/labels.spec.ts`, add inside the `actionLabel` describe block (next to "labels PassAction and EndPhaseAction"). `stateWithZones()` holds `card-1`, a Sha, and `registryWithSha()` names it "Sha":

```ts
  it('labels DiscardCardAction with the card name', () => {
    expect(
      actionLabel({ kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'card-1' }, stateWithZones(), registryWithSha())
    ).toBe('Discard Sha');
  });
```

Run: `npx jest --selectProjects app labels`
Expected: FAIL. `actionLabel` returns `undefined` for the new kind, or fails to compile because not every code path returns a value.

- [ ] **Step 6: Implement the label**

In `projects/app/src/app/labels.ts` `actionLabel`, after the `EndPhaseAction` case:

```ts
    case 'DiscardCardAction':
      return `Discard ${cardDisplayName(state, registry, action.cardInstanceId)}`;
```

- [ ] **Step 7: Run the whole suite**

Run: `npx jest`
Expected: PASS. Bots that land in an over-limit Discard phase (still reached by hand in this task) fall through to the rule-based policy's `legal[0]` fallback, a discard, so simulated games still terminate.

- [ ] **Step 8: Commit**

```bash
git add projects/engine/src/lib/pipeline/actions.ts projects/engine/src/lib/rules/legality.ts projects/engine/src/lib/pipeline/resolve.ts projects/engine/src/lib/pipeline/discard.spec.ts projects/app/src/app/labels.ts projects/app/src/app/labels.spec.ts
git commit -m "feat(engine): discard down to the hand limit one card at a time in the Discard phase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The engine passes phases with no decision

**Files:**
- Modify: `projects/engine/src/lib/pipeline/resolve.ts`
- Modify: `projects/engine/src/lib/rules/generalSelection.ts` (`phase: finished ? 'Start' : 'GeneralSelection'`)
- Modify: `projects/engine/src/lib/rules/legality.ts`
- Modify: `docs/superpowers/specs/2026-10-02-turn-phases-design.md` (the loop-bound test line, see "Deviation from the spec")
- Test: `projects/engine/src/lib/pipeline/autoAdvance.spec.ts` (create)
- Test, updated for the new behaviour:
  - `projects/engine/src/lib/pipeline/resolve.spec.ts` ("resolve: EndPhaseAction")
  - `projects/engine/src/lib/rules/playability.spec.ts` (two tests)
  - `projects/engine/src/lib/rules/generalSelection.spec.ts` ("starts turn 1 at Judgment…")
  - `projects/content/src/lib/generals/setOne.spec.ts` (two Insight tests)
  - `projects/content/src/lib/modes/kingdomWar.spec.ts` (`seated` phase, the full-selection test, two draw tests)
  - `projects/app/src/app/game.service.spec.ts` (around line 82)
  - `projects/app/src/app/game-board/game-board.spec.ts` (around line 128)

**Interfaces:**
- Consumes: `phaseWaitsForPlayer`, `cardsOverHandLimit` (Task 2), `DiscardCardAction` (Task 3).
- Produces: `export function advanceToDecision(state: GameState, ctx: EngineContext): ResolveResult` and `export const MAX_AUTO_PHASE_STEPS_PER_SEAT = 6`, both from `pipeline/resolve.ts` and exported from `engine`.

  `resolve()` now always returns a state resting on a decision: a game result, `GeneralSelection`, a pending response, Play, or Discard over the limit. Every phase entered, including Start, logs a `PhaseChangedEvent { seatId: <turn owner>, phase }`. `getLegalActions` offers `EndPhaseAction` only in Play. Outside Play and an over-limit Discard, the turn owner has no legal actions.

- [ ] **Step 1: Write the failing auto-advance tests**

Create `projects/engine/src/lib/pipeline/autoAdvance.spec.ts`:

```ts
import { resolve, advanceToDecision } from './resolve';
import { getLegalActions } from '../rules/legality';
import { createRng } from '../rng/rng';
import { CardInstance, GameResult, GameState, Phase } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { EngineEvent, PhaseChangedEvent } from './events';

const selfDestruct: CardDefinition = {
  id: 'self-destruct', name: 'Self Destruct', category: 'basic',
  legalPlayTargets: () => [[]],
  play: (_state, ctx) => [{ kind: 'EliminateSeatEffect', seatId: ctx.seatId }],
};
const registry: ContentRegistry = { cards: new Map([['self-destruct', selfDestruct]]), generals: new Map() };

// Like Kingdom War: whoever enters Draw draws 2.
function mode(checkWinCondition: (s: GameState) => GameResult | null = () => null): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition,
    triggers: [{
      point: 'after:PhaseChangedEvent',
      condition: (_s, subject) => (subject as PhaseChangedEvent).phase === 'Draw',
      effect: (_s, subject) => [{ kind: 'DrawCardsEffect', seatId: (subject as PhaseChangedEvent).seatId, count: 2 }],
    }],
  };
}
const ctx = { registry, mode: mode() };

const card = (instanceId: string, definitionId = 'sha'): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 1 });

// Three seats at HP 4; seat-a owns turn 1. The draw pile holds 20 cards.
function state(phase: Phase, handA: CardInstance[] = []): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 4, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
  });
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2)],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: Array.from({ length: 20 }, (_, i) => card(`d${i}`)) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...['seat-a', 'seat-b', 'seat-c'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'seat-a' ? handA : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const phasesOf = (events: EngineEvent[] | { kind: string }[]) =>
  (events as EngineEvent[]).flatMap((e) =>
    e.kind === 'PhaseChangedEvent' ? [`${e.seatId}:${e.phase}`] : e.kind === 'TurnAdvancedEvent' ? [`turn ${e.turnNumber}`] : []
  );
const handOf = (s: GameState, seatId: string) => s.zones.find((z) => z.id === `${seatId}:hand`)!.cards;
const endPhase = { kind: 'EndPhaseAction' as const, seatId: 'seat-a' };

describe('advanceToDecision', () => {
  it('passes Start, Judgment and Draw on its own and rests in Play after drawing 2', () => {
    const { state: next, events } = advanceToDecision(state('Start'), ctx);
    expect(next.phase).toBe('Play');
    expect(next.turn.ownerSeatId).toBe('seat-a');
    expect(phasesOf(events)).toEqual(['seat-a:Judgment', 'seat-a:Draw', 'seat-a:Play']);
    expect(handOf(next, 'seat-a')).toHaveLength(2);
  });

  it('leaves a state that already waits untouched', () => {
    const resting = state('Play');
    expect(advanceToDecision(resting, ctx)).toEqual({ state: resting, events: [] });
  });

  it('stops at once when a phase trigger ends the game (Review Focus 4)', () => {
    const result: GameResult = { endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: [] };
    const winsOnDraw = mode((s) => (s.phase === 'Draw' ? result : null));
    const { state: next } = advanceToDecision(state('Start'), { registry, mode: winsOnDraw });
    expect(next.phase).toBe('Draw');
    expect(next.result).toEqual(result);
  });

  it('fails loudly when every seat is eliminated and the mode names no winner', () => {
    const s = state('Play');
    const allOut = { ...s, seats: s.seats.map((seat) => ({ ...seat, eliminated: true })) };
    expect(() => advanceToDecision(allOut, ctx)).toThrow('every seat is eliminated');
  });
});

describe('resolve with auto-advance', () => {
  it('ends Play within the hand limit and rests in the next seat’s Play, entering every phase on the way', () => {
    const { state: next, events } = resolve(state('Play', [card('a1')]), endPhase, ctx);
    expect(next.turn).toEqual({ turnNumber: 2, ownerSeatId: 'seat-b', extraTurnStack: [] });
    expect(next.phase).toBe('Play');
    expect(phasesOf(events)).toEqual([
      'seat-a:Discard', 'seat-a:End', 'turn 2', 'seat-b:Start', 'seat-b:Judgment', 'seat-b:Draw', 'seat-b:Play',
    ]);
  });

  it('rests in Discard when over the hand limit, then moves on once the seat has discarded down to it', () => {
    const hand = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id) => card(id));
    const atDiscard = resolve(state('Play', hand), endPhase, ctx).state;
    expect(atDiscard.phase).toBe('Discard');
    expect(getLegalActions(atDiscard, 'seat-a', registry).map((a) => a.kind)).toEqual(Array(6).fill('DiscardCardAction'));

    const once = resolve(atDiscard, { kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId: 'a1' }, ctx).state;
    expect(once.phase).toBe('Discard');
    const twice = resolve(once, { kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId: 'a2' }, ctx).state;
    expect(handOf(twice, 'seat-a')).toHaveLength(4);
    expect(twice.turn.ownerSeatId).toBe('seat-b');
    expect(twice.phase).toBe('Play');
  });

  it('accepts End phase only in the Play phase', () => {
    for (const phase of ['Start', 'Judgment', 'Draw', 'Discard', 'End'] as const) {
      expect(() => resolve(state(phase), endPhase, ctx)).toThrow('EndPhaseAction is only legal in the Play phase');
    }
  });

  it('offers End phase only in Play, and nothing at all in a phase that passes on its own', () => {
    expect(getLegalActions(state('Play'), 'seat-a', registry)).toContainEqual(endPhase);
    for (const phase of ['Start', 'Judgment', 'Draw', 'Discard', 'End'] as const) {
      expect(getLegalActions(state(phase), 'seat-a', registry)).toEqual([]);
    }
  });

  it('skips the rest of the turn when the owner is eliminated by their own play (Review Focus 1)', () => {
    const { state: next, events } = resolve(
      state('Play', [card('boom', 'self-destruct')]),
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'boom', targets: [] },
      ctx
    );
    expect(next.seats.find((s) => s.id === 'seat-a')!.eliminated).toBe(true);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
    expect(phasesOf(events)).not.toContain('seat-a:Discard');
    expect(phasesOf(events)).not.toContain('seat-a:End');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects engine pipeline/autoAdvance`
Expected: FAIL. `advanceToDecision` is not exported.

- [ ] **Step 3: Implement phase entry and the loop**

In `projects/engine/src/lib/pipeline/resolve.ts`:

Imports: change the phaseSequence import to `import { advancePhaseOrTurn, phaseWaitsForPlayer } from '../rules/phaseSequence';`, and add `import { PhaseChangedEvent, TurnAdvancedEvent } from './events';`.

Replace `resolve` with:

```ts
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
```

Replace the body of `case 'EndPhaseAction':` with:

```ts
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
```

Replace `case 'ChooseGeneralsAction':` with:

```ts
    case 'ChooseGeneralsAction': {
      const { state: chosen, event } = applyGeneralChoice(state, action, ctx.registry);
      const followUp = runAfterTriggers(chosen, event, ctx, depth);
      if (followUp.state.phase !== 'Start') return { state: followUp.state, events: [event, ...followUp.events] };
      // The last seat has chosen: turn 1 begins at Start.
      const started = enterPhase(followUp.state, ctx, depth);
      return { state: started.state, events: [event, ...followUp.events, ...started.events] };
    }
```

Update the comment above `runAfterTriggers` ("Shared by the effect resolution path and by EndPhaseAction's phase/turn events") to say "…and by phase and turn changes".

In `projects/engine/src/lib/rules/generalSelection.ts`, change `phase: finished ? 'Judgment' : 'GeneralSelection',` to `phase: finished ? 'Start' : 'GeneralSelection',`.

In `projects/engine/src/lib/rules/legality.ts`, replace everything after the Discard block from Task 3 with:

```ts
  // Only the Play phase waits for the turn owner; every other phase passes on its own.
  if (state.phase !== 'Play') return [];
  const actions: Action[] = [{ kind: 'EndPhaseAction', seatId }];
  const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
  for (const card of handZone?.cards ?? []) {
    for (const targets of legalTargetListsFor(state, seatId, card.instanceId, card.definitionId, registry)) {
      actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets });
    }
  }
  return actions;
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx jest --selectProjects engine pipeline/autoAdvance pipeline/discard`
Expected: PASS.

- [ ] **Step 5: Update the engine tests that encoded manual phase stepping**

`projects/engine/src/lib/pipeline/resolve.spec.ts`, the test "advances the phase and logs a PhaseChangedEvent" inside `describe('resolve: EndPhaseAction')`. `baseState()` is seat-a in Play with an empty hand, and the stub mode has no draw. Rename it to "ends the Play phase and rests in the next seat's Play phase", and replace its expectations with:

```ts
    expect(state.phase).toBe('Play');
    expect(state.turn.ownerSeatId).toBe('seat-b');
    expect(events).toEqual([
      { kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'Discard' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'End' },
      { kind: 'TurnAdvancedEvent', seatId: 'seat-b', turnNumber: 2 },
      { kind: 'PhaseChangedEvent', seatId: 'seat-b', phase: 'Start' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-b', phase: 'Judgment' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-b', phase: 'Draw' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-b', phase: 'Play' },
    ]);
```

(Destructure `state` from the `resolve` call if the test only takes `events` today.)

`projects/engine/src/lib/rules/playability.spec.ts`:
- Replace "offers no card plays outside the Play phase, but still End phase (Review Focus 4)" with:

```ts
  it('offers nothing outside the Play phase: those phases pass on their own (Review Focus 4)', () => {
    for (const phase of ['Start', 'Judgment', 'Draw', 'Discard', 'End'] as const) {
      expect(getLegalActions(state(phase, ['self', 'aim']), 'seat-a', registry)).toEqual([]);
    }
  });
```

  (The `state` helper's seat-a has HP 4 and holds 2 cards here, so Discard is within the limit. The helper's mode has no triggers, so nothing draws.)
- In "starts a new turn with no play counts", change `state('End', [])` to `state('Play', [])`. Ending Play with an empty hand passes Discard and End and starts turn 2.

`projects/engine/src/lib/rules/generalSelection.spec.ts`: replace "starts turn 1 at Judgment once the last seat has chosen" with:

```ts
  it('starts turn 1 at Start once the last seat has chosen, and settles in its Play phase', () => {
    const afterA = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), ctx).state;
    const { state, events } = resolve(afterA, choose('seat-b', 'u1', 'u2'), ctx);
    expect(state.phase).toBe('Play');
    expect(state.generalSelection).toBeNull();
    expect(state.turn).toEqual({ turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] });
    expect(state.seats.map((s) => s.kingdom)).toEqual(['Wei', 'Wu']);
    expect(events.filter((e) => e.kind === 'PhaseChangedEvent')).toEqual([
      { kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'Start' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'Judgment' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'Draw' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'Play' },
    ]);
  });
```

Run: `npx jest --selectProjects engine`
Expected: PASS.

- [ ] **Step 6: Update the content tests**

`projects/content/src/lib/generals/setOne.spec.ts`: add `advanceToDecision` to the `engine` import. In both "Zhuge Liang — Insight" tests, replace the `resolve(state, { kind: 'EndPhaseAction', … })` call with the line below, and `expect(next.phase).toBe('Draw');` with `expect(next.phase).toBe('Play');`. The rest of each test stays as is.

```ts
    const { state: next } = advanceToDecision({ ...state, phase: 'Start' }, { registry: registry(), mode: stubMode() });
```

`projects/content/src/lib/modes/kingdomWar.spec.ts`: add `advanceToDecision` to the `engine` import.
- In `seated`, change `phase: 'Judgment',` to `phase: 'Start',`.
- In "a full selection through resolve…", rename it to end "…and settles in turn 1's Play phase" and change `expect(state.phase).toBe('Judgment');` to `expect(state.phase).toBe('Play');`.
- In both "Kingdom War per-turn draw" tests, replace the `resolve(state, { kind: 'EndPhaseAction', … })` call with `advanceToDecision(state, { registry, mode: kingdomWarMode })`, and `expect(next.phase).toBe('Draw');` with `expect(next.phase).toBe('Play');`. The hand-count assertions stay the same: 2 new cards, 3 for Zhuge Liang.

Run: `npx jest --selectProjects content`
Expected: PASS.

- [ ] **Step 7: Update the app tests**

`projects/app/src/app/game.service.spec.ts`: rename "completes general selection for every seat, then starts turn 1 at Judgment" to "…then settles in turn 1's Play phase", and change `expect(state.phase).toBe('Judgment');` to `expect(state.phase).toBe('Play');`.

`projects/app/src/app/game-board/game-board.spec.ts`, test "submits a card played from the hand and gates the next view": delete the comment line `// Cards are played in the Play phase only: step the active seat from Judgment to Play.` and the `for (let i = 0; i < 2; i++) gameService.submit(…EndPhaseAction…)` line below it. Also delete the `gameService.reveal(gameService.activeSeatId()!);` that directly follows them, because the seat is already revealed above.

- [ ] **Step 8: Run the whole suite**

Run: `npx jest`
Expected: PASS. If a test not listed in this task fails, it almost certainly encodes the old manual phase stepping (it ends a phase outside Play, or expects to rest in Judgment or Draw). Stop and report it with its name and failure rather than changing what it checks.

- [ ] **Step 9: Record the spec deviation**

In `docs/superpowers/specs/2026-10-02-turn-phases-design.md`, under "## Testing", replace the bullet starting `- **Loop bound:**` with:

```markdown
- **No winner with every seat eliminated:** the loop fails loudly (the
  existing "every seat is eliminated" error) instead of spinning. The step
  bound stays as a defensive guard but has no test: Play always waits, so no
  content can construct a run that reaches it.
```

- [ ] **Step 10: Commit**

```bash
git add projects/engine projects/content/src/lib/generals/setOne.spec.ts projects/content/src/lib/modes/kingdomWar.spec.ts projects/app/src/app/game.service.spec.ts projects/app/src/app/game-board/game-board.spec.ts docs/superpowers/specs/2026-10-02-turn-phases-design.md
git commit -m "feat(engine): pass every phase that needs no decision; End phase only in Play

Turns now open at Start and every phase entered raises a PhaseChangedEvent.
resolve() settles on the next decision, and an eliminated turn owner's turn
ends at once instead of freezing the game.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Bots discard their least useful card

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts`
- Test: `projects/bots/src/lib/rule-based.spec.ts`

**Interfaces:**
- Consumes: `DiscardCardAction` (Task 3).
- Produces: in the Discard phase, `ruleBasedPolicy.decide` returns the legal discard of the card it most wants to lose. The keep order runs Peach (kept longest), Shan, Sha, equipment, then everything else (lost first). Ties go to the first in hand order.

- [ ] **Step 1: Write the failing tests**

In `projects/bots/src/lib/rule-based.spec.ts`, add next to the `play` helper:

```ts
const discard = (instanceId: string): Action => ({ kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: instanceId });
```

Replace the test "ends the phase outside the Play phase" with:

```ts
  describe('in the Discard phase', () => {
    const hand = (...ids: [string, string][]) => ids.map(([instanceId, definitionId]) => ({ instanceId, definitionId }));

    it('discards a tool before equipment, Sha, Shan or Peach', () => {
      const h = hand(['p', 'peach'], ['s', 'sha'], ['d', 'duel'], ['e', 'shan'], ['b', 'blade']);
      const legal = h.map((c) => discard(c.instanceId));
      expect(decide(view({ phase: 'Discard', hand: h }), legal).action).toEqual(discard('d'));
    });

    it('keeps Peach longest, then Shan, then Sha, then equipment', () => {
      const pick = (h: { instanceId: string; definitionId: string }[]) =>
        decide(view({ phase: 'Discard', hand: h }), h.map((c) => discard(c.instanceId))).action;
      expect(pick(hand(['p', 'peach'], ['e', 'shan']))).toEqual(discard('e'));
      expect(pick(hand(['e', 'shan'], ['s', 'sha']))).toEqual(discard('s'));
      expect(pick(hand(['s', 'sha'], ['b', 'blade']))).toEqual(discard('b'));
    });

    it('breaks ties by hand order', () => {
      const h = hand(['d1', 'duel'], ['d2', 'duel']);
      expect(decide(view({ phase: 'Discard', hand: h }), h.map((c) => discard(c.instanceId))).action).toEqual(discard('d1'));
    });

    it('still discards when the per-turn safety cap is reached (Review Focus 5)', () => {
      const h = hand(['d1', 'duel'], ['p', 'peach']);
      const memory = { turnNumber: 1, shaPlayed: 0, actionsThisTurn: MAX_BOT_ACTIONS_PER_TURN };
      expect(decide(view({ phase: 'Discard', hand: h }), h.map((c) => discard(c.instanceId)), memory).action).toEqual(discard('d1'));
    });
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects bots rule-based`
Expected: FAIL. The bot returns the first legal action (`discard('p')`) via its fallback.

- [ ] **Step 3: Implement**

In `projects/bots/src/lib/rule-based.ts`, add next to the other type aliases:

```ts
type DiscardCard = Extract<Action, { kind: 'DiscardCardAction' }>;
```

Add above `decide`:

```ts
// Higher = keep longer. Peach saves a life, Shan blocks a Sha, Sha attacks.
function keepRank(view: GameState, registry: ContentRegistry, cardInstanceId: string): number {
  const definitionId = definitionIdOf(view, cardInstanceId);
  if (definitionId === 'peach') return 4;
  if (definitionId === 'shan') return 3;
  if (definitionId === 'sha') return 2;
  if (definitionId && registry.cards.get(definitionId)?.category === 'equipment') return 1;
  return 0;
}
```

In `decide`, replace the block from `const endPhase = …` through the `// 4. Nothing to do outside the Play phase.` line and its `if` with:

```ts
  // 3. Discard phase: lose the least useful card first, first in hand on ties.
  const discards = legal.filter((a): a is DiscardCard => a.kind === 'DiscardCardAction');
  if (discards.length > 0) {
    return take(
      discards.reduce((best, a) =>
        keepRank(view, registry, a.cardInstanceId) < keepRank(view, registry, best.cardInstanceId) ? a : best
      )
    );
  }

  const endPhase = legal.find((a) => a.kind === 'EndPhaseAction');
  // 4. Safety cap.
  if (endPhase && mem.actionsThisTurn >= MAX_BOT_ACTIONS_PER_TURN) return take(endPhase);
```

Renumber the following comments: `// 5. Play phase.` stays, and `// 6. Fallback: never stall.` stays.

- [ ] **Step 4: Run the bot tests to verify they pass**

Run: `npx jest --selectProjects bots`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/bots/src/lib/rule-based.ts projects/bots/src/lib/rule-based.spec.ts
git commit -m "feat(bots): discard the least useful card first in the Discard phase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sim checks that games only rest on a decision, and that the hand limit holds

**Files:**
- Modify: `projects/sim/src/invariants.ts`
- Modify: `projects/sim/src/runGame.ts`
- Modify: `projects/sim/src/property.spec.ts`
- Test: `projects/sim/src/invariants.spec.ts`

**Interfaces:**
- Consumes: `phaseWaitsForPlayer`, `cardsOverHandLimit` (Task 2), and the auto-advance loop (Task 4).
- Produces: `export function checkRestingState(state: GameState): string[]` from `invariants.ts`. `runGame(initialState, ctx, botRngSeed, maxActions = 2000, botKind = 'random', onStep?: (state: GameState) => void)` calls `onStep` after every resolved action.

- [ ] **Step 1: Write the failing tests**

In `projects/sim/src/invariants.spec.ts`, change the import to also bring in `checkRestingState`, and add the block below. If the file already has a helper that builds a valid `GameState`, reuse it instead of `restingState` and keep only the phase, hand and HP overrides.

```ts
describe('checkRestingState', () => {
  function restingState(phase: GameState['phase'], handSize = 0, combinedHp = 4): GameState {
    return {
      seats: [{
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp, maxCombinedHp: 4,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      }],
      players: [], turn: { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
      zones: [{
        id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a',
        cards: Array.from({ length: handSize }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'sha', suit: 'spade' as const, rank: 1 })),
      }],
      pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    };
  }

  it('accepts Play, an over-limit Discard, and general selection', () => {
    expect(checkRestingState(restingState('Play'))).toEqual([]);
    expect(checkRestingState(restingState('Discard', 6, 4))).toEqual([]);
    expect(checkRestingState(restingState('GeneralSelection'))).toEqual([]);
  });

  it('flags a game resting in a phase with no decision to make', () => {
    expect(checkRestingState(restingState('Draw'))).toEqual([
      "Game is resting in seat-a's Draw phase (turn 3) with no decision to make",
    ]);
    expect(checkRestingState(restingState('Discard', 2, 4))).toHaveLength(1);
  });

  it('accepts any phase once the game has ended', () => {
    expect(checkRestingState({ ...restingState('Draw'), result: { endedAt: 3, winningSeatIds: [], losingSeatIds: [] } })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects sim invariants`
Expected: FAIL. `checkRestingState` is not exported.

- [ ] **Step 3: Implement**

In `projects/sim/src/invariants.ts`, change the import to `import { phaseWaitsForPlayer } from 'engine';` plus the existing `import type { ContentRegistry, GameState } from 'engine';`, and add at the bottom:

```ts
// Between actions the engine must only ever rest where someone has to decide.
export function checkRestingState(state: GameState): string[] {
  if (state.result || state.pendingResponse || state.phase === 'GeneralSelection' || phaseWaitsForPlayer(state)) {
    return [];
  }
  return [
    `Game is resting in ${state.turn.ownerSeatId}'s ${state.phase} phase (turn ${state.turn.turnNumber}) with no decision to make`,
  ];
}
```

In `projects/sim/src/runGame.ts`, add the parameter and the call:

```ts
export function runGame(
  initialState: GameState,
  ctx: EngineContext,
  botRngSeed: number,
  maxActions = 2000,
  botKind: BotKind = 'random',
  onStep?: (state: GameState) => void
): RunGameResult {
```

and after `state = resolve(state, action, ctx).state;`:

```ts
    onStep?.(state);
```

- [ ] **Step 4: Run the sim unit tests to verify they pass**

Run: `npx jest --selectProjects sim invariants runGame`
Expected: PASS.

- [ ] **Step 5: Check every step of every simulated game**

In `projects/sim/src/property.spec.ts`:

Imports become:

```ts
import { createGame, cardsOverHandLimit } from 'engine';
import type { GameModeDefinition, PhaseChangedEvent } from 'engine';
import { buildContentRegistry, kingdomWarMode, kingdomWarMaxSeats } from 'content';
import { runGame } from './runGame';
import { checkInvariants, checkRestingState } from './invariants';
```

Inside the `it(...)`, after `const failures: string[] = [];`, add:

```ts
    // A probe that never fires: it records any seat entering End while still over its hand limit.
    const handLimitBreaches: string[] = [];
    const probedMode: GameModeDefinition = {
      ...kingdomWarMode,
      triggers: [
        ...kingdomWarMode.triggers,
        {
          point: 'after:PhaseChangedEvent',
          condition: (state, subject) => {
            const event = subject as PhaseChangedEvent;
            if (event.phase === 'End' && cardsOverHandLimit(state, event.seatId) > 0) {
              handLimitBreaches.push(`${event.seatId} entered End over its hand limit on turn ${state.turn.turnNumber}`);
            }
            return false;
          },
          effect: () => [],
        },
      ],
    };
```

Replace the `runGame(...)` call with:

```ts
          const restingViolations = new Set<string>();
          const { finalState, actionsSubmitted } = runGame(
            initialState,
            { registry, mode: probedMode },
            seed * 7 + 1,
            maxActions,
            botKind,
            (state) => checkRestingState(state).forEach((v) => restingViolations.add(v))
          );
```

and after the `const label = …` line add:

```ts
          if (restingViolations.size > 0) failures.push(`${label}: ${[...restingViolations].join('; ')}`);
          if (handLimitBreaches.length > 0) failures.push(`${label}: ${handLimitBreaches.splice(0).join('; ')}`);
```

- [ ] **Step 6: Run the property test**

Run: `npx jest --selectProjects sim property`
Expected: PASS within the existing 180 s timeout. If any game reports "did not terminate", the extra discards made games longer. Raise the rule-based budget from `20000` and the random budget from `5000` by the same factor, at most 2×, and note the change in the commit message. If it still doesn't terminate at 2×, stop and report the seed.

- [ ] **Step 7: Commit**

```bash
git add projects/sim/src/invariants.ts projects/sim/src/invariants.spec.ts projects/sim/src/runGame.ts projects/sim/src/property.spec.ts
git commit -m "test(sim): every simulated step rests on a decision and no seat leaves Discard over its hand limit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Phase indicator on the board

**Files:**
- Create: `projects/app/src/app/game-board/phase-indicator.ts`
- Create: `projects/app/src/app/game-board/phase-indicator.spec.ts`
- Modify: `projects/app/src/app/game-board/game-board.ts` (render it above the table)
- Modify: `projects/app/src/app/game-board/round-table.ts:20` (`Turn N` only)
- Test: `projects/app/src/app/game-board/round-table.spec.ts` ("shows turn, phase, turn owner and pile counts in the centre")
- Test: `projects/app/src/app/game-board/game-board.spec.ts`

**Interfaces:**
- Consumes: `cardsOverHandLimit` from `engine` (Task 2).
- Produces: a standalone `PhaseIndicator` component, selector `app-phase-indicator`, with inputs `state: GameState` (required) and `viewerSeatId: string | null`, and root element `.phase-indicator`.

- [ ] **Step 1: Write the failing component test**

Create `projects/app/src/app/game-board/phase-indicator.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { GameState } from 'engine';
import { PhaseIndicator } from './phase-indicator';

function state(phase: GameState['phase'], handSize = 0, combinedHp = 4): GameState {
  return {
    seats: [{
      id: 'seat-0', index: 0, kingdom: 'Wei',
      generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
      combinedHp, maxCombinedHp: 4,
      hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, eliminated: false,
    }],
    players: [], turn: { turnNumber: 2, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase,
    zones: [{
      id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0',
      cards: Array.from({ length: handSize }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'sha', suit: 'spade' as const, rank: 1 })),
    }],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

function render(s: GameState, viewerSeatId: string | null): string {
  const fixture = TestBed.createComponent(PhaseIndicator);
  fixture.componentRef.setInput('state', s);
  fixture.componentRef.setInput('viewerSeatId', viewerSeatId);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('.phase-indicator')!.textContent!.replace(/\s+/g, ' ').trim();
}

describe('PhaseIndicator', () => {
  it('shows the turn owner, (you) for the viewer, and the phase', () => {
    expect(render(state('Play'), 'seat-0')).toBe('seat-0 (you) – Play Phase');
  });

  it('leaves out (you) when it is someone else’s turn', () => {
    expect(render(state('Play'), 'seat-1')).toBe('seat-0 – Play Phase');
  });

  it('adds how many cards are left to discard while over the hand limit', () => {
    expect(render(state('Discard', 6, 4), 'seat-0')).toBe('seat-0 (you) – Discard Phase – discard 2 more');
  });

  it('names every phase the same way', () => {
    for (const phase of ['Start', 'Judgment', 'Draw', 'End'] as const) {
      expect(render(state(phase), null)).toBe(`seat-0 – ${phase} Phase`);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app phase-indicator`
Expected: FAIL. `./phase-indicator` is not found.

- [ ] **Step 3: Implement the component**

Create `projects/app/src/app/game-board/phase-indicator.ts`:

```ts
import { Component, computed, input } from '@angular/core';
import { GameState, cardsOverHandLimit } from 'engine';

// Whose turn it is and which phase, e.g. "seat-0 (you) – Play Phase".
// Presentational: every value comes from the (redacted) state or the engine.
@Component({
  selector: 'app-phase-indicator',
  template: `
    <div class="phase-indicator" role="status" aria-live="polite">
      <span class="seat">{{ state().turn.ownerSeatId }}</span>
      @if (isViewersTurn()) {
        <span class="you">(you)</span>
      }
      <span class="sep">–</span>
      <span class="phase">{{ state().phase }} Phase</span>
      @if (discardsLeft() > 0) {
        <span class="discard">– discard {{ discardsLeft() }} more</span>
      }
    </div>
  `,
  styles: `
    :host { display: block; position: sticky; top: 0; z-index: 2; }
    .phase-indicator {
      display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 6px;
      margin: 8px 0; padding: 8px 16px; border-radius: 12px;
      background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container);
      font-size: 1.25em; font-weight: 600;
    }
    .you { color: var(--mat-sys-primary); }
    .discard { color: var(--mat-sys-error); }
  `,
})
export class PhaseIndicator {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input<string | null>(null);

  protected readonly isViewersTurn = computed(() => this.state().turn.ownerSeatId === this.viewerSeatId());
  protected readonly discardsLeft = computed(() => {
    const state = this.state();
    return state.phase === 'Discard' ? cardsOverHandLimit(state, state.turn.ownerSeatId) : 0;
  });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest --selectProjects app phase-indicator`
Expected: PASS.

- [ ] **Step 5: Write the failing board and table tests**

In `projects/app/src/app/game-board/round-table.spec.ts`, in "shows turn, phase, turn owner and pile counts in the centre", rename it to "shows the turn number, turn owner and pile counts in the centre" and replace `expect(centre).toContain('Turn 3 · Play');` with:

```ts
    expect(centre).toContain('Turn 3');
    expect(centre).not.toContain('· Play');
```

In `projects/app/src/app/game-board/game-board.spec.ts`, add after "submits a card played from the hand and gates the next view":

```ts
  it('shows whose turn and which phase above the table', () => {
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    flushBots();
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const indicator = (fixture.nativeElement as HTMLElement).querySelector('app-phase-indicator')!;
    expect(indicator.textContent!.replace(/\s+/g, ' ').trim()).toBe('seat-0 (you) – Play Phase');
  });
```

Put this test inside `describe('GameBoard in vs-bots mode', …)`, which defines `flushBots()` and sets fake timers with `botDelayMs = 0`. seat-0 is the first seat, so after selection the human rests in their own turn 1 Play phase.

Run: `npx jest --selectProjects app round-table game-board`
Expected: FAIL. The centre still shows "· Play", and there is no `app-phase-indicator`.

- [ ] **Step 6: Implement the board and table changes**

In `projects/app/src/app/game-board/round-table.ts` line 20, replace:

```html
        <div class="turn">Turn {{ state().turn.turnNumber }} · {{ state().phase }}</div>
```

with:

```html
        <div class="turn">Turn {{ state().turn.turnNumber }}</div>
```

In `projects/app/src/app/game-board/game-board.ts`: add `import { PhaseIndicator } from './phase-indicator';`, add `PhaseIndicator` to `imports`, and insert directly above `<app-round-table …/>`:

```html
            <app-phase-indicator [state]="visible" [viewerSeatId]="viewerSeatId()" />
```

- [ ] **Step 7: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add projects/app/src/app/game-board/phase-indicator.ts projects/app/src/app/game-board/phase-indicator.spec.ts projects/app/src/app/game-board/game-board.ts projects/app/src/app/game-board/game-board.spec.ts projects/app/src/app/game-board/round-table.ts projects/app/src/app/game-board/round-table.spec.ts
git commit -m "feat(app): show whose turn and which phase above the table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Discard from the hand, and say why Play is disabled

**Files:**
- Modify: `projects/app/src/app/game-board/hand-view.ts`
- Test: `projects/app/src/app/game-board/hand-view.spec.ts`
- Test: `projects/app/src/app/game-board/game-board.spec.ts`

**Interfaces:**
- Consumes: `DiscardCardAction` (Task 3), and the engine resting in an over-limit Discard (Task 4).
- Produces: in `HandView`, a card whose legal actions are discards shows a main button `button.play.discard` reading "Discard". It emits the `DiscardCardAction` through the existing `play` output, which `GameBoard` already routes to `submit`. A card with no legal action gets a tooltip on the wrapper `.play-wrap`: "Only in your Play phase" when `state().phase !== 'Play'`, else "Can't be played now".

- [ ] **Step 1: Write the failing tests**

In `projects/app/src/app/game-board/hand-view.spec.ts`, add `import { By } from '@angular/platform-browser';` and `import { MatTooltip } from '@angular/material/tooltip';`. Then add inside `describe('HandView', ...)`:

```ts
  const tooltipFor = (instanceId: string) =>
    fixture.debugElement.query(By.css(`[data-card-id="${instanceId}"] .play-wrap`)).injector.get(MatTooltip);

  it('shows Discard, and emits the discard, for cards the engine says to discard', () => {
    const discardSha: Action = { kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'c-sha' };
    fixture.componentRef.setInput('actions', [discardSha]);
    fixture.componentRef.setInput('state', { ...state(), phase: 'Discard' });
    fixture.detectChanges();
    expect(playButton('c-sha').textContent).toContain('Discard');
    expect(playButton('c-sha').classList).toContain('discard');
    playButton('c-sha').click();
    expect(played).toEqual([discardSha]);
  });

  it('explains a disabled Play button', () => {
    expect(playButton('c-peach').disabled).toBe(true);
    expect(tooltipFor('c-peach').message).toBe("Can't be played now");
    expect(tooltipFor('c-peach').disabled).toBe(false);
    expect(tooltipFor('c-bow').disabled).toBe(true);

    fixture.componentRef.setInput('actions', []);
    fixture.componentRef.setInput('state', { ...state(), phase: 'Discard' });
    fixture.detectChanges();
    expect(tooltipFor('c-sha').message).toBe('Only in your Play phase');
  });
```

In `projects/app/src/app/game-board/game-board.spec.ts`, add:

```ts
  it('keeps the same seat’s view through a discard in pass-and-play (Review Focus 3)', () => {
    gameService.startGame(2, 1);
    finishSelection(gameService);
    const seatId = gameService.activeSeatId()!;
    gameService.reveal(seatId);
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'EndPhaseAction')!);
    // 4 dealt + 2 drawn = 6 cards against at most 4 HP: at least 2 over the limit.
    expect(gameService.state()!.phase).toBe('Discard');
    expect(gameService.activeSeatId()).toBe(seatId);

    gameService.reveal(seatId);
    gameService.submit(gameService.legalActions().find((a) => a.kind === 'DiscardCardAction')!);
    expect(gameService.lastError()).toBeNull();
    // Still at least 1 over: the same seat discards again, behind the usual gate.
    expect(gameService.state()!.phase).toBe('Discard');
    expect(gameService.activeSeatId()).toBe(seatId);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-reveal-gate-overlay')).not.toBeNull();
  });
```

Put this test inside `describe('GameBoard', …)` (pass-and-play), next to "re-shows the reveal gate for the next seat after an in-game action, post-selection". Every base-set general has 3 or 4 HP, so max HP is at most 4.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects app hand-view game-board`
Expected: FAIL. The hand-view button still reads "Play" for a discard, and there is no `.play-wrap`. The game-board test already passes after Task 4. It pins the existing re-gating behaviour so a later change can't break it.

- [ ] **Step 3: Implement**

In `projects/app/src/app/game-board/hand-view.ts`:

Extend the view model and the action matcher:

```ts
interface HandCardViewModel {
  card: CardInstance;
  name: string;
  actions: { action: Action; label: string }[];
  discarding: boolean;
  disabledReason: string;
}

function cardInstanceIdOf(action: Action): string | undefined {
  return action.kind === 'PlayCardAction' || action.kind === 'RespondAction' || action.kind === 'DiscardCardAction'
    ? action.cardInstanceId
    : undefined;
}
```

Replace the single-action `@else { <button … class="play" …> }` branch of the template with:

```html
            } @else {
              <span class="play-wrap" [matTooltip]="vm.disabledReason" [matTooltipDisabled]="!vm.disabledReason">
                <button
                  mat-flat-button
                  type="button"
                  class="play"
                  [class.discard]="vm.discarding"
                  [disabled]="vm.actions.length === 0"
                  (click)="play.emit(vm.actions[0].action)"
                >
                  @if (vm.discarding) {
                    <mat-icon>delete</mat-icon> Discard
                  } @else {
                    <mat-icon>play_arrow</mat-icon> Play
                  }
                </button>
              </span>
            }
```

Add to `styles`:

```css
    .play-wrap { display: flex; }
    .play-wrap button { flex: 1; }
    .overlay button.discard { --mat-button-filled-container-color: var(--mat-sys-error); }
```

Update the header comment to: `// … Hovering (or focusing, for touch) a card reveals its main button — Play, or Discard in the Discard phase, from the engine's legal actions for that card only — and Info.`

Replace `cardViewModels` with:

```ts
  protected readonly cardViewModels = computed<HandCardViewModel[]>(() =>
    this.cards().map((card) => {
      const actions = this.actions()
        .filter((action) => cardInstanceIdOf(action) === card.instanceId)
        .map((action) => ({ action, label: actionLabel(action, this.state(), this.registry()) }));
      return {
        card,
        name: CardInfoDialog.nameFor(card.definitionId, this.registry().cards.get(card.definitionId)?.name),
        actions,
        discarding: actions.some((a) => a.action.kind === 'DiscardCardAction'),
        disabledReason: actions.length > 0 ? '' : this.state().phase !== 'Play' ? 'Only in your Play phase' : "Can't be played now",
      };
    })
  );
```

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and both builds**

Run: `npx jest && npm run build && npx ng build app`
Expected: all tests PASS, and the engine, content and app builds succeed.

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/game-board/hand-view.ts projects/app/src/app/game-board/hand-view.spec.ts projects/app/src/app/game-board/game-board.spec.ts
git commit -m "feat(app): discard from the hand in the Discard phase; explain a disabled Play button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: See it in the running app

**Files:** none changed.

- [ ] **Step 1: Drive one vs-bots game in a browser**

With `npm start` serving on http://localhost:4200, start "Play vs bots" from Setup, choose two generals of one kingdom and confirm. Then check:
- The board opens on **"seat-0 (you) – Play Phase"** with no End phase clicks. Hand cards that can be played show an enabled Play.
- Seat HP shows 3 or 4 (half the two generals' HP, rounded down).
- Ending Play with more cards than HP shows **"– discard N more"**, Discard buttons on the hand, and no End phase button. Discarding down to the limit hands the turn to the bots, and the indicator follows each bot's phases.
- Hovering a greyed-out Play shows its tooltip.

Expected: all of the above, and no errors in the browser console.
