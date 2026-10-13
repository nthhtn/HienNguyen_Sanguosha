# Backend Stage 1 — Engine Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the engine ready to run on a server. Card ids give nothing
away, a reshuffle can't be tracked, and the timeout defaults and clock rules
live in the engine where a server can use them. A leak checker proves no seat
can learn hidden information.

**Architecture:** The work is all inside the framework-free packages (`engine`, `sim`), plus
rewiring one Angular service onto the moved code. No server code yet. A leak
checker in `sim` is built first and self-tested. The two id fixes follow, and a
property test then runs the checker over simulated games. The timeout defaults
and decision clock become pure engine functions (callers pass `now`), and
`DecisionTimer` is rewired onto them with its existing tests unchanged.

**Tech Stack:** TypeScript 6, Jest 30 (`ts-jest` for engine/sim, `jest-preset-angular` for app), Angular 22 signals.

**Spec:** `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md` (sections "Engine changes", "Decision clocks", "Stages" → Stage 1)

## Global Constraints

- The engine stays framework-free: no Angular, no browser APIs, no `Date.now()` or timers in `projects/engine` (callers pass `now`).
- No game rule changes. Only card ids change (opaque at deck build, fresh on reshuffle).
- New opaque deck ids are exactly `card-<position in the shuffled deck>`; reshuffled ids are exactly `r<rng counter>-<position>`.
- Decision budgets are unchanged: `response` 60 s, `choice` 60 s, `discard` 60 s, `selection` 300 s, `play` 300 s.
- `defaultActionsFor(state, legal): Action[]` keeps today's `defaultDecision` behaviour exactly.
- The existing `DecisionTimer` tests in `projects/app/src/app/decision-timer.service.spec.ts` must pass. Only their import line changes, and the `defaultDecision` block moves to the engine.
- Code style: match the surrounding files. Short "why" comments, no comment banners, and existing naming patterns.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/backend-stage-1-engine-prep`, created from `main`.

## Review Focus

1. **A reshuffle of a single card:** it must still get an id distinct from every earlier reshuffle's, because a one-card shuffle consumes no randomness. This is tested in Task 3.
2. **Cards held back with `keepInDiscard` during a reshuffle:** they must keep their ids, because queued effects reference them. This is tested in Task 3.
3. **A seat arranging draw-pile cards:** it legitimately sees those faces, and the leak checker must not flag them. This is tested in Task 1.
4. **A seat's own face-down Generals in its own view:** these are not a leak. This is tested in Task 1.
5. **A Play-phase clock across several actions, and a paused clock resumed later:** the remaining time must carry over, not reset. This is tested in Task 5, and the app's existing tests cover it end to end.

---

## File Structure

| File | Responsibility |
|---|---|
| `projects/sim/src/leaks.ts` (create) | Leak checker: `secretGeneralIds`, `findViewLeaks`, `findEventLeaks`, `findReshuffleLeaks`, `findStepLeaks` |
| `projects/sim/src/leaks.spec.ts` (create) | Self-test: planted leaks are reported, clean views are not |
| `projects/sim/src/leakProperty.spec.ts` (create) | Runs the checker over simulated games |
| `projects/engine/src/lib/cards/deck.ts` (modify) | Opaque `card-<n>` ids |
| `projects/engine/src/lib/cards/zones.ts` (modify) | Fresh ids for reshuffled cards in `drawTop` |
| `projects/engine/src/lib/rules/defaultActions.ts` (create) | `defaultActionsFor` (moved from the app) |
| `projects/engine/src/lib/rules/decisionClock.ts` (create) | `DECISION_SECONDS`, `describeDecision`, `switchClock`, `clockRemainingMs`, `expireClock` |
| `projects/engine/src/public-api.ts` (modify) | Export the two new rules files |
| `projects/app/src/app/decision-timer.service.ts` (modify) | Uses the engine clock and defaults |
| `docs/architecture/backend-and-deployment.md` (modify) | "Visibility" notes the id fixes |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git pull --ff-only && git checkout -b feat/backend-stage-1-engine-prep
```

- [ ] **Step 2: Confirm the suite is green before changes**

Run: `npx jest`
Expected: all projects PASS. If anything fails on `main`, stop and report it before continuing.

---

### Task 1: Leak checker with self-test

**Files:**
- Create: `projects/sim/src/leaks.ts`
- Test: `projects/sim/src/leaks.spec.ts`

**Interfaces:**
- Consumes: from `engine`: `redactStateForSeat`, `isFaceUpZoneKind`, types `GameState`, `CardInstance`, `EngineEvent`.
- Produces:
  - `secretGeneralIds(state: GameState, viewerSeatId: string | null): Set<string>`
  - `findViewLeaks(state: GameState, view: object, viewerSeatId: string): string[]`
  - `findEventLeaks(state: GameState, events: readonly EngineEvent[]): string[]`
  - `findReshuffleLeaks(prev: GameState, next: GameState): string[]`
  - `findStepLeaks(prev: GameState, next: GameState): string[]`. This checks every seat's view of `next` (`redactStateForSeat` minus `rng` and `log`, the server's mapping), the events `next` added since `prev`, and any reshuffle.

- [ ] **Step 1: Write the failing self-test**

Create `projects/sim/src/leaks.spec.ts`:

```ts
import { createRng, redactStateForSeat } from 'engine';
import type { CardInstance, EngineEvent, GameState } from 'engine';
import { findEventLeaks, findReshuffleLeaks, findViewLeaks } from './leaks';

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 1 });

// Two seats. seat-0 shows its main General (g-a) and hides its deputy (g-b);
// seat-1 hides both (g-c, g-d). Opaque card ids, as the engine deals them.
function table(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [
      { id: 'seat-0', generals: { main: { generalDefinitionId: 'g-a', revealed: true }, deputy: { generalDefinitionId: 'g-b', revealed: false } } },
      { id: 'seat-1', generals: { main: { generalDefinitionId: 'g-c', revealed: false }, deputy: { generalDefinitionId: 'g-d', revealed: false } } },
    ],
    zones: [
      { id: 'draw', kind: 'drawPile', cards: [card('card-0', 'peach'), card('card-1', 'wine')] },
      { id: 'discard', kind: 'discardPile', cards: [card('card-2', 'sha')] },
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: [card('card-3', 'shan')] },
      { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [card('card-4', 'duel')] },
    ],
    pendingResponse: null,
    generalSelection: null,
    log: [],
    rng: createRng(1),
    ...overrides,
  } as unknown as GameState;
}

// What the server will send: the redacted state without rng and log.
function sentView(state: GameState, seatId: string): object {
  const { rng, log, ...view } = redactStateForSeat(state, seatId);
  return view;
}

describe('findViewLeaks', () => {
  it('reports nothing for a properly redacted view, own face-down General included', () => {
    const state = table();
    expect(findViewLeaks(state, sentView(state, 'seat-0'), 'seat-0')).toEqual([]);
  });

  it('reports a view that still carries the RNG state or the log', () => {
    const state = table();
    const leaks = findViewLeaks(state, redactStateForSeat(state, 'seat-0'), 'seat-0');
    expect(leaks).toEqual(expect.arrayContaining([expect.stringContaining('RNG'), expect.stringContaining('log')]));
  });

  it('reports another seat’s hidden card shown face up', () => {
    const state = table();
    const leaky = { ...sentView(state, 'seat-0'), zones: state.zones };
    expect(findViewLeaks(state, leaky, 'seat-0')).toEqual(
      expect.arrayContaining([expect.stringContaining('card-4 as duel'), expect.stringContaining('card-0 as peach')])
    );
  });

  it('reports a masked card whose id still names the card', () => {
    const state = table({
      zones: [{ id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [card('duel-spade-1-7', 'duel')] }],
    } as Partial<GameState>);
    expect(findViewLeaks(state, sentView(state, 'seat-0'), 'seat-0')).toEqual([expect.stringContaining('names its card duel')]);
  });

  it('reports another seat’s face-down General named anywhere in the view', () => {
    const state = table();
    const leaky = { ...sentView(state, 'seat-0'), seats: state.seats };
    expect(findViewLeaks(state, leaky, 'seat-0')).toEqual(
      expect.arrayContaining([expect.stringContaining('g-c'), expect.stringContaining('g-d')])
    );
  });

  it('does not report draw-pile cards the viewer is arranging', () => {
    const state = table({
      pendingArrangement: { id: 'arr', seatId: 'seat-0', cardInstanceIds: ['card-0'], reason: { kind: 'decline' } },
    } as unknown as Partial<GameState>);
    const view = sentView(state, 'seat-0') as GameState;
    expect(view.zones[0].cards[0].definitionId).toBe('peach');
    expect(findViewLeaks(state, view, 'seat-0')).toEqual([]);
  });
});

describe('findEventLeaks', () => {
  it('reports a card face carried into a hand, not into the discard pile', () => {
    const state = table();
    const events: EngineEvent[] = [
      { kind: 'CardMovedEvent', cardInstanceId: 'card-4', fromZoneId: 'draw', toZoneId: 'seat-1:hand', card: card('card-4', 'duel') },
      { kind: 'CardMovedEvent', cardInstanceId: 'card-2', fromZoneId: 'seat-0:hand', toZoneId: 'discard', card: card('card-2', 'sha') },
    ];
    expect(findEventLeaks(state, events)).toEqual([expect.stringContaining('seat-1:hand')]);
  });

  it('reports a face-down General named in the log, any seat’s', () => {
    const state = table();
    const events: EngineEvent[] = [
      { kind: 'FormChosenEvent', seatId: 'seat-0', generalId: 'g-b', skillId: 'x' },
      { kind: 'FormChosenEvent', seatId: 'seat-0', generalId: 'g-a', skillId: 'x' },
    ];
    expect(findEventLeaks(state, events)).toEqual([expect.stringContaining('g-b')]);
  });
});

describe('findReshuffleLeaks', () => {
  const prev = table();
  const reshuffledLog: EngineEvent[] = [{ kind: 'DiscardPileReshuffledEvent', cardCount: 1 }];

  it('reports a reshuffled card that kept its id', () => {
    const next = table({
      zones: [{ id: 'draw', kind: 'drawPile', cards: [card('card-2', 'sha')] }, { id: 'discard', kind: 'discardPile', cards: [] }],
      log: reshuffledLog,
    } as Partial<GameState>);
    expect(findReshuffleLeaks(prev, next)).toEqual([expect.stringContaining('card-2')]);
  });

  it('reports a reshuffled card drawn under its old id', () => {
    const next = table({
      zones: [{ id: 'draw', kind: 'drawPile', cards: [] }, { id: 'discard', kind: 'discardPile', cards: [] }],
      log: [...reshuffledLog, { kind: 'CardsDrawnEvent', seatId: 'seat-0', cardInstanceIds: ['card-2'] }],
    } as Partial<GameState>);
    expect(findReshuffleLeaks(prev, next)).toEqual([expect.stringContaining('card-2')]);
  });

  it('reports nothing when reshuffled cards were renamed', () => {
    const next = table({
      zones: [{ id: 'draw', kind: 'drawPile', cards: [card('r9-0', 'sha')] }, { id: 'discard', kind: 'discardPile', cards: [] }],
      log: reshuffledLog,
    } as Partial<GameState>);
    expect(findReshuffleLeaks(prev, next)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest projects/sim/src/leaks.spec.ts`
Expected: FAIL with "Cannot find module './leaks'".

- [ ] **Step 3: Implement the checker**

Create `projects/sim/src/leaks.ts`:

```ts
import { isFaceUpZoneKind, redactStateForSeat } from 'engine';
import type { CardInstance, EngineEvent, GameState } from 'engine';

const HIDDEN = 'hidden';

// General ids `viewerSeatId` must not learn: other seats' face-down Generals,
// the spare Generals they hold (bar the chosen one), other seats' selection
// candidates, and the Generals nobody was dealt. With no viewer (the shared
// log), every seat's.
export function secretGeneralIds(state: GameState, viewerSeatId: string | null): Set<string> {
  const ids = new Set<string>();
  for (const seat of state.seats) {
    if (seat.id === viewerSeatId) continue;
    if (seat.generals) {
      for (const general of [seat.generals.main, seat.generals.deputy]) if (!general.revealed) ids.add(general.generalDefinitionId);
    }
    for (const id of seat.forms?.held ?? []) if (id !== seat.forms?.chosen?.generalId) ids.add(id);
  }
  for (const [seatId, candidates] of Object.entries(state.generalSelection?.candidates ?? {})) {
    if (seatId !== viewerSeatId) candidates.forEach((id) => ids.add(id));
  }
  (state.spareGenerals ?? []).forEach((id) => ids.add(id));
  return ids;
}

// The real cards `viewerSeatId` can't see, by instance id: other seats' hands
// and the draw pile, bar the cards it is arranging.
function hiddenCards(state: GameState, viewerSeatId: string): Map<string, CardInstance> {
  const shown = new Set(state.pendingArrangement?.seatId === viewerSeatId ? state.pendingArrangement.cardInstanceIds : []);
  const hidden = new Map<string, CardInstance>();
  for (const zone of state.zones) {
    if (isFaceUpZoneKind(zone.kind) || (zone.kind === 'hand' && zone.ownerSeatId === viewerSeatId)) continue;
    for (const card of zone.cards) if (!shown.has(card.instanceId)) hidden.set(card.instanceId, card);
  }
  return hidden;
}

function isCardInstance(value: unknown): value is CardInstance {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Partial<CardInstance>;
  return typeof v.instanceId === 'string' && typeof v.definitionId === 'string' && typeof v.suit === 'string' && typeof v.rank === 'number';
}

// Visits every value inside `value`, with a readable path for the report.
function walk(value: unknown, visit: (v: unknown, path: string) => void, path: string): void {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, `${path}[${i}]`));
  else if (value !== null && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, visit, `${path}.${k}`);
}

// What `view` (as sent to `viewerSeatId`) gives away that it must not.
export function findViewLeaks(state: GameState, view: object, viewerSeatId: string): string[] {
  const leaks: string[] = [];
  if ('rng' in view) leaks.push(`${viewerSeatId}: the view carries the RNG state`);
  if ('log' in view) leaks.push(`${viewerSeatId}: the view carries the log, which is sent separately`);
  const generals = secretGeneralIds(state, viewerSeatId);
  const cards = hiddenCards(state, viewerSeatId);
  walk(
    view,
    (v, path) => {
      if (typeof v === 'string' && generals.has(v)) leaks.push(`${viewerSeatId}: ${path} names hidden General ${v}`);
      if (!isCardInstance(v)) return;
      const real = cards.get(v.instanceId);
      if (!real) return;
      if (v.definitionId !== HIDDEN) leaks.push(`${viewerSeatId}: ${path} shows hidden card ${v.instanceId} as ${v.definitionId}`);
      if (v.instanceId.includes(real.definitionId)) leaks.push(`${viewerSeatId}: ${path} hidden card id ${v.instanceId} names its card ${real.definitionId}`);
    },
    'view'
  );
  return leaks;
}

// What `events` (the log every seat sees) give away, judged against `state`,
// the state right after them.
export function findEventLeaks(state: GameState, events: readonly EngineEvent[]): string[] {
  const leaks: string[] = [];
  const generals = secretGeneralIds(state, null);
  const zoneKinds = new Map(state.zones.map((z) => [z.id, z.kind]));
  events.forEach((event, i) => {
    walk(
      event,
      (v, path) => {
        if (typeof v === 'string' && generals.has(v)) leaks.push(`log ${event.kind}: ${path} names hidden General ${v}`);
      },
      `events[${i}]`
    );
    if (event.kind === 'CardMovedEvent' && event.card) {
      const kind = zoneKinds.get(event.toZoneId);
      if (kind && !isFaceUpZoneKind(kind)) leaks.push(`log CardMovedEvent into ${event.toZoneId} shows ${event.card.definitionId}`);
    }
  });
  return leaks;
}

// Reshuffled cards were face up in the discard pile: under their old ids,
// everyone would know the new draw pile's order and what each seat draws.
export function findReshuffleLeaks(prev: GameState, next: GameState): string[] {
  const events = next.log.slice(prev.log.length);
  if (!events.some((e) => e.kind === 'DiscardPileReshuffledEvent')) return [];
  const before = new Set(prev.zones.filter((z) => z.kind === 'discardPile').flatMap((z) => z.cards.map((c) => c.instanceId)));
  const inDrawPile = next.zones.filter((z) => z.kind === 'drawPile').flatMap((z) => z.cards.map((c) => c.instanceId));
  const drawn = events.flatMap((e) => (e.kind === 'CardsDrawnEvent' ? e.cardInstanceIds : []));
  return [...new Set([...inDrawPile, ...drawn])]
    .filter((id) => before.has(id))
    .map((id) => `reshuffled card ${id} kept the id it had in the discard pile`);
}

// Every leak one step (prev → next) causes, for every seat.
export function findStepLeaks(prev: GameState, next: GameState): string[] {
  const leaks: string[] = [];
  for (const seat of next.seats) {
    const { rng, log, ...view } = redactStateForSeat(next, seat.id);
    leaks.push(...findViewLeaks(next, view, seat.id));
  }
  leaks.push(...findEventLeaks(next, next.log.slice(prev.log.length)));
  leaks.push(...findReshuffleLeaks(prev, next));
  return leaks;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest projects/sim/src/leaks.spec.ts`
Expected: PASS (11 tests). If `redactStateForSeat` throws on the partial `table()` state, add only the missing field it reads to `table()` (for example `turn`), and don't change the checker.

- [ ] **Step 5: Commit**

```bash
git add projects/sim/src/leaks.ts projects/sim/src/leaks.spec.ts
git commit -m "test(sim): leak checker for seat views, the log and reshuffles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Opaque card ids at deck build

**Files:**
- Modify: `projects/engine/src/lib/cards/deck.ts:10-20`
- Test: `projects/engine/src/lib/cards/deck.spec.ts`

**Interfaces:**
- Produces: `buildDeck(entries, rng)` with an unchanged signature. `cards[i].instanceId === \`card-${i}\`` (position in the shuffled deck).

- [ ] **Step 1: Write the failing test**

Append inside `describe('buildDeck', …)` in `projects/engine/src/lib/cards/deck.spec.ts`:

```ts
  it('names each card by its place in the shuffled deck, so an id says nothing about the card', () => {
    const { cards } = buildDeck(entries(), createRng(1));
    expect(cards.map((c) => c.instanceId)).toEqual(['card-0', 'card-1', 'card-2', 'card-3']);
    for (const c of cards) expect(c.instanceId).not.toContain(c.definitionId);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest projects/engine/src/lib/cards/deck.spec.ts`
Expected: FAIL. The ids look like `sha-spade-1-0`.

- [ ] **Step 3: Implement**

Replace the body of `buildDeck` in `projects/engine/src/lib/cards/deck.ts`:

```ts
export function buildDeck(entries: DeckSpecEntry[], rng: RngState): { cards: CardInstance[]; rng: RngState } {
  const { items, rng: currentRng } = shuffle(entries, rng);
  // Ids are given after the shuffle, by place in the deck: a hidden card's id
  // must not tell anyone what the card is.
  const cards = items.map((entry, position) => ({
    instanceId: `card-${position}`,
    definitionId: entry.definitionId,
    suit: entry.suit,
    rank: entry.rank,
  }));
  return { cards, rng: currentRng };
}
```

- [ ] **Step 4: Run the deck test, then the whole suite**

Run: `npx jest projects/engine/src/lib/cards/deck.spec.ts`
Expected: PASS (3 tests).

Run: `npx jest`
Expected: all PASS. If a test elsewhere relied on the old id format (for example by matching an id prefix on a real dealt deck), change that test to look the card up by `definitionId`, never by its id, and say so in the commit message.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/cards/deck.ts projects/engine/src/lib/cards/deck.spec.ts
git commit -m "fix(engine): opaque card ids, so a masked card no longer names itself

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Fresh ids for reshuffled cards

**Files:**
- Modify: `projects/engine/src/lib/cards/zones.ts:106-117` (the reshuffle branch of `drawTop`)
- Test: `projects/engine/src/lib/cards/zones.spec.ts` (`describe('drawTop: reshuffle-on-exhaustion')`)

**Interfaces:**
- Produces: `drawTop` with an unchanged signature and return shape. Reshuffled cards come back named `r<counter>-<position>`, where `counter` is the RNG counter after one extra step taken just for naming.

- [ ] **Step 1: Write the failing tests and fix the one that pins old ids**

In `projects/engine/src/lib/cards/zones.spec.ts`, inside `describe('drawTop: reshuffle-on-exhaustion', …)`:

Replace the id assertion in the first test (`reshuffles discardPile into drawPile and completes the requested count…`). Change this:

```ts
      expect(drawn.map((c) => c.instanceId).every((id) => ['c1', 'd1', 'd2', 'd3'].includes(id))).toBe(true);
```

to this, because reshuffled cards are renamed and the check is now on what they are:

```ts
      expect(drawn.map((c) => c.definitionId).every((id) => ['c1', 'd1', 'd2', 'd3'].includes(id))).toBe(true);
```

Check that the file's `card(id)` helper sets `definitionId` to the same string as the id. If it doesn't, compare against the `definitionId`s it does set.

Then append these tests to the same `describe`:

```ts
    it('renames every reshuffled card, so its old face-up id tells nothing', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1'), card('d2'), card('d3')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const { zones: result, drawn } = drawTop(zones, 'draw', 'seat-a:hand', 1, createRng(1));
      const ids = [...drawn, ...result.find((z) => z.id === 'draw')!.cards].map((c) => c.instanceId);
      expect(ids).toHaveLength(3);
      for (const id of ids) expect(id).toMatch(/^r\d+-\d$/);
      expect(new Set(ids).size).toBe(3);
    });

    it('keeps the ids of cards held back in the discard pile', () => {
      const zones: CardZone[] = [
        { id: 'draw', kind: 'drawPile', cards: [] },
        { id: 'discard', kind: 'discardPile', cards: [card('d1'), card('d2')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      ];
      const { zones: result } = drawTop(zones, 'draw', 'seat-a:hand', 1, createRng(1), ['d2']);
      expect(result.find((z) => z.id === 'discard')!.cards.map((c) => c.instanceId)).toEqual(['d2']);
    });

    it('gives two one-card reshuffles different ids, though a one-card shuffle draws no randomness', () => {
      const first = drawTop(
        [
          { id: 'draw', kind: 'drawPile', cards: [] },
          { id: 'discard', kind: 'discardPile', cards: [card('d1')] },
          { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
        ],
        'draw',
        'seat-a:hand',
        1,
        createRng(1)
      );
      const discardAgain = first.zones.map((z) => (z.id === 'discard' ? { ...z, cards: [card('d2')] } : z));
      const second = drawTop(discardAgain, 'draw', 'seat-a:hand', 1, first.rng);
      expect(second.drawn[0].instanceId).not.toBe(first.drawn[0].instanceId);
    });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/cards/zones.spec.ts`
Expected: the three new tests FAIL, because ids are still `d1`… The edited first test passes.

- [ ] **Step 3: Implement**

In `projects/engine/src/lib/cards/zones.ts`, add `nextFloat` to the rng import (alongside `shuffle`), and replace the reshuffle block's shuffle lines:

```ts
      const shuffled = shuffle(reshuffling, currentRng);
      currentRng = shuffled.rng;
      reshuffled = reshuffling.length;
```

with:

```ts
      const shuffled = shuffle(reshuffling, currentRng);
      // Fresh ids: these cards were face up in the discard pile, so under their
      // old ids everyone would know the new pile's order. One extra RNG step
      // makes every reshuffle's counter its own, even a one-card shuffle's.
      const stamp = nextFloat(shuffled.rng);
      currentRng = stamp.rng;
      const renamed = shuffled.items.map((c, position) => ({ ...c, instanceId: `r${currentRng.counter}-${position}` }));
      reshuffled = reshuffling.length;
```

and in the `currentZones.map` just below, use `renamed` in place of `shuffled.items`:

```ts
        if (zone.id === fromZoneId) return { ...zone, cards: [...zone.cards, ...renamed] };
```

- [ ] **Step 4: Run the zones tests, then the whole suite**

Run: `npx jest projects/engine/src/lib/cards/zones.spec.ts`
Expected: PASS.

Run: `npx jest`
Expected: all PASS. The extra RNG step changes what happens after a reshuffle for a given seed. If a test pinned an exact outcome after a reshuffle, update its expected value only after confirming the new outcome is still legal play. Say so in the commit message.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/cards/zones.ts projects/engine/src/lib/cards/zones.spec.ts
git commit -m "fix(engine): reshuffled cards get fresh ids, so the new draw pile can't be tracked

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Leak property test over simulated games

**Files:**
- Create: `projects/sim/src/leakProperty.spec.ts`

**Interfaces:**
- Consumes: `findStepLeaks(prev, next)` (Task 1); `runGame(initial, ctx, botSeed, maxActions, botKind, onStep)` from `./runGame`; `createGame` from `engine`; `buildContentRegistry`, `kingdomWarMode`, `kingdomWarMaxSeats` from `content`.

- [ ] **Step 1: Write the test**

```ts
import { createGame } from 'engine';
import type { GameState } from 'engine';
import { buildContentRegistry, kingdomWarMaxSeats, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { findStepLeaks } from './leaks';

describe('property: no seat learns hidden information over simulated Kingdom War games', () => {
  it('no view, log event or reshuffle leaks, at any step, for any seat', () => {
    const registry = buildContentRegistry();
    const maxSeats = kingdomWarMaxSeats(registry);
    const seatCounts = [...new Set([2, 4, 7, maxSeats])].filter((n) => n <= maxSeats);
    const failures: string[] = [];
    let reshuffles = 0;
    for (const numSeats of seatCounts) {
      for (let seed = 1; seed <= 2; seed++) {
        const seatIds = Array.from({ length: numSeats }, (_, i) => `seat-${i}`);
        const initial = createGame(kingdomWarMode, registry, seatIds, seed * 100 + numSeats);
        const label = `seed ${seed * 100 + numSeats} (${numSeats} seats)`;
        let prev: GameState = initial;
        const record = (next: GameState) => {
          reshuffles += next.log.slice(prev.log.length).filter((e) => e.kind === 'DiscardPileReshuffledEvent').length;
          if (failures.length < 50) for (const leak of findStepLeaks(prev, next)) failures.push(`${label} turn ${next.turn.turnNumber}: ${leak}`);
          prev = next;
        };
        record(initial);
        runGame(initial, { registry, mode: kingdomWarMode }, seed * 7 + 1, 20000, 'rule-based', record);
      }
    }
    expect(failures).toEqual([]);
    // The reshuffle check only means something if some game reshuffled.
    expect(reshuffles).toBeGreaterThan(0);
  }, 600_000);
});
```

- [ ] **Step 2: Run it**

Run: `npx jest projects/sim/src/leakProperty.spec.ts`
Expected: PASS. Tasks 2 and 3 removed the id leaks, and the engine's redaction covers the rest.

If it reports a leak:
- **A real leak:** something the engine sends that a seat shouldn't know. Stop and report it with the failure line. Don't fix the engine in this task, because a fix may need a spec change.
- **A false positive in the checker:** for example, a General id that is also legitimately a skill id. Narrow that one check in `leaks.ts`, add a self-test for the case in `leaks.spec.ts`, and explain it in the commit message.

If `reshuffles` is 0, raise `maxActions` or add seeds until a game reshuffles, then keep those numbers.

- [ ] **Step 3: Commit**

```bash
git add projects/sim/src/leakProperty.spec.ts
git commit -m "test(sim): leak property over simulated games, every seat and step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Decision clock in the engine

**Files:**
- Create: `projects/engine/src/lib/rules/decisionClock.ts`
- Create: `projects/engine/src/lib/rules/decisionClock.spec.ts`
- Modify: `projects/engine/src/public-api.ts` (append an export)

**Interfaces:**
- Produces (exported from `engine`):
  - `DECISION_SECONDS` = `{ response: 60, choice: 60, discard: 60, selection: 300, play: 300 } as const`
  - `type DecisionKind = keyof typeof DECISION_SECONDS`
  - `interface DecisionSpec { kind: DecisionKind; seatId: string; key: string }`
  - `describeDecision(state: GameState, seatId: string, legal: readonly Action[], stepKey: string): DecisionSpec | null`. The keys are `selection:<seatId>` for General selection, `play:<turnNumber>:<ownerSeatId>` for the Play phase, and `step:<stepKey>` for everything else. The caller's `stepKey` names this exact state: the app uses a per-state key, and the server will use the action `seq`.
  - `interface RunningClock { decision: DecisionSpec; endsAt: number; totalMs: number }`
  - `interface ClockState { running: RunningClock | null; paused: Readonly<Record<string, number>> }`
  - `EMPTY_CLOCK: ClockState`
  - `switchClock(clock: ClockState, decision: DecisionSpec | null, now: number): ClockState`
  - `clockRemainingMs(clock: ClockState, now: number): number | null`
  - `expireClock(clock: ClockState): ClockState`

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/rules/decisionClock.spec.ts`:

```ts
import { Action } from '../pipeline/actions';
import { GameState } from '../domain/types';
import { DecisionSpec, EMPTY_CLOCK, clockRemainingMs, describeDecision, expireClock, switchClock } from './decisionClock';

const state = (fields: object): GameState =>
  ({ phase: 'Play', turn: { turnNumber: 3, ownerSeatId: 'seat-0' }, result: null, pendingResponse: null, ...fields }) as unknown as GameState;
const endPhase: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
const discard: Action = { kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'card-1' };

describe('describeDecision', () => {
  it('is null when the game is over or the seat has nothing to do', () => {
    expect(describeDecision(state({ result: { winners: [] } }), 'seat-0', [endPhase], 'k')).toBeNull();
    expect(describeDecision(state({}), 'seat-0', [], 'k')).toBeNull();
  });

  it('times a pending choice, selection or arrangement as a choice of this state', () => {
    for (const pending of [{ pendingChoice: {} }, { pendingSelection: {} }, { pendingArrangement: {} }]) {
      expect(describeDecision(state(pending), 'seat-1', [endPhase], 'k7')).toEqual({ kind: 'choice', seatId: 'seat-1', key: 'step:k7' });
    }
  });

  it('times a pending response as a response of this state', () => {
    expect(describeDecision(state({ pendingResponse: {} }), 'seat-1', [endPhase], 'k7')).toEqual({ kind: 'response', seatId: 'seat-1', key: 'step:k7' });
  });

  it('gives each seat one General selection clock', () => {
    expect(describeDecision(state({ phase: 'GeneralSelection' }), 'seat-2', [endPhase], 'k7')).toEqual({ kind: 'selection', seatId: 'seat-2', key: 'selection:seat-2' });
  });

  it('times discards as a discard of this state', () => {
    expect(describeDecision(state({ phase: 'Discard' }), 'seat-0', [discard], 'k7')).toEqual({ kind: 'discard', seatId: 'seat-0', key: 'step:k7' });
  });

  it('keeps one clock for a whole Play phase', () => {
    expect(describeDecision(state({}), 'seat-0', [endPhase], 'k7')).toEqual({ kind: 'play', seatId: 'seat-0', key: 'play:3:seat-0' });
    expect(describeDecision(state({}), 'seat-0', [endPhase], 'k8')?.key).toBe('play:3:seat-0');
  });

  it('falls back to a response clock outside those cases', () => {
    expect(describeDecision(state({ phase: 'Start' }), 'seat-0', [endPhase], 'k7')).toEqual({ kind: 'response', seatId: 'seat-0', key: 'step:k7' });
  });
});

describe('switchClock', () => {
  const play: DecisionSpec = { kind: 'play', seatId: 'seat-0', key: 'play:3:seat-0' };
  const response: DecisionSpec = { kind: 'response', seatId: 'seat-1', key: 'step:k9' };

  it('starts a new decision with its full budget', () => {
    const clock = switchClock(EMPTY_CLOCK, play, 1_000);
    expect(clock.running).toEqual({ decision: play, endsAt: 301_000, totalMs: 300_000 });
    expect(clockRemainingMs(clock, 1_000)).toBe(300_000);
  });

  it('keeps the same clock running when the decision keeps its key', () => {
    const started = switchClock(EMPTY_CLOCK, play, 1_000);
    const later = switchClock(started, { ...play, seatId: 'seat-0' }, 50_000);
    expect(later.running?.endsAt).toBe(301_000);
  });

  it('pauses a clock it switches away from and resumes it with the time it had left', () => {
    const started = switchClock(EMPTY_CLOCK, play, 0);
    const answering = switchClock(started, response, 100_000);
    expect(answering.paused).toEqual({ 'play:3:seat-0': 200_000 });
    expect(answering.running?.endsAt).toBe(160_000);
    const back = switchClock(answering, play, 130_000);
    expect(back.running?.endsAt).toBe(330_000);
    expect(back.paused).toEqual({ 'step:k9': 30_000 });
  });

  it('pauses when no decision is open', () => {
    const paused = switchClock(switchClock(EMPTY_CLOCK, play, 0), null, 10_000);
    expect(paused.running).toBeNull();
    expect(paused.paused).toEqual({ 'play:3:seat-0': 290_000 });
    expect(clockRemainingMs(paused, 10_000)).toBeNull();
  });

  it('never reports less than zero', () => {
    expect(clockRemainingMs(switchClock(EMPTY_CLOCK, response, 0), 999_999)).toBe(0);
  });

  it('forgets an expired clock without pausing it', () => {
    const expired = expireClock(switchClock(EMPTY_CLOCK, response, 0));
    expect(expired.running).toBeNull();
    expect(expired.paused).toEqual({});
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/rules/decisionClock.spec.ts`
Expected: FAIL with "Cannot find module './decisionClock'".

- [ ] **Step 3: Implement**

Create `projects/engine/src/lib/rules/decisionClock.ts`:

```ts
import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';

// Seconds per kind of decision.
export const DECISION_SECONDS = {
  response: 60,
  choice: 60,
  discard: 60,
  selection: 300,
  // One budget for a whole Play phase, paused while a response is under way.
  play: 300,
} as const;

export type DecisionKind = keyof typeof DECISION_SECONDS;

// A decision a seat must make. Same key = same clock: a Play phase keeps one
// key across its actions, and General selection one per seat.
export interface DecisionSpec {
  kind: DecisionKind;
  seatId: string;
  key: string;
}

// What `seatId` must decide in `state`, or null. `stepKey` names this exact
// state for the decisions that get a clock each (the caller picks it: the app
// a per-state key, a server the action count).
export function describeDecision(state: GameState, seatId: string, legal: readonly Action[], stepKey: string): DecisionSpec | null {
  if (state.result || legal.length === 0) return null;
  const step = (kind: DecisionKind): DecisionSpec => ({ kind, seatId, key: `step:${stepKey}` });
  if (state.pendingChoice || state.pendingSelection || state.pendingArrangement) return step('choice');
  if (state.pendingResponse) return step('response');
  if (state.phase === 'GeneralSelection') return { kind: 'selection', seatId, key: `selection:${seatId}` };
  if (legal.some((a) => a.kind === 'DiscardCardAction')) return step('discard');
  if (state.phase === 'Play') return { kind: 'play', seatId, key: `play:${state.turn.turnNumber}:${state.turn.ownerSeatId}` };
  return step('response');
}

export interface RunningClock {
  decision: DecisionSpec;
  endsAt: number;
  totalMs: number;
}

// The running clock, and the time left on paused ones by key. Plain data:
// callers pass the time, so this holds no timers.
export interface ClockState {
  running: RunningClock | null;
  paused: Readonly<Record<string, number>>;
}

export const EMPTY_CLOCK: ClockState = { running: null, paused: {} };

// Moves the clock to `decision` (null: none open) at time `now`. The same key
// keeps running; any other running clock pauses with what it had left, and a
// paused clock resumes with what it had left.
export function switchClock(clock: ClockState, decision: DecisionSpec | null, now: number): ClockState {
  const running = clock.running;
  if (decision && running && decision.key === running.decision.key) return { ...clock, running: { ...running, decision } };
  const paused: Record<string, number> = { ...clock.paused };
  if (running) paused[running.decision.key] = Math.max(0, running.endsAt - now);
  if (!decision) return { running: null, paused };
  const totalMs = DECISION_SECONDS[decision.kind] * 1000;
  const remainingMs = paused[decision.key] ?? totalMs;
  delete paused[decision.key];
  return { running: { decision, endsAt: now + remainingMs, totalMs }, paused };
}

export function clockRemainingMs(clock: ClockState, now: number): number | null {
  return clock.running ? Math.max(0, clock.running.endsAt - now) : null;
}

// The running clock ran out: it is done, not paused.
export function expireClock(clock: ClockState): ClockState {
  return { ...clock, running: null };
}
```

Append to `projects/engine/src/public-api.ts`:

```ts
export * from './lib/rules/decisionClock';
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx jest projects/engine/src/lib/rules/decisionClock.spec.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/rules/decisionClock.ts projects/engine/src/lib/rules/decisionClock.spec.ts projects/engine/src/public-api.ts
git commit -m "feat(engine): decision clock as pure functions, for the app and a server

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `defaultActionsFor` in the engine

**Files:**
- Create: `projects/engine/src/lib/rules/defaultActions.ts`
- Create: `projects/engine/src/lib/rules/defaultActions.spec.ts`
- Modify: `projects/engine/src/public-api.ts` (append an export)

**Interfaces:**
- Consumes: `discardOwed(state, seatId)` from `./phaseSequence`.
- Produces (exported from `engine`): `defaultActionsFor(state: GameState, legal: readonly Action[]): Action[]`. This is today's app `defaultDecision`, moved unchanged.

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/rules/defaultActions.spec.ts`:

```ts
import { Action } from '../pipeline/actions';
import { GameState } from '../domain/types';
import { defaultActionsFor } from './defaultActions';

const turn = { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] };
const state = (fields: object = {}): GameState => ({ turn, ...fields }) as unknown as GameState;

describe('defaultActionsFor', () => {
  it('an arrangement times out with every card on top, as given', () => {
    const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
    const s = state({ pendingArrangement: { id: 'arr', seatId: 'seat-0', cardInstanceIds: ['t1', 't2'] } });
    expect(defaultActionsFor(s, [template])).toEqual([{ ...template, top: ['t1', 't2'], bottom: [] }]);
  });

  it('cancels a selection that may be cancelled', () => {
    const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's' };
    const select: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's', ids: [] };
    expect(defaultActionsFor(state({ pendingSelection: { eligibleIds: ['a'], min: 1 } }), [select, cancel])).toEqual([cancel]);
  });

  it('else picks the first eligible ids a selection needs', () => {
    const select: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's', ids: [] };
    expect(defaultActionsFor(state({ pendingSelection: { eligibleIds: ['a', 'b', 'c'], min: 2 } }), [select])).toEqual([{ ...select, ids: ['a', 'b'] }]);
  });

  it('declines an ask, else takes the first option', () => {
    const opt = (optionId: string): Action => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c', optionId });
    expect(defaultActionsFor(state(), [opt('x'), opt('decline')])).toEqual([opt('decline')]);
    expect(defaultActionsFor(state(), [opt('x'), opt('y')])).toEqual([opt('x')]);
  });

  it('answers No Response', () => {
    const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r' };
    const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r', cardInstanceId: 'card-1' };
    expect(defaultActionsFor(state(), [respond, pass])).toEqual([pass]);
  });

  it('takes the first General pair', () => {
    const pair = (mainId: string): Action => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId: 'd' });
    expect(defaultActionsFor(state(), [pair('a'), pair('b')])).toEqual([pair('a')]);
  });

  it('else ends the phase', () => {
    const end: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
    const play: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [] };
    expect(defaultActionsFor(state(), [play, end])).toEqual([end]);
  });
});
```

(The discard default reads hand limits from a full game state. The app's existing `DecisionTimer` test "discards the UI’s chosen cards when the Discard phase times out, else the first ones" covers it end to end after Task 7.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/rules/defaultActions.spec.ts`
Expected: FAIL with "Cannot find module './defaultActions'".

- [ ] **Step 3: Implement (moved verbatim from the app, then renamed)**

Create `projects/engine/src/lib/rules/defaultActions.ts`:

```ts
import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';
import { discardOwed } from './phaseSequence';

// What a timeout submits when nobody has said: Cancel or the first picks for
// a selection, every card on top for an arrangement, Don't for an ask, the
// first option of a choice, No Response, the first General pair, the first
// discards, else End Phase. Several actions for a discard: submit them as one.
export function defaultActionsFor(state: GameState, legal: readonly Action[]): Action[] {
  const arrange = legal.find((a): a is Extract<Action, { kind: 'ArrangeCardsAction' }> => a.kind === 'ArrangeCardsAction');
  if (arrange && state.pendingArrangement) return [{ ...arrange, top: [...state.pendingArrangement.cardInstanceIds], bottom: [] }];
  // A selection: Cancel when it may be, else the first eligible picks.
  const cancel = legal.find((a) => a.kind === 'CancelSelectionAction');
  if (cancel) return [cancel];
  const select = legal.find((a): a is Extract<Action, { kind: 'SelectAction' }> => a.kind === 'SelectAction');
  if (select && state.pendingSelection) return [{ ...select, ids: state.pendingSelection.eligibleIds.slice(0, state.pendingSelection.min) }];
  // An ask (or "let them draw"): Don't.
  const decline = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'decline');
  if (decline) return [decline];
  const pick = legal.find((a) => a.kind === 'ChooseOptionAction');
  if (pick) return [pick];
  const pass = legal.find((a) => a.kind === 'PassAction');
  if (pass) return [pass];
  const generals = legal.find((a) => a.kind === 'ChooseGeneralsAction');
  if (generals) return [generals];
  const discards = legal.filter((a) => a.kind === 'DiscardCardAction');
  if (discards.length > 0) return discards.slice(0, discardOwed(state, state.turn.ownerSeatId));
  const endPhase = legal.find((a) => a.kind === 'EndPhaseAction');
  return [endPhase ?? legal[0]];
}
```

Append to `projects/engine/src/public-api.ts`:

```ts
export * from './lib/rules/defaultActions';
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx jest projects/engine/src/lib/rules/defaultActions.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/rules/defaultActions.ts projects/engine/src/lib/rules/defaultActions.spec.ts projects/engine/src/public-api.ts
git commit -m "feat(engine): defaultActionsFor, the timeout defaults, moved from the app

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rewire `DecisionTimer` onto the engine

**Files:**
- Modify: `projects/app/src/app/decision-timer.service.ts` (whole file)
- Modify: `projects/app/src/app/decision-timer.service.spec.ts` (import line; remove the `describe('defaultDecision', …)` block, now in the engine)

**Interfaces:**
- Consumes: from `engine`: `ClockState`, `DecisionSpec`, `EMPTY_CLOCK`, `switchClock`, `clockRemainingMs`, `expireClock`, `describeDecision`, `defaultActionsFor` (Tasks 5–6).
- Produces: `DecisionTimer` with an unchanged public API (`secondsLeft`, `totalSeconds`, `attach(destroyRef)`, `setTimeoutChoice(actions)`). The service no longer exports `DECISION_SECONDS` or `defaultDecision`; import them from `engine`.

- [ ] **Step 1: Point the existing tests at the engine**

In `projects/app/src/app/decision-timer.service.spec.ts`, replace the import lines:

```ts
import { Action, GameState, cardsOverHandLimit } from 'engine';
import { DECISION_SECONDS, DecisionTimer, defaultDecision } from './decision-timer.service';
```

with:

```ts
import { DECISION_SECONDS, GameState, cardsOverHandLimit } from 'engine';
import { DecisionTimer } from './decision-timer.service';
```

Delete the whole `describe('defaultDecision', () => { … });` block at the end of the file. Its case now lives in `projects/engine/src/lib/rules/defaultActions.spec.ts`. If `Action` is still used elsewhere in the file, keep it in the engine import.

- [ ] **Step 2: Run the app timer tests to see the current state**

Run: `npx jest projects/app/src/app/decision-timer.service.spec.ts`
Expected: PASS. The service still has its own copies, and `DECISION_SECONDS` from the engine has the same values. This is the baseline the rewrite must keep.

- [ ] **Step 3: Rewrite the service onto the engine**

Replace `projects/app/src/app/decision-timer.service.ts` with:

```ts
import { DestroyRef, Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Action, ClockState, DecisionSpec, EMPTY_CLOCK, GameState, clockRemainingMs, defaultActionsFor, describeDecision, expireClock, switchClock } from 'engine';
import { GameService } from './game.service';

interface Decision {
  spec: DecisionSpec;
  state: GameState;
}

// Times every decision a person makes. The clock runs only while a game board
// is on screen and the deciding seat's view is showing (in pass-and-play,
// after the hand-off gate); bots are never timed. The engine says which clock
// a decision runs on and how long it has (describeDecision, switchClock):
//   - Responses, choices and discards: a clock per decision.
//   - General selection: one clock per player for their whole choice.
//   - The Play phase: one clock for the phase.
// Any clock pauses whenever its decision isn't on screen (a response under
// way, the pass-and-play gate, the board left for another page) and resumes
// with the time it had left.
// At zero the timer submits the UI's current pick if it gave one, else the
// engine's default (defaultActionsFor).
@Injectable({ providedIn: 'root' })
export class DecisionTimer {
  private readonly game = inject(GameService);
  private readonly boards = signal(0);
  private interval: ReturnType<typeof setInterval> | null = null;
  private clock: ClockState = EMPTY_CLOCK;
  // The state the running clock is for: a timeout acts only if it still is.
  private clockState: GameState | null = null;
  private choice: { state: GameState; actions: Action[] } | null = null;
  private stateKeys = new WeakMap<GameState, string>();
  private nextKey = 0;

  private readonly _secondsLeft = signal<number | null>(null);
  private readonly _totalSeconds = signal<number | null>(null);
  // Whole seconds left on the current decision, or null when nothing is timed.
  readonly secondsLeft: Signal<number | null> = this._secondsLeft.asReadonly();
  // The current clock's full length, for the countdown bar.
  readonly totalSeconds: Signal<number | null> = this._totalSeconds.asReadonly();

  // What a person must decide now, or null.
  private readonly decision = computed<Decision | null>(() => {
    if (this.boards() === 0) return null;
    const state = this.game.state();
    const seatId = this.game.activeSeatId();
    if (!state || !seatId) return null;
    if (this.game.revealedSeatId() !== seatId) return null; // behind the gate, or a bot to move
    const spec = describeDecision(state, seatId, this.game.legalActions(), this.keyOf(state));
    // Keys are per game, so nothing paused in one game resumes in the next.
    return spec && { spec: { ...spec, key: `${this.game.gameNumber()}:${spec.key}` }, state };
  });

  constructor() {
    // A new game: nothing paused carries over.
    effect(() => {
      this.game.gameNumber();
      untracked(() => (this.clock = { ...this.clock, paused: {} }));
    });
    effect(() => {
      const decision = this.decision();
      untracked(() => this.switchTo(decision));
    });
    inject(DestroyRef).onDestroy(() => this.stopTicking());
  }

  // A game board registers while it is on screen; the clock pauses otherwise.
  attach(destroyRef: DestroyRef): void {
    this.boards.update((n) => n + 1);
    destroyRef.onDestroy(() => this.boards.update((n) => n - 1));
  }

  // What to submit if time runs out on this very state (e.g. the cards ticked
  // so far in the Discard dialog). Ignored once the state has moved on.
  setTimeoutChoice(actions: Action[]): void {
    const state = this.game.state();
    this.choice = state ? { state, actions } : null;
  }

  private keyOf(state: GameState): string {
    let key = this.stateKeys.get(state);
    if (!key) {
      key = `decision:${this.nextKey++}`;
      this.stateKeys.set(state, key);
    }
    return key;
  }

  private switchTo(decision: Decision | null): void {
    const sameClock = !!decision && this.clock.running?.decision.key === decision.spec.key;
    this.clock = switchClock(this.clock, decision?.spec ?? null, Date.now());
    this.clockState = decision?.state ?? null;
    // Same Play phase, new state (a card played): the clock just keeps going.
    if (sameClock) return;
    this.stopTicking();
    const running = this.clock.running;
    if (!running) {
      this._secondsLeft.set(null);
      this._totalSeconds.set(null);
      return;
    }
    this._totalSeconds.set(running.totalMs / 1000);
    this._secondsLeft.set(Math.ceil((running.endsAt - Date.now()) / 1000));
    this.interval = setInterval(() => this.tick(), 250);
  }

  private tick(): void {
    const leftMs = clockRemainingMs(this.clock, Date.now());
    if (leftMs === null) return;
    const left = Math.ceil(leftMs / 1000);
    this._secondsLeft.set(left);
    if (left > 0) return;
    this.stopTicking();
    this.clock = expireClock(this.clock);
    const state = this.clockState;
    if (!state || this.game.state() !== state) return;
    const chosen = this.choice?.state === state ? this.choice.actions : null;
    this.game.submitAll(chosen ?? defaultActionsFor(state, this.game.legalActions()));
  }

  private stopTicking(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

- [ ] **Step 4: Run the app timer tests and the board tests**

Run: `npx jest projects/app/src/app/decision-timer.service.spec.ts projects/app/src/app/game-board`
Expected: all PASS, with the same test names as in Step 2.

If a timer test fails, compare the behaviour with the old file (`git show main:projects/app/src/app/decision-timer.service.ts`). The rewrite must match it exactly, so fix the rewrite, not the test.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/decision-timer.service.ts projects/app/src/app/decision-timer.service.spec.ts
git commit -m "refactor(app): DecisionTimer runs on the engine's clock and timeout defaults

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs and full verification

**Files:**
- Modify: `docs/architecture/backend-and-deployment.md` (section "Visibility: what has to change first")

- [ ] **Step 1: Update the architecture doc**

In `docs/architecture/backend-and-deployment.md`, under "### Visibility: what has to change first", add a third numbered item after item 2:

```markdown
3. **Card ids must not name cards.** Done in backend Stage 1: the deck names
   each card `card-<position>` after the shuffle, and a reshuffle gives every
   reshuffled card a fresh `r<counter>-<position>` id, so neither a masked
   card nor the draw-pile order can be read from ids. `projects/sim/src/leaks.ts`
   checks views, the log and reshuffles over simulated games.
```

Change item 2's last sentence ("…using the same invariants-and-property approach as the simulator.") to end with " (now `projects/sim/src/leakProperty.spec.ts`)." Then, in "### Clocks and bots", replace "`DecisionTimer` (client UI state today) moves to the server" with "The decision clock (`describeDecision`, `switchClock`) and the timeout defaults (`defaultActionsFor`) are engine functions, so the server runs the same clock".

- [ ] **Step 2: Run the whole test suite**

Run: `npx jest`
Expected: all projects PASS.

- [ ] **Step 3: Build the libraries and the app**

Run: `npm run build && npx ng build app`
Expected: all three builds succeed, with no type errors.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/backend-and-deployment.md
git commit -m "docs: backend doc notes opaque card ids, the leak check and the engine clock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand off**

Report the branch name, the commit list (`git log --oneline main..HEAD`), and the test and build results. Merging follows `superpowers:finishing-a-development-branch`. After the merge, ask whether to delete the branch.
