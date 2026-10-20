# Judgment Notice, Stage 1: Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The engine can hold the game after a judgment's card is final, until a seat acknowledges it or the 10 s decision clock runs out, behind a game rule that defaults off.

**Architecture:** A public `judgmentView` on `GameState` is set when a judgment starts, updated by every replacement, and marked `settled` when no skill can change the card; a settled view is a pending decision (it stops the queue like a choice does) that `AcknowledgeJudgmentAction` clears before queuing the judgment's resolution. The rule `GameRules.judgmentNotice` (stored on state, default off) keeps every existing game, test and replay unchanged.

**Tech Stack:** TypeScript, Jest (`projects/engine`).

**Spec:** `docs/superpowers/specs/2026-10-20-judgment-popup-design.md` (sections "Engine: a judgment view in state", "Who acts, and the clock", "Compatibility: a game option"). This is stage 1 of 4; content text, bots/server and the popup are separate later plans.

## Global Constraints

- The engine stays framework-free and executable under plain Node; no UI or browser code (CLAUDE.md).
- With `rules.judgmentNotice` absent or false, behavior and every existing test are unchanged; no `judgmentView` ever exists.
- `judgmentView` is plain serializable data (survives `JSON.parse(JSON.stringify(state))`) and is absent, never `null`, when there is none.
- The engine keeps one acting seat: `AcknowledgeJudgmentAction.seatId` is the active seat; `by` is informational (who actually pressed Close). The proxy that fills in `by` is stage 3.
- Timeout for this decision is 10 seconds, kind `'notice'`.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch: `feat/judgment-notice-engine` off `main`.

## Review Focus

- Rule off: no `judgmentView` after a full judgment, and the queue runs exactly as before (Task 1).
- Two replacements in a row: `changes` lists both in order and `card` is the latest (Task 1).
- Acknowledging when nothing is settled, or twice, throws instead of corrupting the queue (Task 2).
- A second judgment right after the first is closed (River Goddess repeats) gets a fresh view (Task 2).
- The judged seat or every human is eliminated while settled: someone living can still acknowledge; the game never stalls (Task 3).
- A viewer must not learn a hidden General's skill id from `judgmentView.reader` (Task 4).
- The state survives a JSON round trip mid-wait and resumes (Task 4).

## File Structure

- Modify `projects/engine/src/lib/domain/types.ts`: `GameRules.judgmentNotice`, `JudgmentView`, `JudgmentChange`, `GameState.judgmentView`.
- Modify `projects/engine/src/lib/pipeline/actions.ts`: the new action and its kind.
- Modify `projects/engine/src/lib/pipeline/events.ts`: `JudgmentAcknowledgedEvent`.
- Modify `projects/engine/src/lib/pipeline/judgment.ts`: view lifecycle (JudgeEffect, JudgmentShownEffect, ReplaceJudgmentEffect).
- Modify `projects/engine/src/lib/pipeline/resolve.ts`: the action's handler.
- Modify `projects/engine/src/lib/rules/activeSeat.ts`, `legality.ts`, `decisionClock.ts`, `defaultActions.ts`.
- Modify `projects/engine/src/lib/domain/redact.ts`.
- Tests: `pipeline/judgment.spec.ts` (reuses its `table`, `omen`, `card` helpers), `rules/activeSeat.spec.ts`, `rules/legality.spec.ts`, `rules/decisionClock.spec.ts`, `rules/defaultActions.spec.ts`, `domain/redact.spec.ts` (create any that does not exist, in the style of its neighbours).

---

### Task 1: The judgment view and the wait

**Files:**
- Modify: `domain/types.ts`, `pipeline/actions.ts`, `pipeline/events.ts`, `pipeline/judgment.ts`, `rules/activeSeat.ts` (`decisionPending` only)
- Test: `pipeline/judgment.spec.ts`

**Interfaces:**
- Produces (in `types.ts`):
  ```ts
  export interface JudgmentChange { owner: AbilityOwner; abilityId: string; card: CardInstance; replaced: CardInstance }
  export interface JudgmentView {
    seatId: string; reader: JudgmentReader; card: CardInstance;
    data?: Record<string, unknown>;
    changes: JudgmentChange[];
    settled: boolean;
  }
  // GameRules gains:  judgmentNotice?: boolean;
  // GameState gains:  judgmentView?: JudgmentView;   // absent when none
  ```
- Produces (in `actions.ts`): `{ kind: 'AcknowledgeJudgmentAction'; seatId: string; by?: string; timeout?: true }` in the `Action` union and in `ACTION_KINDS`.
- Produces (in `events.ts`): `JudgmentAcknowledgedEvent { kind: 'JudgmentAcknowledgedEvent'; seatId: string; by?: string; source: 'close' | 'timeout' }` in the `EngineEvent` union.
- Behavior: with `state.rules?.judgmentNotice` true, `JudgeEffect` sets `judgmentView = { seatId, reader, card: judged, ...(data), changes: [], settled: false }`; `ReplaceJudgmentEffect` sets `card` to the new card and appends `{ owner, abilityId, card, replaced: old }`; `JudgmentShownEffect` (the apply step, after every changer has had its say) sets `settled: true` and does **not** queue `JudgmentResolveEffect`. `decisionPending` returns true while `judgmentView?.settled`.

- [ ] **Step 1: Write failing tests** in `judgment.spec.ts`, a `describe('judgment notice')` using `table` with `rules: { judgmentNotice: true }` added on the returned state (`{ ...table(...), rules: { judgmentNotice: true } }`):
  - `'rule on: the card turned up is a settled view and nothing is resolved'`: run `advanceToDecision` over a queue of `JudgeEffect` for `seat-b` read by `omen` (the existing fixture) with a heart on top of `drawPile`; expect `state.judgmentView` toEqual `{ seatId: 'seat-b', reader: <omen reader>, card: <the heart>, changes: [], settled: true }`, `decisionPending(state)` true, the turn flag `skipFlagOf('Play')` **not** set, and the card still in the `processing` zone.
  - `'rule on: two replacements are listed in order and the card is the latest'`: apply two `ReplaceJudgmentEffect` (from `seat-a` then `seat-b`, abilityIds `'a1'`, `'a2'`) before the Shown effect settles; expect `changes.map(c => c.abilityId)` `['a1','a2']`, `changes[1].replaced` is the first replacement's card, `card` is the last, `settled` true.
  - `'rule off: no view is ever created and the judgment resolves as before'`: same queue without the rule; expect `judgmentView` undefined and the skip flag set.
  - `'rule on: with no card left to judge there is no view'`: empty draw and discard piles with an `otherwise` effect; expect `judgmentView` undefined.
- [ ] **Step 2: Run** `npx jest projects/engine/src/lib/pipeline/judgment.spec.ts -t "judgment notice"` — Expected: FAIL (`judgmentView` undefined / type errors).
- [ ] **Step 3: Add the types, action, event and the `decisionPending` clause**; then implement the three lifecycle changes in `judgment.ts` as described in Behavior (the `JudgeEffect` no-card path must not set a view).
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `npx jest projects/engine` — Expected: all existing engine tests still PASS.
- [ ] **Step 5: Commit** `feat(engine): the judgment view and the wait behind the judgmentNotice rule`.

### Task 2: Acknowledging a judgment

**Files:**
- Modify: `pipeline/resolve.ts` (`resolveAction`)
- Test: `pipeline/judgment.spec.ts`

**Interfaces:**
- Consumes: Task 1's `judgmentView`, action, event.
- Behavior: `resolveAction` case `'AcknowledgeJudgmentAction'`: throws `Error('No settled judgment to acknowledge')` unless `state.judgmentView?.settled`; otherwise removes `judgmentView` (key deleted, not set to `null`), appends `{ kind: 'JudgmentAcknowledgedEvent', seatId: action.seatId, ...(action.by ? { by: action.by } : {}), source: action.timeout ? 'timeout' : 'close' }` to `state.log` and returns it in `events`, and `queueFront`s `{ kind: 'JudgmentResolveEffect', judgment: { seatId, reader, card, ...(data ? { data } : {}) } }` built from the view.

- [ ] **Step 1: Write failing tests** (same describe, rule on):
  - `'acknowledging resolves the judgment: the reader acts, the view is cleared, the event is logged'`: from the settled state of Task 1's first test, `resolve(state, { kind: 'AcknowledgeJudgmentAction', seatId: 'seat-a', by: 'seat-b' }, ctx)`; expect the skip flag set, `judgmentView` undefined (`'judgmentView' in state` false), the card in the discard pile, and a `JudgmentAcknowledgedEvent` `{ seatId: 'seat-a', by: 'seat-b', source: 'close' }` as the last log entry.
  - `'a timeout acknowledgement is logged as a timeout without by'`: action with `timeout: true`; expect `source: 'timeout'` and no `by` key.
  - `'acknowledging when nothing is settled throws'`: on a plain `table()` and on an unsettled view (`settled: false`); expect `toThrow('No settled judgment to acknowledge')`. A second acknowledgement after the first also throws.
  - `'a second judgment after the first is closed gets a fresh view'`: acknowledge, then queue another `JudgeEffect` with a different card on top; expect a new settled view for that card and `changes: []`.
- [ ] **Step 2: Run** `-t "judgment notice"` — Expected: FAIL (unhandled action kind).
- [ ] **Step 3: Implement the case** in `resolveAction`.
- [ ] **Step 4: Run** `npx jest projects/engine` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(engine): AcknowledgeJudgmentAction resolves a settled judgment`.

### Task 3: Who acts, what is legal, the clock

**Files:**
- Modify: `rules/activeSeat.ts`, `rules/legality.ts`, `rules/decisionClock.ts`, `rules/defaultActions.ts`
- Test: `rules/activeSeat.spec.ts`, `rules/legality.spec.ts`, `rules/decisionClock.spec.ts`, `rules/defaultActions.spec.ts`

**Interfaces:**
- Consumes: Task 1's `judgmentView`, Task 2's action.
- Produces: `getActiveSeatId(state)` with a settled view returns the first living seat, in seat order, whose `state.players` entry (`player.seatId === seat.id`) has `kind === 'human'`; else the judged seat if it lives; else the first living seat; else null. `getLegalActions(state, seatId, registry?)` with a settled view returns `[{ kind: 'AcknowledgeJudgmentAction', seatId }]` for the active seat and `[]` for every other seat (this check comes right after the unknown or eliminated seat check and the GeneralSelection check). `DECISION_SECONDS.notice = 10`; `describeDecision` returns `step('notice')` (kind `'notice'`) when a settled view exists and `legal` is non-empty, before every other case; `defaultActionsFor` returns `[{ ...legal[0], timeout: true }]` for an `AcknowledgeJudgmentAction` offer, checked first.

- [ ] **Step 1: Write failing tests**:
  - `activeSeat.spec.ts`: `'a settled judgment is acted on by the first living human'` (players: seat-a bot, seat-b human, seat-c human → seat-b); `'falls back to the judged seat when there is no human'`; `'falls back to the first living seat when the judged seat and every human are eliminated'`; `'an unsettled view changes nothing'` (active seat is the usual one).
  - `legality.spec.ts`: `'only the active seat is offered the acknowledgement'` (its action equals `{ kind: 'AcknowledgeJudgmentAction', seatId }`, every other seat gets `[]`); `'nothing else is offered while a judgment waits'`.
  - `decisionClock.spec.ts`: `'a settled judgment is a notice decision of 10 seconds'` (kind `'notice'`, `DECISION_SECONDS.notice` 10); `'two judgments get two clocks'` (different `stepKey` gives different keys).
  - `defaultActions.spec.ts`: `'the default for a settled judgment is a timeout acknowledgement'`.
- [ ] **Step 2: Run** `npx jest projects/engine/src/lib/rules` — Expected: FAIL.
- [ ] **Step 3: Implement** as specified. Adding `'notice'` to `DecisionKind` may break an exhaustive use elsewhere (`grep -rn "DecisionKind" projects`): fix each with the smallest additive change and list them in the commit message.
- [ ] **Step 4: Run** `npx jest projects/engine projects/server projects/bots projects/app` — Expected: PASS (these projects consume the clock or the action union; fix compile errors minimally, with no behavior change).
- [ ] **Step 5: Commit** `feat(engine): who acts on a settled judgment, its legal action and its 10 s clock`.

### Task 4: Redaction, replay and a full game

**Files:**
- Modify: `domain/redact.ts`
- Test: `domain/redact.spec.ts`, `pipeline/judgment.spec.ts`

**Interfaces:**
- Behavior: `redactStateForSeat` keeps `judgmentView` and masks hidden Generals' skill ids in `judgmentView.reader` and `judgmentView.changes[].owner` exactly as it does for the same data in a `JudgmentEvent` or `JudgmentChangedEvent` in the log, and `hiddenSkillsFor` includes `state.judgmentView` among the things it scans.

- [ ] **Step 1: Write failing tests**:
  - `redact.spec.ts`: `'judgmentView does not reveal another seat's hidden skill'`: a state whose view's reader is a skill of seat-a's hidden General, viewed as seat-b; expect the redacted view equals what the redacted log's `JudgmentEvent` shows for the same reader (follow the existing leak tests in this file or `projects/sim/src/leaks.ts` for the assertion style). A second case: the owner viewing their own state sees it unmasked.
  - `judgment.spec.ts`: `'a settled judgment survives a JSON round trip and still resolves'`: `JSON.parse(JSON.stringify(settled))`, then acknowledge; expect the same end state as without the round trip.
  - `judgment.spec.ts`: `'rule on: a whole judgment through advanceToDecision and the legal action'`: starting from a turn where `seat-a` plays `omen` on `seat-b` and the Judgment phase arrives, drive with `getLegalActions` and `defaultActionsFor` (timeout acknowledgement) until the turn ends; expect the game never stalls and the skip flag took effect.
- [ ] **Step 2: Run** `npx jest projects/engine/src/lib/domain/redact.spec.ts projects/engine/src/lib/pipeline/judgment.spec.ts` — Expected: the redaction test FAILS (id leaks), the others PASS or FAIL for a stated reason.
- [ ] **Step 3: Implement** the redaction change.
- [ ] **Step 4: Run the whole suite** `npm test` — Expected: all PASS; `npx tsc --noEmit -p projects/app/tsconfig.app.json` reports no error (if the app's event switch is exhaustive, add the minimal ignore case for `JudgmentAcknowledgedEvent` in `projects/app/src/app/game-board/action-history.ts`, with no new text).
- [ ] **Step 5: Commit** `feat(engine): redact and round-trip the judgment view`.
