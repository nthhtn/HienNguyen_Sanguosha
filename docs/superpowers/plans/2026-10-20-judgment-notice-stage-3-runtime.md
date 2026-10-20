# Judgment Notice, Stage 3: Server, Bots and Local Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wherever games run (the server, bots, the simulation, the local game service and the online client service), a settled judgment can be closed by any person-controlled seat, closes itself after 10 seconds, is never closed by a bot while a person is playing, and never stalls a game.

**Architecture:** The engine keeps one acting seat (stage 1). The server and the local service accept a Close from any person-controlled seat and submit it as the acting seat's `AcknowledgeJudgmentAction` with `by` set to the closer. "Person-controlled" is decided at run time (a human seat that no bot is playing), so the server suppresses its bot move for a settled judgment while any such seat exists and lets the 10 s clock close it instead. Nothing here turns the rule on for new games; stage 4 does that together with the popup.

**Tech Stack:** TypeScript, Jest (`projects/engine`, `server`, `bots`, `sim`, `app`).

**Spec:** `docs/superpowers/specs/2026-10-20-judgment-popup-design.md` ("Who acts, and the clock", "Online"). Stages 1 (engine) and 2 (text) are built. Stage 4 (the popup, and setting `judgmentNotice: true` on new games) is a separate plan.

## Global Constraints

- The engine stays unchanged except the one `offered.ts` line in Task 1; the proxy lives in the server and the app services.
- A bot never acknowledges a settled judgment while at least one human seat is not bot-played (`isBotPlayed` false, living). With no such seat, bots acknowledge after their normal delay (`BOT_DELAY_MS`, local `botDelayMs`).
- A notice timeout does not count towards the away/takeover rule.
- `judgmentNotice` stays off for new games, rooms and local games in this stage; tests set it explicitly.
- Stored games replay unchanged: a proxy close is stored as the rewritten action (`seatId` = acting seat, `by` = closer).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch: `feat/judgment-notice-runtime` off `feat/judgment-notice-text`. Stage `git add` with explicit paths only (the working tree holds the user's unrelated edits to `projects/app/src/app/game-board/seat-avatar.spec.ts`, `projects/content/src/lib/assets.ts` and `assets.spec.ts`).

## Review Focus

- Every human is away but not yet taken over: the 10 s clock runs, the timeout does not count towards takeover, and after takeover bots close it (Tasks 2, 3).
- The active seat (first living human) is bot-played or has left while another human is playing: still the 10 s clock, no bot close, and the playing human can Close (Task 2, 3).
- A Close from a bot-played, eliminated or non-human seat, with extra actions, or with the wrong kind is rejected (Task 3).
- Two humans close at once, or a Close races the timeout: the second is refused as stale, never a double acknowledgement (Task 3).
- A game containing a proxy Close replays to the same state (Task 3).
- Local Pass and Play: the clock runs for a settled judgment even though the device holder is not the acting seat (Task 5).
- A whole simulated game with the rule on finishes and never ends with a view left (Task 4).

## File Structure

- Modify `projects/engine/src/lib/rules/offered.ts` (+ `offered.spec.ts`).
- Modify `projects/server/src/game/gameRunner.ts` (+ `gameRunner.spec.ts`, `testing.ts` if its `setup` needs a `rules` option), `projects/server/src/game/engineGame.spec.ts`.
- Modify `projects/bots/src/lib/rule-based.spec.ts` (test only), `projects/sim/src/runGame.spec.ts` (test only), `projects/sim/src/invariants.ts` (+ spec).
- Modify `projects/app/src/app/game.service.ts`, `decision-timer.service.ts`, `online/remote-game.service.ts` and their specs.

---

### Task 1: The engine accepts `by`

**Files:**
- Modify: `projects/engine/src/lib/rules/offered.ts`
- Test: `projects/engine/src/lib/rules/offered.spec.ts`

**Interfaces:**
- Produces: `isOfferedAction(action, legal)` treats `by` as a free field of an offered `AcknowledgeJudgmentAction` (as `freeKeys` does for `ids` of a selection).

- [ ] **Step 1: Write failing tests** in `offered.spec.ts`: `'an acknowledgement with by is the offered acknowledgement'` (offered `{ kind: 'AcknowledgeJudgmentAction', seatId: 'seat-a' }`, submitted `{ ..., by: 'seat-b' }` ⇒ true); `'an acknowledgement for another seat is not offered'` (`seatId: 'seat-b'` ⇒ false); `'by is not free on other actions'` (an `EndPhaseAction` with an extra `by` ⇒ false).
- [ ] **Step 2: Run** `npx jest projects/engine/src/lib/rules/offered.spec.ts` — Expected: FAIL on the first test.
- [ ] **Step 3: Implement**: add `case 'AcknowledgeJudgmentAction': return ['by'];` to `freeKeys`.
- [ ] **Step 4: Run** `npx jest projects/engine` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): an offered acknowledgement may carry by`.

### Task 2: The server clock and bots

**Files:**
- Modify: `projects/server/src/game/gameRunner.ts` (`reschedule`, `timeout`'s stored callback), `projects/server/src/game/testing.ts` and `gameRunner.spec.ts` (a `rules` option on `setup`, default `{}`, passed to both the stored record and `openingState`)
- Test: `projects/server/src/game/gameRunner.spec.ts`

**Interfaces:**
- Produces (private to the runner): `personControlled(): boolean` — true when some living seat has `kind === 'human'` in `state.players` and `!this.isBotPlayed(seatId)`.
- Behavior: in `reschedule()`, when `state.judgmentView?.settled` and `personControlled()`, the decision is clocked (`switchClock` with the engine's `'notice'` spec, a timeout at `endsAt`) **even if the active seat is bot-played**, and no `botMove` timer is set. When the settled view exists and no seat is person-controlled, the existing bot path runs unchanged. In `timeout()`'s stored callback, an `AcknowledgeJudgmentAction` neither increments nor resets `timeouts` for the seat and never triggers takeover.

- [ ] **Step 1: Write failing tests** (use a helper that builds a runner whose state has a settled `judgmentView`: seed a game with `rules: { judgmentNotice: true }` and drive it with the default actions until `state.judgmentView?.settled`, or hand-build the state if the runner accepts one):
  - `'a settled judgment with a person playing runs the 10 second notice clock'`: `clockView()` is kind `'notice'`, `totalSeconds` 10, and advancing the scheduler by 10 s submits a default acknowledgement with `source: 'timeout'` and `timeout: true`.
  - `'the first human being bot-played does not make a bot close it while another human plays'` (kinds `['human','human']`, seat 0 taken over): no bot move is scheduled, the notice clock runs, the timeout acknowledges as the active seat (seat 0).
  - `'a notice timeout does not count towards takeover'`: an away player's notice timeout twice in a row leaves `controlled` empty and `timeouts` unchanged; a normal response timeout still counts.
  - `'with no person playing, a bot closes it after the bot delay'`: kinds `['human','bot']` with the human taken over (or `gone`): after `BOT_DELAY_MS` an acknowledgement is committed with source `'takeover'` or `'bot'`.
  - `'every human away but not taken over: the clock still closes it'`.
- [ ] **Step 2: Run** `npx jest projects/server/src/game/gameRunner.spec.ts -t "judgment"` — Expected: FAIL.
- [ ] **Step 3: Implement** the three changes described under Behavior.
- [ ] **Step 4: Run** `npx jest projects/server` — Expected: PASS (existing runner specs unchanged).
- [ ] **Step 5: Commit** `feat(server): a settled judgment is closed by the clock while a person plays`.

### Task 3: The proxy Close

**Files:**
- Modify: `projects/server/src/game/gameRunner.ts` (`submit`, `updateFor`)
- Test: `projects/server/src/game/gameRunner.spec.ts`, `projects/server/src/game/engineGame.spec.ts`

**Interfaces:**
- Consumes: Task 1's `by`, Task 2's `personControlled`.
- Behavior of `submit(playerId, gameId, baseSeq, actions)`: when `state.judgmentView?.settled`, `actions.length === 1`, its `kind` is `'AcknowledgeJudgmentAction'`, and the submitter's seat is a living, human, not bot-played seat (`seatOf(playerId)`): the action is replaced by `{ kind: 'AcknowledgeJudgmentAction', seatId: <active seat>, by: <submitter's seat> }` (the client's own `seatId` and `by` are ignored) and validated and applied through `applyMove(ctx, state, activeSeatId, [rewritten])`; the committed row is `commit(submitterSeatId, 'human', [rewritten], steps)`. `baseSeq` is checked as before. Any other submission during a settled judgment keeps today's rule (`not_your_turn`, unless it is the active human's own legal move, of which there is none).
- Behavior of `updateFor(playerId, logFrom)`: while a judgment is settled, every living human seat that is not bot-played gets `legalActions: [{ kind: 'AcknowledgeJudgmentAction', seatId: <its own seat> }]` (for the acting seat this equals `getLegalActions`); everyone else gets `[]` as today.

- [ ] **Step 1: Write failing tests**:
  - `'any person-controlled seat can close a settled judgment, as the acting seat with by'`: seat 1 (not active) submits `{ kind: 'AcknowledgeJudgmentAction', seatId: 'seat-1' }`; the committed action is `{ kind, seatId: 'seat-0', by: 'seat-1' }`, `judgmentView` is gone, and the log holds `JudgmentAcknowledgedEvent { seatId: 'seat-0', by: 'seat-1', source: 'close' }`.
  - `'a non-active human is offered the close, a bot seat and a spectator are not'`: check `updateFor(...).legalActions` for each.
  - `'a bot-played seat, an eliminated seat, a stale baseSeq and extra actions are refused'` (`not_your_turn`, `not_your_turn`, `stale`, `not_your_turn`/`illegal_action`).
  - `'two closes: the second is stale, not a second acknowledgement'`; `'a close that loses the race to the timeout is stale'`.
  - `engineGame.spec.ts`: `'a game with a proxy close replays to the same state'` — apply a proxy close through the runner's stored actions and `replay(...)` them; the final state equals the live state.
- [ ] **Step 2: Run** `npx jest projects/server -t "close|judgment"` — Expected: FAIL.
- [ ] **Step 3: Implement** the two behaviors.
- [ ] **Step 4: Run** `npx jest projects/server` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): any person-controlled seat can close a settled judgment`.

### Task 4: Bots and the simulation

**Files:**
- Modify: `projects/sim/src/invariants.ts`
- Test: `projects/bots/src/lib/rule-based.spec.ts`, `projects/sim/src/runGame.spec.ts`, `projects/sim/src/invariants.spec.ts`

**Interfaces:**
- Produces: a new invariant in `checkInvariants`: a settled `judgmentView` always has a living acting seat with `AcknowledgeJudgmentAction` among its legal actions; a finished game has no `judgmentView`.

- [ ] **Step 1: Write failing tests**:
  - `rule-based.spec.ts`: `'with only an acknowledgement offered, the bot takes it'` (decide with `legal = [{ kind: 'AcknowledgeJudgmentAction', seatId }]` returns that action) — passes now; keep it as a guard.
  - `runGame.spec.ts`: `'games with judgmentNotice on finish, for random and rule-based bots, over 10 seeds'`: `createGame(kingdomWarMode, registry, seatIds, seed, { judgmentNotice: true })` through `runGame`; each ends with `state.result` set and no `judgmentView`.
  - `invariants.spec.ts`: `'a settled judgment with nobody able to act is a violation'` (hand-built state), and `'a finished game with a judgment view is a violation'`; both fail until implemented.
- [ ] **Step 2: Run** `npx jest projects/sim projects/bots` — Expected: the invariant tests FAIL.
- [ ] **Step 3: Implement** the invariant in `invariants.ts`.
- [ ] **Step 4: Run** `npx jest projects/sim projects/bots` — Expected: PASS.
- [ ] **Step 5: Commit** `test(sim): games with the judgment notice finish; settled judgments always have an actor`.

### Task 5: Local and online client services

**Files:**
- Modify: `projects/app/src/app/game.service.ts`, `projects/app/src/app/decision-timer.service.ts`, `projects/app/src/app/online/remote-game.service.ts`
- Test: `projects/app/src/app/game.service.spec.ts`, `decision-timer.service.spec.ts`, `online/remote-game.service.spec.ts`

**Interfaces:**
- Produces:
  - `GameService.closeJudgment(bySeatId: string | null): void` — no-op unless `state().judgmentView?.settled`; otherwise applies `{ kind: 'AcknowledgeJudgmentAction', seatId: <activeSeatId>, ...(bySeatId ? { by: bySeatId } : {}) }` as `submit` would (ignored while a bot seat is active; Pass and Play regates afterwards as today).
  - `GameService.judgmentSettled: Signal<boolean>` — true while a settled view exists.
  - `RemoteGameService.closeJudgment(): void` — no-op unless a settled view exists and the member has a seat; sends `game.submit` with `[{ kind: 'AcknowledgeJudgmentAction', seatId: <own seat> }]` (the server rewrites it).
  - `RemoteGameService.judgmentSettled: Signal<boolean>` — as above, from the view.
  - `DecisionTimer`: while a judgment is settled, the decision no longer waits for `revealedSeatId() === seatId` (the clock runs behind the Pass and Play gate, since the popup is public).
  - `RemoteDecisionClock.own` also returns the clock when `clock.kind === 'notice'`, whoever the clock's seat is.

- [ ] **Step 1: Write failing tests**:
  - `game.service.spec.ts`: `'closeJudgment closes a settled judgment as the acting seat with by'` (vs-bots with the human alive, and Pass and Play with `bySeatId` the device holder: the logged event has that `by`); `'closeJudgment does nothing when nothing is settled'`; `'with no human left, a bot closes a settled judgment after the bot delay'` (vs-bots with the human eliminated).
  - `decision-timer.service.spec.ts`: `'in Pass and Play a settled judgment is clocked without the gate, and times out into a timeout acknowledgement'`.
  - `remote-game.service.spec.ts`: `'closeJudgment submits an acknowledgement for the member's own seat with the update's seq'`, `'it does nothing without a settled view'`, and `'the own clock shows a notice clock for a seat that is not the clock's'`.
  - Use hand-built states with `rules: { judgmentNotice: true }` and a settled `judgmentView` (as in the engine specs) where the service lets tests inject a state, else drive a seeded game to its first judgment.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game.service.spec.ts projects/app/src/app/decision-timer.service.spec.ts projects/app/src/app/online` — Expected: FAIL.
- [ ] **Step 3: Implement** the five items.
- [ ] **Step 4: Run the whole suite** `npm test` and `npx tsc --noEmit -p projects/app/tsconfig.app.json` — Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat(app): closing a settled judgment in the local and online services`.
