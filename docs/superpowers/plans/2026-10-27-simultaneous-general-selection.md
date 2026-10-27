# Simultaneous General Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In an online game every human picks their Generals at the same time, a right-hand panel shows who is ready, and the game starts 3 seconds after the last seat confirms.

**Architecture:** The engine lets any seat that still has candidates choose, and exposes `getActingSeatIds`. The server runner serves several acting seats during selection with one shared 300 s clock, bots choosing at once, and a 3 s hold before the first decision. The online app derives "Ready" from the redacted state, and shows a roster panel and a start countdown. Local games keep the single-seat path.

**Tech Stack:** TypeScript, Angular (standalone, signals), Jest, Fastify server, the `engine`, `protocol`, `bots` and `sim` projects.

**Spec:** `docs/superpowers/specs/2026-10-27-simultaneous-general-selection-design.md` (read its "Decisions made while writing this" section: it fixes the stale-check, clock, hold and callers calls).

## Global Constraints

- Work on a new branch `feat/simultaneous-selection` cut from the current branch `feat/decision-timers`, which already holds the spec.
- Selection clock stays `DECISION_SECONDS.selection` = 300. The start hold is `GAME_START_LEAD_IN_MS` = 3000, exported from the engine.
- Local pass-and-play and vs-bots stay sequential: no roster, no countdown, same screens as today. Do not change `Setup` or the local Game screens' behaviour.
- The engine stays framework-free. Same seed deals the same candidates; `npm test` (jest) must pass for every project, and `sim` games for the same seeds must be unchanged.
- No protocol change: `GameUpdate` and `GameClockView` keep their shapes.
- UI text: Title Case for the panel title and labels ("Players"); sentence case for status lines ("Choosing", "Ready", "Game starts in 3", "Waiting for the other players to choose"). Seat names, never ids. English and Vietnamese (Vietnamese sentence case; a draft) in `i18n/en.ts` and `i18n/vi.ts`.
- Nothing may reveal another seat's candidates or pick; the roster shows only choosing or ready.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Two players confirm in the same instant: both succeed, neither gets a stale error. (Task 2 test.)
- A choice races the 300 s timeout: the loser is refused as illegal and the client resyncs without an error message. (Task 3 test.)
- The timeout fires with one seat ready and one choosing: only the choosing seat is defaulted, and no new 300 s clock starts for the rest. (Task 3 test.)
- A player reconnects during the 3 s: the clock view still says when it ends, not a fresh 3. (Task 3 test.)
- Every seat is a bot or taken over: the game starts with no human clock, and the hold still applies. (Task 3 test.)
- A seat that already chose tries to choose again, or a seat tries another seat's candidates: the engine refuses. (Task 1 test.)

---

### Task 1: Engine, any seat with candidates may choose

**Files:**
- Modify: `projects/engine/src/lib/rules/activeSeat.ts`, `projects/engine/src/lib/rules/generalSelection.ts:36-48`, `projects/engine/src/lib/rules/legality.ts:34-39`, `projects/engine/src/lib/rules/decisionClock.ts`, the engine's public index (export the new names beside `getActiveSeatId` and `JUDGMENT_LEAD_IN_MS`)
- Modify: `docs/architecture/rules-engine.md` (General Selection and the active-seat description, and the lead-in constants), `docs/architecture/frontend.md` / `backend-and-deployment.md` only where they say seats choose in seat order
- Test: `activeSeat.spec.ts`, `generalSelection.spec.ts`, `legality.spec.ts` beside the sources

**Interfaces:**
- Produces: `getActingSeatIds(state: GameState): string[]`: during `GeneralSelection` every seat id with an entry in `generalSelection.candidates`, in seat order; otherwise `[getActiveSeatId(state)]` without nulls (empty when none). `getActiveSeatId` is unchanged.
- Produces: `GAME_START_LEAD_IN_MS = 3000` in `decisionClock.ts`.
- Produces: `getLegalGeneralChoices` and `applyGeneralChoice` accept any seat in `getActingSeatIds(state)`.

- [ ] **Step 1: Write the failing tests.** `activeSeat.spec`: `getActingSeatIds lists every seat that still has candidates during General Selection, in seat order`; `after one seat chooses it is no longer listed`; `outside General Selection it is the active seat alone`; `getActiveSeatId still returns the first seat with candidates`. `generalSelection.spec`: `a later seat may choose before an earlier one`; `the game starts when the last seat has chosen, whatever the order` (choose seat-1 then seat-0, expect phase `Start` and `generalSelection` null); `a seat that has chosen cannot choose again` (throws); `a seat cannot choose another seat's candidates` (throws); same seed and same final choices give the same final state in either order, except the event order. `legality.spec`: `every seat with candidates is offered its legal pairs; a seat with none is offered nothing`.
- [ ] **Step 2: Run** `npx jest projects/engine/src/lib/rules` → the new tests fail.
- [ ] **Step 3: Implement** `getActingSeatIds` in `activeSeat.ts`; replace the `getActiveSeatId(state) !== seatId` checks in `applyGeneralChoice` and `getLegalActions` with `!getActingSeatIds(state).includes(seatId)`; add the constant with a comment beside `JUDGMENT_LEAD_IN_MS`; export both. Update the doc comment on `getActiveSeatId` ("seats choose in seat order" → "the first seat still choosing; use getActingSeatIds for all of them").
- [ ] **Step 4: Run** `npx jest projects/engine projects/bots projects/sim` → all pass (bots and sim keep using `getActiveSeatId`).
- [ ] **Step 5: Update the architecture docs listed above and commit** `feat(engine): any seat with candidates may choose its Generals`.

### Task 2: Server, accept moves from any acting seat

**Files:**
- Modify: `projects/server/src/game/engineGame.ts` (`applyMove`), `projects/server/src/game/gameRunner.ts` (`submit`, `updateFor`)
- Test: `engineGame.spec.ts`, `gameRunner.spec.ts`

**Interfaces:**
- Consumes: `getActingSeatIds` from Task 1.
- Produces: `applyMove` checks `getActingSeatIds(current).includes(seatId)` instead of `getActiveSeatId(current) === seatId`. `GameRunner.submit` treats a move whose actions are all `ChooseGeneralsAction` for the caller's own seat as exempt from the stale-`baseSeq` check; it is accepted when legal against the *current* state, else refused `illegal_action`. `updateFor` offers legal actions to every seat in `getActingSeatIds` that no bot plays.

- [ ] **Step 1: Write the failing tests** in `gameRunner.spec.ts`: `two seats confirm their Generals from the same base seq and both are stored`; `a General choice sent with an old seq is accepted while the seat is still choosing`; `a second choice from a seat that has chosen is refused illegal_action`; `a seat's update offers its choices from the start, before the earlier seats have chosen`; `a seat that has chosen is offered nothing`. In `engineGame.spec.ts`: `applyMove accepts a choice from a seat other than the first one still choosing`.
- [ ] **Step 2: Run** `npx jest projects/server/src/game` → new tests fail.
- [ ] **Step 3: Implement** the three changes. Keep the existing stale rules for every other action (including the Close precedent).
- [ ] **Step 4: Run** the same command → pass; run `npx jest projects/server` → pass.
- [ ] **Step 5: Commit** `feat(server): accept General choices from any seat still choosing`.

### Task 3: Server, shared selection clock, bots, timeout and the 3 s hold

**Files:**
- Modify: `projects/server/src/game/gameRunner.ts` (`reschedule`, `botMove`, `timeout`, `commit`, `clockView`, `updateFor`, `submit`)
- Test: `gameRunner.spec.ts`

**Interfaces:**
- Consumes: `getActingSeatIds`, `GAME_START_LEAD_IN_MS`, `DECISION_SECONDS.selection` from the engine; `switchClock`.
- Produces (behaviour, in `GameRunner`): during `GeneralSelection`
  - one shared decision `{ kind: 'selection', seatId: <first human seat still choosing>, key: 'selection:all' }` runs on one clock that keeps its deadline across commits (`switchClock` keeps a running clock whose key is unchanged);
  - while any acting seat is bot-played, the next bot-played seat chooses with **no move delay** (a normal `botMove` scheduled at 0 ms), one commit per seat; the human clock is paused meanwhile and resumes with what it had left;
  - `clockView(viewerSeatId)` reports the shared clock to every seat, with `seatId` set to the viewer's own seat (ready seats included);
  - on expiry, each seat still choosing gets `defaultActionsFor`, committed one after another as source `timeout`; after expiry no new 300 s clock starts for the rest. A selection timeout does not count towards the away-takeover count.
- Produces: a **start hold**. When a commit moves the phase out of `GeneralSelection`, the runner sets `holdUntil = now + GAME_START_LEAD_IN_MS`. Until `holdUntil`: `updateFor` offers no legal actions to anyone, `submit` throws `RoomError('not_your_turn')`, the first decision's human clock gets `leadInMs = holdUntil - now` (a bot's move delay is `botDelayMs + holdUntil - now`), and `clockView` reports a view whose `startsAt` is `holdUntil` (for a bot's move too, `bot: true`). A one-shot wake-up at `holdUntil` republishes (`refresh`) so legal actions appear. The wake-up is cancelled with the other timers. The hold is not persisted: a restored game has none.

- [ ] **Step 1: Write the failing tests** with the fake scheduler the spec already uses: `bots choose at once when the selection opens, with no move delay`; `the human clock for selection is shared: one seat confirming does not restart another seat's clock`; `every seat is sent the same clock, with its own seat id`; `at 300 s a seat still choosing is defaulted and a seat that is ready is not touched`; `after the timeout no new selection clock starts for the remaining seats`; `a choice that loses a race to the timeout is refused and nothing is stored twice`; `a taken-over seat chooses at once`; `an away player who times out in selection does not count towards takeover`; `after the last choice nobody is offered actions for 3 seconds, then the first decision's actions appear`; `during the 3 seconds the clock view starts at the end of the hold, also when the first mover is a bot`; `a snapshot taken during the 3 seconds still reports the remaining time`; `with only bots and taken-over seats, the game starts and the hold applies`; `submit is refused with not_your_turn during the hold`.
- [ ] **Step 2: Run** `npx jest projects/server/src/game/gameRunner` → new tests fail.
- [ ] **Step 3: Implement** in `GameRunner`: a selection branch at the top of `reschedule` (when `state.phase === 'GeneralSelection'`) using the rules above; `botMove` and `timeout` pick the seat to act for from `getActingSeatIds` during selection instead of `getActiveSeatId`; `holdUntil` and its wake-up as described; `clockView(viewerSeatId)` takes the viewer (update `updateFor` and any other caller). Reuse `defaultActionsFor`, `applyActions` and `commit`; do not duplicate their logic.
- [ ] **Step 4: Run** `npx jest projects/server` → pass.
- [ ] **Step 5: Commit** `feat(server): shared selection clock, instant bot picks and the 3 s start hold`.

### Task 4: App, online selection screen, ready panel and start countdown

**Files:**
- Modify: `projects/app/src/app/online/remote-game.service.ts` (`activeSeatId`, two new signals, the shared `Pick` surface), `projects/app/src/app/game.service.ts` (the same two signals, always null), `projects/app/src/app/game-board/game-board.ts` (the `GeneralSelection` block at ~line 77), `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`
- Create: `projects/app/src/app/game-board/selection-roster.ts`, `projects/app/src/app/game-board/game-start-countdown.ts`
- Test: `remote-game.service.spec.ts` (or the online spec that covers it), `selection-roster.spec.ts`, `game-start-countdown.spec.ts`, `game-board.spec.ts`, and the Vietnamese spec that checks keys

**Interfaces:**
- Produces in both game services: `selectionRoster: Signal<SelectionRosterRow[] | null>` and `gameStartsAt: Signal<number | null>` (epoch ms on this device). `SelectionRosterRow = { seatId: string; name: string; ready: boolean; isYou: boolean }`, exported from `selection-roster.ts`. The local `GameService` returns `null` for both always.
- Remote `selectionRoster`: `null` unless `state.phase === 'GeneralSelection'`; else one row per seat in seat order, `ready` = the seat has no key in `generalSelection.candidates`, `name` from `state.players`, bots included; names go through the existing seat-name helper so ids are never shown.
- Remote `activeSeatId`: during `GeneralSelection`, the viewer's own seat while it is still choosing, else the first seat still choosing (so the board shows the selection screen for a seat that must pick); otherwise `getActiveSeatId`.
- Remote `gameStartsAt`: when `state.phase === 'Start'`, `state.turn.turnNumber === 1` and the clock's `startsAt` is later than now when the update arrives, that `startsAt`; else `null`.
- `selection-roster.ts`: standalone component `app-selection-roster`, input `rows: SelectionRosterRow[]`. Heading "Players" (Title Case); each row: name, "You" tag on the viewer's row, status "Choosing" or "Ready".
- `game-start-countdown.ts`: standalone component `app-game-start-countdown`, input `startsAt: number`. Shows "Game starts in N" (N whole seconds left, ticking about every 100 ms) over the board and renders nothing once the time is up.
- i18n keys (en / vi draft): `board.selection.players` "Players" / "Người chơi"; `board.selection.choosing` "Choosing" / "Đang chọn"; `board.selection.ready` "Ready" / "Sẵn sàng"; `board.selection.you` "You" / "Bạn"; `board.selection.waiting` "Waiting for the other players to choose" / "Đang chờ những người chơi khác chọn Tướng"; `board.gameStartsIn` "Game starts in {n}" / "Ván đấu bắt đầu sau {n}".

- [ ] **Step 1: Write the failing tests.** Service: `selectionRoster lists every seat as Choosing or Ready from the candidates keys`; `bots are Ready from the start`; `selectionRoster is null outside General Selection and in local games`; `activeSeatId is the viewer's own seat while it is choosing, even when an earlier seat is too`; `gameStartsAt is the clock's start while turn 1 is in the Start phase and the clock has not started, else null`. Roster: `shows Choosing and Ready`, `marks the viewer's row`, `never shows seat ids`. Countdown: `shows the seconds left and counts down` (fake timers), `renders nothing at zero`. Board: `online selection shows the selection controls and the roster side by side`; `a ready seat sees the waiting message and the roster, not the Bots are choosing spinner`; `a local game still shows the old spinner and no roster`; `the start countdown covers the board while gameStartsAt is set`. Vietnamese: the new keys exist in both languages.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board projects/app/src/app/online` → new tests fail.
- [ ] **Step 3: Implement** the two components, the service signals and the board changes. The roster sits to the right of the selection/waiting view (stacked below it on a phone width). No game rules in components: readiness comes from the service.
- [ ] **Step 4: Run** `npx jest projects/app` and `npm run i18n:status` → pass; the new Vietnamese entries show as draft.
- [ ] **Step 5: Commit** `feat(app): ready panel and start countdown for online General Selection`.

### Task 5: Whole-system check and docs

**Files:**
- Modify: `docs/architecture/backend-and-deployment.md`, `docs/architecture/frontend.md` (the online selection flow, the roster and the 3 s hold), the spec's status line to "implemented"
- Test: none new; run the whole suite and a real two-browser session

- [ ] **Step 1: Run** `npx jest` (all projects) and the type check/build (`npm run build`, `npx tsc --noEmit -p projects/app/tsconfig.app.json`) → pass.
- [ ] **Step 2: Run the app with a local server** (use the project's `run` skill) with two browsers in one online room: both see their five Generals at once; the roster flips a row to Ready when the other confirms; the countdown "Game starts in 3" plays after the second confirms; the first mover's actions appear after it. Also: one browser idle with the other confirmed, and a reload during the countdown. Report what was seen.
- [ ] **Step 3: Commit** `docs: simultaneous General Selection` and ask the author about merging and deleting the branch.
