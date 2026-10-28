# Guozhan Hotseat App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `projects/app`, a local pass-and-play Angular application that lets human players actually play a full game of Guozhan on top of the existing `engine`/`content` rules engine, with a small extension to the engine's redaction so hidden information (kingdom, generals, hand, draw pile) is genuinely hidden between seats.

**Architecture:** A single injectable `GameService` (Signals-based facade, no state library) wraps the existing pure `resolve()`/`getLegalActions()`/`createGame()`/`redactStateForSeat()` engine functions. Every component reads from `GameService`'s signals via DI and never implements game rules itself. A reveal-gate overlay, driven by comparing the currently-revealed seat to whichever seat is next to act, enforces pass-and-play hiding. Functional-first UI: legal actions as buttons, seat summaries as text, a plain event log — no board layout or card art.

**Tech Stack:** Angular CLI 22.x `@angular/build:application` (not `ng-packagr` — this project is a deployable app), Signals, standalone components, Angular Router, Jest + `jest-preset-angular` (zoneless) for component tests, this workspace's existing `engine`/`content` libraries consumed via the existing `paths` mapping in the root `tsconfig.json`.

**Spec:** `docs/superpowers/specs/2026-09-07-guozhan-app-design.md`

## Global Constraints

- Components MUST NOT implement game-rule logic; they render `GameService`'s signals and dispatch chosen actions back to it (spec: Architecture; CLAUDE.md: Presentation layer).
- The UI MUST only ever offer actions `getLegalActions` itself returned — no client-side target-picking or legality logic (spec: Scope; CLAUDE.md: Presentation layer, "UI MUST NOT determine whether a player is allowed to play Slash").
- Test runner is Jest everywhere, including `projects/app` (via `jest-preset-angular`, zoneless) — no Karma, no Vitest runner is wired into any `test` architect target (spec: Testing strategy; matches existing project-wide convention).
- `resolve()`/`getLegalActions()`/`createGame()`/`redactStateForSeat()` are called with the authoritative `GameState` for gameplay logic; only `redactStateForSeat`'s *return value* is ever shown on screen — the redacted view is never fed back into `resolve()`/`getLegalActions()` (spec: Architecture).
- Every rule-texted engine change (Task 2) is implemented exactly as specified in the spec's "Engine change" section before any UI code depends on it (CLAUDE.md: Process).
- Dependency direction unchanged: `app` depends on `engine` and `content`; neither depends on `app` (spec: Architecture; CLAUDE.md: Layering).

---

## File Structure

```
angular.json, package.json, jest.config.js, jest.setup.app.ts   — workspace root (modified)

projects/app/
  src/main.ts, src/app/app.ts, src/app/app.config.ts, src/app/app.routes.ts   — generated, app.routes.ts modified
  src/app/game.service.ts, src/app/game.service.spec.ts
  src/app/labels.ts, src/app/labels.spec.ts
  src/app/setup/setup.ts, src/app/setup/setup.spec.ts
  src/app/game-board/reveal-gate-overlay.ts, .../reveal-gate-overlay.spec.ts
  src/app/game-board/action-list.ts, .../action-list.spec.ts
  src/app/game-board/event-log.ts, .../event-log.spec.ts
  src/app/game-board/seat-summary.ts, .../seat-summary.spec.ts
  src/app/game-board/game-over.ts, .../game-over.spec.ts
  src/app/game-board/game-board.ts, .../game-board.spec.ts
  tsconfig.app.json, tsconfig.spec.json   — generated, tsconfig.spec.json modified

projects/engine/src/lib/domain/
  types.ts     — Kingdom widened to include 'hidden'
  redact.ts, redact.spec.ts   — hand/draw-pile/kingdom masking added
```

`game.service.ts` is the single state-owning unit; `labels.ts` is a pure, dependency-free display-string helper shared by every component that renders an action or event; every other file under `game-board/` is a single presentational component with one clear rendering job, tied together by `game-board.ts`.

---

## Task 1: Scaffold `projects/app` with Jest component-testing support

**Files:**
- Create: `projects/app/` (via `ng generate application app`)
- Modify: `angular.json` (remove the generated `test` architect target), `package.json` (add `jest-preset-angular`, `jest-environment-jsdom`; remove `vitest`), `jest.config.js` (add an `app` project), `projects/app/tsconfig.spec.json` (swap `vitest/globals` for `jest`/`node` types)
- Create: `jest.setup.app.ts` (workspace root)

**Interfaces:**
- Produces: `npx jest --selectProjects app` discovers and runs specs under `projects/app/src`, with Angular's `TestBed` working under zoneless change detection.

- [ ] **Step 1: Scaffold the application**

```bash
npx ng generate application app --routing --style=css --skip-install
```

Verify: `projects/app/src/app/app.ts` exists and exports a standalone `App` component; `angular.json` now has an `"app"` project entry with a `build`/`serve`/`test` architect.

- [ ] **Step 2: Remove the generated Vitest wiring**

In `angular.json`, delete the entire `"test": { "builder": "@angular/build:unit-test" }` entry from the `app` project's `architect` block (this workspace tests everything through plain Jest, not this builder — it only supports Karma or Vitest as a runner, never Jest).

In `package.json`, remove `"vitest"` from `devDependencies` (added by the generator; unused since the test target above is deleted). Keep `"jsdom"` — it is still needed as a peer of `jest-environment-jsdom` below.

In `projects/app/tsconfig.spec.json`, change:

```json
"types": ["vitest/globals"]
```

to:

```json
"types": ["jest", "node"]
```

- [ ] **Step 3: Install Jest's Angular testing support**

```bash
npm install --save-dev jest-preset-angular@17.0.0 jest-environment-jsdom@30
```

- [ ] **Step 4: Add the zoneless Jest setup file**

Create `jest.setup.app.ts` at the repo root:

```ts
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv();
```

(This app has no `zone.js` dependency — `ng generate application` produces a zoneless app by default in this Angular version. `jest-preset-angular`'s zoneless setup entry calls `TestBed.initTestEnvironment` with `provideZonelessChangeDetection()`, matching that.)

- [ ] **Step 5: Add the `app` project to `jest.config.js`**

Add this entry to the `projects` array in the root `jest.config.js` (after the existing `sim` entry):

```js
    {
      displayName: 'app',
      preset: 'jest-preset-angular',
      testEnvironment: 'jsdom',
      rootDir: 'projects/app',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/../../jest.setup.app.ts'],
      moduleNameMapper: {
        '^engine$': '<rootDir>/../engine/src/public-api.ts',
        '^content$': '<rootDir>/../content/src/public-api.ts',
      },
    },
```

- [ ] **Step 6: Verify the generated sanity spec passes**

Run: `npx jest --selectProjects app`
Expected: PASS, 1 suite (`app.spec.ts`), 2 tests (`should create the app`, `should render title`).

- [ ] **Step 7: Verify the app still builds and type-checks cleanly**

```bash
rm -rf dist out-tsc
npx ng build app --configuration development
npx tsc --noEmit -p projects/app/tsconfig.app.json
```

Expected: both succeed with 0 errors. (Unlike `content`, the `@angular/build:application` builder does not enforce a per-package `rootDir`, so no `tsconfig.ngbuild.json`-style workaround is needed here — this was verified during planning.)

- [ ] **Step 8: Verify the rest of the workspace is unaffected**

Run: `npx jest --selectProjects engine --selectProjects content --selectProjects sim`
Expected: all previously-passing suites still pass (23 suites, 123 tests, unchanged from before this task).

- [ ] **Step 9: Commit**

```bash
git add projects/app angular.json package.json jest.config.js jest.setup.app.ts
git commit -m "feat(app): scaffold the Angular application with Jest component testing"
```

---

## Task 2: Extend `redactStateForSeat` — hide hand contents, draw pile, and kingdom

**Rule text:** see the design spec's "Engine change: extend `redactStateForSeat`" section — reproduced in full here since it is this task's exact requirement:

- For every `CardZone` in `state.zones` with `kind === 'hand'` and `ownerSeatId !== viewerSeatId`: replace each card in `cards` with a masked copy — `definitionId: 'hidden'`, `suit: 'spade'`, `rank: 0`. `instanceId` and the array's length are preserved unchanged.
- For every `CardZone` with `kind === 'drawPile'`: masked the same way, for every viewer without exception.
- `kind === 'discardPile' | 'equip' | 'judgment'` zones are left untouched for every viewer.
- A seat's own `hand` zone (`ownerSeatId === viewerSeatId`) is never masked.
- `Kingdom` widens to include `'hidden'`. Every seat other than the viewer has its `kingdom` replaced with `'hidden'` unless already revealed — treat a seat's kingdom as revealed exactly when either of its generals (`main` or `deputy`) has `revealed === true`. The viewer's own `kingdom` is never masked.

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts:9` (widen `Kingdom`)
- Modify: `projects/engine/src/lib/domain/redact.ts`
- Modify: `projects/engine/src/lib/domain/redact.spec.ts`

**Interfaces:**
- Consumes: `GameState`, `CardZone`, `CardInstance`, `Seat`, `Kingdom` (all from `./types`, unchanged import paths).
- Produces: `redactStateForSeat(state: GameState, viewerSeatId: string): GameState` — same signature as before; only the returned value's masking is more thorough. `Kingdom` is now `'Wei' | 'Shu' | 'Wu' | 'Qun' | 'hidden'`.

- [ ] **Step 1: Widen the `Kingdom` type**

In `projects/engine/src/lib/domain/types.ts`, change line 9 from:

```ts
export type Kingdom = 'Wei' | 'Shu' | 'Wu' | 'Qun';
```

to:

```ts
export type Kingdom = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'hidden';
```

- [ ] **Step 2: Write the failing tests**

Extend `projects/engine/src/lib/domain/redact.spec.ts`. Replace its entire contents with:

```ts
import { redactStateForSeat } from './redact';
import { createSeat, createPlayer } from './factories';
import { GameState, CardZone } from './types';

function makeZones(): CardZone[] {
  return [
    {
      id: 'hand-a',
      kind: 'hand',
      ownerSeatId: 'seat-a',
      cards: [{ instanceId: 'card-1', definitionId: 'sha', suit: 'spade', rank: 7 }],
    },
    {
      id: 'hand-b',
      kind: 'hand',
      ownerSeatId: 'seat-b',
      cards: [
        { instanceId: 'card-2', definitionId: 'shan', suit: 'heart', rank: 3 },
        { instanceId: 'card-3', definitionId: 'peach', suit: 'club', rank: 9 },
      ],
    },
    {
      id: 'draw-pile',
      kind: 'drawPile',
      cards: [{ instanceId: 'card-4', definitionId: 'duel', suit: 'diamond', rank: 5 }],
    },
    {
      id: 'discard-pile',
      kind: 'discardPile',
      cards: [{ instanceId: 'card-5', definitionId: 'wuxie', suit: 'spade', rank: 2 }],
    },
    {
      id: 'equip-a',
      kind: 'equip',
      ownerSeatId: 'seat-a',
      cards: [{ instanceId: 'card-6', definitionId: 'silver-lion', suit: 'club', rank: 11 }],
    },
    { id: 'judgment-b', kind: 'judgment', ownerSeatId: 'seat-b', cards: [] },
  ];
}

function makeState(): GameState {
  const maxHp = () => 4;
  const seatA = createSeat('seat-a', 0, 'Wei', 'general-x', 'general-y', maxHp);
  const seatB = createSeat('seat-b', 1, 'Shu', 'general-z', 'general-w', maxHp);
  return {
    seats: [seatA, seatB],
    players: [createPlayer('p1', 'seat-a', 'human'), createPlayer('p2', 'seat-b', 'bot')],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: makeZones(),
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null,
  };
}

describe('redactStateForSeat', () => {
  it('hides unrevealed generals from other seats but keeps them visible to the owner', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const ownSeat = viewFromA.seats.find((s) => s.id === 'seat-a')!;
    expect(ownSeat.generals.main.generalDefinitionId).toBe('general-x');

    const otherSeat = viewFromA.seats.find((s) => s.id === 'seat-b')!;
    expect(otherSeat.generals.main.generalDefinitionId).toBe('hidden');
    expect(otherSeat.generals.deputy.generalDefinitionId).toBe('hidden');
  });

  it('reveals a general to everyone once revealed is true', () => {
    const state = makeState();
    state.seats[1].generals.main.revealed = true;
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const otherSeat = viewFromA.seats.find((s) => s.id === 'seat-b')!;
    expect(otherSeat.generals.main.generalDefinitionId).toBe('general-z');
    expect(otherSeat.generals.deputy.generalDefinitionId).toBe('hidden');
  });

  it("masks another seat's hand contents but preserves card count and instance ids", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const handB = viewFromA.zones.find((z) => z.id === 'hand-b')!;
    expect(handB.cards).toHaveLength(2);
    expect(handB.cards.map((c) => c.instanceId)).toEqual(['card-2', 'card-3']);
    expect(handB.cards.every((c) => c.definitionId === 'hidden')).toBe(true);
    expect(handB.cards.every((c) => c.suit === 'spade' && c.rank === 0)).toBe(true);
  });

  it('never masks the viewer\'s own hand', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const handA = viewFromA.zones.find((z) => z.id === 'hand-a')!;
    expect(handA.cards[0].definitionId).toBe('sha');
  });

  it('masks the draw pile for every viewer, including seat-a', () => {
    const state = makeState();

    for (const viewerSeatId of ['seat-a', 'seat-b']) {
      const view = redactStateForSeat(state, viewerSeatId);
      const drawPile = view.zones.find((z) => z.id === 'draw-pile')!;
      expect(drawPile.cards[0].definitionId).toBe('hidden');
    }
  });

  it('leaves discard pile, equip zones, and judgment zones untouched', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.zones.find((z) => z.id === 'discard-pile')!.cards[0].definitionId).toBe('wuxie');
    expect(viewFromA.zones.find((z) => z.id === 'equip-a')!.cards[0].definitionId).toBe('silver-lion');
  });

  it("masks another seat's kingdom while both generals are hidden", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-b')!.kingdom).toBe('hidden');
  });

  it('reveals a kingdom once either of that seat\'s generals is revealed', () => {
    const state = makeState();
    state.seats[1].generals.deputy.revealed = true;
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-b')!.kingdom).toBe('Shu');
  });

  it("never masks the viewer's own kingdom", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-a')!.kingdom).toBe('Wei');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest --selectProjects engine -t redactStateForSeat`
Expected: FAIL — the new hand/draw-pile/kingdom assertions fail (the old two general-reveal tests still pass, since that behavior is unchanged).

- [ ] **Step 4: Implement the extended masking**

Replace `projects/engine/src/lib/domain/redact.ts` entirely with:

```ts
import { CardInstance, CardZone, GameState, Seat } from './types';

const HIDDEN_GENERAL_ID = 'hidden';
const HIDDEN_CARD_DEFINITION_ID = 'hidden';

function maskCard(card: CardInstance): CardInstance {
  return { ...card, definitionId: HIDDEN_CARD_DEFINITION_ID, suit: 'spade', rank: 0 };
}

function redactZone(zone: CardZone, viewerSeatId: string): CardZone {
  const isViewersOwnHand = zone.kind === 'hand' && zone.ownerSeatId === viewerSeatId;
  const shouldMask = (zone.kind === 'hand' && !isViewersOwnHand) || zone.kind === 'drawPile';
  if (!shouldMask) return zone;
  return { ...zone, cards: zone.cards.map(maskCard) };
}

function isKingdomRevealed(seat: Seat): boolean {
  return seat.generals.main.revealed || seat.generals.deputy.revealed;
}

function redactSeat(seat: Seat, viewerSeatId: string): Seat {
  if (seat.id === viewerSeatId) return seat;
  return {
    ...seat,
    kingdom: isKingdomRevealed(seat) ? seat.kingdom : 'hidden',
    generals: {
      main: seat.generals.main.revealed
        ? seat.generals.main
        : { ...seat.generals.main, generalDefinitionId: HIDDEN_GENERAL_ID },
      deputy: seat.generals.deputy.revealed
        ? seat.generals.deputy
        : { ...seat.generals.deputy, generalDefinitionId: HIDDEN_GENERAL_ID },
    },
  };
}

export function redactStateForSeat(state: GameState, viewerSeatId: string): GameState {
  return {
    ...state,
    seats: state.seats.map((seat) => redactSeat(seat, viewerSeatId)),
    zones: state.zones.map((zone) => redactZone(zone, viewerSeatId)),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --selectProjects engine -t redactStateForSeat`
Expected: PASS, all 9 tests.

- [ ] **Step 6: Verify no other engine/content code breaks under the widened `Kingdom` type**

```bash
rm -rf out-tsc dist
npx tsc --noEmit -p projects/engine/tsconfig.lib.json
npx tsc --noEmit -p projects/engine/tsconfig.spec.json
npx tsc --noEmit -p projects/content/tsconfig.lib.json
npx tsc --noEmit -p projects/content/tsconfig.spec.json
npx jest --selectProjects engine --selectProjects content --selectProjects sim
```

Expected: all five `tsc` checks 0 errors, all previously-passing suites still pass (this confirms the blast-radius check done during planning — `GeneralDefinition.kingdom`, `KINGDOM_ORDER`, and the win-condition's `!== 'Qun'` comparison all still type-check against the widened union).

- [ ] **Step 7: Commit**

```bash
git add projects/engine/src/lib/domain/types.ts projects/engine/src/lib/domain/redact.ts projects/engine/src/lib/domain/redact.spec.ts
git commit -m "fix(engine): mask hand contents, draw pile, and kingdom in redactStateForSeat"
```

---

## Task 3: `GameService` — the state facade

**Files:**
- Create: `projects/app/src/app/game.service.ts`
- Create: `projects/app/src/app/game.service.spec.ts`

**Interfaces:**
- Consumes: `createGame`, `resolve`, `getLegalActions`, `redactStateForSeat`, `EngineContext`, `GameState`, `Action` (all from `'engine'`); `buildContentRegistry`, `guozhanMode` (from `'content'`).
- Produces (consumed by every later task): `GameService` with `state: Signal<GameState | null>`, `revealedSeatId: Signal<string | null>`, `lastError: Signal<string | null>`, `activeSeatId: Signal<string | null>`, `legalActions: Signal<Action[]>`, `visibleState: Signal<GameState | null>`, `registry: ContentRegistry` (readonly field), and methods `startGame(seatCount: number, seed?: number): void`, `reveal(seatId: string): void`, `submit(action: Action): void`, `clearError(): void`.

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/game.service.spec.ts`:

```ts
import { GameService } from './game.service';

describe('GameService', () => {
  let service: GameService;

  beforeEach(() => {
    service = new GameService();
  });

  it('starts with no game in progress', () => {
    expect(service.state()).toBeNull();
    expect(service.activeSeatId()).toBeNull();
    expect(service.legalActions()).toEqual([]);
  });

  it('startGame creates a game with the requested seat count', () => {
    service.startGame(4, 42);

    const state = service.state();
    expect(state).not.toBeNull();
    expect(state!.seats).toHaveLength(4);
    expect(state!.seats.map((s) => s.id)).toEqual(['seat-0', 'seat-1', 'seat-2', 'seat-3']);
  });

  it('startGame is deterministic for a given seed', () => {
    service.startGame(3, 7);
    const first = service.state();

    service.startGame(3, 7);
    const second = service.state();

    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });

  it('activeSeatId reflects the turn owner when there is no pending response', () => {
    service.startGame(2, 1);
    expect(service.activeSeatId()).toBe(service.state()!.turn.ownerSeatId);
  });

  it('legalActions matches getLegalActions for the active seat', () => {
    service.startGame(2, 1);
    const state = service.state()!;
    const seatId = service.activeSeatId()!;

    expect(service.legalActions().length).toBeGreaterThan(0);
    expect(service.legalActions().every((a) => a.seatId === seatId)).toBe(true);
  });

  it('visibleState is null until reveal is called, then matches the redacted view', () => {
    service.startGame(2, 1);
    expect(service.visibleState()).toBeNull();

    const seatId = service.activeSeatId()!;
    service.reveal(seatId);

    const visible = service.visibleState()!;
    expect(visible.seats.find((s) => s.id === seatId)).toBeDefined();
    // A different seat's generals should be masked in the visible view.
    const otherSeat = visible.seats.find((s) => s.id !== seatId)!;
    expect(otherSeat.generals.main.generalDefinitionId).toBe('hidden');
  });

  it('submit advances state on a legal action and resets revealedSeatId', () => {
    service.startGame(2, 1);
    const seatId = service.activeSeatId()!;
    service.reveal(seatId);
    expect(service.revealedSeatId()).toBe(seatId);

    const endPhase = service.legalActions().find((a) => a.kind === 'EndPhaseAction')!;
    expect(endPhase).toBeDefined();
    service.submit(endPhase);

    expect(service.revealedSeatId()).toBeNull();
    expect(service.lastError()).toBeNull();
  });

  it('submit sets lastError and leaves state unchanged when resolve() throws', () => {
    service.startGame(2, 1);
    const stateBefore = service.state();
    const seatId = service.activeSeatId()!;

    service.submit({ kind: 'PassAction', seatId, pendingResponseId: 'does-not-exist' });

    expect(service.lastError()).toContain('No matching pending response');
    expect(service.state()).toBe(stateBefore);
  });

  it('clearError resets lastError without touching state', () => {
    service.startGame(2, 1);
    const seatId = service.activeSeatId()!;
    service.submit({ kind: 'PassAction', seatId, pendingResponseId: 'nope' });
    expect(service.lastError()).not.toBeNull();

    const stateBefore = service.state();
    service.clearError();

    expect(service.lastError()).toBeNull();
    expect(service.state()).toBe(stateBefore);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects app`
Expected: FAIL with "Cannot find module './game.service'".

- [ ] **Step 3: Implement `GameService`**

Create `projects/app/src/app/game.service.ts`:

```ts
import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import {
  Action,
  ContentRegistry,
  EngineContext,
  GameState,
  createGame,
  getLegalActions,
  redactStateForSeat,
  resolve,
} from 'engine';
import { buildContentRegistry, guozhanMode } from 'content';

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly registry: ContentRegistry = buildContentRegistry();
  private readonly ctx: EngineContext = { registry: this.registry, mode: guozhanMode };

  private readonly _state: WritableSignal<GameState | null> = signal(null);
  private readonly _revealedSeatId: WritableSignal<string | null> = signal(null);
  private readonly _lastError: WritableSignal<string | null> = signal(null);

  readonly state: Signal<GameState | null> = this._state.asReadonly();
  readonly revealedSeatId: Signal<string | null> = this._revealedSeatId.asReadonly();
  readonly lastError: Signal<string | null> = this._lastError.asReadonly();

  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    if (!state) return null;
    return state.pendingResponse?.respondingSeatId ?? state.turn.ownerSeatId;
  });

  readonly legalActions: Signal<Action[]> = computed(() => {
    const state = this._state();
    const seatId = this.activeSeatId();
    if (!state || !seatId) return [];
    return getLegalActions(state, seatId);
  });

  readonly visibleState: Signal<GameState | null> = computed(() => {
    const state = this._state();
    const seatId = this._revealedSeatId();
    if (!state || !seatId) return null;
    return redactStateForSeat(state, seatId);
  });

  startGame(seatCount: number, seed?: number): void {
    const seatIds = Array.from({ length: seatCount }, (_, i) => `seat-${i}`);
    const rngSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
    const state = createGame(guozhanMode, this.registry, seatIds, rngSeed);
    this._state.set(state);
    this._revealedSeatId.set(null);
    this._lastError.set(null);
  }

  reveal(seatId: string): void {
    this._revealedSeatId.set(seatId);
  }

  submit(action: Action): void {
    const state = this._state();
    if (!state) return;
    try {
      const result = resolve(state, action, this.ctx);
      this._state.set(result.state);
      this._revealedSeatId.set(null);
      this._lastError.set(null);
    } catch (err) {
      this._lastError.set(err instanceof Error ? err.message : String(err));
    }
  }

  clearError(): void {
    this._lastError.set(null);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects app`
Expected: PASS, all 9 tests in `game.service.spec.ts` (plus the 2 from `app.spec.ts` in Task 1 — 11 total).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p projects/app/tsconfig.app.json`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/game.service.ts projects/app/src/app/game.service.spec.ts
git commit -m "feat(app): add GameService, the signals-based facade over the engine"
```

---

## Task 4: `labels.ts` — human-readable action/event/general/kingdom labels

**Files:**
- Create: `projects/app/src/app/labels.ts`
- Create: `projects/app/src/app/labels.spec.ts`

**Interfaces:**
- Consumes: `Action`, `EngineEvent`, `GameState`, `ContentRegistry`, `Target` (from `'engine'`).
- Produces (consumed by Task 7's `ActionList` and Task 8's `EventLog`, and Task 9's `SeatSummary`): `actionLabel(action: Action, state: GameState, registry: ContentRegistry): string`, `eventLabel(event: EngineEvent): string`, `generalDisplayName(generalDefinitionId: string): string`, `kingdomDisplayName(kingdom: Kingdom): string`.

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/labels.spec.ts`:

```ts
import { actionLabel, eventLabel, generalDisplayName, kingdomDisplayName } from './labels';
import { Action, ContentRegistry, EngineEvent, GameState } from 'engine';

function stateWithZones(): GameState {
  return {
    seats: [],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      {
        id: 'hand-0',
        kind: 'hand',
        ownerSeatId: 'seat-0',
        cards: [{ instanceId: 'card-1', definitionId: 'sha', suit: 'spade', rank: 7 }],
      },
    ],
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null,
  };
}

function registryWithSha(): ContentRegistry {
  return {
    cards: new Map([['sha', { id: 'sha', name: 'Sha', category: 'basic', play: () => [] }]]),
    generals: new Map(),
  };
}

describe('generalDisplayName', () => {
  it('title-cases a kebab-case id', () => {
    expect(generalDisplayName('xiahou-dun')).toBe('Xiahou Dun');
  });

  it('renders the hidden sentinel as a human phrase', () => {
    expect(generalDisplayName('hidden')).toBe('a hidden general');
  });
});

describe('kingdomDisplayName', () => {
  it('passes through a real kingdom unchanged', () => {
    expect(kingdomDisplayName('Wei')).toBe('Wei');
  });

  it('renders the hidden sentinel as a human phrase', () => {
    expect(kingdomDisplayName('hidden')).toBe('Hidden');
  });
});

describe('actionLabel', () => {
  it('labels DrawCardsAction with the count', () => {
    const action: Action = { kind: 'DrawCardsAction', seatId: 'seat-0', count: 2 };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Draw 2 cards');
  });

  it('labels a targetless PlayCardAction with the card name', () => {
    const action: Action = {
      kind: 'PlayCardAction',
      seatId: 'seat-0',
      cardInstanceId: 'card-1',
      targets: [],
    };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Play Sha');
  });

  it('labels a targeted PlayCardAction with the target', () => {
    const action: Action = {
      kind: 'PlayCardAction',
      seatId: 'seat-0',
      cardInstanceId: 'card-1',
      targets: [{ kind: 'seat', seatId: 'seat-1' }],
    };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Play Sha targeting seat-1');
  });

  it('labels PassAction and EndPhaseAction', () => {
    expect(
      actionLabel({ kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' }, stateWithZones(), registryWithSha())
    ).toBe('Pass');
    expect(actionLabel({ kind: 'EndPhaseAction', seatId: 'seat-0' }, stateWithZones(), registryWithSha())).toBe(
      'End phase'
    );
  });
});

describe('eventLabel', () => {
  it('labels DamageDealtEvent', () => {
    const event: EngineEvent = {
      kind: 'DamageDealtEvent',
      damage: { source: null, target: { kind: 'seat', seatId: 'seat-1' }, amount: 2, nature: 'normal' },
    };
    expect(eventLabel(event)).toBe('seat-1 took 2 normal damage');
  });

  it('labels SeatEliminatedEvent', () => {
    expect(eventLabel({ kind: 'SeatEliminatedEvent', seatId: 'seat-2' })).toBe('seat-2 was eliminated');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects app -t labels`
Expected: FAIL with "Cannot find module './labels'".

- [ ] **Step 3: Implement `labels.ts`**

Create `projects/app/src/app/labels.ts`:

```ts
import { Action, CardInstance, ContentRegistry, EngineEvent, GameState, Kingdom, Target } from 'engine';

function findCardInstance(state: GameState, cardInstanceId: string): CardInstance | undefined {
  for (const zone of state.zones) {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (found) return found;
  }
  return undefined;
}

function cardDisplayName(state: GameState, registry: ContentRegistry, cardInstanceId: string): string {
  const card = findCardInstance(state, cardInstanceId);
  if (!card) return cardInstanceId;
  return registry.cards.get(card.definitionId)?.name ?? card.definitionId;
}

function targetLabel(target: Target): string {
  if (target.kind === 'seat') return target.seatId;
  return `${target.seatId}'s ${target.generalSlot} general`;
}

export function generalDisplayName(generalDefinitionId: string): string {
  if (generalDefinitionId === 'hidden') return 'a hidden general';
  return generalDefinitionId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function kingdomDisplayName(kingdom: Kingdom): string {
  return kingdom === 'hidden' ? 'Hidden' : kingdom;
}

export function actionLabel(action: Action, state: GameState, registry: ContentRegistry): string {
  switch (action.kind) {
    case 'DrawCardsAction':
      return `Draw ${action.count} card${action.count === 1 ? '' : 's'}`;
    case 'PlayCardAction': {
      const name = cardDisplayName(state, registry, action.cardInstanceId);
      if (action.targets.length === 0) return `Play ${name}`;
      return `Play ${name} targeting ${action.targets.map(targetLabel).join(', ')}`;
    }
    case 'RevealGeneralAction':
      return `Reveal ${action.slot} general`;
    case 'RespondAction':
      return `Respond with ${cardDisplayName(state, registry, action.cardInstanceId)}`;
    case 'PassAction':
      return 'Pass';
    case 'EndPhaseAction':
      return 'End phase';
  }
}

export function eventLabel(event: EngineEvent): string {
  switch (event.kind) {
    case 'CardsDrawnEvent':
      return `${event.seatId} drew ${event.cardInstanceIds.length} card(s)`;
    case 'DamageDealtEvent':
      return `${targetLabel(event.damage.target)} took ${event.damage.amount} ${event.damage.nature} damage`;
    case 'PhaseChangedEvent':
      return `${event.seatId} entered the ${event.phase} phase`;
    case 'TurnAdvancedEvent':
      return `Turn ${event.turnNumber}: ${event.seatId}'s turn`;
    case 'GeneralRevealedEvent':
      return `${event.seatId} revealed their ${event.slot} general`;
    case 'HealEvent':
      return `${targetLabel(event.target)} healed ${event.amount}`;
    case 'CardMovedEvent':
      return `A card moved to ${event.toZoneId}`;
    case 'SeatEliminatedEvent':
      return `${event.seatId} was eliminated`;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects app -t labels`
Expected: PASS, all tests in `labels.spec.ts`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p projects/app/tsconfig.app.json`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/labels.ts projects/app/src/app/labels.spec.ts
git commit -m "feat(app): add human-readable labels for actions, events, generals, kingdoms"
```

---

## Task 5: Routing skeleton and the `Setup` component

**Files:**
- Modify: `projects/app/src/app/app.routes.ts`
- Create: `projects/app/src/app/setup/setup.ts`
- Create: `projects/app/src/app/setup/setup.spec.ts`

**Interfaces:**
- Consumes: `GameService` (Task 3).
- Produces: route `/setup` renders `Setup`; route `/game` is registered pointing at a not-yet-created `GameBoard` (Task 11 creates the real component — this task adds a placeholder standalone component inline in the routes file so the route is valid immediately, and Task 11 replaces it).

- [ ] **Step 1: Write the failing test**

Create `projects/app/src/app/setup/setup.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { Setup } from './setup';
import { GameService } from '../game.service';

describe('Setup', () => {
  it('starts a game with the chosen seat count and navigates to /game', async () => {
    await TestBed.configureTestingModule({
      imports: [Setup],
      providers: [provideRouter([{ path: 'game', children: [] }])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Setup);
    const component = fixture.componentInstance;
    const gameService = TestBed.inject(GameService);
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigateByUrl');

    component.seatCount.set(5);
    component.startGame();

    expect(gameService.state()!.seats).toHaveLength(5);
    expect(navigateSpy).toHaveBeenCalledWith(expect.stringContaining('/game'));
  });

  it('passes an explicit seed through to GameService when provided', async () => {
    await TestBed.configureTestingModule({
      imports: [Setup],
      providers: [provideRouter([{ path: 'game', children: [] }])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Setup);
    const component = fixture.componentInstance;
    const gameService = TestBed.inject(GameService);

    component.seatCount.set(3);
    component.seed.set(99);
    component.startGame();
    const first = gameService.state();

    component.startGame();
    const second = gameService.state();

    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects app -t Setup`
Expected: FAIL with "Cannot find module './setup'".

- [ ] **Step 3: Implement `Setup`**

Create `projects/app/src/app/setup/setup.ts`:

```ts
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '../game.service';

@Component({
  selector: 'app-setup',
  template: `
    <h1>New Guozhan game</h1>
    <label>
      Seat count (2-8):
      <input
        type="number"
        min="2"
        max="8"
        [value]="seatCount()"
        (input)="seatCount.set(+$any($event.target).value)"
      />
    </label>
    <label>
      Seed (optional):
      <input type="number" (input)="seed.set($any($event.target).value ? +$any($event.target).value : undefined)" />
    </label>
    <button (click)="startGame()">Start game</button>
  `,
})
export class Setup {
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);

  readonly seatCount = signal(4);
  readonly seed = signal<number | undefined>(undefined);

  startGame(): void {
    this.gameService.startGame(this.seatCount(), this.seed());
    this.router.navigateByUrl('/game');
  }
}
```

- [ ] **Step 4: Wire the routes**

Replace `projects/app/src/app/app.routes.ts` with:

```ts
import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { Setup } from './setup/setup';

// Placeholder until Task 11 creates the real GameBoard component.
@Component({ selector: 'app-game-board-placeholder', template: `<p>Game board coming in Task 11.</p>` })
class GameBoardPlaceholder {}

export const routes: Routes = [
  { path: 'setup', component: Setup },
  { path: 'game', component: GameBoardPlaceholder },
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest --selectProjects app -t Setup`
Expected: PASS, both tests.

- [ ] **Step 6: Type-check and full app suite**

```bash
npx tsc --noEmit -p projects/app/tsconfig.app.json
npx jest --selectProjects app
```

Expected: 0 errors; all app suites so far pass.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/app.routes.ts projects/app/src/app/setup
git commit -m "feat(app): add routing skeleton and the Setup screen"
```

---

## Task 6: `RevealGateOverlay` component

**Files:**
- Create: `projects/app/src/app/game-board/reveal-gate-overlay.ts`
- Create: `projects/app/src/app/game-board/reveal-gate-overlay.spec.ts`

**Interfaces:**
- Produces (consumed by Task 11's `GameBoard`): `RevealGateOverlay` with `seatId = input.required<string>()`, `revealed = output<void>()`.

- [ ] **Step 1: Write the failing test**

Create `projects/app/src/app/game-board/reveal-gate-overlay.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { RevealGateOverlay } from './reveal-gate-overlay';

describe('RevealGateOverlay', () => {
  it('shows the seat id being passed to and emits revealed when tapped', () => {
    const fixture = TestBed.createComponent(RevealGateOverlay);
    fixture.componentRef.setInput('seatId', 'seat-2');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('seat-2');

    const revealedSpy = jest.fn();
    fixture.componentInstance.revealed.subscribe(revealedSpy);
    el.querySelector('button')!.dispatchEvent(new Event('click'));

    expect(revealedSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects app -t RevealGateOverlay`
Expected: FAIL with "Cannot find module './reveal-gate-overlay'".

- [ ] **Step 3: Implement `RevealGateOverlay`**

Create `projects/app/src/app/game-board/reveal-gate-overlay.ts`:

```ts
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-reveal-gate-overlay',
  template: `
    <div class="reveal-gate">
      <p>Pass the device to {{ seatId() }}</p>
      <button (click)="revealed.emit()">Tap to reveal</button>
    </div>
  `,
})
export class RevealGateOverlay {
  readonly seatId = input.required<string>();
  readonly revealed = output<void>();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --selectProjects app -t RevealGateOverlay`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/reveal-gate-overlay.ts projects/app/src/app/game-board/reveal-gate-overlay.spec.ts
git commit -m "feat(app): add the RevealGateOverlay component"
```

---

## Task 7: `ActionList` component

**Files:**
- Create: `projects/app/src/app/game-board/action-list.ts`
- Create: `projects/app/src/app/game-board/action-list.spec.ts`

**Interfaces:**
- Consumes: `actionLabel` (Task 4); `Action`, `GameState`, `ContentRegistry` (from `'engine'`).
- Produces (consumed by Task 11's `GameBoard`): `ActionList` with `actions = input.required<Action[]>()`, `state = input.required<GameState>()`, `registry = input.required<ContentRegistry>()`, `actionChosen = output<Action>()`.

- [ ] **Step 1: Write the failing test**

Create `projects/app/src/app/game-board/action-list.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Action, ContentRegistry, GameState } from 'engine';
import { ActionList } from './action-list';

function emptyState(): GameState {
  return {
    seats: [],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play',
    zones: [],
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null,
  };
}

function emptyRegistry(): ContentRegistry {
  return { cards: new Map(), generals: new Map() };
}

describe('ActionList', () => {
  it('renders one button per action and emits the chosen action on click', () => {
    const fixture = TestBed.createComponent(ActionList);
    const actions: Action[] = [
      { kind: 'EndPhaseAction', seatId: 'seat-0' },
      { kind: 'DrawCardsAction', seatId: 'seat-0', count: 1 },
    ];
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('state', emptyState());
    fixture.componentRef.setInput('registry', emptyRegistry());
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('End phase');
    expect(buttons[1].textContent).toContain('Draw 1 card');

    const chosenSpy = jest.fn();
    fixture.componentInstance.actionChosen.subscribe(chosenSpy);
    buttons[1].dispatchEvent(new Event('click'));

    expect(chosenSpy).toHaveBeenCalledWith(actions[1]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects app -t ActionList`
Expected: FAIL with "Cannot find module './action-list'".

- [ ] **Step 3: Implement `ActionList`**

Create `projects/app/src/app/game-board/action-list.ts`:

```ts
import { Component, computed, input, output } from '@angular/core';
import { Action, ContentRegistry, GameState } from 'engine';
import { actionLabel } from '../labels';

interface LabeledAction {
  action: Action;
  label: string;
}

@Component({
  selector: 'app-action-list',
  template: `
    <ul class="action-list">
      @for (item of labeledActions(); track item.action) {
        <li>
          <button (click)="actionChosen.emit(item.action)">{{ item.label }}</button>
        </li>
      }
    </ul>
  `,
})
export class ActionList {
  readonly actions = input.required<Action[]>();
  readonly state = input.required<GameState>();
  readonly registry = input.required<ContentRegistry>();
  readonly actionChosen = output<Action>();

  readonly labeledActions = computed<LabeledAction[]>(() =>
    this.actions().map((action) => ({ action, label: actionLabel(action, this.state(), this.registry()) }))
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --selectProjects app -t ActionList`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/action-list.ts projects/app/src/app/game-board/action-list.spec.ts
git commit -m "feat(app): add the ActionList component"
```

---

## Task 8: `EventLog` component

**Files:**
- Create: `projects/app/src/app/game-board/event-log.ts`
- Create: `projects/app/src/app/game-board/event-log.spec.ts`

**Interfaces:**
- Consumes: `eventLabel` (Task 4); `EngineEvent` (from `'engine'`).
- Produces (consumed by Task 11's `GameBoard`): `EventLog` with `events = input.required<EngineEvent[]>()`.

- [ ] **Step 1: Write the failing test**

Create `projects/app/src/app/game-board/event-log.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { EngineEvent } from 'engine';
import { EventLog } from './event-log';

describe('EventLog', () => {
  it('renders one line per event, oldest first', () => {
    const fixture = TestBed.createComponent(EventLog);
    const events: EngineEvent[] = [
      { kind: 'SeatEliminatedEvent', seatId: 'seat-1' },
      { kind: 'TurnAdvancedEvent', seatId: 'seat-2', turnNumber: 3 },
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();

    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('seat-1 was eliminated');
    expect(items[1].textContent).toContain("Turn 3: seat-2's turn");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects app -t EventLog`
Expected: FAIL with "Cannot find module './event-log'".

- [ ] **Step 3: Implement `EventLog`**

Create `projects/app/src/app/game-board/event-log.ts`:

```ts
import { Component, computed, input } from '@angular/core';
import { EngineEvent } from 'engine';
import { eventLabel } from '../labels';

@Component({
  selector: 'app-event-log',
  template: `
    <ul class="event-log">
      @for (line of lines(); track $index) {
        <li>{{ line }}</li>
      }
    </ul>
  `,
})
export class EventLog {
  readonly events = input.required<EngineEvent[]>();
  readonly lines = computed(() => this.events().map(eventLabel));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --selectProjects app -t EventLog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/event-log.ts projects/app/src/app/game-board/event-log.spec.ts
git commit -m "feat(app): add the EventLog component"
```

---

## Task 9: `SeatSummary` component

**Files:**
- Create: `projects/app/src/app/game-board/seat-summary.ts`
- Create: `projects/app/src/app/game-board/seat-summary.spec.ts`

**Interfaces:**
- Consumes: `generalDisplayName`, `kingdomDisplayName` (Task 4); `Seat` (from `'engine'`).
- Produces (consumed by Task 11's `GameBoard`): `SeatSummary` with `seat = input.required<Seat>()`, `handCount = input.required<number>()`.

- [ ] **Step 1: Write the failing test**

Create `projects/app/src/app/game-board/seat-summary.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Seat } from 'engine';
import { SeatSummary } from './seat-summary';

function makeSeat(overrides: Partial<Seat> = {}): Seat {
  return {
    id: 'seat-0',
    index: 0,
    kingdom: 'hidden',
    generals: {
      main: { generalDefinitionId: 'hidden', revealed: false },
      deputy: { generalDefinitionId: 'hidden', revealed: false },
    },
    combinedHp: 6,
    maxCombinedHp: 8,
    hand: { zoneId: 'hand-0' },
    equipped: { zoneId: 'equip-0' },
    eliminated: false,
    ...overrides,
  };
}

describe('SeatSummary', () => {
  it('renders hidden kingdom/generals and HP/hand count', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat());
    fixture.componentRef.setInput('handCount', 3);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('seat-0');
    expect(text).toContain('Hidden');
    expect(text).toContain('a hidden general');
    expect(text).toContain('6/8');
    expect(text).toContain('3');
  });

  it('renders a revealed kingdom and general name', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput(
      'seat',
      makeSeat({ kingdom: 'Wu', generals: { main: { generalDefinitionId: 'zhao-yun', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } })
    );
    fixture.componentRef.setInput('handCount', 0);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Wu');
    expect(text).toContain('Zhao Yun');
  });

  it('marks an eliminated seat', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat({ eliminated: true }));
    fixture.componentRef.setInput('handCount', 0);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('eliminated');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects app -t SeatSummary`
Expected: FAIL with "Cannot find module './seat-summary'".

- [ ] **Step 3: Implement `SeatSummary`**

Create `projects/app/src/app/game-board/seat-summary.ts`:

```ts
import { Component, input } from '@angular/core';
import { Seat } from 'engine';
import { generalDisplayName, kingdomDisplayName } from '../labels';

@Component({
  selector: 'app-seat-summary',
  template: `
    <div class="seat-summary">
      <strong>{{ seat().id }}</strong>
      @if (seat().eliminated) {
        <span> (eliminated)</span>
      }
      <div>Kingdom: {{ kingdomDisplayName(seat().kingdom) }}</div>
      <div>Main general: {{ generalDisplayName(seat().generals.main.generalDefinitionId) }}</div>
      <div>Deputy general: {{ generalDisplayName(seat().generals.deputy.generalDefinitionId) }}</div>
      <div>HP: {{ seat().combinedHp }}/{{ seat().maxCombinedHp }}</div>
      <div>Hand: {{ handCount() }} card(s)</div>
    </div>
  `,
})
export class SeatSummary {
  readonly seat = input.required<Seat>();
  readonly handCount = input.required<number>();

  protected readonly generalDisplayName = generalDisplayName;
  protected readonly kingdomDisplayName = kingdomDisplayName;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --selectProjects app -t SeatSummary`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/seat-summary.ts projects/app/src/app/game-board/seat-summary.spec.ts
git commit -m "feat(app): add the SeatSummary component"
```

---

## Task 10: `GameOver` component

**Files:**
- Create: `projects/app/src/app/game-board/game-over.ts`
- Create: `projects/app/src/app/game-board/game-over.spec.ts`

**Interfaces:**
- Consumes: `kingdomDisplayName` (Task 4); `GameResult` (from `'engine'`).
- Produces (consumed by Task 11's `GameBoard`): `GameOver` with `result = input.required<GameResult>()`, `newGame = output<void>()`.

- [ ] **Step 1: Write the failing test**

Create `projects/app/src/app/game-board/game-over.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { GameResult } from 'engine';
import { GameOver } from './game-over';

describe('GameOver', () => {
  it('renders the winning kingdom and seat lists, and emits newGame on click', () => {
    const fixture = TestBed.createComponent(GameOver);
    const result: GameResult = {
      endedAt: 12,
      winningKingdom: 'Wei',
      winningSeatIds: ['seat-0', 'seat-2'],
      losingSeatIds: ['seat-1', 'seat-3'],
    };
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Wei');
    expect(text).toContain('seat-0');
    expect(text).toContain('seat-2');
    expect(text).toContain('seat-1');

    const newGameSpy = jest.fn();
    fixture.componentInstance.newGame.subscribe(newGameSpy);
    (fixture.nativeElement as HTMLElement).querySelector('button')!.dispatchEvent(new Event('click'));
    expect(newGameSpy).toHaveBeenCalled();
  });

  it('renders a draw when there is no winning kingdom', () => {
    const fixture = TestBed.createComponent(GameOver);
    fixture.componentRef.setInput('result', {
      endedAt: 20,
      winningSeatIds: [],
      losingSeatIds: ['seat-0', 'seat-1'],
    } satisfies GameResult);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Draw');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects app -t GameOver`
Expected: FAIL with "Cannot find module './game-over'".

- [ ] **Step 3: Implement `GameOver`**

Create `projects/app/src/app/game-board/game-over.ts`:

```ts
import { Component, input, output } from '@angular/core';
import { GameResult } from 'engine';
import { kingdomDisplayName } from '../labels';

@Component({
  selector: 'app-game-over',
  template: `
    <div class="game-over">
      <h2>Game over</h2>
      @if (result().winningKingdom) {
        <p>{{ kingdomDisplayName(result().winningKingdom!) }} wins!</p>
      } @else {
        <p>Draw — no survivors.</p>
      }
      <p>Winners: {{ result().winningSeatIds.join(', ') || 'none' }}</p>
      <p>Losers: {{ result().losingSeatIds.join(', ') || 'none' }}</p>
      <button (click)="newGame.emit()">New game</button>
    </div>
  `,
})
export class GameOver {
  readonly result = input.required<GameResult>();
  readonly newGame = output<void>();

  protected readonly kingdomDisplayName = kingdomDisplayName;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --selectProjects app -t GameOver`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/game-over.ts projects/app/src/app/game-board/game-over.spec.ts
git commit -m "feat(app): add the GameOver component"
```

---

## Task 11: `GameBoard` — the container component

**Files:**
- Create: `projects/app/src/app/game-board/game-board.ts`
- Create: `projects/app/src/app/game-board/game-board.spec.ts`
- Modify: `projects/app/src/app/app.routes.ts` (point `/game` at the real `GameBoard`, remove the placeholder)

**Interfaces:**
- Consumes: `GameService` (Task 3); `RevealGateOverlay` (Task 6); `ActionList` (Task 7); `EventLog` (Task 8); `SeatSummary` (Task 9); `GameOver` (Task 10).
- Produces: the `/game` route's component; no further task depends on this one.

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/game-board/game-board.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameBoard } from './game-board';
import { GameService } from '../game.service';

describe('GameBoard', () => {
  let gameService: GameService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    gameService = TestBed.inject(GameService);
  });

  it('shows the reveal gate for the active seat when no seat is revealed yet', () => {
    gameService.startGame(2, 1);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
  });

  it('shows the action list once the active seat is revealed, and hides the gate', () => {
    gameService.startGame(2, 1);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
    expect(el.querySelector('app-action-list')).not.toBeNull();
  });

  it('re-shows the reveal gate for the next seat after an action is submitted', () => {
    gameService.startGame(2, 1);
    const firstSeat = gameService.activeSeatId()!;
    gameService.reveal(firstSeat);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const endPhase = gameService.legalActions().find((a) => a.kind === 'EndPhaseAction')!;
    gameService.submit(endPhase);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
  });

  it('shows a dismissible error banner when GameService reports an error', () => {
    gameService.startGame(2, 1);
    gameService.reveal(gameService.activeSeatId()!);
    gameService.submit({ kind: 'PassAction', seatId: gameService.activeSeatId()!, pendingResponseId: 'nope' });
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No matching pending response');
  });

  it('shows GameOver instead of the action list once the game has a result', () => {
    gameService.startGame(2, 1);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    // Play out actions via the real engine until the game ends. EndPhaseAction
    // is always legal and always progresses the game, so repeatedly ending
    // phases for whichever seat is active will eventually terminate the game
    // (the same property the engine's own property.spec.ts already relies on).
    let guard = 0;
    while (!gameService.state()!.result && guard < 5000) {
      const seatId = gameService.activeSeatId()!;
      gameService.reveal(seatId);
      const actions = gameService.legalActions();
      const endPhase = actions.find((a) => a.kind === 'EndPhaseAction');
      gameService.submit(endPhase ?? actions[0]);
      guard++;
    }
    expect(gameService.state()!.result).not.toBeNull();

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-game-over')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects app -t GameBoard`
Expected: FAIL with "Cannot find module './game-board'".

- [ ] **Step 3: Implement `GameBoard`**

Create `projects/app/src/app/game-board/game-board.ts`:

```ts
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Action } from 'engine';
import { GameService } from '../game.service';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { ActionList } from './action-list';
import { EventLog } from './event-log';
import { SeatSummary } from './seat-summary';
import { GameOver } from './game-over';

interface SeatViewModel {
  seat: import('engine').Seat;
  handCount: number;
}

@Component({
  selector: 'app-game-board',
  imports: [RevealGateOverlay, ActionList, EventLog, SeatSummary, GameOver],
  template: `
    @if (lastError(); as error) {
      <div class="error-banner">
        {{ error }}
        <button (click)="dismissError()">Dismiss</button>
      </div>
    }

    @if (gameService.state(); as state) {
      @if (state.result; as result) {
        <app-game-over [result]="result" (newGame)="goToSetup()" />
      } @else if (activeSeatId(); as activeSeatId) {
        @if (gameService.revealedSeatId() !== activeSeatId) {
          <app-reveal-gate-overlay [seatId]="activeSeatId" (revealed)="gameService.reveal(activeSeatId)" />
        } @else if (visibleState(); as visible) {
          <div class="seats">
            @for (vm of seatViewModels(); track vm.seat.id) {
              <app-seat-summary [seat]="vm.seat" [handCount]="vm.handCount" />
            }
          </div>
          <app-action-list
            [actions]="gameService.legalActions()"
            [state]="visible"
            [registry]="gameService.registry"
            (actionChosen)="submit($event)"
          />
          <app-event-log [events]="visible.log" />
        }
      }
    }
  `,
})
export class GameBoard {
  protected readonly gameService = inject(GameService);
  private readonly router = inject(Router);

  protected readonly activeSeatId = this.gameService.activeSeatId;
  protected readonly visibleState = this.gameService.visibleState;
  protected readonly lastError = this.gameService.lastError;

  protected readonly seatViewModels = computed<SeatViewModel[]>(() => {
    const state = this.visibleState();
    if (!state) return [];
    return state.seats.map((seat) => ({
      seat,
      handCount: state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0,
    }));
  });

  submit(action: Action): void {
    this.gameService.submit(action);
  }

  dismissError(): void {
    this.gameService.clearError();
  }

  goToSetup(): void {
    this.router.navigateByUrl('/setup');
  }
}
```

- [ ] **Step 4: Wire the real route**

Replace `projects/app/src/app/app.routes.ts` with:

```ts
import { Routes } from '@angular/router';
import { Setup } from './setup/setup';
import { GameBoard } from './game-board/game-board';

export const routes: Routes = [
  { path: 'setup', component: Setup },
  { path: 'game', component: GameBoard },
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --selectProjects app -t GameBoard`
Expected: PASS, all 5 tests (the "GameOver" test may take a moment — it plays a real game to completion via `EndPhaseAction`s).

- [ ] **Step 6: Run the full app suite and type-check**

```bash
npx jest --selectProjects app
npx tsc --noEmit -p projects/app/tsconfig.app.json
```

Expected: all suites pass; 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/game-board/game-board.ts projects/app/src/app/game-board/game-board.spec.ts projects/app/src/app/app.routes.ts
git commit -m "feat(app): add the GameBoard container and wire the real /game route"
```

---

## Task 12: Root shell, final build/type-check, manual verification

**Files:**
- Modify: `projects/app/src/app/app.ts` (minor: give the page a real title instead of the generated "app" placeholder)

**Interfaces:**
- Produces: a working `ng serve app` that a person can click through end-to-end.

- [ ] **Step 1: Update the root shell's title**

In `projects/app/src/app/app.ts`, change:

```ts
protected readonly title = signal('app');
```

to:

```ts
protected readonly title = signal('Guozhan');
```

- [ ] **Step 2: Run the full app suite**

Run: `npx jest --selectProjects app`
Expected: PASS. (The `app.spec.ts` test asserting `textContent).toContain('Hello, app')` from Task 1's scaffold will now fail, since the title changed — update it to `toContain('Guozhan')` in `projects/app/src/app/app.spec.ts`, matching the new title.)

- [ ] **Step 3: Full workspace verification**

```bash
rm -rf out-tsc dist
npx tsc --noEmit -p projects/engine/tsconfig.lib.json
npx tsc --noEmit -p projects/engine/tsconfig.spec.json
npx tsc --noEmit -p projects/content/tsconfig.lib.json
npx tsc --noEmit -p projects/content/tsconfig.spec.json
npx tsc --noEmit -p projects/sim/tsconfig.json
npx tsc --noEmit -p projects/app/tsconfig.app.json
npx jest
npx ng build app --configuration development
```

Expected: every `tsc` check 0 errors; full Jest suite passes (engine + content + sim + app); `ng build app` succeeds.

- [ ] **Step 4: Manual click-through (this milestone's acceptance check — no e2e runner)**

```bash
npx ng serve app
```

Open the printed local URL in a browser and walk the full flow once:
1. `/setup` loads by default (redirected from `/`); set seat count to 3, leave seed blank, click "Start game".
2. Confirm the reveal gate appears naming the first active seat; tap "Tap to reveal".
3. Confirm seat summaries show only the revealed seat's kingdom/generals in the clear, others as "Hidden"/"a hidden general"; confirm the action list shows legal actions with readable labels; click one.
4. Confirm the reveal gate reappears (for the same seat again, or the next seat, depending on whose turn it now is).
5. Continue until either a `RevealGeneralAction` becomes available (click it, confirm that seat's kingdom becomes visible to others afterward) or the game reaches a result — confirm the `GameOver` screen renders winners/losers and "New game" returns to `/setup`.

Stop the dev server (Ctrl-C) once this is confirmed.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/app.ts projects/app/src/app/app.spec.ts
git commit -m "feat(app): set the page title and complete manual verification"
```

---

## Self-Review Notes (completed during authoring)

- **Spec coverage:** every "In scope" bullet from the design spec's Scope section maps to a task — setup screen (Task 5), all-human pass-and-play (Task 3's `activeSeatId`/Task 6's reveal gate), reveal-gate mechanic (Task 6, Task 11), the redaction extension (Task 2), functional-first action list/seat summaries/event log (Tasks 7-9), game-over screen (Task 10). The three explicitly-deferred items (networking, persistence, bot seats, visual fidelity) have no task, correctly.
- **Placeholder scan:** an earlier draft of Task 11 had a vacuous test (`expect((fixture => fixture)(null)).toBeNull()`) and a `dismissError()` stub that submitted a bogus action to clear an error. Both were caught during self-review and rewritten before this plan was finalized: `dismissError()` calls a proper `clearError()` method, added to `GameService` directly in Task 3 (with its own test there) rather than retrofitted later, and Task 11's "game ends" test drives a real game to completion via repeated `EndPhaseAction`s instead of asserting nothing. The plan as written contains only the corrected versions — no task shows a broken draft followed by a fix.
- **Type consistency:** `Action`, `EngineEvent`, `GameState`, `Seat`, `ContentRegistry`, `GameResult`, `Kingdom` are used with identical shapes across every task, matching the actual current engine/content exports (verified by reading the source files during planning, not assumed). `GameService`'s public signal/method names (`state`, `revealedSeatId`, `lastError`, `activeSeatId`, `legalActions`, `visibleState`, `registry`, `startGame`, `reveal`, `submit`, `clearError`) are identical everywhere they are consumed (Tasks 5, 11).
