# Kingdom War (Guozhan) Rules Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a headless, framework-independent TypeScript rules engine for Sanguosha's Kingdom War (Guozhan) mode, plus a minimal content pack and simulation harness, inside a single Angular CLI workspace, with the engine/content libraries carrying zero Angular or browser dependency.

**Architecture:** Three pure-TypeScript packages — `engine` (domain types, the Action→Effect→Event `resolve()` pipeline, registry interfaces, generic rule modules), `content` (card/general/skill definitions plus the Kingdom War `GameModeDefinition`, depending only on `engine`), and `sim` (a headless Node CLI driving random-legal-move bots through many games) — built inside one Angular CLI workspace via `ng generate library`, tested with Jest, with the future Angular `app` project deferred to a later sub-project.

**Tech Stack:** TypeScript, Angular CLI 22.x (workspace/library tooling only — no `@angular/core` imports in engine/content source), Jest + ts-jest, ts-node (for running the `sim` CLI in development), Node 24.

**Spec:** `docs/superpowers/specs/2026-09-03-guozhan-engine-design.md`

## Global Constraints

- Engine and content libraries MUST NOT import from `@angular/core`, any Angular package, or any browser-only API (spec: Purpose; CLAUDE.md: Layering).
- The engine core MUST NOT branch on a specific card/general/skill id (no `if (card.id === 'sha')`); all such dispatch goes through `ContentRegistry`/`ModeRegistry` lookups (spec: Extensibility; CLAUDE.md: Extensibility).
- `GameState` and every type nested inside it MUST be plain, JSON-serializable data — no functions, no class instances, `RngState` as plain seed+counter data (spec: Serializability).
- `resolve()` MUST be pure: identical `(state, action)` pairs (with the same `ContentRegistry`/`GameModeDefinition`) always produce identical results; all randomness comes from the seeded `RngState` inside `GameState` (spec: Action → Effect → Event pipeline).
- Test runner is Jest everywhere in this plan; no Karma/browser test runner is introduced (spec: Workspace layout).
- Every non-trivial rule implemented in `content` (card behavior, general skill, mode rule) has its exact rule text stated in this plan before its implementation step (CLAUDE.md: Process).
- Dependency direction is one-way: `sim → content → engine`; `engine` never imports from `content` or `sim` (spec: Workspace layout).

---

## File Structure

```
angular.json, package.json, tsconfig.json, jest.config.js   — workspace root

projects/engine/src/lib/
  rng/rng.ts, rng.spec.ts
  domain/types.ts, domain/factories.ts, domain/factories.spec.ts
  domain/redact.ts, domain/redact.spec.ts
  cards/zones.ts, cards/zones.spec.ts                          — CardZone/CardInstance types live in domain/types.ts
  cards/deck.ts, cards/deck.spec.ts
  registry/types.ts, registry/lookup.ts, registry/lookup.spec.ts   — also defines SkillDefinition/SkillTrigger, alongside GeneralDefinition which references them
  pipeline/actions.ts, pipeline/effects.ts, pipeline/events.ts
  pipeline/resolve.ts, pipeline/resolve.spec.ts                — Response pause/resume lives inside resolve.ts, not a separate file
  pipeline/winCondition.spec.ts                                 — win-check wrapper is part of resolve.ts; this spec covers just that behavior
  skills/triggers.ts, skills/triggers.spec.ts
  rules/legality.ts, rules/legality.spec.ts
  rules/phaseSequence.ts, rules/phaseSequence.spec.ts
  setup/gameSetup.ts, setup/gameSetup.spec.ts
  public-api.ts

projects/content/src/lib/
  cards/sha.ts, cards/shan.ts, cards/peach.ts, cards/cards.spec.ts
  cards/duel.ts, cards/wuxie.ts, cards/equipment.ts, cards/tricks.spec.ts
  generals/setOne.ts, generals/setOne.spec.ts
  generals/setTwo.ts, generals/setTwo.spec.ts
  shared/queries.ts                                             — findSeatIdForGeneral, getSeatDistance (used by generals/*, no standalone spec — exercised through the general specs above)
  registry.ts, registry.spec.ts
  modes/kingdomWar.ts, modes/kingdomWar.spec.ts
  public-api.ts

projects/sim/src/
  bot.ts, bot.spec.ts
  runGame.ts, runGame.spec.ts
  invariants.ts, invariants.spec.ts
  property.spec.ts
  cli.ts
  tsconfig.json
```

Each `lib` subfolder has one clear responsibility (RNG, domain types, card/zone mechanics, registries, the pipeline, skills, rule modules, setup). `content` mirrors this by content category (basic cards, trick cards, two general sets, the mode definition) so each file stays focused and files that change together (a card and its test) live together.

---

## Task 1: Scaffold the Angular CLI workspace with engine/content libraries and Jest

**Files:**
- Create: `angular.json`, `package.json`, `tsconfig.json` (workspace root, via `ng new`)
- Create: `projects/engine/` (via `ng generate library engine`)
- Create: `projects/content/` (via `ng generate library content`)
- Create: `jest.config.js`, `projects/engine/tsconfig.spec.json` (jest variant), `projects/content/tsconfig.spec.json`

**Interfaces:**
- Produces: a workspace where `npx jest` discovers and runs specs under `projects/engine/src` and `projects/content/src`.

- [ ] **Step 1: Scaffold the workspace**

Run (this repo already has `.git`, `CLAUDE.md`, and `docs/`, so skip git init and allow an existing directory):

```bash
npx --yes @angular/cli@22 new my-sanguosha-workspace --directory . --create-application=false --package-manager npm --skip-git
```

Verify: `angular.json` exists at repo root and `git status` shows the new files as untracked (nothing was committed yet).

- [ ] **Step 2: Generate the engine and content libraries**

```bash
npx ng generate library engine --skip-install
npx ng generate library content --skip-install
```

Verify: `projects/engine/src/lib/` and `projects/content/src/lib/` exist, each with a generated `public-api.ts`. Delete the placeholder generated component/service files `ng generate library` creates (e.g. `engine.service.ts`, `engine.service.spec.ts` and content's equivalents) — this plan replaces them with the structure above.

- [ ] **Step 3: Add Jest and ts-jest, remove the default Karma/Jasmine test target**

```bash
npm install --save-dev jest ts-jest @types/jest
```

Create `jest.config.js` at the repo root:

```js
module.exports = {
  projects: [
    {
      displayName: 'engine',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/engine/src',
      testMatch: ['**/*.spec.ts'],
    },
    {
      displayName: 'content',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/content/src',
      testMatch: ['**/*.spec.ts'],
    },
  ],
};
```

Add to `package.json` scripts: `"test": "jest"`.

- [ ] **Step 4: Verify Jest runs (sanity test)**

Create `projects/engine/src/lib/sanity.spec.ts`:

```ts
describe('workspace sanity', () => {
  it('runs under jest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx jest`
Expected: 1 test suite, 1 test, PASS. Then delete `sanity.spec.ts` — it was only to prove the harness works.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Angular CLI workspace with engine/content libraries and Jest"
```

---

## Task 2: Seeded RNG (engine)

**Files:**
- Create: `projects/engine/src/lib/rng/rng.ts`
- Test: `projects/engine/src/lib/rng/rng.spec.ts`

**Interfaces:**
- Produces: `RngState { seed: number; counter: number }`, `createRng(seed: number): RngState`, `nextFloat(rng: RngState): { value: number; rng: RngState }`, `nextInt(rng: RngState, maxExclusive: number): { value: number; rng: RngState }`.

- [ ] **Step 1: Write the failing test**

```ts
import { createRng, nextFloat, nextInt } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const stepA = nextFloat(a);
    const stepB = nextFloat(b);
    expect(stepA.value).toBe(stepB.value);
  });

  it('advances the counter and produces different values on successive draws', () => {
    const rng = createRng(42);
    const first = nextFloat(rng);
    const second = nextFloat(first.rng);
    expect(first.rng.counter).toBe(1);
    expect(second.rng.counter).toBe(2);
    expect(first.value).not.toBe(second.value);
  });

  it('nextInt stays within [0, maxExclusive)', () => {
    let rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const step = nextInt(rng, 6);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(6);
      rng = step.rng;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest rng.spec.ts`
Expected: FAIL with "Cannot find module './rng'".

- [ ] **Step 3: Write minimal implementation**

```ts
export interface RngState {
  readonly seed: number;
  readonly counter: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, counter: 0 };
}

export function nextFloat(rng: RngState): { value: number; rng: RngState } {
  const counter = rng.counter + 1;
  let t = (rng.seed + counter * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { seed: rng.seed, counter } };
}

export function nextInt(rng: RngState, maxExclusive: number): { value: number; rng: RngState } {
  const step = nextFloat(rng);
  return { value: Math.floor(step.value * maxExclusive), rng: step.rng };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest rng.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/rng
git commit -m "feat(engine): add deterministic seeded RNG"
```

---

## Task 3: Core domain types and factories (engine)

**Files:**
- Create: `projects/engine/src/lib/domain/types.ts`
- Create: `projects/engine/src/lib/domain/factories.ts`
- Test: `projects/engine/src/lib/domain/factories.spec.ts`

**Interfaces:**
- Consumes: `RngState` from `../rng/rng`.
- Produces: `Kingdom`, `Target`, `Turn`, `Phase`, `GameResult`, `GeneralInstance`, `Seat`, `Player`, `CardZoneRef`, `GameState` types; `createSeat(id: string, index: number, kingdom: Kingdom, mainGeneralId: string, deputyGeneralId: string, maxHpLookup: (generalId: string) => number): Seat`, `createPlayer(id: string, seatId: string, kind: 'human' | 'bot'): Player`.

- [ ] **Step 1: Write types** (no test for a pure type file — covered by the factory tests below, which fail to compile if the types are wrong)

```ts
// projects/engine/src/lib/domain/types.ts
import { RngState } from '../rng/rng';

export type Kingdom = 'Wei' | 'Shu' | 'Wu' | 'Qun';

export type Target =
  | { kind: 'seat'; seatId: string }
  | { kind: 'general'; seatId: string; generalSlot: 'main' | 'deputy' };

export interface Turn {
  turnNumber: number;
  ownerSeatId: string;
  extraTurnStack: string[];
}

export type Phase = 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End';

export interface GameResult {
  endedAt: number;
  winningKingdom?: Kingdom;
  winningSeatIds: string[];
  losingSeatIds: string[];
}

export interface GeneralInstance {
  generalDefinitionId: string;
  revealed: boolean;
}

export interface CardZoneRef {
  zoneId: string;
}

export interface Seat {
  id: string;
  index: number;
  kingdom: Kingdom;
  generals: { main: GeneralInstance; deputy: GeneralInstance };
  combinedHp: number;
  maxCombinedHp: number;
  hand: CardZoneRef;
  equipped: CardZoneRef;
  eliminated: boolean;
}

export interface Player {
  id: string;
  seatId: string;
  kind: 'human' | 'bot';
}

export interface PendingResponse {
  id: string;
  respondingSeatId: string;
  allowedActionKinds: string[];
  context: { effect: unknown };
}

export interface CardZone {
  id: string;
  kind: 'hand' | 'equip' | 'drawPile' | 'discardPile' | 'judgment';
  ownerSeatId?: string;
  cards: CardInstance[];
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  suit: 'spade' | 'heart' | 'club' | 'diamond';
  rank: number;
}

export interface GameEvent {
  kind: string;
  [key: string]: unknown;
}

export interface GameState {
  seats: Seat[];
  players: Player[];
  turn: Turn;
  zones: CardZone[];
  pendingResponse: PendingResponse | null;
  log: GameEvent[];
  rng: RngState;
  result: GameResult | null;
}
```

- [ ] **Step 2: Write the failing factory test**

```ts
// projects/engine/src/lib/domain/factories.spec.ts
import { createSeat, createPlayer } from './factories';

describe('domain factories', () => {
  it('creates a seat with combined HP from both generals and both hidden', () => {
    const maxHp = (id: string) => (id === 'main-general' ? 4 : 3);
    const seat = createSeat('seat-1', 0, 'Wei', 'main-general', 'deputy-general', maxHp);

    expect(seat.maxCombinedHp).toBe(7);
    expect(seat.combinedHp).toBe(7);
    expect(seat.generals.main).toEqual({ generalDefinitionId: 'main-general', revealed: false });
    expect(seat.generals.deputy).toEqual({ generalDefinitionId: 'deputy-general', revealed: false });
    expect(seat.eliminated).toBe(false);
  });

  it('creates a player bound to a seat', () => {
    const player = createPlayer('player-1', 'seat-1', 'bot');
    expect(player).toEqual({ id: 'player-1', seatId: 'seat-1', kind: 'bot' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest factories.spec.ts`
Expected: FAIL with "Cannot find module './factories'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/engine/src/lib/domain/factories.ts
import { Seat, Player, Kingdom, CardZoneRef } from './types';

export function createSeat(
  id: string,
  index: number,
  kingdom: Kingdom,
  mainGeneralId: string,
  deputyGeneralId: string,
  maxHpLookup: (generalDefinitionId: string) => number
): Seat {
  const maxCombinedHp = maxHpLookup(mainGeneralId) + maxHpLookup(deputyGeneralId);
  const hand: CardZoneRef = { zoneId: `${id}:hand` };
  const equipped: CardZoneRef = { zoneId: `${id}:equip` };
  return {
    id,
    index,
    kingdom,
    generals: {
      main: { generalDefinitionId: mainGeneralId, revealed: false },
      deputy: { generalDefinitionId: deputyGeneralId, revealed: false },
    },
    combinedHp: maxCombinedHp,
    maxCombinedHp,
    hand,
    equipped,
    eliminated: false,
  };
}

export function createPlayer(id: string, seatId: string, kind: 'human' | 'bot'): Player {
  return { id, seatId, kind };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest factories.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add projects/engine/src/lib/domain
git commit -m "feat(engine): add core domain types and Seat/Player factories"
```

---

## Task 4: Hidden-general redaction (engine)

**Files:**
- Create: `projects/engine/src/lib/domain/redact.ts`
- Test: `projects/engine/src/lib/domain/redact.spec.ts`

**Interfaces:**
- Consumes: `GameState`, `Seat` from `./types`.
- Produces: `redactStateForSeat(state: GameState, viewerSeatId: string): GameState`.

- [ ] **Step 1: Write the failing test**

```ts
import { redactStateForSeat } from './redact';
import { createSeat, createPlayer } from './factories';
import { GameState } from './types';

function makeState(): GameState {
  const maxHp = () => 4;
  const seatA = createSeat('seat-a', 0, 'Wei', 'general-x', 'general-y', maxHp);
  const seatB = createSeat('seat-b', 1, 'Shu', 'general-z', 'general-w', maxHp);
  return {
    seats: [seatA, seatB],
    players: [createPlayer('p1', 'seat-a', 'human'), createPlayer('p2', 'seat-b', 'bot')],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [],
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest redact.spec.ts`
Expected: FAIL with "Cannot find module './redact'".

- [ ] **Step 3: Write minimal implementation**

```ts
import { GameState, Seat } from './types';

const HIDDEN_GENERAL_ID = 'hidden';

function redactSeat(seat: Seat, viewerSeatId: string): Seat {
  if (seat.id === viewerSeatId) return seat;
  return {
    ...seat,
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
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest redact.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/domain
git commit -m "feat(engine): redact unrevealed generals from other seats' view"
```

---

## Task 5: Card zone operations (engine)

**Files:**
- Create: `projects/engine/src/lib/cards/zones.ts`
- Test: `projects/engine/src/lib/cards/zones.spec.ts`

**Interfaces:**
- Consumes: `CardZone`, `CardInstance` from `../domain/types`.
- Produces: `moveCard(zones: CardZone[], cardInstanceId: string, toZoneId: string): CardZone[]`, `drawTop(zones: CardZone[], fromZoneId: string, toZoneId: string, count: number): { zones: CardZone[]; drawn: CardInstance[] }`.

- [ ] **Step 1: Write the failing test**

```ts
import { moveCard, drawTop } from './zones';
import { CardZone } from '../domain/types';

function card(instanceId: string): { instanceId: string; definitionId: string; suit: 'spade'; rank: number } {
  return { instanceId, definitionId: 'sha', suit: 'spade', rank: 1 };
}

describe('zones', () => {
  it('moveCard relocates a card from whichever zone holds it to the target zone', () => {
    const zones: CardZone[] = [
      { id: 'draw', kind: 'drawPile', cards: [card('c1'), card('c2')] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
    ];
    const result = moveCard(zones, 'c1', 'seat-a:hand');
    const draw = result.find((z) => z.id === 'draw')!;
    const hand = result.find((z) => z.id === 'seat-a:hand')!;
    expect(draw.cards.map((c) => c.instanceId)).toEqual(['c2']);
    expect(hand.cards.map((c) => c.instanceId)).toEqual(['c1']);
  });

  it('drawTop moves the first N cards and reports what was drawn', () => {
    const zones: CardZone[] = [
      { id: 'draw', kind: 'drawPile', cards: [card('c1'), card('c2'), card('c3')] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
    ];
    const { zones: result, drawn } = drawTop(zones, 'draw', 'seat-a:hand', 2);
    expect(drawn.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
    const hand = result.find((z) => z.id === 'seat-a:hand')!;
    expect(hand.cards.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest zones.spec.ts`
Expected: FAIL with "Cannot find module './zones'".

- [ ] **Step 3: Write minimal implementation**

```ts
import { CardZone, CardInstance } from '../domain/types';

export function moveCard(zones: CardZone[], cardInstanceId: string, toZoneId: string): CardZone[] {
  let moving: CardInstance | undefined;
  const withoutCard = zones.map((zone) => {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (!found) return zone;
    moving = found;
    return { ...zone, cards: zone.cards.filter((c) => c.instanceId !== cardInstanceId) };
  });
  if (!moving) throw new Error(`Card ${cardInstanceId} not found in any zone`);
  return withoutCard.map((zone) =>
    zone.id === toZoneId ? { ...zone, cards: [...zone.cards, moving as CardInstance] } : zone
  );
}

export function drawTop(
  zones: CardZone[],
  fromZoneId: string,
  toZoneId: string,
  count: number
): { zones: CardZone[]; drawn: CardInstance[] } {
  const source = zones.find((z) => z.id === fromZoneId);
  if (!source) throw new Error(`Zone ${fromZoneId} not found`);
  const drawn = source.cards.slice(0, count);
  const result = zones.map((zone) => {
    if (zone.id === fromZoneId) return { ...zone, cards: zone.cards.slice(count) };
    if (zone.id === toZoneId) return { ...zone, cards: [...zone.cards, ...drawn] };
    return zone;
  });
  return { zones: result, drawn };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest zones.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/cards
git commit -m "feat(engine): add card zone move/draw operations"
```

---

## Task 6: Deck builder (engine)

**Files:**
- Create: `projects/engine/src/lib/cards/deck.ts`
- Test: `projects/engine/src/lib/cards/deck.spec.ts`

**Interfaces:**
- Consumes: `RngState`, `nextInt` from `../rng/rng`; `CardInstance` from `../domain/types`.
- Produces: `DeckSpecEntry { definitionId: string; suit: CardInstance['suit']; rank: number }`, `buildDeck(entries: DeckSpecEntry[], rng: RngState): { cards: CardInstance[]; rng: RngState }`.

- [ ] **Step 1: Write the failing test**

```ts
import { buildDeck, DeckSpecEntry } from './deck';
import { createRng } from '../rng/rng';

function entries(): DeckSpecEntry[] {
  return [
    { definitionId: 'sha', suit: 'spade', rank: 1 },
    { definitionId: 'sha', suit: 'heart', rank: 2 },
    { definitionId: 'shan', suit: 'club', rank: 3 },
    { definitionId: 'peach', suit: 'diamond', rank: 4 },
  ];
}

describe('buildDeck', () => {
  it('includes every entry exactly once, each with a unique instance id', () => {
    const { cards } = buildDeck(entries(), createRng(1));
    expect(cards).toHaveLength(4);
    expect(new Set(cards.map((c) => c.instanceId)).size).toBe(4);
    expect(cards.map((c) => c.definitionId).sort()).toEqual(['peach', 'sha', 'sha', 'shan']);
  });

  it('is deterministic for a given seed and shuffles order for different seeds', () => {
    const a = buildDeck(entries(), createRng(1)).cards.map((c) => c.definitionId + c.suit);
    const b = buildDeck(entries(), createRng(1)).cards.map((c) => c.definitionId + c.suit);
    const c = buildDeck(entries(), createRng(2)).cards.map((c) => c.definitionId + c.suit);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest deck.spec.ts`
Expected: FAIL with "Cannot find module './deck'".

- [ ] **Step 3: Write minimal implementation** (Fisher-Yates shuffle driven by the seeded RNG)

```ts
import { RngState, nextInt } from '../rng/rng';
import { CardInstance } from '../domain/types';

export interface DeckSpecEntry {
  definitionId: string;
  suit: CardInstance['suit'];
  rank: number;
}

export function buildDeck(entries: DeckSpecEntry[], rng: RngState): { cards: CardInstance[]; rng: RngState } {
  const cards: CardInstance[] = entries.map((entry, index) => ({
    instanceId: `${entry.definitionId}-${entry.suit}-${entry.rank}-${index}`,
    definitionId: entry.definitionId,
    suit: entry.suit,
    rank: entry.rank,
  }));

  let currentRng = rng;
  for (let i = cards.length - 1; i > 0; i--) {
    const step = nextInt(currentRng, i + 1);
    currentRng = step.rng;
    const j = step.value;
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, rng: currentRng };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest deck.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/cards
git commit -m "feat(engine): add seeded deck builder"
```

---

## Task 7: Registry types and lookup helpers (engine)

**Files:**
- Create: `projects/engine/src/lib/registry/types.ts`
- Create: `projects/engine/src/lib/registry/lookup.ts`
- Test: `projects/engine/src/lib/registry/lookup.spec.ts`

**Interfaces:**
- Consumes: `GameState`, `Target`, `GameEvent` from `../domain/types`.
- Produces: `CardDefinition`, `PlayContext`, `GeneralDefinition`, `ContentRegistry`, `GameModeDefinition`, `ModeRegistry` types; `lookupCard(registry, id): CardDefinition`, `lookupGeneral(registry, id): GeneralDefinition`, `lookupMode(modes, id): GameModeDefinition` (each throws a clear error on a missing id — this is the engine's only way to reach content, so a missing id must fail loudly rather than silently).

- [ ] **Step 1: Write the types** (no separate test; exercised by the lookup tests below)

```ts
// projects/engine/src/lib/registry/types.ts
import { GameState, Target, Kingdom, GameResult, RngState } from '../domain/types';

export interface PlayContext {
  seatId: string;
  cardInstanceId: string;
  targets: Target[];
  respondingTo?: string;
}

export interface CardDefinition {
  id: string;
  name: string;
  category: 'basic' | 'trick' | 'equipment';
  play(state: GameState, ctx: PlayContext): unknown[];
}

export type TriggerPoint = `before:${string}` | `after:${string}`;

export interface SkillTrigger {
  point: TriggerPoint;
  condition(state: GameState, subject: unknown): boolean;
  effect(state: GameState, subject: unknown): unknown[];
}

export interface SkillDefinition {
  id: string;
  triggers: SkillTrigger[];
  activation: 'auto' | 'player-choice';
}

export interface GeneralDefinition {
  id: string;
  kingdom: Kingdom;
  maxHp: number;
  skills: SkillDefinition[];
}

export interface ContentRegistry {
  cards: Map<string, CardDefinition>;
  generals: Map<string, GeneralDefinition>;
}

export interface GameModeDefinition {
  id: string;
  setup(seatIds: string[], registry: ContentRegistry, rng: RngState): { state: GameState; rng: RngState };
  checkWinCondition(state: GameState): GameResult | null;
  triggers: SkillTrigger[];
}

export type ModeRegistry = Map<string, GameModeDefinition>;
```

- [ ] **Step 2: Write the failing test**

```ts
// projects/engine/src/lib/registry/lookup.spec.ts
import { lookupCard, lookupGeneral, lookupMode } from './lookup';
import { ContentRegistry, ModeRegistry, CardDefinition, GeneralDefinition, GameModeDefinition } from './types';

describe('registry lookups', () => {
  it('finds a registered card definition by id', () => {
    const sha: CardDefinition = { id: 'sha', name: 'Sha', category: 'basic', play: () => [] };
    const registry: ContentRegistry = { cards: new Map([['sha', sha]]), generals: new Map() };
    expect(lookupCard(registry, 'sha')).toBe(sha);
  });

  it('throws a clear error for an unregistered card id', () => {
    const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
    expect(() => lookupCard(registry, 'does-not-exist')).toThrow(/does-not-exist/);
  });

  it('finds a registered general definition by id', () => {
    const general: GeneralDefinition = { id: 'g1', kingdom: 'Wei', maxHp: 4, skills: [] };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['g1', general]]) };
    expect(lookupGeneral(registry, 'g1')).toBe(general);
  });

  it('finds a registered game mode by id', () => {
    const mode: GameModeDefinition = {
      id: 'kingdom-war',
      setup: (() => { throw new Error('not used in this test'); }) as GameModeDefinition['setup'],
      checkWinCondition: () => null,
      triggers: [],
    };
    const modes: ModeRegistry = new Map([['kingdom-war', mode]]);
    expect(lookupMode(modes, 'kingdom-war')).toBe(mode);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest lookup.spec.ts`
Expected: FAIL with "Cannot find module './lookup'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/engine/src/lib/registry/lookup.ts
import { ContentRegistry, ModeRegistry, CardDefinition, GeneralDefinition, GameModeDefinition } from './types';

export function lookupCard(registry: ContentRegistry, id: string): CardDefinition {
  const card = registry.cards.get(id);
  if (!card) throw new Error(`Unknown card definition id: ${id}`);
  return card;
}

export function lookupGeneral(registry: ContentRegistry, id: string): GeneralDefinition {
  const general = registry.generals.get(id);
  if (!general) throw new Error(`Unknown general definition id: ${id}`);
  return general;
}

export function lookupMode(modes: ModeRegistry, id: string): GameModeDefinition {
  const mode = modes.get(id);
  if (!mode) throw new Error(`Unknown game mode id: ${id}`);
  return mode;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest lookup.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add projects/engine/src/lib/registry
git commit -m "feat(engine): add ContentRegistry/ModeRegistry types and lookup helpers"
```

---

## Task 8: Minimal resolve() pipeline — Validation → Effect Resolution → State Update (engine)

Builds the first vertical slice of `resolve()` using `DrawCardsAction`, the simplest built-in action (no targets, no triggers, no response window — those are added in Tasks 9-11). Establishes the `Action`/`Effect`/`EngineEvent` type files and the `resolve()`/`applyEffect()` shape that later tasks extend.

**Files:**
- Create: `projects/engine/src/lib/pipeline/actions.ts`
- Create: `projects/engine/src/lib/pipeline/effects.ts`
- Create: `projects/engine/src/lib/pipeline/events.ts`
- Create: `projects/engine/src/lib/pipeline/resolve.ts`
- Test: `projects/engine/src/lib/pipeline/resolve.spec.ts`

**Interfaces:**
- Consumes: `GameState`, `Target` from `../domain/types`; `drawTop` from `../cards/zones`; `ContentRegistry`, `GameModeDefinition` from `../registry/types`.
- Produces: `Action` union (starts with `DrawCardsAction`, `PlayCardAction`, `RevealGeneralAction`, `RespondAction`, `PassAction`, `EndPhaseAction` — later tasks add handling for the rest), `Effect` union (starts with `DrawCardsEffect`), `EngineEvent` union (starts with `CardsDrawnEvent`), `EngineContext { registry: ContentRegistry; mode: GameModeDefinition }`, `applyEffect(state: GameState, effect: Effect): { state: GameState; events: EngineEvent[] }`, `resolve(state: GameState, action: Action, ctx: EngineContext): { state: GameState; events: GameEvent[] }`.

- [ ] **Step 1: Write the action/effect/event type files**

```ts
// projects/engine/src/lib/pipeline/actions.ts
import { Target } from '../domain/types';

export type Action =
  | { kind: 'DrawCardsAction'; seatId: string; count: number }
  | { kind: 'PlayCardAction'; seatId: string; cardInstanceId: string; targets: Target[] }
  | { kind: 'RevealGeneralAction'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'RespondAction'; seatId: string; pendingResponseId: string; cardInstanceId: string }
  | { kind: 'PassAction'; seatId: string; pendingResponseId: string }
  | { kind: 'EndPhaseAction'; seatId: string };
```

```ts
// projects/engine/src/lib/pipeline/events.ts
export interface CardsDrawnEvent {
  kind: 'CardsDrawnEvent';
  seatId: string;
  cardInstanceIds: string[];
}

export type EngineEvent = CardsDrawnEvent;
```

```ts
// projects/engine/src/lib/pipeline/effects.ts
import { GameState } from '../domain/types';
import { drawTop } from '../cards/zones';
import { EngineEvent } from './events';

export type Effect = { kind: 'DrawCardsEffect'; seatId: string; count: number };

export interface ApplyResult {
  state: GameState;
  events: EngineEvent[];
}

export function applyEffect(state: GameState, effect: Effect): ApplyResult {
  switch (effect.kind) {
    case 'DrawCardsEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const { zones, drawn } = drawTop(state.zones, 'drawPile', seat.hand.zoneId, effect.count);
      const event: EngineEvent = {
        kind: 'CardsDrawnEvent',
        seatId: seat.id,
        cardInstanceIds: drawn.map((c) => c.instanceId),
      };
      return { state: { ...state, zones, log: [...state.log, event] }, events: [event] };
    }
    default:
      throw new Error(`Unhandled effect kind: ${(effect as Effect).kind}`);
  }
}
```

```ts
// projects/engine/src/lib/pipeline/resolve.ts
import { GameState, GameEvent } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action } from './actions';
import { applyEffect } from './effects';

export interface EngineContext {
  registry: ContentRegistry;
  mode: GameModeDefinition;
}

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
}

export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  switch (action.kind) {
    case 'DrawCardsAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      return applyEffect(state, { kind: 'DrawCardsEffect', seatId: action.seatId, count: action.count });
    }
    default:
      throw new Error(`Action kind not yet handled by resolve(): ${action.kind}`);
  }
}
```

- [ ] **Step 2: Write the failing test**

```ts
// projects/engine/src/lib/pipeline/resolve.spec.ts
import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';

function emptyRegistry(): ContentRegistry {
  return { cards: new Map(), generals: new Map() };
}

function stubMode(): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused in this test'); }) as GameModeDefinition['setup'],
    checkWinCondition: () => null,
    triggers: [],
  };
}

function baseState(): GameState {
  return {
    seats: [
      {
        id: 'seat-a',
        index: 0,
        kingdom: 'Wei',
        generals: {
          main: { generalDefinitionId: 'g1', revealed: false },
          deputy: { generalDefinitionId: 'g2', revealed: false },
        },
        combinedHp: 7,
        maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' },
        equipped: { zoneId: 'seat-a:equip' },
        eliminated: false,
      },
    ],
    players: [{ id: 'p1', seatId: 'seat-a', kind: 'bot' }],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [
      {
        id: 'drawPile',
        kind: 'drawPile',
        cards: [
          { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 1 },
          { instanceId: 'c2', definitionId: 'sha', suit: 'heart', rank: 2 },
        ],
      },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
    ],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
  };
}

describe('resolve: DrawCardsAction', () => {
  it('moves cards from the draw pile into the seat hand and logs a CardsDrawnEvent', () => {
    const state = baseState();
    const { state: next, events } = resolve(
      state,
      { kind: 'DrawCardsAction', seatId: 'seat-a', count: 2 },
      { registry: emptyRegistry(), mode: stubMode() }
    );
    const hand = next.zones.find((z) => z.id === 'seat-a:hand')!;
    expect(hand.cards.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
    expect(events).toEqual([{ kind: 'CardsDrawnEvent', seatId: 'seat-a', cardInstanceIds: ['c1', 'c2'] }]);
  });

  it('throws for an unknown seat rather than silently mutating state', () => {
    const state = baseState();
    expect(() =>
      resolve(
        state,
        { kind: 'DrawCardsAction', seatId: 'missing', count: 1 },
        { registry: emptyRegistry(), mode: stubMode() }
      )
    ).toThrow(/Unknown seat/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest resolve.spec.ts`
Expected: FAIL with "Cannot find module './resolve'".

- [ ] **Step 4: Confirm the implementation from Step 1 is in place, then run tests**

Run: `npx jest resolve.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/pipeline
git commit -m "feat(engine): add minimal resolve() pipeline via DrawCardsAction"
```

---

## Task 9: Target Selection, Damage value object, and PlayCardAction (engine)

Adds stage 3 (Target Selection) and wires `PlayCardAction` through to a `CardDefinition` looked up from the `ContentRegistry`, using a fixture card in the test (the real `content` cards arrive in Tasks 15-16). Introduces `Damage` as an explicit value object.

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (add `Damage`)
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (add `DamageEffect`)
- Modify: `projects/engine/src/lib/pipeline/events.ts` (add `DamageDealtEvent`)
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (add `PlayCardAction` handling)
- Test: `projects/engine/src/lib/pipeline/resolve.spec.ts` (add a new `describe` block)

**Interfaces:**
- Consumes: `lookupCard` from `../registry/lookup`; `PlayContext`, `CardDefinition` from `../registry/types`.
- Produces: `Damage { source: Target | null; target: Target; amount: number; nature: 'normal' | 'fire' | 'thunder'; cause?: { cardInstanceId?: string; skillId?: string } }`; `resolve()` now also handles `PlayCardAction`.

- [ ] **Step 1: Add `Damage` to domain types**

Append to `projects/engine/src/lib/domain/types.ts`:

```ts
export interface Damage {
  source: Target | null;
  target: Target;
  amount: number;
  nature: 'normal' | 'fire' | 'thunder';
  cause?: { cardInstanceId?: string; skillId?: string };
}
```

- [ ] **Step 2: Write the failing test**

First, replace `baseState()` in `projects/engine/src/lib/pipeline/resolve.spec.ts` with this version, which adds a second seat (`seat-b`); `seat-a`'s hand stays empty here (unchanged from Task 8), so Task 8's draw-into-empty-hand assertions still pass:

```ts
function baseState(): GameState {
  return {
    seats: [
      {
        id: 'seat-a',
        index: 0,
        kingdom: 'Wei',
        generals: {
          main: { generalDefinitionId: 'g1', revealed: false },
          deputy: { generalDefinitionId: 'g2', revealed: false },
        },
        combinedHp: 7,
        maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' },
        equipped: { zoneId: 'seat-a:equip' },
        eliminated: false,
      },
      {
        id: 'seat-b',
        index: 1,
        kingdom: 'Shu',
        generals: {
          main: { generalDefinitionId: 'g3', revealed: false },
          deputy: { generalDefinitionId: 'g4', revealed: false },
        },
        combinedHp: 6,
        maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' },
        equipped: { zoneId: 'seat-b:equip' },
        eliminated: false,
      },
    ],
    players: [
      { id: 'p1', seatId: 'seat-a', kind: 'bot' },
      { id: 'p2', seatId: 'seat-b', kind: 'bot' },
    ],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [
      {
        id: 'drawPile',
        kind: 'drawPile',
        cards: [
          { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 1 },
          { instanceId: 'c2', definitionId: 'sha', suit: 'heart', rank: 2 },
        ],
      },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
  };
}
```

Then add a small helper that puts the test card into `seat-a`'s hand (only the new tests below use it, so Task 8's tests are unaffected), plus the new test block, using the `ContentRegistry` and `CardDefinition` types:

```ts
import { ContentRegistry, CardDefinition } from '../registry/types';

function withTestCardInSeatAHand(state: GameState): GameState {
  return {
    ...state,
    zones: state.zones.map((zone) =>
      zone.id === 'seat-a:hand'
        ? { ...zone, cards: [{ instanceId: 'test-card-1', definitionId: 'test-damage-card', suit: 'spade' as const, rank: 5 }] }
        : zone
    ),
  };
}

function registryWithTestDamageCard(): ContentRegistry {
  const testDamageCard: CardDefinition = {
    id: 'test-damage-card',
    name: 'Test Damage Card',
    category: 'basic',
    play: (_state, ctx) => [
      {
        kind: 'DamageEffect',
        damage: {
          source: { kind: 'seat', seatId: ctx.seatId },
          target: ctx.targets[0],
          amount: 2,
          nature: 'normal',
          cause: { cardInstanceId: ctx.cardInstanceId },
        },
      },
    ],
  };
  return { cards: new Map([['test-damage-card', testDamageCard]]), generals: new Map() };
}

describe('resolve: PlayCardAction with Target Selection and Damage', () => {
  it('applies damage to a legal target seat and logs a DamageDealtEvent', () => {
    const state = withTestCardInSeatAHand(baseState());
    const { state: next, events } = resolve(
      state,
      {
        kind: 'PlayCardAction',
        seatId: 'seat-a',
        cardInstanceId: 'test-card-1',
        targets: [{ kind: 'seat', seatId: 'seat-b' }],
      },
      { registry: registryWithTestDamageCard(), mode: stubMode() }
    );
    const seatB = next.seats.find((s) => s.id === 'seat-b')!;
    expect(seatB.combinedHp).toBe(4);
    expect(events).toEqual([
      {
        kind: 'DamageDealtEvent',
        damage: {
          source: { kind: 'seat', seatId: 'seat-a' },
          target: { kind: 'seat', seatId: 'seat-b' },
          amount: 2,
          nature: 'normal',
          cause: { cardInstanceId: 'test-card-1' },
        },
      },
    ]);
  });

  it('rejects an illegal target (eliminated seat) without mutating state', () => {
    const state = withTestCardInSeatAHand(baseState());
    state.seats[1].eliminated = true;
    expect(() =>
      resolve(
        state,
        {
          kind: 'PlayCardAction',
          seatId: 'seat-a',
          cardInstanceId: 'test-card-1',
          targets: [{ kind: 'seat', seatId: 'seat-b' }],
        },
        { registry: registryWithTestDamageCard(), mode: stubMode() }
      )
    ).toThrow(/Illegal target/);
  });

  it('rejects playing a card the seat does not hold', () => {
    const state = baseState();
    expect(() =>
      resolve(
        state,
        {
          kind: 'PlayCardAction',
          seatId: 'seat-a',
          cardInstanceId: 'not-in-hand',
          targets: [{ kind: 'seat', seatId: 'seat-b' }],
        },
        { registry: registryWithTestDamageCard(), mode: stubMode() }
      )
    ).toThrow(/does not hold/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest resolve.spec.ts`
Expected: FAIL — `PlayCardAction` falls through to the `default` case ("Action kind not yet handled").

- [ ] **Step 4: Extend `effects.ts` and `events.ts`**

In `projects/engine/src/lib/pipeline/events.ts`:

```ts
import { Damage } from '../domain/types';

export interface DamageDealtEvent {
  kind: 'DamageDealtEvent';
  damage: Damage;
}

export type EngineEvent = CardsDrawnEvent | DamageDealtEvent;
```

In `projects/engine/src/lib/pipeline/effects.ts`, extend the `Effect` union and `applyEffect`:

```ts
import { Damage } from '../domain/types';

export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage };

// inside applyEffect's switch, add:
case 'DamageEffect': {
  if (effect.damage.target.kind !== 'seat') {
    throw new Error('DamageEffect currently only supports seat targets');
  }
  const seatId = effect.damage.target.seatId;
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  const seats = state.seats.map((s) =>
    s.id === seatId ? { ...s, combinedHp: s.combinedHp - effect.damage.amount } : s
  );
  const event: EngineEvent = { kind: 'DamageDealtEvent', damage: effect.damage };
  return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
}
```

- [ ] **Step 5: Add `PlayCardAction` handling to `resolve.ts`**

```ts
import { lookupCard } from '../registry/lookup';
import { Effect } from './effects';

// inside resolve()'s switch, add:
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
    const result = applyEffect(currentState, effect);
    currentState = result.state;
    allEvents = [...allEvents, ...result.events];
  }
  return { state: currentState, events: allEvents };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest resolve.spec.ts`
Expected: PASS (5 tests total).

- [ ] **Step 7: Commit**

```bash
git add projects/engine/src/lib/domain projects/engine/src/lib/pipeline
git commit -m "feat(engine): add Target Selection, Damage value object, and PlayCardAction"
```

---

## Task 10: Skill trigger dispatch — before/after hooks (engine)

Implements the `before:<EffectType>` (modify/cancel) and `after:<EventType>` (queue follow-ups) hooks from stages 5 and 7 of the pipeline, and routes all effect application in `resolve()` through them.

**Files:**
- Modify: `projects/engine/src/lib/pipeline/actions.ts` (add `ACTION_KINDS`, `isAction`)
- Create: `projects/engine/src/lib/skills/triggers.ts`
- Test: `projects/engine/src/lib/skills/triggers.spec.ts`
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (route effect application through trigger dispatch)
- Test: `projects/engine/src/lib/pipeline/resolve.spec.ts` (add a new `describe` block)

**Interfaces:**
- Consumes: `SkillTrigger`, `TriggerPoint`, `ContentRegistry`, `GameModeDefinition` from `../registry/types`.
- Produces: `gatherTriggeredSkills(state: GameState, registry: ContentRegistry, mode: GameModeDefinition, point: TriggerPoint, subject: unknown): SkillTrigger[]`; `isAction(value: { kind: string }): value is Action`.

- [ ] **Step 1: Add the action type guard**

Append to `projects/engine/src/lib/pipeline/actions.ts`:

```ts
export const ACTION_KINDS: ReadonlySet<Action['kind']> = new Set([
  'DrawCardsAction',
  'PlayCardAction',
  'RevealGeneralAction',
  'RespondAction',
  'PassAction',
  'EndPhaseAction',
]);

export function isAction(value: { kind: string }): value is Action {
  return ACTION_KINDS.has(value.kind as Action['kind']);
}
```

- [ ] **Step 2: Write the failing test for `gatherTriggeredSkills`**

```ts
// projects/engine/src/lib/skills/triggers.spec.ts
import { gatherTriggeredSkills } from './triggers';
import { ContentRegistry, GameModeDefinition, GeneralDefinition } from '../registry/types';
import { GameState } from '../domain/types';
import { createRng } from '../rng/rng';

function stateWithGenerals(mainId: string, deputyId: string): GameState {
  return {
    seats: [
      {
        id: 'seat-a',
        index: 0,
        kingdom: 'Wei',
        generals: {
          main: { generalDefinitionId: mainId, revealed: false },
          deputy: { generalDefinitionId: deputyId, revealed: false },
        },
        combinedHp: 7,
        maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' },
        equipped: { zoneId: 'seat-a:equip' },
        eliminated: false,
      },
    ],
    players: [{ id: 'p1', seatId: 'seat-a', kind: 'bot' }],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
  };
}

function stubMode(extraTriggers: GameModeDefinition['triggers'] = []): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition: () => null,
    triggers: extraTriggers,
  };
}

describe('gatherTriggeredSkills', () => {
  it('collects a matching trigger from a seat general whose condition passes', () => {
    const general: GeneralDefinition = {
      id: 'general-main',
      kingdom: 'Wei',
      maxHp: 4,
      skills: [
        {
          id: 'skill-1',
          activation: 'auto',
          triggers: [{ point: 'before:DamageEffect', condition: () => true, effect: () => [] }],
        },
      ],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['general-main', general]]) };
    const state = stateWithGenerals('general-main', 'general-deputy');
    const found = gatherTriggeredSkills(state, registry, stubMode(), 'before:DamageEffect', {});
    expect(found).toHaveLength(1);
  });

  it('excludes a trigger whose condition returns false', () => {
    const general: GeneralDefinition = {
      id: 'general-main',
      kingdom: 'Wei',
      maxHp: 4,
      skills: [
        {
          id: 'skill-1',
          activation: 'auto',
          triggers: [{ point: 'after:DamageDealtEvent', condition: () => false, effect: () => [] }],
        },
      ],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['general-main', general]]) };
    const state = stateWithGenerals('general-main', 'general-deputy');
    const found = gatherTriggeredSkills(state, registry, stubMode(), 'after:DamageDealtEvent', {});
    expect(found).toHaveLength(0);
  });

  it('includes mode-level triggers alongside general skill triggers', () => {
    const state = stateWithGenerals('unregistered-1', 'unregistered-2');
    const modeTrigger = { point: 'before:DamageEffect' as const, condition: () => true, effect: () => [] };
    const found = gatherTriggeredSkills(
      state,
      { cards: new Map(), generals: new Map() },
      stubMode([modeTrigger]),
      'before:DamageEffect',
      {}
    );
    expect(found).toEqual([modeTrigger]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest triggers.spec.ts`
Expected: FAIL with "Cannot find module './triggers'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/engine/src/lib/skills/triggers.ts
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition, SkillTrigger, TriggerPoint } from '../registry/types';

export function gatherTriggeredSkills(
  state: GameState,
  registry: ContentRegistry,
  mode: GameModeDefinition,
  point: TriggerPoint,
  subject: unknown
): SkillTrigger[] {
  const candidates: SkillTrigger[] = [...mode.triggers];
  for (const seat of state.seats) {
    for (const slot of [seat.generals.main, seat.generals.deputy]) {
      const general = registry.generals.get(slot.generalDefinitionId);
      if (!general) continue;
      for (const skill of general.skills) {
        for (const trigger of skill.triggers) {
          if (trigger.point === point) candidates.push(trigger);
        }
      }
    }
  }
  return candidates.filter((trigger) => trigger.condition(state, subject));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest triggers.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Route `resolve()`'s effect application through trigger dispatch**

Replace the contents of `projects/engine/src/lib/pipeline/resolve.ts` with:

```ts
import { GameState, GameEvent } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action, isAction } from './actions';
import { Effect, applyEffect } from './effects';
import { lookupCard } from '../registry/lookup';
import { gatherTriggeredSkills } from '../skills/triggers';

export interface EngineContext {
  registry: ContentRegistry;
  mode: GameModeDefinition;
}

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
}

export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
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
```

This is a pure refactor of dispatch — Tasks 8 and 9's tests use empty registries/generals, so `gatherTriggeredSkills` always returns `[]` for them and their assertions are unaffected. Run `npx jest resolve.spec.ts` now and confirm all 5 existing tests still PASS before continuing.

- [ ] **Step 7: Write the failing test for trigger integration**

Append to `projects/engine/src/lib/pipeline/resolve.spec.ts`:

```ts
import { GeneralDefinition } from '../registry/types';
import { DamageDealtEvent } from './events';

describe('resolve: skill triggers modify effects and queue follow-ups', () => {
  function registryWithShieldAndDrawGenerals(): ContentRegistry {
    const testDamageCard: CardDefinition = {
      id: 'test-damage-card',
      name: 'Test Damage Card',
      category: 'basic',
      play: (_state, ctx) => [
        {
          kind: 'DamageEffect',
          damage: {
            source: { kind: 'seat', seatId: ctx.seatId },
            target: ctx.targets[0],
            amount: 4,
            nature: 'normal',
            cause: { cardInstanceId: ctx.cardInstanceId },
          },
        },
      ],
    };
    const shieldGeneral: GeneralDefinition = {
      id: 'shield-general',
      kingdom: 'Shu',
      maxHp: 4,
      skills: [
        {
          id: 'shield-skill',
          activation: 'auto',
          triggers: [
            {
              point: 'before:DamageEffect',
              condition: (_state, subject) => (subject as Effect).kind === 'DamageEffect',
              effect: (_state, subject) => {
                const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
                return [{ ...effect, damage: { ...effect.damage, amount: Math.floor(effect.damage.amount / 2) } }];
              },
            },
          ],
        },
      ],
    };
    const drawGeneral: GeneralDefinition = {
      id: 'draw-general',
      kingdom: 'Shu',
      maxHp: 3,
      skills: [
        {
          id: 'draw-skill',
          activation: 'auto',
          triggers: [
            {
              point: 'after:DamageDealtEvent',
              condition: () => true,
              effect: (_state, subject) => {
                const event = subject as DamageDealtEvent;
                if (event.damage.target.kind !== 'seat') return [];
                return [{ kind: 'DrawCardsEffect', seatId: event.damage.target.seatId, count: 1 }];
              },
            },
          ],
        },
      ],
    };
    return {
      cards: new Map([['test-damage-card', testDamageCard]]),
      generals: new Map([
        ['shield-general', shieldGeneral],
        ['draw-general', drawGeneral],
      ]),
    };
  }

  it('halves incoming damage via a before:DamageEffect trigger and draws a card via after:DamageDealtEvent', () => {
    let state = withTestCardInSeatAHand(baseState());
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.id === 'seat-b'
          ? {
              ...seat,
              generals: {
                main: { generalDefinitionId: 'shield-general', revealed: false },
                deputy: { generalDefinitionId: 'draw-general', revealed: false },
              },
            }
          : seat
      ),
    };

    const { state: next } = resolve(
      state,
      {
        kind: 'PlayCardAction',
        seatId: 'seat-a',
        cardInstanceId: 'test-card-1',
        targets: [{ kind: 'seat', seatId: 'seat-b' }],
      },
      { registry: registryWithShieldAndDrawGenerals(), mode: stubMode() }
    );

    const seatB = next.seats.find((s) => s.id === 'seat-b')!;
    expect(seatB.combinedHp).toBe(4); // 6 - floor(4/2) = 4
    const seatBHand = next.zones.find((z) => z.id === 'seat-b:hand')!;
    expect(seatBHand.cards).toHaveLength(1);
  });
});
```

- [ ] **Step 8: Run test to verify it fails, then confirm it passes**

Run: `npx jest resolve.spec.ts`
Expected (before Step 6's refactor is in place): this new test FAILs (seat-b combinedHp would be `2`, not `4`, and no card drawn). Since Step 6 already applied the refactor, running now should PASS immediately — if it doesn't, re-check Step 6 was applied exactly as written.
Expected (final): PASS (6 tests total in `resolve.spec.ts`, 3 tests in `triggers.spec.ts`).

- [ ] **Step 9: Commit**

```bash
git add projects/engine/src/lib/pipeline projects/engine/src/lib/skills
git commit -m "feat(engine): add before/after skill trigger dispatch to resolve()"
```

---

## Task 11: Response Window — PendingResponse pause/resume (engine)

Implements stage 4 of the pipeline: an `OpenResponseEffect` pauses resolution by setting `state.pendingResponse`; only `RespondAction`/`PassAction` matching that pending response are legal until it's answered; answering resumes resolution through the same `resolve()` entry point.

**Files:**
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (add `OpenResponseEffect`)
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (add pending-response guard, `RespondAction`, `PassAction`)
- Test: `projects/engine/src/lib/pipeline/resolve.spec.ts` (add a new `describe` block)

**Interfaces:**
- Consumes: `PendingResponse` from `../domain/types` (already defined in Task 3).
- Produces: `resolve()` now also handles `RespondAction` and `PassAction`, and rejects any action whose `kind` is not in `state.pendingResponse.allowedActionKinds` while a response is pending.

- [ ] **Step 1: Write the failing test**

Append to `projects/engine/src/lib/pipeline/resolve.spec.ts`:

```ts
describe('resolve: Response Window pause and resume', () => {
  function registryWithShaAndShield(): ContentRegistry {
    const testShaLikeCard: CardDefinition = {
      id: 'test-sha-like-card',
      name: 'Test Sha-like Card',
      category: 'basic',
      play: (_state, ctx) => [
        {
          kind: 'OpenResponseEffect',
          pendingResponse: {
            id: 'resp-1',
            respondingSeatId: (ctx.targets[0] as { kind: 'seat'; seatId: string }).seatId,
            allowedActionKinds: ['RespondAction', 'PassAction'],
            context: {
              effect: {
                kind: 'DamageEffect',
                damage: {
                  source: { kind: 'seat', seatId: ctx.seatId },
                  target: ctx.targets[0],
                  amount: 3,
                  nature: 'normal',
                  cause: { cardInstanceId: ctx.cardInstanceId },
                },
              },
            },
          },
        },
      ],
    };
    const testShieldCard: CardDefinition = {
      id: 'test-shield-card',
      name: 'Test Shield Card',
      category: 'basic',
      play: () => [],
    };
    return {
      cards: new Map([
        ['test-sha-like-card', testShaLikeCard],
        ['test-shield-card', testShieldCard],
      ]),
      generals: new Map(),
    };
  }

  function stateWithShaInHandAndShieldForB(): GameState {
    let state = withTestCardInSeatAHand(baseState());
    state = {
      ...state,
      zones: state.zones.map((zone) =>
        zone.id === 'seat-a:hand'
          ? { ...zone, cards: [{ instanceId: 'sha-1', definitionId: 'test-sha-like-card', suit: 'spade' as const, rank: 7 }] }
          : zone.id === 'seat-b:hand'
          ? { ...zone, cards: [{ instanceId: 'shield-1', definitionId: 'test-shield-card', suit: 'club' as const, rank: 2 }] }
          : zone
      ),
    };
    return state;
  }

  it('opens a pending response and defers damage instead of applying it immediately', () => {
    const state = stateWithShaInHandAndShieldForB();
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(next.pendingResponse).toEqual({
      id: 'resp-1',
      respondingSeatId: 'seat-b',
      allowedActionKinds: ['RespondAction', 'PassAction'],
      context: { effect: expect.objectContaining({ kind: 'DamageEffect' }) },
    });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('PassAction resumes resolution and applies the deferred damage', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    const { state: next } = resolve(
      opened.state,
      { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'resp-1' },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(next.pendingResponse).toBeNull();
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(3);
  });

  it('RespondAction resumes resolution and the shield card prevents the damage', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    const { state: next } = resolve(
      opened.state,
      { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'resp-1', cardInstanceId: 'shield-1' },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(next.pendingResponse).toBeNull();
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('rejects an unrelated action while a response is pending', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(() =>
      resolve(opened.state, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry: registryWithShaAndShield(), mode: stubMode() })
    ).toThrow(/not legal while a response is pending/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest resolve.spec.ts`
Expected: FAIL — `OpenResponseEffect` is not a known `Effect` kind yet, and `RespondAction`/`PassAction` fall through to the `default` case.

- [ ] **Step 3: Add `OpenResponseEffect` to `effects.ts`**

```ts
import { PendingResponse } from '../domain/types';

export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage }
  | { kind: 'OpenResponseEffect'; pendingResponse: PendingResponse };

// inside applyEffect's switch, add:
case 'OpenResponseEffect':
  return { state: { ...state, pendingResponse: effect.pendingResponse }, events: [] };
```

- [ ] **Step 4: Add the pending-response guard and `RespondAction`/`PassAction` to `resolve.ts`**

At the top of the exported `resolve()` function body, before the `switch`:

```ts
export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  if (state.pendingResponse && !state.pendingResponse.allowedActionKinds.includes(action.kind)) {
    throw new Error(`Action ${action.kind} is not legal while a response is pending`);
  }
  switch (action.kind) {
    // ...existing cases...
```

Add two new cases to the same `switch`:

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest resolve.spec.ts`
Expected: PASS (10 tests total in this file).

- [ ] **Step 6: Commit**

```bash
git add projects/engine/src/lib/pipeline
git commit -m "feat(engine): add Response Window pause/resume via PendingResponse"
```

---

## Task 12: Targeting/legality module (engine)

A pure query module giving a seat's legal actions/targets in the current state — usable identically by a human UI (later), an AI bot, or the simulation harness. Also closes a gap from Task 11: a `RespondAction` can currently submit any card the responder holds; this task adds an optional `allowedCardIds` whitelist to `PendingResponse` and enforces it.

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (add `allowedCardIds?: string[]` to `PendingResponse`)
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (validate `allowedCardIds` in the `RespondAction` case)
- Create: `projects/engine/src/lib/rules/legality.ts`
- Test: `projects/engine/src/lib/rules/legality.spec.ts`

**Interfaces:**
- Consumes: `GameState`, `Target` from `../domain/types`; `Action` from `../pipeline/actions`.
- Produces: `getLegalTargets(state: GameState, seatId: string): Target[]`; `getLegalActions(state: GameState, seatId: string): Action[]`.

- [ ] **Step 1: Add `allowedCardIds` to `PendingResponse` and enforce it**

In `projects/engine/src/lib/domain/types.ts`, change:

```ts
export interface PendingResponse {
  id: string;
  respondingSeatId: string;
  allowedActionKinds: string[];
  allowedCardIds?: string[];
  context: { effect: unknown };
}
```

In `projects/engine/src/lib/pipeline/resolve.ts`'s `RespondAction` case, after finding `cardInHand`, add:

```ts
if (pending.allowedCardIds && !pending.allowedCardIds.includes(cardInHand.definitionId)) {
  throw new Error(`Card ${cardInHand.definitionId} is not a legal response here`);
}
```

- [ ] **Step 2: Write the failing test**

```ts
// projects/engine/src/lib/rules/legality.spec.ts
import { getLegalActions, getLegalTargets } from './legality';
import { GameState } from '../domain/types';
import { createRng } from '../rng/rng';

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 7, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
      {
        id: 'seat-c', index: 2, kingdom: 'Wu',
        generals: { main: { generalDefinitionId: 'g5', revealed: false }, deputy: { generalDefinitionId: 'g6', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-c:hand' }, equipped: { zoneId: 'seat-c:equip' }, eliminated: true,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [{ instanceId: 'c2', definitionId: 'shan', suit: 'club', rank: 2 }] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-c:hand', kind: 'hand', ownerSeatId: 'seat-c', cards: [] },
      { id: 'seat-c:equip', kind: 'equip', ownerSeatId: 'seat-c', cards: [] },
    ],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
    ...overrides,
  };
}

describe('getLegalTargets', () => {
  it('excludes the acting seat and eliminated seats', () => {
    expect(getLegalTargets(state(), 'seat-a')).toEqual([{ kind: 'seat', seatId: 'seat-b' }]);
  });
});

describe('getLegalActions', () => {
  it('returns no actions once the game has a result', () => {
    expect(getLegalActions(state({ result: { endedAt: 1, winningSeatIds: [], losingSeatIds: [] } }), 'seat-a')).toEqual([]);
  });

  it('during a pending response, only the responding seat gets Pass + whitelisted Respond actions', () => {
    const withPending = state({
      pendingResponse: {
        id: 'resp-1', respondingSeatId: 'seat-b',
        allowedActionKinds: ['RespondAction', 'PassAction'],
        allowedCardIds: ['shan'],
        context: { effect: null },
      },
    });
    expect(getLegalActions(withPending, 'seat-a')).toEqual([]);
    const actionsForB = getLegalActions(withPending, 'seat-b');
    expect(actionsForB).toContainEqual({ kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'resp-1' });
    expect(actionsForB).toContainEqual({
      kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'resp-1', cardInstanceId: 'c2',
    });
    expect(actionsForB).toHaveLength(2);
  });

  it('outside a pending response, only the active seat gets EndPhaseAction and PlayCardAction variants', () => {
    const actionsForA = getLegalActions(state(), 'seat-a');
    expect(actionsForA).toContainEqual({ kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(actionsForA).toContainEqual({ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [] });
    expect(actionsForA).toContainEqual({
      kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [{ kind: 'seat', seatId: 'seat-b' }],
    });
    expect(getLegalActions(state(), 'seat-b')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest legality.spec.ts`
Expected: FAIL with "Cannot find module './legality'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/engine/src/lib/rules/legality.ts
import { GameState, Target } from '../domain/types';
import { Action } from '../pipeline/actions';

export function getLegalTargets(state: GameState, seatId: string): Target[] {
  return state.seats
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => ({ kind: 'seat', seatId: s.id }));
}

export function getLegalActions(state: GameState, seatId: string): Action[] {
  if (state.result) return [];

  if (state.pendingResponse) {
    const pending = state.pendingResponse;
    if (pending.respondingSeatId !== seatId) return [];
    const actions: Action[] = [];
    if (pending.allowedActionKinds.includes('PassAction')) {
      actions.push({ kind: 'PassAction', seatId, pendingResponseId: pending.id });
    }
    if (pending.allowedActionKinds.includes('RespondAction')) {
      const seat = state.seats.find((s) => s.id === seatId);
      const handZone = seat && state.zones.find((z) => z.id === seat.hand.zoneId);
      for (const card of handZone?.cards ?? []) {
        if (!pending.allowedCardIds || pending.allowedCardIds.includes(card.definitionId)) {
          actions.push({
            kind: 'RespondAction',
            seatId,
            pendingResponseId: pending.id,
            cardInstanceId: card.instanceId,
          });
        }
      }
    }
    return actions;
  }

  if (state.turn.ownerSeatId !== seatId) return [];

  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) return [];
  const handZone = state.zones.find((z) => z.id === seat.hand.zoneId);
  const targets = getLegalTargets(state, seatId);
  const actions: Action[] = [{ kind: 'EndPhaseAction', seatId }];
  for (const card of handZone?.cards ?? []) {
    actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets: [] });
    for (const target of targets) {
      actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets: [target] });
    }
  }
  return actions;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest legality.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add projects/engine/src/lib/domain projects/engine/src/lib/pipeline projects/engine/src/lib/rules
git commit -m "feat(engine): add targeting/legality query module and PendingResponse card whitelist"
```

---

## Task 13: Phase sequence and turn advancement (engine)

The spec's `Phase` type was defined but not yet wired into `GameState`; this task adds it (as a top-level `GameState.phase` field, alongside `turn`) and implements `EndPhaseAction`.

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (add `phase: Phase` to `GameState`)
- Create: `projects/engine/src/lib/rules/phaseSequence.ts`
- Test: `projects/engine/src/lib/rules/phaseSequence.spec.ts`
- Modify: `projects/engine/src/lib/pipeline/events.ts` (add `PhaseChangedEvent`, `TurnAdvancedEvent`)
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (add `EndPhaseAction` handling)
- Test: `projects/engine/src/lib/pipeline/resolve.spec.ts` (add a new `describe` block)

**Interfaces:**
- Produces: `PHASE_ORDER: readonly Phase[]`, `advancePhaseOrTurn(state: GameState): { phase: Phase; turn: Turn }`.

- [ ] **Step 1: Add `phase` to `GameState`**

In `projects/engine/src/lib/domain/types.ts`, add `phase: Phase;` to the `GameState` interface (alongside `turn`). This makes `phase` a required field, so every earlier task's `GameState`-typed test fixture must be updated now or it will fail to compile — add `phase: 'Play',` (or `'Judgment'`, matching whatever phase the test's scenario implies) as a one-line addition to each of these functions:
- `domain/redact.spec.ts`'s `makeState()` (Task 4)
- `pipeline/resolve.spec.ts`'s `baseState()` (Tasks 8-9)
- `skills/triggers.spec.ts`'s `stateWithGenerals()` (Task 10)
- `rules/legality.spec.ts`'s `state()` (Task 12)

None of these earlier tests asserted on the absence of `phase`, so adding the field doesn't change any existing assertion — only run `npx jest --selectProjects engine` afterward to confirm every previously-passing suite (`redact.spec.ts`, `resolve.spec.ts`, `triggers.spec.ts`, `legality.spec.ts`, plus everything else in the project) still compiles and passes before continuing to Step 2.

- [ ] **Step 2: Write the failing test**

```ts
// projects/engine/src/lib/rules/phaseSequence.spec.ts
import { advancePhaseOrTurn, PHASE_ORDER } from './phaseSequence';
import { GameState, Seat } from '../domain/types';
import { createRng } from '../rng/rng';

function seat(id: string, index: number, eliminated = false): Seat {
  return {
    id, index, kingdom: 'Wei',
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated,
  };
}

function state(phase: GameState['phase'], turn: GameState['turn'], seats: Seat[]): GameState {
  return {
    seats, players: [], turn, phase, zones: [], pendingResponse: null, log: [], rng: createRng(1), result: null,
  };
}

describe('advancePhaseOrTurn', () => {
  it('cycles through phases in order without advancing the turn', () => {
    const turn = { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1)];
    let current = state('Judgment', turn, seats);
    for (let i = 1; i < PHASE_ORDER.length; i++) {
      const next = advancePhaseOrTurn(current);
      expect(next.phase).toBe(PHASE_ORDER[i]);
      expect(next.turn.turnNumber).toBe(1);
      current = { ...current, phase: next.phase, turn: next.turn };
    }
  });

  it('wraps to Judgment and advances to the next living seat clockwise after End', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: [] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1, true), seat('seat-c', 2)];
    const result = advancePhaseOrTurn(state('End', turn, seats));
    expect(result.phase).toBe('Judgment');
    expect(result.turn).toEqual({ turnNumber: 4, ownerSeatId: 'seat-c', extraTurnStack: [] });
  });

  it('gives priority to a queued extra turn over clockwise order', () => {
    const turn = { turnNumber: 3, ownerSeatId: 'seat-a', extraTurnStack: ['seat-c'] };
    const seats = [seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2)];
    const result = advancePhaseOrTurn(state('End', turn, seats));
    expect(result.turn).toEqual({ turnNumber: 4, ownerSeatId: 'seat-c', extraTurnStack: [] });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest phaseSequence.spec.ts`
Expected: FAIL with "Cannot find module './phaseSequence'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/engine/src/lib/rules/phaseSequence.ts
import { GameState, Phase, Seat, Turn } from '../domain/types';

export const PHASE_ORDER: readonly Phase[] = ['Judgment', 'Draw', 'Play', 'Discard', 'End'];

export function advancePhaseOrTurn(state: GameState): { phase: Phase; turn: Turn } {
  const currentIndex = PHASE_ORDER.indexOf(state.phase);
  if (currentIndex < PHASE_ORDER.length - 1) {
    return { phase: PHASE_ORDER[currentIndex + 1], turn: state.turn };
  }
  return { phase: PHASE_ORDER[0], turn: advanceTurn(state.turn, state.seats) };
}

function advanceTurn(turn: Turn, seats: Seat[]): Turn {
  if (turn.extraTurnStack.length > 0) {
    const nextSeatId = turn.extraTurnStack[turn.extraTurnStack.length - 1];
    return {
      turnNumber: turn.turnNumber + 1,
      ownerSeatId: nextSeatId,
      extraTurnStack: turn.extraTurnStack.slice(0, -1),
    };
  }
  const livingSeats = seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
  const currentIdx = livingSeats.findIndex((s) => s.id === turn.ownerSeatId);
  const nextSeat = livingSeats[(currentIdx + 1) % livingSeats.length];
  return { turnNumber: turn.turnNumber + 1, ownerSeatId: nextSeat.id, extraTurnStack: [] };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest phaseSequence.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire `EndPhaseAction` into `resolve()`**

Add `PhaseChangedEvent` and `TurnAdvancedEvent` to `projects/engine/src/lib/pipeline/events.ts`:

```ts
import { Phase } from '../domain/types';

export interface PhaseChangedEvent {
  kind: 'PhaseChangedEvent';
  seatId: string;
  phase: Phase;
}

export interface TurnAdvancedEvent {
  kind: 'TurnAdvancedEvent';
  seatId: string;
  turnNumber: number;
}

export type EngineEvent = CardsDrawnEvent | DamageDealtEvent | PhaseChangedEvent | TurnAdvancedEvent;
```

Add a case to `resolve()`'s switch in `projects/engine/src/lib/pipeline/resolve.ts`:

```ts
import { advancePhaseOrTurn } from '../rules/phaseSequence';

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
```

- [ ] **Step 7: Write and run the `resolve()` integration test**

Append to `resolve.spec.ts` (remember `baseState()` now needs `phase: 'Play'` per Step 1):

```ts
describe('resolve: EndPhaseAction', () => {
  it('advances the phase and logs a PhaseChangedEvent', () => {
    const state = { ...baseState(), phase: 'Play' as const };
    const { state: next, events } = resolve(
      state,
      { kind: 'EndPhaseAction', seatId: 'seat-a' },
      { registry: emptyRegistry(), mode: stubMode() }
    );
    expect(next.phase).toBe('Discard');
    expect(events).toEqual([{ kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'Discard' }]);
  });

  it('rejects EndPhaseAction from a seat that is not the current turn owner', () => {
    const state = { ...baseState(), phase: 'Play' as const };
    expect(() =>
      resolve(state, { kind: 'EndPhaseAction', seatId: 'seat-b' }, { registry: emptyRegistry(), mode: stubMode() })
    ).toThrow(/not seat seat-b's turn/);
  });
});
```

Run: `npx jest phaseSequence.spec.ts resolve.spec.ts`
Expected: PASS (3 tests in `phaseSequence.spec.ts`, 12 tests in `resolve.spec.ts`).

- [ ] **Step 8: Commit**

```bash
git add projects/engine/src/lib/domain projects/engine/src/lib/rules projects/engine/src/lib/pipeline
git commit -m "feat(engine): add phase sequencing, turn advancement, and EndPhaseAction"
```

---

## Task 14: RevealGeneralAction, generic win-condition wiring, and game setup (engine)

Closes out the generic engine: `RevealGeneralAction`/`RevealGeneralEffect` (also exercises the "an `after:<EventType>` trigger returns a follow-up `Action`" path left untested in Task 10 — Task 18's forced-reveal trigger will use exactly this), a `createGame()` entry point that delegates to a `GameModeDefinition`'s `setup()`, and generic win-condition checking wrapped around every `resolve()` call.

**Files:**
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (add `RevealGeneralEffect`)
- Modify: `projects/engine/src/lib/pipeline/events.ts` (add `GeneralRevealedEvent`)
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (add `RevealGeneralAction`; wrap with win-check; rename internal dispatch)
- Create: `projects/engine/src/lib/setup/gameSetup.ts`
- Test: `projects/engine/src/lib/setup/gameSetup.spec.ts`
- Test: `projects/engine/src/lib/pipeline/winCondition.spec.ts`

**Interfaces:**
- Produces: `createGame(mode: GameModeDefinition, registry: ContentRegistry, seatIds: string[], rngSeed: number): GameState`. `resolve()` now throws if `state.result` is already set, and attaches `state.result` automatically once `ctx.mode.checkWinCondition(state)` returns non-null.

- [ ] **Step 1: Add `RevealGeneralEffect`/`GeneralRevealedEvent`**

In `projects/engine/src/lib/pipeline/events.ts`:

```ts
export interface GeneralRevealedEvent {
  kind: 'GeneralRevealedEvent';
  seatId: string;
  slot: 'main' | 'deputy';
}

export type EngineEvent = CardsDrawnEvent | DamageDealtEvent | PhaseChangedEvent | TurnAdvancedEvent | GeneralRevealedEvent;
```

In `projects/engine/src/lib/pipeline/effects.ts`:

```ts
export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage }
  | { kind: 'OpenResponseEffect'; pendingResponse: PendingResponse }
  | { kind: 'RevealGeneralEffect'; seatId: string; slot: 'main' | 'deputy' };

// inside applyEffect's switch, add:
case 'RevealGeneralEffect': {
  const seat = state.seats.find((s) => s.id === effect.seatId);
  if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
  if (seat.generals[effect.slot].revealed) {
    return { state, events: [] };
  }
  const seats = state.seats.map((s) =>
    s.id === effect.seatId
      ? { ...s, generals: { ...s.generals, [effect.slot]: { ...s.generals[effect.slot], revealed: true } } }
      : s
  );
  const event: EngineEvent = { kind: 'GeneralRevealedEvent', seatId: effect.seatId, slot: effect.slot };
  return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
}
```

- [ ] **Step 2: Replace the entire contents of `resolve.ts`**

This consolidates every incremental change from Tasks 8-13, adds `RevealGeneralAction`, and wraps dispatch with win-condition checking (splitting the old single `resolve()` into a public `resolve()` that checks `state.result`/win-condition, and an internal `resolveAction()` that does the actual dispatch — internal follow-ups from `resolveEffectWithTriggers` now call `resolveAction()` directly rather than re-entering the public win-check wrapper on every recursive step):

```ts
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
  if (state.result) {
    throw new Error('Cannot submit an action after the game has ended');
  }
  const result = resolveAction(state, action, ctx);
  const gameResult = ctx.mode.checkWinCondition(result.state);
  const finalState = gameResult ? { ...result.state, result: gameResult } : result.state;
  return { state: finalState, events: result.events };
}

function resolveAction(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
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

    case 'RevealGeneralAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      return resolveEffectWithTriggers(
        state,
        { kind: 'RevealGeneralEffect', seatId: action.seatId, slot: action.slot },
        ctx
      );
    }

    default:
      throw new Error(`Action kind not yet handled by resolve(): ${(action as Action).kind}`);
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
          const result = resolveAction(currentState, followUp, ctx);
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
```

Run: `npx jest resolve.spec.ts triggers.spec.ts phaseSequence.spec.ts` and confirm every existing test in these files still PASSes (this step is a pure refactor plus one additive case — no existing assertions should change).

- [ ] **Step 3: Write `createGame()` and its failing test**

```ts
// projects/engine/src/lib/setup/gameSetup.spec.ts
import { createGame } from './gameSetup';
import { GameModeDefinition } from '../registry/types';
import { GameState } from '../domain/types';

function stubSetupMode(): GameModeDefinition {
  return {
    id: 'stub-setup',
    setup: (seatIds, _registry, rng) => {
      const state: GameState = {
        seats: seatIds.map((id, index) => ({
          id, index, kingdom: 'Wei',
          generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
          combinedHp: 5, maxCombinedHp: 5,
          hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
        })),
        players: seatIds.map((id) => ({ id: `player-${id}`, seatId: id, kind: 'bot' as const })),
        turn: { turnNumber: 1, ownerSeatId: seatIds[0], extraTurnStack: [] },
        phase: 'Judgment',
        zones: [],
        pendingResponse: null,
        log: [],
        rng,
        result: null,
      };
      return { state, rng };
    },
    checkWinCondition: () => null,
    triggers: [],
  };
}

describe('createGame', () => {
  it('delegates to the mode definition\'s setup with the given seat ids and a seeded RNG', () => {
    const state = createGame(stubSetupMode(), { cards: new Map(), generals: new Map() }, ['seat-a', 'seat-b'], 99);
    expect(state.seats.map((s) => s.id)).toEqual(['seat-a', 'seat-b']);
    expect(state.turn.ownerSeatId).toBe('seat-a');
  });
});
```

Run: `npx jest gameSetup.spec.ts`
Expected: FAIL with "Cannot find module './gameSetup'".

```ts
// projects/engine/src/lib/setup/gameSetup.ts
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { createRng } from '../rng/rng';

export function createGame(
  mode: GameModeDefinition,
  registry: ContentRegistry,
  seatIds: string[],
  rngSeed: number
): GameState {
  const { state } = mode.setup(seatIds, registry, createRng(rngSeed));
  return state;
}
```

Run: `npx jest gameSetup.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 4: Write the failing win-condition test**

```ts
// projects/engine/src/lib/pipeline/winCondition.spec.ts
import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition, CardDefinition } from '../registry/types';

function lastSeatStandingMode(): GameModeDefinition {
  return {
    id: 'last-seat-standing',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition: (state) => {
      const alive = state.seats.filter((s) => s.combinedHp > 0);
      if (alive.length !== 1) return null;
      return {
        endedAt: state.turn.turnNumber,
        winningSeatIds: [alive[0].id],
        losingSeatIds: state.seats.filter((s) => s.combinedHp <= 0).map((s) => s.id),
      };
    },
    triggers: [],
  };
}

function twoSeatState(): GameState {
  const testDamageCard: CardDefinition = {
    id: 'test-lethal-card', name: 'Test Lethal Card', category: 'basic',
    play: (_state, ctx) => [{
      kind: 'DamageEffect',
      damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 10, nature: 'normal' },
    }],
  };
  const registry: ContentRegistry = { cards: new Map([['test-lethal-card', testDamageCard]]), generals: new Map() };
  const state: GameState = {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 7, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'c1', definitionId: 'test-lethal-card', suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null,
  };
  return { state, registry };
}

describe('resolve: generic win-condition wiring', () => {
  it('attaches a GameResult once checkWinCondition finds a winner', () => {
    const { state, registry } = twoSeatState();
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry, mode: lastSeatStandingMode() }
    );
    expect(next.result).toEqual({ endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] });
  });

  it('rejects any further action once the game has a result', () => {
    const { state, registry } = twoSeatState();
    const { state: ended } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry, mode: lastSeatStandingMode() }
    );
    expect(() =>
      resolve(ended, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry, mode: lastSeatStandingMode() })
    ).toThrow(/game has ended/);
  });
});
```

Note this test needs `twoSeatState()` to return `{ state, registry }`, not just `GameState` — adjust the function signature accordingly (shown above).

Run: `npx jest winCondition.spec.ts`
Expected: since Step 2 already implements the win-check wrapper, this should PASS immediately. If it doesn't, re-check Step 2 was applied exactly as written.

- [ ] **Step 5: Run the full engine test suite**

Run: `npx jest --selectProjects engine`
Expected: PASS, all suites green.

- [ ] **Step 6: Commit**

```bash
git add projects/engine/src/lib
git commit -m "feat(engine): add RevealGeneralAction, game setup, and generic win-condition wiring"
```

The generic engine is now feature-complete per the spec. The remaining engine work in Tasks 15-16 is two small additive primitives (`HealEffect`, `MoveCardEffect`) that content needs but the engine hadn't yet defined — everything else from here on is `content` and `sim`.

---

## Task 15: Heal/MoveCard engine primitives, and basic cards Sha/Shan/Peach (content)

**Rule text (written before implementation, per CLAUDE.md):**
- **Sha (杀):** Play, targeting one other living seat (this milestone targets any living seat — Sanguosha's distance/range restriction on Sha is not enforced here, a deliberate simplification). Opens a response window: the target may respond with Shan to prevent the damage, or Pass. If not answered with Shan, Sha deals 1 point of normal damage to the target.
- **Shan (闪):** Playable only as a response to a pending Sha (or Sha-shaped) response window; playing it prevents that window's deferred damage entirely. Has no effect if played any other way (the engine's legality module only ever offers it as a `RespondAction`, so this is never exercised).
- **Peach (桃):** Play, no target. Heals the playing seat's `combinedHp` by 1, up to `maxCombinedHp`.

**Files:**
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (add `HealEffect`, `MoveCardEffect`)
- Modify: `projects/engine/src/lib/pipeline/events.ts` (add `HealEvent`, `CardMovedEvent`)
- Test: `projects/engine/src/lib/pipeline/resolve.spec.ts` (add a small `describe` block covering both new effects directly, since Peach's own test below only exercises `HealEffect` indirectly)
- Create: `projects/content/src/lib/cards/sha.ts`, `shan.ts`, `peach.ts`
- Test: `projects/content/src/lib/cards/cards.spec.ts`

**Interfaces:**
- Produces (engine): `Effect` gains `{ kind: 'HealEffect'; target: Target; amount: number }` and `{ kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string }`.
- Produces (content): `shaCard: CardDefinition`, `shanCard: CardDefinition`, `peachCard: CardDefinition`.

- [ ] **Step 1: Write the failing engine test for the two new effects**

Append to `projects/engine/src/lib/pipeline/resolve.spec.ts` (this exercises `applyEffect` through the pipeline the same way every other effect in this file has been tested):

```ts
describe('resolve: Heal and MoveCard effects', () => {
  const healPlayCard: CardDefinition = {
    id: 'test-heal-card', name: 'Test Heal Card', category: 'basic',
    play: (_state, ctx) => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: ctx.seatId }, amount: 3 }],
  };
  const moveCard: CardDefinition = {
    id: 'test-move-card', name: 'Test Move Card', category: 'equipment',
    play: (_state, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: `${ctx.seatId}:equip` }],
  };
  function registry(): ContentRegistry {
    return { cards: new Map([['test-heal-card', healPlayCard], ['test-move-card', moveCard]]), generals: new Map() };
  }

  it('HealEffect increases combinedHp but never above maxCombinedHp', () => {
    let state = withTestCardInSeatAHand(baseState());
    state = {
      ...state,
      seats: state.seats.map((s) => (s.id === 'seat-a' ? { ...s, combinedHp: 5 } : s)), // maxCombinedHp is 7
      zones: state.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'heal-1', definitionId: 'test-heal-card', suit: 'spade' as const, rank: 1 }] } : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'heal-1', targets: [] },
      { registry: registry(), mode: stubMode() }
    );
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(7); // capped at max, not 8
  });

  it('MoveCardEffect relocates the played card into the given zone', () => {
    let state = withTestCardInSeatAHand(baseState());
    state = {
      ...state,
      zones: state.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'move-1', definitionId: 'test-move-card', suit: 'club' as const, rank: 1 }] } : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'move-1', targets: [] },
      { registry: registry(), mode: stubMode() }
    );
    const equip = next.zones.find((z) => z.id === 'seat-a:equip')!;
    expect(equip.cards.map((c) => c.instanceId)).toEqual(['move-1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest resolve.spec.ts`
Expected: FAIL — neither `HealEffect` nor `MoveCardEffect` is a known `Effect` kind yet.

- [ ] **Step 3: Add the two effects to the engine**

In `projects/engine/src/lib/pipeline/events.ts`:

```ts
import { Target } from '../domain/types';

export interface HealEvent {
  kind: 'HealEvent';
  target: Target;
  amount: number;
}

export interface CardMovedEvent {
  kind: 'CardMovedEvent';
  cardInstanceId: string;
  toZoneId: string;
}

export type EngineEvent =
  | CardsDrawnEvent
  | DamageDealtEvent
  | PhaseChangedEvent
  | TurnAdvancedEvent
  | GeneralRevealedEvent
  | HealEvent
  | CardMovedEvent;
```

In `projects/engine/src/lib/pipeline/effects.ts`:

```ts
import { moveCard } from '../cards/zones';

export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage }
  | { kind: 'OpenResponseEffect'; pendingResponse: PendingResponse }
  | { kind: 'RevealGeneralEffect'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'HealEffect'; target: Target; amount: number }
  | { kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string };

// inside applyEffect's switch, add:
case 'HealEffect': {
  if (effect.target.kind !== 'seat') throw new Error('HealEffect currently only supports seat targets');
  const seat = state.seats.find((s) => s.id === effect.target.seatId);
  if (!seat) throw new Error(`Unknown seat: ${effect.target.seatId}`);
  const combinedHp = Math.min(seat.maxCombinedHp, seat.combinedHp + effect.amount);
  const seats = state.seats.map((s) => (s.id === effect.target.seatId ? { ...s, combinedHp } : s));
  const event: EngineEvent = { kind: 'HealEvent', target: effect.target, amount: effect.amount };
  return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
}
case 'MoveCardEffect': {
  const zones = moveCard(state.zones, effect.cardInstanceId, effect.toZoneId);
  const event: EngineEvent = { kind: 'CardMovedEvent', cardInstanceId: effect.cardInstanceId, toZoneId: effect.toZoneId };
  return { state: { ...state, zones, log: [...state.log, event] }, events: [event] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest resolve.spec.ts`
Expected: PASS (all suites in this file green).

- [ ] **Step 5: Commit the engine addition**

```bash
git add projects/engine/src/lib/pipeline
git commit -m "feat(engine): add HealEffect and MoveCardEffect primitives"
```

- [ ] **Step 5b: Populate `engine`'s public API**

This is the first task where `content` imports from the `engine` package (rather than engine-internal files importing each other by relative path), so `projects/engine/src/public-api.ts` needs to actually export what `content` will use. Replace its contents with:

```ts
// projects/engine/src/public-api.ts
export * from './lib/rng/rng';
export * from './lib/domain/types';
export * from './lib/domain/factories';
export * from './lib/domain/redact';
export * from './lib/cards/zones';
export * from './lib/cards/deck';
export * from './lib/registry/types';
export * from './lib/registry/lookup';
export * from './lib/pipeline/actions';
export * from './lib/pipeline/effects';
export * from './lib/pipeline/events';
export * from './lib/pipeline/resolve';
export * from './lib/skills/triggers';
export * from './lib/rules/legality';
export * from './lib/rules/phaseSequence';
export * from './lib/setup/gameSetup';
```

Run `npx jest --selectProjects engine` once more to confirm this export-surface change doesn't break anything (it shouldn't — internal files still import each other by relative path).

- [ ] **Step 6: Write the failing content test for Sha/Shan/Peach**

```ts
// projects/content/src/lib/cards/cards.spec.ts
import { shaCard } from './sha';
import { shanCard } from './shan';
import { peachCard } from './peach';
import { resolve } from 'engine';
import type { GameState, ContentRegistry } from 'engine';

function registry(): ContentRegistry {
  return {
    cards: new Map([[shaCard.id, shaCard], [shanCard.id, shanCard], [peachCard.id, peachCard]]),
    generals: new Map(),
  };
}

function twoSeatState(): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 6, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 1 }, { instanceId: 'peach-1', definitionId: 'peach', suit: 'heart', rank: 5 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [{ instanceId: 'shan-1', definitionId: 'shan', suit: 'club', rank: 2 }] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
  };
}

function stubMode() {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as any, checkWinCondition: () => null, triggers: [] };
}

describe('Sha/Shan/Peach', () => {
  it('Sha deals 1 damage when the target has no Shan to respond with', () => {
    let state = twoSeatState();
    state = { ...state, zones: state.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [] } : z)) };
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'sha-response-sha-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(5);
  });

  it('Shan prevents Sha\'s damage when played in response', () => {
    const state = twoSeatState();
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'sha-response-sha-1', cardInstanceId: 'shan-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('Peach heals the playing seat up to maxCombinedHp', () => {
    const state = twoSeatState();
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'peach-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(7);
  });

  it('Sha played with no target is a no-op rather than throwing (guards the legality module\'s untargeted variant)', () => {
    const state = twoSeatState();
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
    expect(next.pendingResponse).toBeNull();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx jest cards.spec.ts`
Expected: FAIL with "Cannot find module './sha'" (etc).

- [ ] **Step 8: Write minimal implementations**

```ts
// projects/content/src/lib/cards/sha.ts
import type { CardDefinition } from 'engine';

export const shaCard: CardDefinition = {
  id: 'sha',
  name: 'Sha',
  category: 'basic',
  play: (_state, ctx) => {
    if (ctx.respondingTo) {
      return []; // played as the counter-card in a Duel response window (Task 16) — cancels the pending damage
    }
    if (ctx.targets.length === 0) {
      return []; // no target chosen (e.g. the legality module's untargeted variant) — a no-op rather than a crash
    }
    const target = ctx.targets[0];
    return [
      {
        kind: 'OpenResponseEffect',
        pendingResponse: {
          id: `sha-response-${ctx.cardInstanceId}`,
          respondingSeatId: (target as { kind: 'seat'; seatId: string }).seatId,
          allowedActionKinds: ['RespondAction', 'PassAction'],
          allowedCardIds: ['shan'],
          context: {
            effect: {
              kind: 'DamageEffect',
              damage: {
                source: { kind: 'seat', seatId: ctx.seatId },
                target,
                amount: 1,
                nature: 'normal',
                cause: { cardInstanceId: ctx.cardInstanceId },
              },
            },
          },
        },
      },
    ];
  },
};
```

```ts
// projects/content/src/lib/cards/shan.ts
import type { CardDefinition } from 'engine';

export const shanCard: CardDefinition = {
  id: 'shan',
  name: 'Shan',
  category: 'basic',
  play: () => [],
};
```

```ts
// projects/content/src/lib/cards/peach.ts
import type { CardDefinition } from 'engine';

export const peachCard: CardDefinition = {
  id: 'peach',
  name: 'Peach',
  category: 'basic',
  play: (_state, ctx) => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: ctx.seatId }, amount: 1 }],
};
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx jest cards.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add projects/content/src/lib/cards
git commit -m "feat(content): add Sha, Shan, and Peach cards"
```

---

## Task 16: Trick cards Duel/Wuxie Kongjie and two equipment cards (content)

**Rule text (written before implementation):**
- **Duel (决斗)** — simplified for this milestone: play, targeting one other living seat. Opens a response window where the target may respond with Sha to cancel Duel's damage entirely, or Pass and take 2 points of normal damage from the source. *(Simplification: the official rule has both sides alternate playing Sha until one side stops, with the loser taking damage — a straightforward content-only extension of this same `PendingResponse` mechanism, deferred here to keep this task bite-sized; no engine change would be needed to add it later.)*
- **Wuxie Kongjie (无懈可击 / Nullify)** — simplified for this milestone: playable only by the seat Duel is currently targeting (added to Duel's response whitelist alongside Sha); cancels Duel's damage the same way Sha's counter does. *(Simplification: the official rule lets any seat nullify a trick card, not only its target — supporting that needs `PendingResponse.respondingSeatId` broadened from one seat to a set of eligible seats, a natural but out-of-scope engine extension here.)*
- **Equipment (this milestone):** two equipment cards, "Silver Lion" (armor) and "Green Dragon Blade" (weapon). Playing either only moves the card into the playing seat's equip zone via `MoveCardEffect` — neither grants a passive ability yet. *(Simplification: a passive equipment ability needs `gatherTriggeredSkills` to also scan a seat's equipped cards, not only its generals — the same trigger-point mechanism already supports it, deferred here.)*

**Files:**
- Create: `projects/content/src/lib/cards/duel.ts`, `wuxie.ts`, `equipment.ts`
- Test: `projects/content/src/lib/cards/tricks.spec.ts`

**Interfaces:**
- Produces: `duelCard: CardDefinition`, `wuxieCard: CardDefinition`, `silverLionCard: CardDefinition`, `greenDragonBladeCard: CardDefinition`.

- [ ] **Step 1: Write the failing test**

```ts
// projects/content/src/lib/cards/tricks.spec.ts
import { duelCard } from './duel';
import { wuxieCard } from './wuxie';
import { silverLionCard, greenDragonBladeCard } from './equipment';
import { resolve } from 'engine';
import type { GameState, ContentRegistry, GameModeDefinition } from 'engine';

function registry(): ContentRegistry {
  return {
    cards: new Map([
      [duelCard.id, duelCard],
      [wuxieCard.id, wuxieCard],
      [silverLionCard.id, silverLionCard],
      [greenDragonBladeCard.id, greenDragonBladeCard],
      // a fixture 'sha' stand-in so Duel's allowedCardIds check has something to accept:
      ['sha', { id: 'sha', name: 'Sha', category: 'basic', play: () => [] }],
    ]),
    generals: new Map(),
  };
}

function stubMode(): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
}

function twoSeatState(seatAHandCardId: string): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 7, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'card-1', definitionId: seatAHandCardId, suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
  };
}

function withSeatBHand(state: GameState, cardId: string, instanceId: string): GameState {
  return {
    ...state,
    zones: state.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [{ instanceId, definitionId: cardId, suit: 'club' as const, rank: 3 }] } : z)),
  };
}

describe('Duel and Wuxie Kongjie', () => {
  it('deals 2 damage to the target if they Pass', () => {
    const state = twoSeatState('duel');
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'duel-response-card-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(4);
  });

  it('is cancelled if the target responds with Sha', () => {
    let state = twoSeatState('duel');
    state = withSeatBHand(state, 'sha', 'sha-1');
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'duel-response-card-1', cardInstanceId: 'sha-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('is cancelled if the target responds with Wuxie Kongjie', () => {
    let state = twoSeatState('duel');
    state = withSeatBHand(state, 'wuxie', 'wuxie-1');
    const opened = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    const { state: next } = resolve(opened.state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'duel-response-card-1', cardInstanceId: 'wuxie-1' }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('played with no target is a no-op rather than throwing', () => {
    const state = twoSeatState('duel');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
    expect(next.pendingResponse).toBeNull();
  });
});

describe('Equipment', () => {
  it('Silver Lion moves from hand to the equip zone when played', () => {
    const state = twoSeatState('silver-lion');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.zones.find((z) => z.id === 'seat-a:hand')!.cards).toHaveLength(0);
    expect(next.zones.find((z) => z.id === 'seat-a:equip')!.cards.map((c) => c.instanceId)).toEqual(['card-1']);
  });

  it('Green Dragon Blade moves from hand to the equip zone when played', () => {
    const state = twoSeatState('green-dragon-blade');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.zones.find((z) => z.id === 'seat-a:equip')!.cards.map((c) => c.instanceId)).toEqual(['card-1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tricks.spec.ts`
Expected: FAIL with "Cannot find module './duel'" (etc).

- [ ] **Step 3: Write minimal implementations**

```ts
// projects/content/src/lib/cards/duel.ts
import type { CardDefinition } from 'engine';

export const duelCard: CardDefinition = {
  id: 'duel',
  name: 'Duel',
  category: 'trick',
  play: (_state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    const target = ctx.targets[0];
    return [
      {
        kind: 'OpenResponseEffect',
        pendingResponse: {
          id: `duel-response-${ctx.cardInstanceId}`,
          respondingSeatId: (target as { kind: 'seat'; seatId: string }).seatId,
          allowedActionKinds: ['RespondAction', 'PassAction'],
          allowedCardIds: ['sha', 'wuxie'],
          context: {
            effect: {
              kind: 'DamageEffect',
              damage: {
                source: { kind: 'seat', seatId: ctx.seatId },
                target,
                amount: 2,
                nature: 'normal',
                cause: { cardInstanceId: ctx.cardInstanceId },
              },
            },
          },
        },
      },
    ];
  },
};
```

```ts
// projects/content/src/lib/cards/wuxie.ts
import type { CardDefinition } from 'engine';

export const wuxieCard: CardDefinition = {
  id: 'wuxie',
  name: 'Wuxie Kongjie',
  category: 'trick',
  play: () => [],
};
```

Both equipment cards share identical "move myself into the equip zone" behavior, differing only in id/name — exactly the "card variants via composition" case the spec's Extensibility section calls out, so both are built from one shared factory rather than duplicating the `play()` body:

```ts
// projects/content/src/lib/cards/equipment.ts
import type { CardDefinition } from 'engine';

function makeEquipmentCard(id: string, name: string): CardDefinition {
  return {
    id,
    name,
    category: 'equipment',
    play: (_state, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: `${ctx.seatId}:equip` }],
  };
}

export const silverLionCard = makeEquipmentCard('silver-lion', 'Silver Lion');
export const greenDragonBladeCard = makeEquipmentCard('green-dragon-blade', 'Green Dragon Blade');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tricks.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/content/src/lib/cards
git commit -m "feat(content): add Duel, Wuxie Kongjie, and two equipment cards"
```

---

## Task 17: Generals set 1 — on-play damage modifier, lifesteal, draw trigger (content)

**Rule text (written before implementation):**
- **Xiahou Dun (Wei) — "Ferocity":** Whenever this seat deals damage caused by a card, increase that instance of damage by 1. *(Simplified: no once-per-turn limit; applies to any card-caused damage from this seat rather than only Sha, since `Damage.cause` only carries a card instance id, not its category — distinguishing "was this a Sha" would need `Damage.cause` extended with the card's definition id, deferred here.)*
- **Sun Shangxiang (Wu) — "Valor":** Whenever this seat deals damage to another seat, this seat heals 1 `combinedHp` afterward. *(Simplified: applies to any damage this seat deals, not only a killing blow.)*
- **Zhuge Liang (Shu) — "Insight":** After this seat's turn enters the Draw phase, this seat draws 1 additional card (on top of whatever draw-phase behavior the active `GameModeDefinition` itself provides).

A shared helper, `findSeatIdForGeneral`, looks up which seat currently holds a given general (as main or deputy) — every skill below needs to know "is the damage/event about *my* seat," and a general definition has no seat reference of its own.

**Files:**
- Create: `projects/content/src/lib/shared/queries.ts`
- Create: `projects/content/src/lib/generals/setOne.ts`
- Test: `projects/content/src/lib/generals/setOne.spec.ts`

**Interfaces:**
- Produces: `findSeatIdForGeneral(state: GameState, generalDefinitionId: string): string | undefined`; `xiahouDunGeneral`, `sunShangxiangGeneral`, `zhugeLiangGeneral: GeneralDefinition`.

- [ ] **Step 1: Write `findSeatIdForGeneral`** (no standalone test — exercised by every general test below)

```ts
// projects/content/src/lib/shared/queries.ts
import type { GameState } from 'engine';

export function findSeatIdForGeneral(state: GameState, generalDefinitionId: string): string | undefined {
  const seat = state.seats.find(
    (s) =>
      s.generals.main.generalDefinitionId === generalDefinitionId ||
      s.generals.deputy.generalDefinitionId === generalDefinitionId
  );
  return seat?.id;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// projects/content/src/lib/generals/setOne.spec.ts
import { xiahouDunGeneral, sunShangxiangGeneral, zhugeLiangGeneral } from './setOne';
import { resolve } from 'engine';
import type { GameState, ContentRegistry, GameModeDefinition, CardDefinition } from 'engine';

const testDamageCard: CardDefinition = {
  id: 'test-damage-card',
  name: 'Test Damage Card',
  category: 'basic',
  play: (_state, ctx) => [
    {
      kind: 'DamageEffect',
      damage: {
        source: { kind: 'seat', seatId: ctx.seatId },
        target: ctx.targets[0],
        amount: 2,
        nature: 'normal',
        cause: { cardInstanceId: ctx.cardInstanceId },
      },
    },
  ],
};

function registry(): ContentRegistry {
  return {
    cards: new Map([['test-damage-card', testDamageCard]]),
    generals: new Map([
      ['xiahou-dun', xiahouDunGeneral],
      ['sun-shangxiang', sunShangxiangGeneral],
      ['zhuge-liang', zhugeLiangGeneral],
    ]),
  };
}

function stubMode(): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
}

function stateWithMainGeneral(generalId: string, seatACombinedHp = 5): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: generalId, revealed: false }, deputy: { generalDefinitionId: 'filler', revealed: false } },
        combinedHp: seatACombinedHp, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'filler2', revealed: false }, deputy: { generalDefinitionId: 'filler3', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Judgment',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [{ instanceId: 'draw-1', definitionId: 'sha', suit: 'spade', rank: 1 }] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'card-1', definitionId: 'test-damage-card', suit: 'heart', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
  };
}

describe('Xiahou Dun — Ferocity', () => {
  it('adds 1 to damage this seat deals with a card', () => {
    const state = stateWithMainGeneral('xiahou-dun');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(3); // 6 - (2+1)
  });
});

describe('Sun Shangxiang — Valor', () => {
  it('heals this seat 1 after it deals damage', () => {
    const state = stateWithMainGeneral('sun-shangxiang', 5);
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(6); // 5 + 1
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(4); // 6 - 2
  });
});

describe('Zhuge Liang — Insight', () => {
  it('draws 1 extra card when this seat enters the Draw phase', () => {
    const state = stateWithMainGeneral('zhuge-liang');
    const { state: next } = resolve(state, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry: registry(), mode: stubMode() });
    expect(next.phase).toBe('Draw');
    const hand = next.zones.find((z) => z.id === 'seat-a:hand')!;
    expect(hand.cards.map((c) => c.instanceId)).toContain('draw-1');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest setOne.spec.ts`
Expected: FAIL with "Cannot find module './setOne'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/content/src/lib/generals/setOne.ts
import type { GeneralDefinition, Effect } from 'engine';
import type { DamageDealtEvent, PhaseChangedEvent } from 'engine';
import { findSeatIdForGeneral } from '../shared/queries';

export const xiahouDunGeneral: GeneralDefinition = {
  id: 'xiahou-dun',
  kingdom: 'Wei',
  maxHp: 4,
  skills: [
    {
      id: 'ferocity',
      activation: 'auto',
      triggers: [
        {
          point: 'before:DamageEffect',
          condition: (state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            const seatId = findSeatIdForGeneral(state, 'xiahou-dun');
            return (
              !!seatId &&
              effect.damage.source?.kind === 'seat' &&
              effect.damage.source.seatId === seatId &&
              !!effect.damage.cause?.cardInstanceId
            );
          },
          effect: (_state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            return [{ ...effect, damage: { ...effect.damage, amount: effect.damage.amount + 1 } }];
          },
        },
      ],
    },
  ],
};

export const sunShangxiangGeneral: GeneralDefinition = {
  id: 'sun-shangxiang',
  kingdom: 'Wu',
  maxHp: 3,
  skills: [
    {
      id: 'valor',
      activation: 'auto',
      triggers: [
        {
          point: 'after:DamageDealtEvent',
          condition: (state, subject) => {
            const event = subject as DamageDealtEvent;
            const seatId = findSeatIdForGeneral(state, 'sun-shangxiang');
            return !!seatId && event.damage.source?.kind === 'seat' && event.damage.source.seatId === seatId;
          },
          effect: (state) => {
            const seatId = findSeatIdForGeneral(state, 'sun-shangxiang')!;
            return [{ kind: 'HealEffect', target: { kind: 'seat', seatId }, amount: 1 }];
          },
        },
      ],
    },
  ],
};

export const zhugeLiangGeneral: GeneralDefinition = {
  id: 'zhuge-liang',
  kingdom: 'Shu',
  maxHp: 3,
  skills: [
    {
      id: 'insight',
      activation: 'auto',
      triggers: [
        {
          point: 'after:PhaseChangedEvent',
          condition: (state, subject) => {
            const event = subject as PhaseChangedEvent;
            const seatId = findSeatIdForGeneral(state, 'zhuge-liang');
            return event.phase === 'Draw' && event.seatId === seatId;
          },
          effect: (_state, subject) => {
            const event = subject as PhaseChangedEvent;
            return [{ kind: 'DrawCardsEffect', seatId: event.seatId, count: 1 }];
          },
        },
      ],
    },
  ],
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest setOne.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add projects/content/src/lib/shared projects/content/src/lib/generals
git commit -m "feat(content): add Xiahou Dun, Sun Shangxiang, and Zhuge Liang generals"
```

---

## Task 18: Generals set 2 — forced/negative, distance modifier, vanilla — and registry assembly (content)

**Rule text (written before implementation):**
- **Dong Zhuo (Qun) — "Tyranny":** Whenever this seat would be healed, reduce that healing by 1 (minimum 0). Forced and always active — a debuff, not a choice.
- **Zhao Yun (Wei) — "Vanguard":** Whenever this seat takes damage from a source seat at circular seat-distance 2 or more, reduce that damage by 1 (minimum 0 — reduced-to-0 damage still applies as a zero-amount hit, it is not cancelled outright). Distance is computed among currently-living seats ordered by seat index.
- **Huang Yueying (Shu):** no skills — a "vanilla" general, included to round out this pack's kingdom distribution (Wei: 2, Shu: 2, Wu: 1, Qun: 1 — six generals total, matching the spec's "one or two per kingdom").

A shared `getSeatDistance` helper computes circular seat distance, needed by Zhao Yun's skill.

**Files:**
- Modify: `projects/content/src/lib/shared/queries.ts` (add `getSeatDistance`)
- Create: `projects/content/src/lib/generals/setTwo.ts`
- Test: `projects/content/src/lib/generals/setTwo.spec.ts`
- Create: `projects/content/src/lib/registry.ts`
- Test: `projects/content/src/lib/registry.spec.ts`

**Interfaces:**
- Produces: `getSeatDistance(state: GameState, fromSeatId: string, toSeatId: string): number`; `dongZhuoGeneral`, `zhaoYunGeneral`, `huangYueyingGeneral: GeneralDefinition`; `buildContentRegistry(): ContentRegistry`.

- [ ] **Step 1: Add `getSeatDistance`**

Append to `projects/content/src/lib/shared/queries.ts`:

```ts
export function getSeatDistance(state: GameState, fromSeatId: string, toSeatId: string): number {
  const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
  const fromIdx = living.findIndex((s) => s.id === fromSeatId);
  const toIdx = living.findIndex((s) => s.id === toSeatId);
  if (fromIdx === -1 || toIdx === -1) {
    throw new Error('Seat not found among living seats');
  }
  const n = living.length;
  const diff = Math.abs(fromIdx - toIdx);
  return Math.min(diff, n - diff);
}
```

- [ ] **Step 2: Write the failing test**

```ts
// projects/content/src/lib/generals/setTwo.spec.ts
import { dongZhuoGeneral, zhaoYunGeneral, huangYueyingGeneral } from './setTwo';
import { resolve } from 'engine';
import type { GameState, ContentRegistry, GameModeDefinition, CardDefinition } from 'engine';

const testHealSelfCard: CardDefinition = {
  id: 'test-heal-self-card', name: 'Test Heal Self', category: 'basic',
  play: (_state, ctx) => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: ctx.seatId }, amount: 2 }],
};
const testDamageCard: CardDefinition = {
  id: 'test-damage-card', name: 'Test Damage Card', category: 'basic',
  play: (_state, ctx) => [{
    kind: 'DamageEffect',
    damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 2, nature: 'normal' },
  }],
};

function registry(): ContentRegistry {
  return {
    cards: new Map([['test-heal-self-card', testHealSelfCard], ['test-damage-card', testDamageCard]]),
    generals: new Map([['dong-zhuo', dongZhuoGeneral], ['zhao-yun', zhaoYunGeneral]]),
  };
}

function stubMode(): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
}

function seat(id: string, index: number, generalId: string, combinedHp: number, maxCombinedHp: number) {
  return {
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: generalId, revealed: false }, deputy: { generalDefinitionId: 'filler', revealed: false } },
    combinedHp, maxCombinedHp,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
  };
}

describe('Dong Zhuo — Tyranny', () => {
  it('reduces healing to this seat by 1', () => {
    const state: GameState = {
      seats: [seat('seat-a', 0, 'dong-zhuo', 3, 6)],
      players: [],
      turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
      phase: 'Play',
      zones: [
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'heal-1', definitionId: 'test-heal-self-card', suit: 'spade', rank: 1 }] },
        { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      ],
      pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
    };
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'heal-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(4); // 3 + (2-1)
  });
});

describe('Zhao Yun — Vanguard', () => {
  it('reduces damage by 1 when the source is 2+ seats away', () => {
    const seats = [seat('seat-a', 0, 'filler', 5, 5), seat('seat-b', 1, 'filler', 5, 5), seat('seat-c', 2, 'zhao-yun', 6, 6), seat('seat-d', 3, 'filler', 5, 5)];
    const state: GameState = {
      seats,
      players: [],
      turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
      phase: 'Play',
      zones: [
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'dmg-1', definitionId: 'test-damage-card', suit: 'spade', rank: 1 }] },
        { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
        { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] }, { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
        { id: 'seat-c:hand', kind: 'hand', ownerSeatId: 'seat-c', cards: [] }, { id: 'seat-c:equip', kind: 'equip', ownerSeatId: 'seat-c', cards: [] },
        { id: 'seat-d:hand', kind: 'hand', ownerSeatId: 'seat-d', cards: [] }, { id: 'seat-d:equip', kind: 'equip', ownerSeatId: 'seat-d', cards: [] },
      ],
      pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
    };
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'dmg-1', targets: [{ kind: 'seat', seatId: 'seat-c' }] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-c')!.combinedHp).toBe(5); // 6 - (2-1), distance(seat-a, seat-c) === 2
  });
});

describe('Huang Yueying', () => {
  it('has no skills', () => {
    expect(huangYueyingGeneral.skills).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest setTwo.spec.ts`
Expected: FAIL with "Cannot find module './setTwo'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/content/src/lib/generals/setTwo.ts
import type { GeneralDefinition, Effect } from 'engine';
import { findSeatIdForGeneral, getSeatDistance } from '../shared/queries';

export const dongZhuoGeneral: GeneralDefinition = {
  id: 'dong-zhuo',
  kingdom: 'Qun',
  maxHp: 4,
  skills: [
    {
      id: 'tyranny',
      activation: 'auto',
      triggers: [
        {
          point: 'before:HealEffect',
          condition: (state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'HealEffect' }>;
            const seatId = findSeatIdForGeneral(state, 'dong-zhuo');
            return !!seatId && effect.target.kind === 'seat' && effect.target.seatId === seatId;
          },
          effect: (_state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'HealEffect' }>;
            const reduced = Math.max(0, effect.amount - 1);
            return reduced === 0 ? [] : [{ ...effect, amount: reduced }];
          },
        },
      ],
    },
  ],
};

export const zhaoYunGeneral: GeneralDefinition = {
  id: 'zhao-yun',
  kingdom: 'Wei',
  maxHp: 4,
  skills: [
    {
      id: 'vanguard',
      activation: 'auto',
      triggers: [
        {
          point: 'before:DamageEffect',
          condition: (state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            const seatId = findSeatIdForGeneral(state, 'zhao-yun');
            if (!seatId || effect.damage.target.kind !== 'seat' || effect.damage.target.seatId !== seatId) return false;
            if (effect.damage.source?.kind !== 'seat') return false;
            return getSeatDistance(state, effect.damage.source.seatId, seatId) >= 2;
          },
          effect: (_state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            return [{ ...effect, damage: { ...effect.damage, amount: Math.max(0, effect.damage.amount - 1) } }];
          },
        },
      ],
    },
  ],
};

export const huangYueyingGeneral: GeneralDefinition = {
  id: 'huang-yueying',
  kingdom: 'Shu',
  maxHp: 3,
  skills: [],
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest setTwo.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing registry test**

```ts
// projects/content/src/lib/registry.spec.ts
import { buildContentRegistry } from './registry';

describe('buildContentRegistry', () => {
  it('registers all seven cards and six generals from this content pack', () => {
    const registry = buildContentRegistry();
    expect([...registry.cards.keys()].sort()).toEqual(
      ['duel', 'green-dragon-blade', 'peach', 'sha', 'shan', 'silver-lion', 'wuxie'].sort()
    );
    expect([...registry.generals.keys()].sort()).toEqual(
      ['dong-zhuo', 'huang-yueying', 'sun-shangxiang', 'xiahou-dun', 'zhao-yun', 'zhuge-liang'].sort()
    );
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx jest registry.spec.ts`
Expected: FAIL with "Cannot find module './registry'".

- [ ] **Step 8: Write minimal implementation**

```ts
// projects/content/src/lib/registry.ts
import type { ContentRegistry } from 'engine';
import { shaCard } from './cards/sha';
import { shanCard } from './cards/shan';
import { peachCard } from './cards/peach';
import { duelCard } from './cards/duel';
import { wuxieCard } from './cards/wuxie';
import { silverLionCard, greenDragonBladeCard } from './cards/equipment';
import { xiahouDunGeneral, sunShangxiangGeneral, zhugeLiangGeneral } from './generals/setOne';
import { dongZhuoGeneral, zhaoYunGeneral, huangYueyingGeneral } from './generals/setTwo';

export function buildContentRegistry(): ContentRegistry {
  const cards = [shaCard, shanCard, peachCard, duelCard, wuxieCard, silverLionCard, greenDragonBladeCard];
  const generals = [
    xiahouDunGeneral,
    sunShangxiangGeneral,
    zhugeLiangGeneral,
    dongZhuoGeneral,
    zhaoYunGeneral,
    huangYueyingGeneral,
  ];
  return {
    cards: new Map(cards.map((c) => [c.id, c])),
    generals: new Map(generals.map((g) => [g.id, g])),
  };
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx jest registry.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 10: Commit**

```bash
git add projects/content/src/lib
git commit -m "feat(content): add Dong Zhuo, Zhao Yun, Huang Yueying generals and assemble the content registry"
```

---

## Task 19: Kingdom War GameModeDefinition (content, plus one small engine addition)

**Rule text (written before implementation):**
- **Setup:** each seat is assigned a kingdom, cycling round-robin through `['Wei','Shu','Wu','Qun']` by seat index, and two hidden generals (main + deputy), assigned round-robin through the sorted list of the content registry's registered general ids. *(Simplified: generals are not filtered to match the seat's own kingdom — this milestone's 6-general pool can't guarantee 2 same-kingdom generals once seat count grows, and a richer content pool would naturally enforce that instead.)* `maxCombinedHp` = the sum of both generals' `maxHp`; `combinedHp` starts at `maxCombinedHp`; both generals start `revealed: false`. A shared deck is built from 4 copies of every registered card definition, shuffled with the setup RNG, and each seat is dealt 4 cards to its hand. Turn starts at seat index 0's seat, phase starts at `'Judgment'`.
- **Forced reveal:** after any `DamageDealtEvent` against a seat, if that seat's `combinedHp` is now ≤ `floor(maxCombinedHp / 2)` and its main general is still hidden, force-reveal the main general; if `combinedHp` is now ≤ 0 and the deputy is still hidden, force-reveal the deputy too. *(This milestone's concrete choice for the threshold the spec left unresolved — see the spec's Kingdom War section.)*
- **Elimination:** a seat is marked `eliminated: true` the instant its `combinedHp` drops to ≤ 0.
- **Win condition:** the game ends when either (a) exactly one non-eliminated seat remains — that seat wins alone (including a solo Qun survivor) — or (b) every non-eliminated seat shares the same non-Qun kingdom — all of them win together. *(This resolves the spec's flagged Qun-win ambiguity: Qun only ever wins as a lone survivor, never as a group.)*

Elimination needs its own engine primitive (nothing currently sets `Seat.eliminated`), added here the same way Task 15 added Heal/MoveCard.

**Files:**
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (add `EliminateSeatEffect`)
- Modify: `projects/engine/src/lib/pipeline/events.ts` (add `SeatEliminatedEvent`)
- Create: `projects/content/src/lib/modes/kingdomWar.ts`
- Test: `projects/content/src/lib/modes/kingdomWar.spec.ts`

**Interfaces:**
- Produces (engine): `Effect` gains `{ kind: 'EliminateSeatEffect'; seatId: string }`.
- Produces (content): `kingdomWarMode: GameModeDefinition`.

- [ ] **Step 1: Add `EliminateSeatEffect` to the engine**

In `projects/engine/src/lib/pipeline/events.ts`:

```ts
export interface SeatEliminatedEvent {
  kind: 'SeatEliminatedEvent';
  seatId: string;
}

export type EngineEvent =
  | CardsDrawnEvent
  | DamageDealtEvent
  | PhaseChangedEvent
  | TurnAdvancedEvent
  | GeneralRevealedEvent
  | HealEvent
  | CardMovedEvent
  | SeatEliminatedEvent;
```

In `projects/engine/src/lib/pipeline/effects.ts`:

```ts
export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage }
  | { kind: 'OpenResponseEffect'; pendingResponse: PendingResponse }
  | { kind: 'RevealGeneralEffect'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'HealEffect'; target: Target; amount: number }
  | { kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string }
  | { kind: 'EliminateSeatEffect'; seatId: string };

// inside applyEffect's switch, add:
case 'EliminateSeatEffect': {
  const seat = state.seats.find((s) => s.id === effect.seatId);
  if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
  if (seat.eliminated) return { state, events: [] };
  const seats = state.seats.map((s) => (s.id === effect.seatId ? { ...s, eliminated: true } : s));
  const event: EngineEvent = { kind: 'SeatEliminatedEvent', seatId: effect.seatId };
  return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
}
```

Run `npx jest --selectProjects engine` to confirm nothing broke, then commit:

```bash
git add projects/engine/src/lib/pipeline
git commit -m "feat(engine): add EliminateSeatEffect primitive"
```

- [ ] **Step 2: Write the failing test**

```ts
// projects/content/src/lib/modes/kingdomWar.spec.ts
import { kingdomWarMode } from './kingdomWar';
import { buildContentRegistry } from '../registry';
import { createGame, resolve } from 'engine';
import type { GameState, GameModeDefinition, CardDefinition, ContentRegistry } from 'engine';

describe('Kingdom War setup', () => {
  it('assigns kingdoms round-robin, sets combined HP from both generals, and deals 4 cards to each seat', () => {
    const registry = buildContentRegistry();
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 42);
    expect(state.seats.map((s) => s.kingdom)).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    for (const seat of state.seats) {
      const main = registry.generals.get(seat.generals.main.generalDefinitionId)!;
      const deputy = registry.generals.get(seat.generals.deputy.generalDefinitionId)!;
      expect(seat.maxCombinedHp).toBe(main.maxHp + deputy.maxHp);
      expect(seat.combinedHp).toBe(seat.maxCombinedHp);
      expect(seat.generals.main.revealed).toBe(false);
      expect(seat.generals.deputy.revealed).toBe(false);
      const hand = state.zones.find((z) => z.id === seat.hand.zoneId)!;
      expect(hand.cards).toHaveLength(4);
    }
    expect(state.turn).toEqual({ turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] });
    expect(state.phase).toBe('Judgment');
  });
});

describe('Kingdom War forced reveal and elimination', () => {
  const testDamageCard: CardDefinition = {
    id: 'test-damage-card', name: 'Test Damage Card', category: 'basic',
    play: (_state, ctx) => [{
      kind: 'DamageEffect',
      damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 10, nature: 'normal' },
    }],
  };

  function registryWithLethalCard(): ContentRegistry {
    const base = buildContentRegistry();
    base.cards.set('test-damage-card', testDamageCard);
    return base;
  }

  function twoSeatState(): GameState {
    const registry = registryWithLethalCard();
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    return {
      ...state,
      zones: state.zones.map((z) =>
        z.id === state.seats[0].hand.zoneId
          ? { ...z, cards: [{ instanceId: 'lethal-1', definitionId: 'test-damage-card', suit: 'spade', rank: 1 }] }
          : z
      ),
    };
  }

  it('force-reveals both generals and eliminates the seat on lethal damage, ending the game', () => {
    const registry = registryWithLethalCard();
    const state = twoSeatState();
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'lethal-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry, mode: kingdomWarMode }
    );
    const seatB = next.seats.find((s) => s.id === 'seat-b')!;
    expect(seatB.generals.main.revealed).toBe(true);
    expect(seatB.generals.deputy.revealed).toBe(true);
    expect(seatB.eliminated).toBe(true);
    expect(next.result).toEqual({ endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest kingdomWar.spec.ts`
Expected: FAIL with "Cannot find module './kingdomWar'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/content/src/lib/modes/kingdomWar.ts
import type { GameModeDefinition, GameState, ContentRegistry, Kingdom, DamageDealtEvent, Target } from 'engine';
import { buildDeck, drawTop } from 'engine';

const KINGDOM_ORDER: Kingdom[] = ['Wei', 'Shu', 'Wu', 'Qun'];
const SUITS = ['spade', 'heart', 'club', 'diamond'] as const;

function buildDeckSpec(registry: ContentRegistry) {
  const entries: { definitionId: string; suit: (typeof SUITS)[number]; rank: number }[] = [];
  let i = 0;
  for (const cardId of registry.cards.keys()) {
    for (let copy = 0; copy < 4; copy++) {
      entries.push({ definitionId: cardId, suit: SUITS[i % SUITS.length], rank: (i % 13) + 1 });
      i++;
    }
  }
  return entries;
}

function seatIdOfTarget(target: Target): string {
  if (target.kind !== 'seat') throw new Error('Expected a seat target');
  return target.seatId;
}

export const kingdomWarMode: GameModeDefinition = {
  id: 'kingdom-war',
  setup: (seatIds, registry, rng) => {
    const generalIds = [...registry.generals.keys()].sort();
    const seats = seatIds.map((id, index) => {
      const kingdom = KINGDOM_ORDER[index % KINGDOM_ORDER.length];
      const mainGeneralId = generalIds[(index * 2) % generalIds.length];
      const deputyGeneralId = generalIds[(index * 2 + 1) % generalIds.length];
      const maxCombinedHp = registry.generals.get(mainGeneralId)!.maxHp + registry.generals.get(deputyGeneralId)!.maxHp;
      return {
        id,
        index,
        kingdom,
        generals: {
          main: { generalDefinitionId: mainGeneralId, revealed: false },
          deputy: { generalDefinitionId: deputyGeneralId, revealed: false },
        },
        combinedHp: maxCombinedHp,
        maxCombinedHp,
        hand: { zoneId: `${id}:hand` },
        equipped: { zoneId: `${id}:equip` },
        eliminated: false,
      };
    });

    const { cards, rng: afterShuffle } = buildDeck(buildDeckSpec(registry), rng);
    let zones = [
      { id: 'drawPile', kind: 'drawPile' as const, cards },
      { id: 'discardPile', kind: 'discardPile' as const, cards: [] },
      ...seats.flatMap((s) => [
        { id: s.hand.zoneId, kind: 'hand' as const, ownerSeatId: s.id, cards: [] },
        { id: s.equipped.zoneId, kind: 'equip' as const, ownerSeatId: s.id, cards: [] },
      ]),
    ];
    for (const s of seats) {
      const drawResult = drawTop(zones, 'drawPile', s.hand.zoneId, 4);
      zones = drawResult.zones;
    }

    const state: GameState = {
      seats,
      players: seatIds.map((id) => ({ id: `player-${id}`, seatId: id, kind: 'bot' as const })),
      turn: { turnNumber: 1, ownerSeatId: seatIds[0], extraTurnStack: [] },
      phase: 'Judgment',
      zones,
      pendingResponse: null,
      log: [],
      rng: afterShuffle,
      result: null,
    };
    return { state, rng: afterShuffle };
  },

  checkWinCondition: (state) => {
    const alive = state.seats.filter((s) => !s.eliminated);
    if (alive.length === 0) return null;
    const losingSeatIds = state.seats.filter((s) => s.eliminated).map((s) => s.id);
    if (alive.length === 1) {
      return { endedAt: state.turn.turnNumber, winningSeatIds: [alive[0].id], losingSeatIds };
    }
    const kingdoms = new Set(alive.map((s) => s.kingdom));
    if (kingdoms.size === 1 && alive[0].kingdom !== 'Qun') {
      return {
        endedAt: state.turn.turnNumber,
        winningKingdom: alive[0].kingdom,
        winningSeatIds: alive.map((s) => s.id),
        losingSeatIds,
      };
    }
    return null;
  },

  triggers: [
    {
      point: 'after:DamageDealtEvent',
      condition: (state, subject) => {
        const event = subject as DamageDealtEvent;
        if (event.damage.target.kind !== 'seat') return false;
        const seat = state.seats.find((s) => s.id === event.damage.target.seatId);
        return !!seat && !seat.generals.main.revealed && seat.combinedHp <= Math.floor(seat.maxCombinedHp / 2);
      },
      effect: (_state, subject) => {
        const event = subject as DamageDealtEvent;
        return [{ kind: 'RevealGeneralAction', seatId: seatIdOfTarget(event.damage.target), slot: 'main' as const }];
      },
    },
    {
      point: 'after:DamageDealtEvent',
      condition: (state, subject) => {
        const event = subject as DamageDealtEvent;
        if (event.damage.target.kind !== 'seat') return false;
        const seat = state.seats.find((s) => s.id === event.damage.target.seatId);
        return !!seat && !seat.generals.deputy.revealed && seat.combinedHp <= 0;
      },
      effect: (_state, subject) => {
        const event = subject as DamageDealtEvent;
        return [{ kind: 'RevealGeneralAction', seatId: seatIdOfTarget(event.damage.target), slot: 'deputy' as const }];
      },
    },
    {
      point: 'after:DamageDealtEvent',
      condition: (state, subject) => {
        const event = subject as DamageDealtEvent;
        if (event.damage.target.kind !== 'seat') return false;
        const seat = state.seats.find((s) => s.id === event.damage.target.seatId);
        return !!seat && !seat.eliminated && seat.combinedHp <= 0;
      },
      effect: (_state, subject) => {
        const event = subject as DamageDealtEvent;
        return [{ kind: 'EliminateSeatEffect', seatId: seatIdOfTarget(event.damage.target) }];
      },
    },
  ],
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest kingdomWar.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full test suite**

Run: `npx jest`
Expected: every suite across `engine` and `content` PASSes.

- [ ] **Step 7: Commit**

```bash
git add projects/content/src/lib/modes
git commit -m "feat(content): add Kingdom War GameModeDefinition (setup, forced reveal, win condition)"
```

The engine and content libraries are now complete and fully tested. The remaining tasks build `sim`, the headless simulation harness.

---

## Task 20: Scaffold `sim`, and the random-legal-move bot (sim)

**Files:**
- Create: `projects/sim/tsconfig.json`
- Modify: `jest.config.js` (add a `sim` project entry)
- Create: `projects/sim/src/bot.ts`
- Test: `projects/sim/src/bot.spec.ts`

**Interfaces:**
- Produces: `seatToAct(state: GameState): string`; `pickRandomAction(state: GameState, rng: RngState): { action: Action; rng: RngState }`.

- [ ] **Step 1: Scaffold the `sim` project**

`projects/sim` is a headless Node CLI, not an Angular library, so it's added by hand rather than via `ng generate`. Create `projects/sim/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc/sim",
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts"]
}
```

Install dev dependencies for running the CLI directly in development:

```bash
npm install --save-dev ts-node @types/node
```

Add a `sim` project entry to `jest.config.js`'s `projects` array (alongside `engine` and `content`):

```js
{
  displayName: 'sim',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'projects/sim/src',
  testMatch: ['**/*.spec.ts'],
},
```

Verify with a sanity test the same way Task 1 did: create `projects/sim/src/sanity.spec.ts` with a trivial passing assertion, run `npx jest --selectProjects sim`, confirm PASS, then delete it.

- [ ] **Step 2: Write the failing test**

```ts
// projects/sim/src/bot.spec.ts
import { seatToAct, pickRandomAction } from './bot';
import { createRng } from 'engine';
import type { GameState } from 'engine';

function state(pendingResponse: GameState['pendingResponse'] = null): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse, log: [], rng: createRng(1), result: null,
  };
}

describe('seatToAct', () => {
  it('is the turn owner when no response is pending', () => {
    expect(seatToAct(state())).toBe('seat-a');
  });

  it('is the responding seat when a response is pending', () => {
    const withPending = state({ id: 'resp-1', respondingSeatId: 'seat-b', allowedActionKinds: ['PassAction'], context: { effect: null } });
    expect(seatToAct(withPending)).toBe('seat-b');
  });
});

describe('pickRandomAction', () => {
  it('picks a legal action for the acting seat (EndPhaseAction is always legal on its turn)', () => {
    const { action } = pickRandomAction(state(), createRng(5));
    expect(action.seatId).toBe('seat-a');
  });

  it('is deterministic for a given seed', () => {
    const first = pickRandomAction(state(), createRng(5));
    const second = pickRandomAction(state(), createRng(5));
    expect(first.action).toEqual(second.action);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --selectProjects sim`
Expected: FAIL with "Cannot find module './bot'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/sim/src/bot.ts
import { nextInt } from 'engine';
import { getLegalActions } from 'engine';
import type { GameState, RngState, Action } from 'engine';

export function seatToAct(state: GameState): string {
  return state.pendingResponse ? state.pendingResponse.respondingSeatId : state.turn.ownerSeatId;
}

export function pickRandomAction(state: GameState, rng: RngState): { action: Action; rng: RngState } {
  const seatId = seatToAct(state);
  const legal = getLegalActions(state, seatId);
  if (legal.length === 0) {
    throw new Error(`No legal actions for seat ${seatId} to act with`);
  }
  const step = nextInt(rng, legal.length);
  return { action: legal[step.value], rng: step.rng };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --selectProjects sim`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add projects/sim jest.config.js package.json package-lock.json
git commit -m "feat(sim): scaffold sim project and add the random-legal-move bot"
```

---

## Task 21: Single-game runner, invariant checks, and CLI (sim)

**Files:**
- Modify: `projects/content/src/public-api.ts` (populate it — this is the first task where `sim` imports from `content`)
- Create: `projects/sim/src/runGame.ts`
- Test: `projects/sim/src/runGame.spec.ts`
- Create: `projects/sim/src/invariants.ts`
- Test: `projects/sim/src/invariants.spec.ts`
- Create: `projects/sim/src/cli.ts`

**Interfaces:**
- Consumes: `resolve`, `createRng`, `createGame` from `engine`; `buildContentRegistry`, `kingdomWarMode` from `content`; `pickRandomAction` from `./bot`.
- Produces: `runGame(initialState: GameState, ctx: EngineContext, botRngSeed: number, maxActions?: number): { finalState: GameState; actionsSubmitted: number }`; `checkInvariants(state: GameState): string[]` (empty = no violations found).

- [ ] **Step 1: Populate `content`'s public API**

```ts
// projects/content/src/public-api.ts
export * from './lib/registry';
export * from './lib/modes/kingdomWar';
```

(Individual cards/generals aren't re-exported — `sim` and any future consumer only need the assembled registry and the mode definition, not each card/general symbol individually.)

- [ ] **Step 2: Write the failing test for `runGame`**

```ts
// projects/sim/src/runGame.spec.ts
import { runGame } from './runGame';
import { createGame } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';

describe('runGame', () => {
  it('drives a Kingdom War game to a terminal GameResult using the random-legal-move bot', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 123);
    const { finalState, actionsSubmitted } = runGame(initialState, { registry, mode: kingdomWarMode }, 456);
    expect(finalState.result).not.toBeNull();
    expect(actionsSubmitted).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --selectProjects sim`
Expected: FAIL with "Cannot find module './runGame'".

- [ ] **Step 4: Write minimal implementation**

```ts
// projects/sim/src/runGame.ts
import { resolve, createRng } from 'engine';
import type { GameState, EngineContext } from 'engine';
import { pickRandomAction } from './bot';

export interface RunGameResult {
  finalState: GameState;
  actionsSubmitted: number;
}

export function runGame(
  initialState: GameState,
  ctx: EngineContext,
  botRngSeed: number,
  maxActions = 2000
): RunGameResult {
  let state = initialState;
  let botRng = createRng(botRngSeed);
  let actionsSubmitted = 0;
  while (!state.result && actionsSubmitted < maxActions) {
    const picked = pickRandomAction(state, botRng);
    botRng = picked.rng;
    const result = resolve(state, picked.action, ctx);
    state = result.state;
    actionsSubmitted++;
  }
  return { finalState: state, actionsSubmitted };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --selectProjects sim`
Expected: PASS. This may take a few seconds of wall-clock time (a full random-bot game plays out) but must complete well under the 2000-action cap — if it times out or hits the cap, re-check Task 19's Kingdom War win condition and Task 15/16's no-target guards are exactly as written, since a stuck game means a `resolve()` call is silently failing to make progress somewhere in that chain.

- [ ] **Step 6: Write the failing test for `checkInvariants`**

```ts
// projects/sim/src/invariants.spec.ts
import { checkInvariants } from './invariants';
import type { GameState } from 'engine';

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
    ],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [], pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
    ...overrides,
  };
}

describe('checkInvariants', () => {
  it('reports no violations for a clean state', () => {
    expect(checkInvariants(baseState())).toEqual([]);
  });

  it('flags negative combinedHp', () => {
    const state = baseState();
    state.seats[0].combinedHp = -1;
    expect(checkInvariants(state)).toEqual([expect.stringContaining('negative combinedHp')]);
  });

  it('flags a pendingResponse pointing at an eliminated seat', () => {
    const state = baseState();
    state.seats[0].eliminated = true;
    state.pendingResponse = { id: 'r1', respondingSeatId: 'seat-a', allowedActionKinds: ['PassAction'], context: { effect: null } };
    expect(checkInvariants(state)).toEqual([expect.stringContaining('eliminated seat')]);
  });

  it('flags a GameResult that references an unknown seat', () => {
    const state = baseState({ result: { endedAt: 1, winningSeatIds: ['ghost-seat'], losingSeatIds: [] } });
    expect(checkInvariants(state)).toEqual([expect.stringContaining('unknown seat')]);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx jest --selectProjects sim`
Expected: FAIL with "Cannot find module './invariants'".

- [ ] **Step 8: Write minimal implementation**

```ts
// projects/sim/src/invariants.ts
import type { GameState } from 'engine';

export function checkInvariants(state: GameState): string[] {
  const violations: string[] = [];

  for (const seat of state.seats) {
    if (seat.combinedHp < 0) {
      violations.push(`Seat ${seat.id} has negative combinedHp: ${seat.combinedHp}`);
    }
  }

  if (state.pendingResponse) {
    const seat = state.seats.find((s) => s.id === state.pendingResponse!.respondingSeatId);
    if (!seat) {
      violations.push(`pendingResponse references unknown seat ${state.pendingResponse.respondingSeatId}`);
    } else if (seat.eliminated) {
      violations.push(`pendingResponse references eliminated seat ${seat.id}`);
    }
  }

  if (state.result) {
    const allIds = new Set(state.seats.map((s) => s.id));
    const seen = new Set<string>();
    for (const id of [...state.result.winningSeatIds, ...state.result.losingSeatIds]) {
      if (!allIds.has(id)) violations.push(`GameResult references unknown seat ${id}`);
      if (seen.has(id)) violations.push(`GameResult lists seat ${id} more than once`);
      seen.add(id);
    }
  }

  return violations;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx jest --selectProjects sim`
Expected: PASS (4 tests in `invariants.spec.ts`, plus `runGame.spec.ts` and `bot.spec.ts` still green).

- [ ] **Step 10: Write the CLI**

`cli.ts` is a thin I/O wrapper over `runGame`/`checkInvariants` (both already tested above) — it has no dedicated Jest spec, and is instead verified by manually running it in Step 11.

```ts
#!/usr/bin/env node
// projects/sim/src/cli.ts
import { createGame } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants } from './invariants';

function playOneGame(seed: number, numSeats: number) {
  const registry = buildContentRegistry();
  const seatIds = Array.from({ length: numSeats }, (_, i) => `seat-${i}`);
  const initialState = createGame(kingdomWarMode, registry, seatIds, seed);
  return runGame(initialState, { registry, mode: kingdomWarMode }, seed);
}

function runSingle(seed: number, numSeats: number): void {
  const { finalState, actionsSubmitted } = playOneGame(seed, numSeats);
  console.log(`Actions submitted: ${actionsSubmitted}`);
  console.log(`Result: ${JSON.stringify(finalState.result)}`);
  console.log('Event log:');
  for (const event of finalState.log) {
    console.log(JSON.stringify(event));
  }
  const violations = checkInvariants(finalState);
  if (violations.length > 0) {
    console.error('Invariant violations:', violations);
    process.exitCode = 1;
  }
}

function runBatch(numGames: number, numSeats: number): void {
  let failures = 0;
  for (let seed = 0; seed < numGames; seed++) {
    const { finalState, actionsSubmitted } = playOneGame(seed, numSeats);
    const violations = checkInvariants(finalState);
    if (violations.length > 0 || !finalState.result) {
      failures++;
      console.error(
        `Seed ${seed} FAILED (actions: ${actionsSubmitted}):`,
        violations.length > 0 ? violations : 'game did not terminate'
      );
    }
  }
  console.log(`${numGames - failures}/${numGames} games passed invariant checks.`);
  if (failures > 0) process.exitCode = 1;
}

const [, , mode, arg1, arg2] = process.argv;
if (mode === 'single') {
  runSingle(Number(arg1 ?? 1), Number(arg2 ?? 4));
} else if (mode === 'batch') {
  runBatch(Number(arg1 ?? 100), Number(arg2 ?? 4));
} else {
  console.error('Usage: sim single <seed> <numSeats> | sim batch <numGames> <numSeats>');
  process.exitCode = 1;
}
```

- [ ] **Step 11: Manually verify the CLI**

Run:

```bash
npx ts-node -P projects/sim/tsconfig.json projects/sim/src/cli.ts single 1 4
npx ts-node -P projects/sim/tsconfig.json projects/sim/src/cli.ts batch 50 4
```

Expected: the first prints an event log ending in a non-null `Result:` line with no invariant violations; the second prints `50/50 games passed invariant checks.` with exit code 0. If `ts-node` can't resolve the `engine`/`content` path aliases, add a `-r tsconfig-paths/register` flag and `npm install --save-dev tsconfig-paths`, since ts-node doesn't read `tsconfig.json` path mappings by default.

- [ ] **Step 12: Commit**

```bash
git add projects/content/src/public-api.ts projects/sim
git commit -m "feat(sim): add single-game runner, invariant checks, and CLI"
```

---

## Task 22: Property-style tests across many seeds (sim)

The spec's testing strategy calls for automated (Jest, not just the manual CLI) property tests running the sim harness across many seeds, asserting: combined HP never goes negative, every game terminates within a bounded number of actions, a `pendingResponse` is never left dangling, and the win condition is always eventually satisfied. `checkInvariants` (Task 21) already covers the first of these structurally; this task adds the seeded-batch test, the two invariants specific to a *terminated* game (no dangling response, and a result was actually reached), and a direct check of the spec's Serializability invariant (every produced `GameState` survives a `JSON.stringify`/`JSON.parse` round-trip unchanged, proving nothing non-serializable — a function, a class instance, a stateful RNG object — ever leaked into state across a real batch of played games).

**Files:**
- Create: `projects/sim/src/property.spec.ts`

**Interfaces:**
- Consumes: `createGame` from `engine`; `buildContentRegistry`, `kingdomWarMode` from `content`; `runGame` from `./runGame`; `checkInvariants` from `./invariants`.

- [ ] **Step 1: Write the test**

There's no separate "fails first" step here — this test exercises only already-implemented code (Tasks 1-21), so it's written directly against the working implementation rather than TDD'd from a red state:

```ts
// projects/sim/src/property.spec.ts
import { createGame } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants } from './invariants';

describe('property: simulated Kingdom War games across many seeds and seat counts', () => {
  it('every game terminates with a valid, non-dangling GameResult and no invariant violations', () => {
    const registry = buildContentRegistry();
    const seatCounts = [2, 3, 4, 5, 6, 7, 8];
    const failures: string[] = [];
    let seed = 0;

    for (const numSeats of seatCounts) {
      for (let i = 0; i < 10; i++) {
        seed++;
        const seatIds = Array.from({ length: numSeats }, (_, idx) => `seat-${idx}`);
        const initialState = createGame(kingdomWarMode, registry, seatIds, seed);
        const { finalState, actionsSubmitted } = runGame(
          initialState,
          { registry, mode: kingdomWarMode },
          seed * 7 + 1,
          2000
        );

        const label = `seed ${seed} (${numSeats} seats)`;
        const violations = checkInvariants(finalState);
        if (violations.length > 0) failures.push(`${label}: ${violations.join('; ')}`);
        if (!finalState.result) failures.push(`${label}: did not terminate within ${actionsSubmitted} actions`);
        if (finalState.result && finalState.pendingResponse) {
          failures.push(`${label}: game ended with a dangling pendingResponse`);
        }

        const roundTripped = JSON.parse(JSON.stringify(finalState));
        if (JSON.stringify(roundTripped) !== JSON.stringify(finalState)) {
          failures.push(`${label}: final GameState did not survive a JSON round-trip (Serializability invariant broken)`);
        }
      }
    }

    expect(failures).toEqual([]);
  }, 60000); // drives 70 full games end-to-end; give it more headroom than Jest's 5s default
});
```

- [ ] **Step 2: Run and confirm it passes**

Run: `npx jest --selectProjects sim`
Expected: PASS. If `failures` is non-empty, the assertion failure message lists exactly which seed/seat-count combination broke and how — use that to find which task's logic needs a fix (a negative HP points at a `DamageEffect`/`HealEffect` bug; a non-terminating game points at the win condition or the phase/turn advancement; a dangling response points at the `PendingResponse` pause/resume logic).

- [ ] **Step 3: Run the entire workspace test suite one final time**

Run: `npx jest`
Expected: every suite across `engine`, `content`, and `sim` PASSes.

- [ ] **Step 4: Commit**

```bash
git add projects/sim/src/property.spec.ts
git commit -m "test(sim): add property-style invariant tests across many seeds and seat counts"
```

This completes the Kingdom War rules engine sub-project: `projects/engine` and `projects/content` are fully framework-independent, unit-tested, and demonstrate the extensibility model (registries, pluggable `GameModeDefinition`) from the spec; `projects/sim` proves the engine runs headlessly under plain Node and holds up across many simulated games. The Angular presentation layer and the application/persistence layer remain future sub-projects, per the spec's stated scope.

