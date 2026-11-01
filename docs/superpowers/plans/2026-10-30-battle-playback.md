# Battle Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play each batch of new log events on the board as a paced, animated sequence, with the board showing the moment being animated, local games waiting for it, and online games catching up.

**Architecture:** A board-scoped `PlaybackDirector` turns new log events into beats (from a registry keyed by event kind) and folds them one by one into a `displayedState` the board renders. A root `PlaybackGate` publishes whether playback is idle, so `GameService` (bots) and `DecisionTimer` wait without importing presentation code. A `PlaybackLayer` overlay draws flights, lines, callouts, the caption and the banner from the director's current beat. The engine gains one public event, `ResponsePassedEvent`, behind a `logPasses` rule.

**Tech Stack:** Angular (standalone components, signals), TypeScript, Jest (`jest-preset-angular`, fake timers), Web Animations API, the engine/content/server packages in `projects/`.

**Spec:** `docs/superpowers/specs/2026-10-30-battle-playback-design.md`

## Global Constraints

- No rules in the app: the fold and the beats replay only what an event records (CLAUDE.md).
- Beats come from a registry keyed by event kind, not a switch over event kinds (CLAUDE.md extensibility).
- Every visible string is a catalog key in `i18n/en.ts` and `i18n/vi.ts` (Vietnamese as a draft, reported by `npm run i18n:status`), and follows CLAUDE.md's casing rules.
- Never show a card face the viewer's redacted state does not show.
- Speeds: Slow ×0.5, Normal ×1, Fast ×2, Instant (every beat 0 ms). Remembered in `localStorage`. Reduced motion means Instant unless the player picked a speed.
- Online catch-up: rush so the remaining beats finish in about 1000 ms when the viewer owes a decision. Cap: speed up while more than 4000 ms of beats are queued at the chosen speed.
- Bot delay after playback: 600 ms, or 1500 ms at Instant.
- Gap between batches (one `resolve` call each): 350 ms at Normal.
- Games restored on the server must replay with unchanged state hashes.
- `npm run verify` and `npm test` pass at the end of every task.

## Review Focus

1. **A new game, or a reload, while beats are queued:** nothing old plays, the queue empties, and the gate goes back to idle (Task 6 test "resets on a new game").
2. **The board destroyed mid-sequence (leaving the page):** the gate must return to idle, or bots and the timer stall forever (Task 6 test "releases the gate on destroy").
3. **An event arrives for a seat or zone the displayed state doesn't have** (redacted, or a General Selection state): the fold must skip it, not throw (Task 5 test "ignores unknown zones and seats").
4. **The game ends mid-sequence:** the Game Over window opens only after the last beat, and the music switches to the win track then, not before (Task 8 test "waits for playback before Game Over").
5. **A 12-seat Barbarians online with a Slow setting:** the cap brings the queue under 4 s, and a decision rushes it (Task 6 tests for `paceFactor`).

---

### Task 1: Engine: `ResponsePassedEvent` behind `logPasses`

**Files:**
- Modify: `projects/engine/src/lib/pipeline/events.ts` (add the event and add it to `EngineEvent`)
- Modify: `projects/engine/src/lib/domain/types.ts` (`GameRules.logPasses?: boolean`; `PendingResponse.announcePass?: true`)
- Modify: `projects/engine/src/lib/pipeline/resolve.ts:590-596` (`case 'PassAction'`)
- Modify: `projects/content/src/lib/cards/sha.ts`, `duel.ts`, `mass-attack.ts`, `coerce.ts` (set `announcePass: true` on their windows)
- Test: `projects/engine/src/lib/pipeline/resolve.spec.ts`, `projects/content/src/lib/cards/sha.spec.ts` (or the cards' existing spec files)

**Interfaces:**
- Produces: `interface ResponsePassedEvent { kind: 'ResponsePassedEvent'; seatId: string; pendingResponseId: string; allowedCardIds?: string[] }`
- Produces: `GameRules.logPasses?: boolean`, `PendingResponse.announcePass?: true`

Why a content flag: only content knows whether a window is asked whatever the seat holds. Wuxie, counter-Wuxie, dying and skill windows never set it, so their passes stay unlogged (spec section 6).

- [ ] **Step 1: Write the failing engine tests**

In `resolve.spec.ts`, using a state with a pending response:
- `logs ResponsePassedEvent for an announced window when logPasses is on`: `rules: { logPasses: true }`, `pendingResponse.announcePass: true`, `allowedCardIds: ['shan']`; after `PassAction` the new events equal `[{ kind: 'ResponsePassedEvent', seatId: 'b', pendingResponseId: <id>, allowedCardIds: ['shan'] }]`, followed by whatever the window's effect logs.
- `logs nothing for a pass when logPasses is off`: the same, without the rule; no `ResponsePassedEvent` in the log.
- `logs nothing for a window without announcePass`: `logPasses: true`, no `announcePass`; no `ResponsePassedEvent`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/pipeline/resolve.spec.ts -t ResponsePassedEvent`
Expected: FAIL. The event is never logged.

- [ ] **Step 3: Implement**

In `case 'PassAction'`, when `state.rules?.logPasses && pending.announcePass`, append the event to `state.log` and return it in `events`. Add the event to `EngineEvent`. Leave the rest of the pipeline alone.

- [ ] **Step 4: Content windows announce their passes**

Add `announcePass: true` to the `pendingResponse` of: `shanWindow` (sha.ts), `duelWindow` (duel.ts), the `massAttack` window (mass-attack.ts, which covers Barbarians and Hail of Arrows), and Coerce's window (coerce.ts). Add one content test: Barbarians with `logPasses` on, the target passes, and the log has a `ResponsePassedEvent` for that seat with `allowedCardIds: ['sha']`.

- [ ] **Step 5: Run the engine and content tests**

Run: `npx jest projects/engine projects/content`
Expected: PASS. Existing snapshots and the simulator still pass, because no existing game sets `logPasses`.

- [ ] **Step 6: Document and commit**

Add a row for `ResponsePassedEvent` to the event list in `docs/architecture/event-chain.md`, saying it is logged only under `logPasses` and only for windows that announce passes.

```bash
git add projects/engine projects/content docs/architecture/event-chain.md
git commit -m "feat(engine): log ResponsePassedEvent for announced windows under the logPasses rule"
```

---

### Task 2: New games log passes; restored games are unchanged; Action History line

**Files:**
- Modify: `projects/app/src/app/game.service.ts:129-130` (add `logPasses: rules?.logPasses ?? true`)
- Modify: `projects/server/src/rooms/roomService.ts:435-436` (add `logPasses: true` beside `judgmentNotice: true`)
- Modify: `projects/app/src/app/game-board/action-history.ts` (a line for `ResponsePassedEvent`)
- Modify: `projects/app/src/app/i18n/en.ts`, `vi.ts`
- Test: `projects/server/src/game/engineGame.spec.ts`, `projects/app/src/app/game.service.spec.ts`, `projects/app/src/app/game-board/action-history.spec.ts`, `action-history.vi.spec.ts`

**Interfaces:**
- Consumes: `ResponsePassedEvent` and `GameRules.logPasses` from Task 1.
- Produces: catalog key `history.passed` = `'{seat} had no {card}'`. In Vietnamese, a draft: `'{seat} không có {card}'`.

- [ ] **Step 1: Write the failing tests**
- `engineGame.spec.ts` → `replays a game stored without logPasses with the same hashes`: build a game record with `rules: { judgmentNotice: true }` (no `logPasses`), play moves that include a pass in a Slash window, store the actions with their hashes, then expect `replay(ctx, record, stored, true)` not to throw, and expect the replayed log to contain no `ResponsePassedEvent`.
- `game.service.spec.ts` → `starts new games with logPasses on`: `service.startGame(2, 1, 'vs-bots')`, then expect `service.state()!.rules.logPasses` to be `true`.
- `action-history.spec.ts` → `describes a pass`: for a `ResponsePassedEvent` for `seat-1` with `allowedCardIds: ['shan']`, the line text is `'Seat 1 had no Dodge'`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/server/src/game/engineGame.spec.ts projects/app/src/app/game.service.spec.ts projects/app/src/app/game-board/action-history.spec.ts`
Expected: the rule and history tests FAIL. The replay test may already pass; it protects the deploy.

- [ ] **Step 3: Implement**

Turn the rule on in both places. Add the history case, naming the card with the existing card-name helper used for `CardPlayedEvent`, and `history.passed` in both catalogs.

- [ ] **Step 4: Run the tests, then `npm run verify`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: new games log passes; Action History says who had no answer"
```

---

### Task 3: The speed setting

**Files:**
- Create: `projects/app/src/app/playback-speed.service.ts`
- Modify: `projects/app/src/app/app.html` (a `button.playback-speed` with a `mat-menu`, after `button.effects-toggle`), `app.ts` (imports)
- Modify: `i18n/en.ts`, `i18n/vi.ts`
- Test: `projects/app/src/app/playback-speed.service.spec.ts`, `app.spec.ts`

**Interfaces:**
- Produces: `type PlaybackSpeedId = 'slow' | 'normal' | 'fast' | 'instant'`
- Produces: `@Injectable({ providedIn: 'root' }) class PlaybackSpeed { readonly speed: Signal<PlaybackSpeedId>; readonly factor: Signal<number>; set(id: PlaybackSpeedId): void }`. `factor` is 0.5, 1, 2, or `Infinity` for Instant (a duration is `ms / factor`, so Instant gives 0).
- Produces: catalog keys `nav.playbackSpeed` ('Playback Speed'), `speed.slow` ('Slow'), `speed.normal` ('Normal'), `speed.fast` ('Fast'), `speed.instant` ('Instant'). Vietnamese drafts in sentence case: 'Tốc độ diễn hoạt', 'Chậm', 'Bình thường', 'Nhanh', 'Tức thì'.

- [ ] **Step 1: Write the failing tests**
- `defaults to normal`; `remembers a choice` (after `set('fast')`, a new instance reads `'fast'` from `localStorage` key `playbackSpeed`); `falls back when storage throws`; `defaults to instant under reduced motion` (stub `matchMedia` to match `(prefers-reduced-motion: reduce)`); `a stored choice beats reduced motion`.
- `app.spec.ts`: extend the right-side order test with `'button.playback-speed'` after `'button.effects-toggle'`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/app/src/app/playback-speed.service.spec.ts projects/app/src/app/app.spec.ts`
Expected: FAIL, because the service and the button don't exist yet.

- [ ] **Step 3: Implement**

Follow the `readEnabled` and `writeEnabled` pattern in `music.service.ts` (try/catch around storage). Use `prefersReducedMotion()` from `game-board/beat-player.ts`. The menu shows the four speeds as radio-style items, with the current one ticked. Use icon `speed`.

- [ ] **Step 4: Run the tests and `npm run verify`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(app): playback speed setting in the toolbar"
```

---

### Task 4: The beat registry

**Files:**
- Create: `projects/app/src/app/game-board/playback/beats.ts`
- Test: `projects/app/src/app/game-board/playback/beats.spec.ts`

**Interfaces:**
- Produces:

```ts
export type BeatVisual =
  | { kind: 'turn'; seatId: string }
  | { kind: 'phase'; seatId: string; phase: Phase }
  | { kind: 'draw'; seatId: string; count: number }
  | { kind: 'play'; seatId: string; card: UsedCard; targetSeatIds: string[]; answersSeatId?: string; response: boolean }
  | { kind: 'pass'; seatId: string; cardId?: string }
  | { kind: 'move'; cardInstanceId: string; fromZoneId: string; toZoneId: string; card?: CardInstance }
  | { kind: 'damage'; seatId: string; amount: number; sourceSeatId?: string }
  | { kind: 'heal'; seatId: string; amount: number }
  | { kind: 'dying'; seatId: string }
  | { kind: 'saved'; seatId: string }
  | { kind: 'reveal'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'eliminated'; seatId: string }
  | { kind: 'ability'; seatId: string; abilityId: string };

export interface PlannedBeat { logIndex: number; event: EngineEvent; durationMs: number; visual: BeatVisual | null }

type BeatDefinition<E extends EngineEvent> = { durationMs: (event: E, context: BeatContext) => number; visual: (event: E, context: BeatContext) => BeatVisual | null };
export const BEATS: { [K in EngineEvent['kind']]?: BeatDefinition<Extract<EngineEvent, { kind: K }>> };

export const BATCH_GAP_MS = 350;
export interface BeatContext { zoneKindOf(zoneId: string): CardZone['kind'] | undefined; previous?: EngineEvent }
export function planBeat(event: EngineEvent, logIndex: number, context: BeatContext): PlannedBeat;
```

Durations at Normal, from the spec's table:

| Kind | `durationMs` |
|---|---|
| TurnAdvancedEvent | 1000 |
| PhaseChangedEvent | 250 |
| CardsDrawnEvent | 500 + 140 × cards |
| CardPlayedEvent | 900, +150 when there are more than 2 targets |
| ResponsePassedEvent | 700 |
| CardMovedEvent | 400 to a `discardPile` zone, 500 otherwise. A move out of a hand straight after its `CardPlayedEvent` is 0 (the play beat already flew it) |
| DamageDealtEvent, HpLostEvent | 900 |
| HealEvent | 800 |
| SeatDyingEvent | 900 |
| SeatSavedEvent | 300 |
| GeneralRevealedEvent | 700 |
| SeatEliminatedEvent | 1400 |
| AbilityUsedEvent | 700 |
| anything else | 0, visual `null` |

`BeatContext` supplies what the event alone doesn't say: a zone's kind, and the event before it. `BeatDefinition` functions take `(event, context)`.

`answersSeatId` comes from `CardPlayedEvent.inResponseTo?.seatId`, or `dyingSeatId` for a Peach. `response` is `!!inResponseTo`.

- [ ] **Step 1: Write the failing tests**

One test per row of the table, asserting `durationMs` and `visual.kind`. Also:
- `an unknown event kind gets a 0 ms beat with no visual`, using `{ kind: 'ChainToggledEvent', ... }`;
- `a fan-out to five targets lists them all`;
- `a Dodge answering a Slash names the Slash's user in answersSeatId`;
- `a hand-to-discard move straight after its play takes 0 ms`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/app/src/app/game-board/playback/beats.spec.ts`
Expected: FAIL, because the module doesn't exist yet.

- [ ] **Step 3: Implement `BEATS` and `planBeat`**

`planBeat` looks up `BEATS[event.kind]` and falls back to `{ durationMs: 0, visual: null }`.

- [ ] **Step 4: Run the tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/playback && git commit -m "feat(app): beat registry for battle playback"
```

---

### Task 5: The displayed-state fold

**Files:**
- Create: `projects/app/src/app/game-board/playback/displayed-state.ts`
- Test: `projects/app/src/app/game-board/playback/displayed-state.spec.ts`

**Interfaces:**
- Produces: `export function foldEvent(state: GameState, event: EngineEvent, target: GameState): GameState`
  - `state`: the displayed state so far. `target`: the latest visible state, which is the source of card faces and General identities. Pure: it never mutates either argument.
  - It does not touch `log`. The director sets `log` to `target.log.slice(0, n)`.

What it folds (only what each event records):

| Event | Change |
|---|---|
| DamageDealtEvent | `combinedHp -= damage.amount` on `damage.target.seatId` |
| HpLostEvent | `combinedHp -= amount` |
| HealEvent | `combinedHp += amount` on `target.seatId` |
| MaxHpReducedEvent | `maxCombinedHp = event.maxHp`; `combinedHp = min(combinedHp, maxHp)` |
| CardMovedEvent | remove `cardInstanceId` from `fromZoneId`; add to `toZoneId` the card as `target` shows it in any zone, else `event.card`, else a masked copy (`definitionId: 'hidden'`) |
| CardsDrawnEvent | move each id from the `drawPile` zone to the seat's hand zone, with the face as above |
| SeatEliminatedEvent | `eliminated = true` |
| GeneralRevealedEvent, GeneralHiddenEvent | copy that seat's `generals` from `target` |
| TurnAdvancedEvent | `turn.ownerSeatId = seatId` |
| PhaseChangedEvent | `phase = event.phase` |
| anything else | unchanged |

Dying needs no field: the board's `isSeatDying` already reads `combinedHp`.

- [ ] **Step 1: Write the failing tests**
- `damage lowers HP on the target only`;
- `heal raises HP`;
- `a move to the discard pile takes the face from the event`;
- `a draw into the viewer's hand takes faces from the target state`;
- `a draw into another seat's hand stays hidden`: the target state already masks it, so expect `definitionId: 'hidden'`;
- `ignores unknown zones and seats` (Review Focus 3): a `CardMovedEvent` naming a zone that is not in the state returns an equal state and does not throw;
- `folding every event of a resolve call reaches the target's HP, hand counts, discard pile and eliminated flags`: build a real game with `createGame`, `resolve` a Slash that hits (`logPasses` on), fold `log.slice(before)` onto the redacted before-state, and compare those fields with the redacted after-state.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/app/src/app/game-board/playback/displayed-state.spec.ts`
Expected: FAIL, because the module doesn't exist yet.

- [ ] **Step 3: Implement `foldEvent`**

A per-kind table like `BEATS` (a `FOLDS` record keyed by event kind), not a switch.

- [ ] **Step 4: Run the tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(app): fold played events into the displayed state"
```

---

### Task 6: `PlaybackGate`, pace maths and `PlaybackDirector`

**Files:**
- Create: `projects/app/src/app/playback-gate.service.ts`
- Create: `projects/app/src/app/game-board/playback/pace.ts`
- Create: `projects/app/src/app/game-board/playback/playback-director.ts`
- Modify: `projects/app/src/app/online/remote-game.service.ts` (add `clockWaitsForPlayback` and `lastMoveStart` to `BoardGame` and implement them)
- Modify: `projects/app/src/app/game.service.ts` (implement both; see Task 7 for `lastMoveStart`; here it may return `null`)
- Test: `pace.spec.ts`, `playback-director.spec.ts`

**Interfaces:**
- Produces: `@Injectable({ providedIn: 'root' }) class PlaybackGate { readonly idle: WritableSignal<boolean> }` (starts `true`).
- Produces in `pace.ts`: `export const RUSH_MS = 1000; export const CAP_MS = 4000;` and `export function paceFactor(queuedMs: number, speedFactor: number, opts: { catchUp: boolean; owesDecision: boolean }): number`. `queuedMs` is the queue's total at Normal. The return value is the divisor for every duration:
  - Instant (`speedFactor === Infinity`) → `Infinity`;
  - `!catchUp` → `speedFactor`;
  - `owesDecision` → `max(speedFactor, queuedMs / RUSH_MS)`;
  - otherwise → `max(speedFactor, queuedMs / CAP_MS)`.
- Produces: `BoardGame` gains `clockWaitsForPlayback: boolean` (`true` in `GameService`, `false` in `RemoteGameService`) and `lastMoveStart: Signal<GameState | null>` (`RemoteGameService`: always `null`).
- Produces: `@Injectable() class PlaybackDirector` (provided by `GameBoard`, so it is scoped to the board) with:
  - `readonly displayedState: Signal<GameState | null>`
  - `readonly current: Signal<PlannedBeat | null>`
  - `readonly idle: Signal<boolean>`
  - `readonly playedLogLength: Signal<number>`
  - `readonly centreStack: Signal<UsedCard[]>`: cards played into the current resolution. Cleared by the next non-response play, a `TurnAdvancedEvent`, or going idle.
  - `hold(): () => void`: pauses playback until the returned release is called (used by the local Compete popup).

Behaviour (each line is a test in `playback-director.spec.ts`, using `jest.useFakeTimers()` and a fake `BoardGame` built from signals):
- `sets a baseline on the first look and plays nothing`;
- `plays new events in order, each after its duration, and is idle after the last one plus BATCH_GAP_MS`;
- `displayedState shows HP dropping only when the damage beat starts`;
- `a batch arriving mid-sequence is appended to the queue`;
- `speed factor 2 halves every duration; Instant applies everything in one tick`;
- `writes idle to PlaybackGate`, and `releases the gate on destroy` (Review Focus 2);
- `resets on a new game`: the log shrinks, the queue empties, and the gate goes idle (Review Focus 1);
- `online: owing a decision rushes the rest into about RUSH_MS` (`clockWaitsForPlayback: false`, `legalActions` non-empty);
- `online: more than CAP_MS queued speeds up`;
- `hold() pauses until released`;
- `Pass and Play: while visibleState is null nothing plays; on reveal, plays from lastMoveStart's log length starting at lastMoveStart`;
- `displayedState equals visibleState whenever idle`.

`pace.spec.ts`: one test per branch of `paceFactor`. Also, for Review Focus 5, `twelve 900 ms beats at Slow with catch-up are capped to CAP_MS`: `paceFactor(10800, 0.5, { catchUp: true, owesDecision: false })` is `2.7`.

- [ ] **Step 1: Write `pace.spec.ts` and `playback-director.spec.ts` as listed**
- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/app/src/app/game-board/playback`
Expected: the new specs FAIL.

- [ ] **Step 3: Implement `PlaybackGate`, `paceFactor` and the `BoardGame` additions**
- [ ] **Step 4: Implement `PlaybackDirector`**

It injects `GameService` (which `OnlineGame` replaces with `RemoteGameService`), `PlaybackSpeed` and `PlaybackGate`. An `effect` on `visibleState` appends `planBeat` results for `log.slice(cursor)`, using as context the zone kinds of the latest visible state. A single `setTimeout` chain plays the queue: on each beat, set `current`, fold the event into `displayedState`, and wait `durationMs / paceFactor(...)`, recomputing the factor at every beat. Add `BATCH_GAP_MS` after the last beat of each batch. When the queue is empty, set `displayedState` to `visibleState` (reconcile), `current` to `null` and `idle` to `true`.

- [ ] **Step 5: Run the tests and `npm run verify`**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(app): playback director, gate and catch-up pacing"
```

---

### Task 7: Local games wait for playback

**Files:**
- Modify: `projects/app/src/app/game.service.ts` (`scheduleBotIfDue`, `botDelayMs`, `lastMoveStart`)
- Modify: `projects/app/src/app/decision-timer.service.ts` (the `decision` computed)
- Test: `game.service.spec.ts`, `decision-timer.service.spec.ts`

**Interfaces:**
- Consumes: `PlaybackGate`, `PlaybackSpeed`.
- Produces: `GameService.botDelayMs = 600`, `GameService.instantBotDelayMs = 1500`, and `GameService.lastMoveStart: Signal<GameState | null>`.

`lastMoveStart` is the full state from before the last successful `submit` or `submitAll`, redacted for `revealedSeatId`. It is set only in `pass-and-play`, and is `null` otherwise or with no revealed seat.

- [ ] **Step 1: Write the failing tests**
- `a bot waits while playback is busy`: set `gate.idle` to `false`, make a bot due, advance 10 s, and expect no bot move; then set `idle` to `true`, advance 600 ms, and expect the move.
- `the bot delay is 1500 ms at Instant`.
- `the decision clock does not start while playback is busy`: `secondsLeft()` stays `null` while not idle, then starts at full length.
- `lastMoveStart is the pre-move state redacted for the revealed seat in Pass and Play`, and `lastMoveStart is null in vs-bots`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/app/src/app/game.service.spec.ts projects/app/src/app/decision-timer.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`scheduleBotIfDue` sets the thinking seat but returns early while `!gate.idle()`. A constructor `effect` on `gate.idle()` calls `scheduleBotIfDue()` when it turns `true`. Existing tests that set `botDelayMs = 0` keep working at Normal speed.

`DecisionTimer.decision` returns `null` while `!gate.idle()`.

- [ ] **Step 4: Run the whole app suite and `npm run verify`**

Run: `npx jest projects/app`
Expected: PASS. If existing board tests now wait on a gate that never goes idle, the fix is that the director reconciles at once when no beats are queued. It is not to skip the gate in tests.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(app): bots and decision clocks wait for playback in local games"
```

---

### Task 8: The board renders the displayed state

**Files:**
- Modify: `projects/app/src/app/game-board/game-board.ts`
- Modify: `projects/app/src/app/game-board/round-table.ts` (the ribbon reads the played log; indicators follow the displayed state)
- Test: `game-board.spec.ts`

**Interfaces:**
- Consumes: `PlaybackDirector` (add it to `GameBoard`'s `providers`).
- Produces: none for later tasks beyond the director instance.

Changes:
- `visibleState` in the board becomes `director.displayedState`. The template and every computed that reads it follow automatically, including the Action History, the discard history, the ribbon (`round-table` receives the displayed state), `dyingOf` and `isResponding`.
- A board-level `legalActions = computed(() => director.idle() ? gameService.legalActions() : [])` replaces `this.gameService.legalActions()` everywhere in `game-board.ts`. That locks the hand, the action list, skill buttons and every `…Due` dialog until idle.
- The `thinkingSeatId` passed to `round-table` is `null` while not idle.
- The Game Over branch (`state.result`) and the win music wait for `director.idle()` (Review Focus 4).
- The sounds `effect` plays `soundsFor([beat.event])`, `voicesFor` and `deathSoundsFor` for each `director.current()` beat, instead of for a whole log slice.
- The Compete `effect` reads `director.displayedState().log` (the played log). Locally, it calls `director.hold()` when a Compete dialog opens and releases it when the dialog closes. Online (`!gameService.clockWaitsForPlayback`) it does not hold, and it closes the open Compete dialog when `gameService.legalActions()` becomes non-empty.
- The judgment popup's `judgmentView` reads the displayed state.

- [ ] **Step 1: Write the failing tests**
- `the hand is not playable while playback is busy`;
- `the response dialog opens only after playback`;
- `HP on the seat tile drops when the damage beat plays`;
- `waits for playback before Game Over` (Review Focus 4);
- `plays a sound with its beat, not with the batch`;
- `online: an open Compete popup closes when the viewer owes a decision`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/app/src/app/game-board/game-board.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the changes listed above**
- [ ] **Step 4: Run the app suite and `npm run verify`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(app): the board shows the displayed state and waits for playback"
```

---

### Task 9: Seat effects: impacts, callouts, spotlight

**Files:**
- Modify: `projects/app/src/app/game-board/seat-tile.ts` (new inputs and their CSS)
- Modify: `round-table.ts`, `game-board.ts` (pass the inputs from `director.current()`)
- Create: `projects/app/src/app/game-board/playback/seat-cues.ts` (pure: beat → per-seat cue)
- Modify: `i18n/en.ts`, `vi.ts`
- Test: `seat-cues.spec.ts`, `seat-tile.spec.ts`

**Interfaces:**
- Produces: `export interface SeatCue { impact?: 'hit' | 'heal'; floatText?: string; callout?: { text: Msg; tone: 'play' | 'red' | 'pass' }; involved: boolean; reveal?: boolean }` and `export function seatCues(beat: PlannedBeat | null, centre: { sourceSeatId?: string; targetSeatIds: string[] }): Record<string, SeatCue>`.
- `SeatTile` gains `cue = input<SeatCue | null>(null)` and `dimmed = input(false)`. The tile is dimmed when a resolution is in progress and its seat is not involved.
- Catalog keys: `cue.play` ('{card}!'), `cue.pass` ('No {card}'), `cue.help` ('Help!'), `cue.eliminated` ('Eliminated'). Vietnamese drafts: '{card}!', 'Không có {card}', 'Cứu với!', 'Bị loại'.

Visuals from the prototype: shake and red flash, "−N" floating up, the HP icon popping; a green glow and "+N"; a bubble above the tile; a greyed tile and an "Eliminated" stamp; a portrait flip on reveal. Under `prefers-reduced-motion` the CSS has no animation, only the end state.

- [ ] **Step 1: Write the failing tests**

`seat-cues.spec.ts`:
- a damage beat → `{ impact: 'hit', floatText: '−1' }` on the target;
- a play → `callout.text` is `cue.play` with the card name, on its user;
- a pass → `callout.tone` is `'pass'`;
- an ability beat → a callout with the skill's name (content's `abilityName`) on its owner;
- dying → `callout.text` is `cue.help` with tone `'red'`;
- `involved` is `true` for the source, the targets and the responder, and `false` for the rest.

`seat-tile.spec.ts`: `renders the callout text` and `adds the hit class for a hit cue`.

- [ ] **Step 2: Run them to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run the tests and `npm run verify`**
- [ ] **Step 5: Commit** with `feat(app): seat impacts, callouts and spotlight during playback`

---

### Task 10: The playback layer: flights, target lines, caption, banner

**Files:**
- Create: `projects/app/src/app/game-board/playback/playback-layer.ts` (a standalone component overlaid on the battlefield, `pointer-events: none`)
- Modify: `round-table.ts` (render `<app-playback-layer>` inside `.table`); `game-board.ts` (`data-seat-id` on `.your-seat` and on the hand section, so flights can find the viewer)
- Modify: `i18n/en.ts`, `vi.ts`
- Test: `playback-layer.spec.ts`

**Interfaces:**
- Consumes: `PlaybackDirector.current`, `centreStack`, `PlaybackSpeed.factor`.
- Catalog keys: `banner.turn` ("{seat}'s Turn", a title) and `banner.turnDetail` ('{general} · {force}'). The caption reuses the Action History line for the beat's event (`actionHistory` over the played log, last line).

Behaviour:
- **Flights:** Web Animations on a cloned `app-playing-card`. They go from the element with `[data-seat-id=…]`, or the hand for the viewer, to the centre stack, then from the centre to the Discard Pile when the stack clears. Draws fly as card backs from a Draw Pile point. A card moving to or from a hand shows its face only if the displayed state shows it.
- **Target lines:** an SVG with one curved path per target, stroke-dash drawn. A response greys the path to `answersSeatId`. The lines clear with the centre stack.
- **Caption:** one line above the centre, replaced each beat, with `aria-live="polite"`.
- **Turn banner:** on a `turn` visual.
- Durations come from the beat divided by the current factor. Under Instant or reduced motion there are no animations, and the end state shows at once.

- [ ] **Step 1: Write the failing tests**
- `renders a target path per target for a fan-out play`;
- `shows the caption for the current beat`;
- `shows the turn banner for a TurnAdvancedEvent beat`;
- `at Instant, no element is animated` (spy on `Element.prototype.animate`).

- [ ] **Step 2: Run them to verify they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run the tests and `npm run verify`**
- [ ] **Step 5: Manual look**

`npm start`, play vs bots with 6 seats at Normal and at Slow, and check against the prototype (https://claude.ai/artifact/ReswScaowdZKcE8U656SJE). Then play one online room with two browsers, one at Slow, and confirm the Slow one's dialogs open within about a second of its turn.

- [ ] **Step 6: Commit** with `feat(app): card flights, target lines, caption and turn banner`

---

### Task 11: Documentation

**Files:**
- Modify: `docs/architecture/frontend.md`: in "Events become presentation", add a "Battle playback" subsection covering the director, beats, the displayed state, the gate, the rush and cap, and the speed setting. Update the `GameService` section for `botDelayMs`, `lastMoveStart` and `clockWaitsForPlayback`. Update the "State: what the UI may keep" table to add the speed setting.

- [ ] **Step 1: Write the sections**
- [ ] **Step 2: `npm run verify` and `npm run i18n:status`** (the new Vietnamese keys are listed as drafts)
- [ ] **Step 3: Commit** with `docs: battle playback in the frontend architecture`
