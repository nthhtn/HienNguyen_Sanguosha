# Goddess Luo Judgment Chain and Notice Clocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Goddess Luo's judgments share one popup with a visible set-aside row and an in-popup "Judge again?" ask, and the notice clocks become 3 s (Harvest: its participants, at most 5 s).

**Architecture:** The engine's `JudgmentView` gains chain fields (`aside`, `continuing`, `ended`) behind the existing `judgmentNotice` option. A skill may declare `chainsJudgment`, and the view then survives from one judgment to the next. The server and the local timer need no new mechanism: they read the same `describeDecision` and `switchClock`. The app reuses the changer's ask panels.

**Tech Stack:** TypeScript, Angular (standalone, signals), Jest, Node server.

**Spec:** `docs/superpowers/specs/2026-11-23-zhen-ji-judgment-chain-design.md`. Also read `docs/superpowers/specs/2026-10-20-judgment-popup-design.md` and `docs/superpowers/specs/2026-10-26-judgment-compete-animation-design.md`.

## Global Constraints

- **Layering:** Engine and content stay framework-free; no rule logic in Angular components (`CLAUDE.md`).
- **Option:** All new behaviour sits behind `rules.judgmentNotice`; with it off, nothing changes and stored games replay exactly.
- **Clock values:** `DECISION_SECONDS.notice` 3, `NOTICE_SECONDS` 3, new `chainEnd` 5, Harvest `min(participants, 5)`.
- **Only Goddess Luo** (`kingdomWars:goddess-luo`) chains. River Goddess (Identity) is unchanged.
- **UI text:** Title Case for labels ("Set Aside"), sentence case for sentences; Vietnamese sentence case and starts as draft; no ids shown (`CLAUDE.md`).
- **Docs style:** Bullets over long paragraphs, capitalized list items, table cells and text after colons; keep every fact.
- **Process:** Commit per task on a feature branch (`feat/goddess-luo-chain`); never push or merge `main`.
- **Checks:** `npm test`, then `npm run verify` before the last commit.

## Review Focus

1. **A changer ends the chain:** Sima Yi or Zhang Jiao turns a black card red mid-chain: Chain ends, set-aside cards are kept for her, 5 s wait. Tested in Task 3.
2. **Owner dies mid-chain:** Set-aside cards go to the discard pile and the popup closes with no stuck wait. Tested in Task 3.
3. **Draw pile runs out mid-chain:** The chain ends and the popup still waits 5 s, once. Tested in Task 3.
4. **A reconnecting or redacted viewer mid-chain:** Sees the set-aside cards and the ask, and no hidden General is revealed by them. Tested in Task 2.
5. **An all-bot or taken-over game:** A chain never stalls and a bot's "Judge again?" respects the lead-in. Tested in Task 4.

---

### Task 1: Notice clocks (3 s default, Harvest by participants)

**Files:**
- Modify: `projects/engine/src/lib/rules/decisionClock.ts` (`DECISION_SECONDS.notice`)
- Modify: `projects/app/src/app/game-board/resolution-notice-dialog.ts` (`NOTICE_SECONDS`)
- Modify: `projects/content/src/lib/resolutionNotices/harvest.ts`
- Modify: the comments that say "5 seconds" or "5 s" in `projects/app/src/app/game-board/game-board.ts`, `judgment-dialog.ts`, `decision-countdown.ts` if present
- Test: `projects/engine/src/lib/rules/decisionClock.spec.ts`, `projects/content/src/lib/resolutionNotices/harvest.spec.ts` (find the Harvest notice spec; create beside `harvest.ts` if absent), `projects/app/src/app/game-board/resolution-notice-dialog.spec.ts`

**Interfaces:**
- Produces: `DECISION_SECONDS.notice === 3`; `NOTICE_SECONDS === 3`; Harvest's content `seconds === Math.min(picks.length, 5)`.

- [ ] **Step 1: Write the failing tests**
  - `decisionClock.spec.ts`: "a settled judgment's clock is 3 seconds": `switchClock` with a `notice` spec gives `running.totalMs === 3000`.
  - Harvest spec: "lasts one second per participant, at most 5": with 2 picks `seconds === 2`, with 4 picks `4`, with 6 picks `5`.
  - Notice dialog spec: "a notice without its own length counts down from 3".
- [ ] **Step 2: Run them and see them fail**
  Run: `npx jest decisionClock harvest resolution-notice-dialog`
  Expected: FAIL on 5 vs 3 and on `10`.
- [ ] **Step 3: Change the three values** (`notice: 3`, `NOTICE_SECONDS = 3`, Harvest `seconds: Math.min(picks.length, 5)` with its comment now saying why) and update the stale comments.
- [ ] **Step 4: Run the three specs, then `npx jest projects/app projects/engine projects/content` for fallout** (tests that assumed 5 s or 10 s).
  Expected: PASS; fix any spec that hard-coded the old numbers.
- [ ] **Step 5: Commit** `feat: notice clocks are 3 s; Harvest notice lasts one second per participant`

---

### Task 2: Engine chain state, hook and clocks

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (`JudgmentView`)
- Modify: `projects/engine/src/lib/registry/types.ts` (`SkillDefinition`)
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (new effect kind in the `Effect` union)
- Modify: `projects/engine/src/lib/pipeline/judgment.ts`, `projects/engine/src/lib/pipeline/resolve.ts` (acknowledge case)
- Modify: `projects/engine/src/lib/rules/activeSeat.ts`, `legality.ts`, `decisionClock.ts`
- Create: `projects/engine/src/lib/rules/judgmentWait.ts`
- Modify: `projects/engine/src/public-api.ts` (export the helper, if the engine barrel lists rules)
- Test: `projects/engine/src/lib/pipeline/judgment.spec.ts`, `projects/engine/src/lib/rules/decisionClock.spec.ts`, `projects/engine/src/lib/domain/redact.spec.ts`

**Interfaces:**
- Produces, on `JudgmentView`: `aside?: CardInstance[]` (present only for a chain reader, the cards set aside so far, public), `continuing?: true` (the verdict is shown and the game goes on without an acknowledgement), `ended?: true` (the chain is over and only the acknowledgement is awaited; resolving it must not read the judgment again).
- Produces: `export interface JudgmentChainContext { owner: GeneralOwner; seatId: string; judged: CardInstance; data?: Record<string, unknown> }` and `SkillDefinition.chainsJudgment?(state: GameState, ctx: JudgmentChainContext, registry: ContentRegistry): boolean`. Presence marks a chain reader; the return value says this final card continues the chain.
- Produces: `Effect` `{ kind: 'JudgmentChainEndedEffect' }`: if a view exists and has `aside`, sets `ended: true`, removes `continuing`, leaves it settled; otherwise a no-op.
- Produces: `export function awaitsAcknowledgement(view: JudgmentView | undefined): boolean` in `rules/judgmentWait.ts`: `!!view && view.settled && !view.continuing`.
- Produces: `DECISION_SECONDS.chainEnd = 5` and `DecisionKind` `'chainEnd'`.

- [ ] **Step 1: Write the failing engine tests** in `judgment.spec.ts`, with a fixture skill that has `chainsJudgment` (continues on a black card) and an `onJudged` like Goddess Luo's, and `rules: { judgmentNotice: true }`:
  - "a chaining final card does not wait for an acknowledgement": after the changers' say, the view is `settled && continuing`, `awaitsAcknowledgement` is false, and the queue went on to the reader's ask.
  - "the view survives into the next judgment and keeps `aside`": after the ask's Use, the new view has `settled: false`, `aside` containing the first card.
  - "a non-continuing final card awaits an acknowledgement as before": red card: `settled`, not `continuing`, legal action is `AcknowledgeJudgmentAction`.
  - "`JudgmentChainEndedEffect` makes the view await an acknowledgement, and acknowledging it clears the view without reading the judgment again" (the `onJudged` spy is called once in all).
  - "a view for a reader without `chainsJudgment` has no `aside`".
  - "`JudgmentChainEndedEffect` with no view is a no-op".
- [ ] **Step 2: Write the failing clock and redaction tests**
  - `decisionClock.spec.ts`: "a chain reader's settled view runs a `chainEnd` clock of 5 s"; "a non-chain settled view still runs `notice`"; "a pending ask while the view is continuing is an `ask` with a lead-in of `JUDGMENT_LEAD_IN_MS.tail` when `leadIn` is on, and 0 when off"; "an `ended` view's `chainEnd` clock has no lead-in".
  - `redact.spec.ts`: "`aside` cards survive redaction for every seat, and a hidden General's skill stays masked".
- [ ] **Step 3: Run them and see them fail**
  Run: `npx jest projects/engine`
  Expected: FAIL (missing exports and fields).
- [ ] **Step 4: Implement the engine change**
  - `JudgeEffect` (`judgment.ts`): the new view gets `aside` when the reader is a skill whose definition has `chainsJudgment`: a copy of the previous view's `aside` when that view was `continuing` and had the same reader owner seat, else `[]`.
  - `JudgmentShownEffect` (the settle branch): with a view, call the reader's `chainsJudgment`. When it returns true, set `settled: true, continuing: true`, append the card to `aside`, and queue `JudgmentResolveEffect` (do not stop). Otherwise settle as today.
  - `JudgmentChainEndedEffect` as specified in Interfaces, added to the judgment step kinds so it is dispatched with the others.
  - `AcknowledgeJudgmentAction` (`resolve.ts`): require `awaitsAcknowledgement(view)`; when `view.ended`, clear the view, log the event and queue nothing; else as today.
  - Replace every use of `judgmentView?.settled` that means "awaiting an acknowledgement" with `awaitsAcknowledgement(...)`: `activeSeat.ts` (two sites), `legality.ts` (two sites), `decisionClock.ts` (`notice`). The `!view.settled` uses that mean "a changer may still act" stay.
  - `decisionClock.ts`: `describeDecision` returns `chainEnd` instead of `notice` when the awaiting view has `aside`; lead-in 0 when `ended`, else as `notice` today. A pending choice while the view is `continuing` returns `step('ask')` with `leadInMs: leadIn(JUDGMENT_LEAD_IN_MS.tail)`.
- [ ] **Step 5: Run `npx jest projects/engine`; PASS.** Run `npm run typecheck` for the union fallout (every `Record<DecisionKind, …>` and `switch` on the kind).
- [ ] **Step 6: Commit** `feat(engine): a judgment chain keeps one judgment view across judgments`

---

### Task 3: Goddess Luo uses the chain

**Files:**
- Modify: `projects/content/src/lib/generals/kingdom-wars-wei.ts` (`goddessLuo`, `goddessLuoJudge`)
- Modify: `projects/content/src/lib/judgmentOutcome.ts` only if the settled-chain verdict needs a key (the black card already maps to `again`)
- Test: `projects/content/src/lib/generals/kingdom-wars-wei.spec.ts`

**Interfaces:**
- Consumes: `SkillDefinition.chainsJudgment`, `JudgmentChainEndedEffect` (Task 2).
- Produces: `goddessLuo.chainsJudgment = (state, { owner, judged }, registry) => riverGoddessOutcome(state, owner.seatId, judged, registry) === 'again'`.

- [ ] **Step 1: Write the failing tests** in the existing `Kingdom Wars Zhen Ji, Goddess Luo` describe, with `rules: { judgmentNotice: true }` on the table and cards `b1`, `b2` (black), `r1` (red):
  - "black, black, red: one view throughout, `aside` is [b1, b2] at the end, the red card awaits an acknowledgement, and acknowledging gives her b1 and b2":
  - "a black card needs no acknowledgement; the next legal action is the ask":
  - "stopping after b1: the view awaits an acknowledgement with `ended`; acknowledging gives her b1 and the view is gone":
  - "a changer turns a black card red: the chain ends with `aside` kept" (reuse the fixture changer in the file or a stub skill with `onJudgmentShown` as the Sima Yi tests do in `wei-judgments.spec.ts`):
  - "she dies between judgments: the set-aside cards go to the discard pile and no view or wait remains" (reuse `pendingAsk`):
  - "the draw pile runs out after b1: the chain ends, one acknowledgement, she gets b1":
  - "with `judgmentNotice` off the existing tests are unchanged" (they already run it off).
- [ ] **Step 2: Run them and see them fail**
  Run: `npx jest projects/content/src/lib/generals/kingdom-wars-wei.spec.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement**
  - Add `chainsJudgment` to `goddessLuo`.
  - Every path that ends the chain without a red card queues `{ kind: 'JudgmentChainEndedEffect' }` before the end step: the ask's `otherwise` (`[goddessLuoEnd(owner, now)]` becomes `[{ kind: 'JudgmentChainEndedEffect' }, goddessLuoEnd(owner, now)]`) and `goddessLuoJudge`'s `otherwise`.
  - The red path is unchanged: the acknowledgement resolves it and `onJudged` returns `[done, end]`.
- [ ] **Step 4: Run the Goddess Luo spec and `npx jest projects/content projects/bots`; PASS.**
- [ ] **Step 5: Commit** `feat(content): Goddess Luo chains its judgments in one popup`

---

### Task 4: Server, protocol and online client

**Files:**
- Modify: `projects/server/src/game/gameRunner.ts` (`closedByClock`, `canClose`-style check near line 196, the away-rule exclusion for `notice`)
- Modify: `projects/protocol/src` only if `GameClockView.kind` lists kinds by hand
- Modify: `projects/app/src/app/online/remote-game.service.ts` (the two `'notice'` checks near lines 152 and 286)
- Test: `projects/server/src/game/gameRunner.spec.ts`, `projects/app/src/app/online/online-game.spec.ts` (or `remote-game.service`'s own spec)

**Interfaces:**
- Consumes: `awaitsAcknowledgement`, `DecisionKind` `'chainEnd'`.

- [ ] **Step 1: Write the failing tests**
  - Runner: "a `chainEnd` timeout does not count towards the away rule" (the way the `notice` test does).
  - Runner: "a person-controlled table does not let a bot close an awaiting chain view; a continuing view does not block a bot's ask" (the bot asked "Judge again?" moves after its lead-in).
  - Runner: "an all-bot game runs a full chain with no stall".
  - Online client: "the `chainEnd` clock is shown like `notice` (not as a bot move)".
- [ ] **Step 2: Run and see them fail**
  Run: `npx jest --selectProjects server projects/app/src/app/online`
- [ ] **Step 3: Implement**
  - Replace `judgmentView?.settled` in the runner with `awaitsAcknowledgement(...)` (two sites).
  - Everywhere the runner or the client special-cases the kind `'notice'`, include `'chainEnd'` (a small `isNoticeKind(kind)` helper next to `DecisionKind` if three or more sites need it).
- [ ] **Step 4: Run the tests above plus `npm run typecheck`; PASS.**
- [ ] **Step 5: Commit** `feat(server): the chain's end clock behaves as the notice clock`

---

### Task 5: The popup (description, decision, stage, board, strings)

**Files:**
- Modify: `projects/app/src/app/game-board/judgment-description.ts`, `judgment-decision.ts`, `judgment-stage.ts`, `judgment-dialog.ts`, `game-board.ts` (`choiceDue`, `selectionDue` suppression; the 5 s comment)
- Modify: `projects/app/src/app/i18n/en.ts`, `vi.ts` (and the message-key type if separate)
- Modify: `projects/app/src/app/settled-judgment.testing.ts` (a helper for a chain view)
- Test: `judgment-description.spec.ts`, `judgment-decision.spec.ts`, `judgment-stage.spec.ts`, `judgment-dialog.spec.ts`, `game-board.spec.ts`, `judgment-dialog.vi.spec.ts`

**Interfaces:**
- Consumes: `JudgmentView.aside/continuing/ended` (Task 2).
- Produces: `JudgmentDescription.aside: CardInstance[]` (empty for a non-chain judgment) and `JudgmentDescription.continuing: boolean`.
- Produces: `JudgmentDecisionView` gains `{ kind: 'continue-watching'; ownerName: string }`; `judgmentDecision` returns, for a `continuing` view with a pending ask, `mine` / `gate` for the owner and `continue-watching` for everyone else.
- Produces: message keys `judgment.aside` ("Set Aside" / Vietnamese draft) and `judgment.mayJudgeAgain` ("{name} may judge again" / draft).

- [ ] **Step 1: Write the failing tests**
  - Description: "a chain view lists its `aside` cards"; "a view with no chain has none".
  - Decision: "the owner sees their own ask, others see the watching line that names the owner, a gate shows in Pass and Play".
  - Stage: "the Set Aside row shows the cards after the verdict has played and keeps them while the ask is open"; "the ask shows under the consequence for a continuing view"; "reduced motion shows the row at once"; "the row is absent for a non-chain judgment".
  - Dialog: "stays open while the view exists across two judgments" (the dialog is not closed or reopened when the card changes); "no countdown while continuing, the countdown shows when the chain has ended".
  - Board: "the owner's Judge again ask opens no dialog of its own while the popup is open".
  - Vietnamese spec: the new keys exist and follow sentence case.
- [ ] **Step 2: Run and see them fail**
  Run: `npx jest projects/app/src/app/game-board/judgment`
- [ ] **Step 3: Implement**
  - `judgmentDescription`: fill `aside` from `view.aside`, `continuing` from the view.
  - `judgmentDecision`: today it requires `!view.settled`; extend it with the continuing-view case.
  - `JudgmentStage`: a Set Aside row under the arena (small face-up `app-playing-card`, a `judgment.aside` label); a continuing view's current card joins the row once its verdict (`stampShown`) has played; the decision area for a continuing view renders the same `AskPanel` and watching panels as a changer's, with `judgment.mayJudgeAgain` for others.
  - `JudgmentDialog`: show the countdown only while the engine's clock runs (`d.settled && !d.continuing`).
  - `GameBoard`: `choiceDue` returns null when the view is `continuing` and shows an ask for the viewer, so no separate dialog opens.
  - Strings: en and vi (draft); update the dialog and board comments for 3 s and 5 s.
- [ ] **Step 4: Run `npx jest projects/app`; PASS.** Then start the app (`preview_start`) with a dev scenario for Zhen Ji if one exists (`projects/app/src/app/dev`), play one chain, and screenshot the popup mid-chain and at the end.
- [ ] **Step 5: Commit** `feat(app): one judgment popup for the whole Goddess Luo chain`

---

### Task 6: Docs and full verification

**Files:**
- Modify: `docs/architecture/rules-engine.md` (Decision clocks table: `notice` 3, new `chainEnd` 5, and the "Judgment" sections for the chain fields)
- Modify: `docs/architecture/backend.md` (the "5 s notice clock" lines, chain pacing)
- Modify: `docs/architecture/frontend.md` (the 5 s countdown lines near 317 and 342, the Set Aside row)
- Modify: `docs/superpowers/specs/2026-10-26-judgment-compete-animation-design.md` only if it states a timer the code no longer has (a one-line note pointing here)

- [ ] **Step 1: Update the docs**, following the docs style in `CLAUDE.md`; touch only values this change moved.
- [ ] **Step 2: Run `npm test`, then `npm run verify`; both PASS.**
- [ ] **Step 3: Commit** `docs: judgment chain and 3 s notice clocks`

## Self-review notes

- **Spec coverage:** One popup (Tasks 2, 3, 5); black card no wait and in-popup ask (2, 3, 5); set-aside row (5); 5 s end (2); 3 s notice and judgment result clock (1, the `notice` kind is the judgment result clock); Harvest (1); docs (6).
- **Names:** `awaitsAcknowledgement`, `chainsJudgment`, `JudgmentChainEndedEffect`, `aside`, `continuing`, `ended`, `chainEnd` are used the same way in every task.
