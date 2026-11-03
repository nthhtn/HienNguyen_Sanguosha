# Server-Paced Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Online, the server paces bot moves and human decision clocks by the animation length of what just happened, so every player sees the same animations at the same pace.

**Architecture:** Beat durations move out of the presentation layer into one framework-free engine module that both the server and the client read. The server records when the latest batch of events finishes playing (`playbackUntil`) and starts a bot's move, or a human's clock, only after that time. The client's catch-up speed-up stays only as a backlog fallback.

**Tech Stack:** TypeScript, Angular signals (app), Node (server), Jest.

**Spec:** `docs/superpowers/specs/2026-11-03-server-paced-playback-design.md`

## Global Constraints

- Bot wait = batch animation time at Slow + 1500 ms thinking gap. It replaces the flat 2500 ms (`BOT_MOVE_DELAY_MS`).
- Slow playback factor is 0.5 (durations double). Shared as `SLOW_PLAYBACK_FACTOR`.
- A batch is the events appended by one commit, plus a 350 ms `BATCH_GAP_MS` at its end.
- A human may still act during the animation; only the clock's start moves.
- Engine stays headless and deterministic; no timers or browser APIs in it.
- Tests and simulation keep zero delay.
- UI text casing rules in CLAUDE.md apply to any visible text (this plan adds none).
- `npm run verify` and the Jest suites must pass; the agent never merges or pushes to `main`.

## Review Focus

- First turn of a game: the start hold and the batch animation overlap; the wait is the larger of the two, never the sum, and the client's "Game starts in" popup must not appear for an animation wait.
- A human who acts during the animation: the move is accepted (no `not_your_turn`), and only the clock start moved.
- A commit of many actions (a whole Discard phase is one commit): its events are summed once.
- A runner restored mid-game, or a reconnect: no `playbackUntil`, so no wait for animations nobody is playing.
- A judgment's lead-in and the same moment's beats: the wait takes the larger, so it is not counted twice.
- A bot-played human seat (taken over) is paced the same as a bot seat.

---

### Task 1: Shared beat durations

**Files:**
- Create: `projects/engine/src/lib/rules/playbackTiming.ts`, `projects/engine/src/lib/rules/playbackTiming.spec.ts`
- Modify: `projects/engine/src/public-api.ts` (export it), `projects/app/src/app/game-board/playback/beats.ts` (durations read from it; `BATCH_GAP_MS` re-exported from it so importers don't change), `projects/app/src/app/playback-speed.service.ts` (`slow` factor is `SLOW_PLAYBACK_FACTOR`)
- Test: `playbackTiming.spec.ts`; existing `beats.spec.ts` must stay green unchanged

**Interfaces:**
- Produces (all exported from `engine`):
  - `BATCH_GAP_MS = 350`, `SLOW_PLAYBACK_FACTOR = 0.5`
  - `interface BeatTimingContext { zoneKindOf(zoneId: string): CardZone['kind'] | undefined; previous?: EngineEvent }`
  - `beatDurationMs(event: EngineEvent, context: BeatTimingContext): number` (0 for a kind with no entry)
  - `batchPlaybackMs(events: readonly EngineEvent[], zoneKindOf: BeatTimingContext['zoneKindOf'], previous?: EngineEvent, factor = SLOW_PLAYBACK_FACTOR): number`: real milliseconds the batch takes at `factor`, rounded; 0 for no events; otherwise `(sum of beat durations + BATCH_GAP_MS) / factor`. `previous` is the event before the first one (the context for the first beat).

- [ ] **Step 1: Write the failing tests** in `playbackTiming.spec.ts`:
  - `beatDurationMs` of `TurnAdvancedEvent` is 1000, `PhaseChangedEvent` 250, `CardsDrawnEvent` with 2 cards 780, `CardPlayedEvent` with one target 900, `ResponsePassedEvent` 700, an event kind with no entry 0.
  - A `CardMovedEvent` straight after a `CardPlayedEvent` from a hand zone is 0; to a discard pile 400; elsewhere 500.
  - `batchPlaybackMs([turnAdvanced], zoneKindOf)` is 2700 at Slow and 1350 with `factor` 1; `batchPlaybackMs([], …)` is 0.
  - `batchPlaybackMs([phase, phase, draw2], …)` is `(250 + 250 + 780 + 350) / 0.5 = 3260`.
  - The first event's context uses `previous`.
- [ ] **Step 2: Run** `npx jest projects/engine/src/lib/rules/playbackTiming.spec.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the module. Copy the duration rules from `BEATS` in `beats.ts` unchanged (each kind's `durationMs`), keyed by event kind like `BEATS`.
- [ ] **Step 4: Point `beats.ts` at it.** Each `BEATS` entry keeps its `visual` and takes `durationMs` from the shared table; `PlannedBeat.durationMs` and `stepMs` are unchanged in behaviour. Make `PlaybackSpeed`'s `slow` factor `SLOW_PLAYBACK_FACTOR`.
- [ ] **Step 5: Run** `npx jest projects/engine projects/app/src/app/game-board/playback`. Expected: PASS, with no change to `beats.spec.ts`.
- [ ] **Step 6: Commit** `feat: share beat durations between server and client`

---

### Task 2: The server paces bots and human clocks

**Files:**
- Modify: `projects/protocol/src/limits.ts` (replace `BOT_MOVE_DELAY_MS` with `BOT_THINK_MS = 1500`), `projects/server/src/game/gameRunner.ts`, `projects/server/src/rooms/roomService.ts`, `projects/app/src/app/game.service.ts` (import `BOT_THINK_MS`)
- Test: `projects/server/src/game/gameRunner.spec.ts`, `projects/server/src/socket/gameSocket.spec.ts` (opt out of pacing)

**Interfaces:**
- Consumes: `batchPlaybackMs` from Task 1.
- Produces: `RunnerOptions.pacePlayback?: boolean` (default `true`); `RoomService` dep `pacePlayback?: boolean` (default `true`), passed through to the runner. `BOT_DELAY_MS` in `gameRunner.ts` stays as the name, now `= BOT_THINK_MS`.

- [ ] **Step 1: Make the existing runner and socket specs opt out.** `setup` in `gameRunner.spec.ts` and `setup` in `gameSocket.spec.ts` pass `pacePlayback: false`, so every existing timing assertion keeps its meaning. Run both specs. Expected: PASS before any behaviour change.
- [ ] **Step 2: Write the failing tests** in `gameRunner.spec.ts`, using a `pacePlayback: true` setup and `batchPlaybackMs` to compute expectations (never a literal):
  - `a bot moves BOT_DELAY_MS after the animation of the batch before it`: after a commit whose events are `E`, the bot has not moved at `batchPlaybackMs(E, …) + BOT_DELAY_MS - 1` and has at `+ 0`.
  - `the bot clock's startsAt stays the start hold only`: the bot timer's `startsAt` is `now + hold`, so the client's "Game starts in" check is not tripped by an animation wait.
  - `a human's new clock starts after the animation`: `clock.startsAt - serverNow` equals the batch's animation time (when it is larger than any judgment lead-in), and `endsAt - startsAt` is the full budget.
  - `a human may act during the animation`: a legal human submit during the wait is accepted.
  - `the first decision after the start hold waits for the larger of hold and animation`, not their sum.
  - `a judgment lead-in and the animation overlap`: the wait is the larger.
  - `a runner built mid-game does not wait`: with no earlier commit the first bot move is due after `BOT_DELAY_MS` only.
  - `one commit of many actions sums its events once`.
- [ ] **Step 3: Run** `npx jest projects/server/src/game/gameRunner.spec.ts`. Expected: the new tests FAIL.
- [ ] **Step 4: Implement in `gameRunner.ts`.**
  - Add `private playbackUntil = 0`. In `commit`, after `this.state` is set and when `pacePlayback` is on, set it to `now + batchPlaybackMs(this.state.log.slice(logFrom), zoneKindOf over this.state.zones, this.state.log[logFrom - 1])`.
  - In `reschedule`, compute `animationLeft = Math.max(0, playbackUntil - now)`. Do not fold it into `holdUntil` or `holding()`, because those block human actions.
  - Bot delay becomes `botDelayMs + Math.max(decision?.leadInMs ?? 0, hold, animationLeft)`. The bot timer's `startsAt` stays `now + hold`.
  - A human's spec `leadInMs` becomes `Math.max(spec.leadInMs ?? 0, hold, animationLeft)`. `switchClock` is unchanged: a resumed Play clock gets no lead-in, which is acceptable because the Play phase is one 180 s budget (my call).
  - `bot.totalSeconds` in `clockView` stays `botDelayMs / 1000` (the thinking gap).
- [ ] **Step 5: Constants.** In `protocol/limits.ts`, `BOT_THINK_MS = 1500` with a comment that it is the thinking gap on top of animation time; `BOT_DELAY_MS = BOT_THINK_MS`; `game.service.ts` `botDelayMs = BOT_THINK_MS` (the local gate already waits for animation, so local becomes animation + 1.5 s too; my call, to match online). `RoomService` default passes `pacePlayback` through.
- [ ] **Step 6: Run** `npx jest projects/server projects/app/src/app/game.service.spec.ts`. Expected: PASS.
- [ ] **Step 7: Commit** `feat: server waits for animation before a bot moves or a clock starts`

---

### Task 3: The client stops shaping normal play

**Files:**
- Modify: `projects/app/src/app/game-board/playback/pace.ts`, `projects/app/src/app/game-board/playback/playback-director.ts`
- Test: `pace.spec.ts`, `playback-director.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `paceFactor(queuedMs: number, speedFactor: number, opts: { catchUp: boolean }): number` (no `owesDecision`); `RUSH_MS` removed; `CAP_MS` becomes 30_000 (real ms: a backlog longer than this, such as a late joiner's or a reconnect's, is sped up to fit; one paced batch never reaches it).

- [ ] **Step 1: Update the failing tests.**
  - `pace.spec.ts`: delete the RUSH case; `paceFactor(4850, 0.5, { catchUp: true })` is 0.5 (no compression); `paceFactor(40_000, 1, { catchUp: true })` is `40_000 / CAP_MS`; Instant is still `Infinity`; no catch-up gives the speed factor.
  - `playback-director.spec.ts`: replace `online: owing a decision rushes…` with `online: owing a decision does not rush a queue` (5 damage beats at Slow still take their full time; `director.idle()` is false at 1500 ms); change the CAP test's queue to exceed the new cap (a late-joiner backlog) and assert it speeds up; the local no-catch-up test stays.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board/playback`. Expected: FAIL.
- [ ] **Step 3: Implement.** Drop `owesDecision`, `RUSH_MS` and the `rush` field with its memo logic from the director's `factor()`, `finish()` and `stop()`; set `CAP_MS`; update the comments on `pace.ts` and the director.
- [ ] **Step 4: Run** `npx jest projects/app` and `npm run verify`. Expected: PASS.
- [ ] **Step 5: Docs.** Update `docs/architecture/frontend.md` (the playback and bot-delay passages: animation lengths are shared from `engine`, online the server paces, the catch-up is a backlog fallback), `docs/architecture/backend-and-deployment.md` or `bots-and-simulation.md` wherever the 1.5 s bot delay is described (search for `BOT_DELAY_MS` and `botDelayMs`).
- [ ] **Step 6: Commit** `feat: client catch-up is a backlog fallback`

---

### Task 4: Check it for real

**Files:** none.

- [ ] **Step 1: Run** `npm run verify` and the full Jest suite. Expected: PASS.
- [ ] **Step 2: Manual look, online with bots** (needs the user, so report it as pending if it cannot be done): at turn start the banner finishes before the first bot play; a bot's Sha is followed by about animation + 1.5 s; the "thinking…" marker still shows; a human at turn start can act at once; no "Game starts in" popup outside the game start.
- [ ] **Step 3: Update memory** `bot-move-delay.md` with the new formula and the PR number.
