# Judgment and Compete Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Judgment and Compete popups a fixed, blocking sequence of animated beats that ends on the outcome (check or cross and a visual consequence; a lit winner), with skill decisions that can change a judgment hosted inside the Judgment popup, a 10 s clock for each such decision, and a 3 s closing countdown on both popups.

**Architecture:** Content adds a typed verdict and effect (and a one-line rule text) beside each judgment outcome. The engine gains a 10 s decision kind, a 3 s notice clock, a clock lead-in (a clock starts only when the animation it follows has played), and a `rounds` counter on `judgmentView`. The app plays the beats with a small pure scheduler, renders them in a rebuilt Judgment dialog and Compete dialog, and hosts the existing Ask and Selection panels in the Judgment dialog's decision area.

**Tech Stack:** TypeScript, Angular 22 standalone components with signals, Angular Material, CSS transitions and container sizing, Jest (`jest-preset-angular`).

**Spec:** `docs/superpowers/specs/2026-10-26-judgment-compete-animation-design.md` (amends `2026-10-20-judgment-popup-design.md`)

**Deviation from the spec (amend the spec in Task 10):** the spec's lead-in table has three "judgment change" rows (first ask, after a replacement, after a decline). This plan uses two: the first ask of a judgment waits HEAD, every later ask waits REPLACE (1300 ms). A decision after a decline therefore idles up to 0.8 s longer than the spec's 500 ms, and only one counter (`rounds`) is needed in state instead of a counter plus a last-outcome field.

## Global Constraints

- Beats (ms from the popup opening): source 0; rule 500; card face down then up 1000 (flip about 600); decision rounds from 2100; check or cross drawn over about 750; consequence 900 after the verdict; Continue unlocks 1100 after the consequence; popup closes 3000 after unlock. With no decision, Continue unlocks at about 4100 ms.
- Compete beats: slide in and VS 0; cards face down 800; cards turn together 1500; winner lit and loser dimmed 2500; outcome line 3400; Continue unlocks 4200; closes 3000 later.
- Lead-in constants (shared by app and server, exported from the engine): HEAD 2100, REPLACE 1300, TAIL 2000. First judgment-change ask: HEAD; later asks: REPLACE; notice: TAIL if `rounds > 0`, else HEAD + TAIL. All lead-ins are 0 when no seat is controlled by a person.
- `DECISION_SECONDS.notice` = 3. New decision kind `'judgmentChange'` = 10 s, default action is the decline (Don't Use, or the selection's cancel). A two-step ask (use? then pick a card) shares one clock key and one 10 s budget. Other pending decisions during an unsettled judgment keep their own kinds.
- Compete popup auto-close: 3 s from Continue unlock (UI only, no engine pause).
- Verdict is from the judged seat's player's point of view, whoever the effect lands on. `neutral` draws no stamp. The table of verdicts and effects is the spec's, keys taken from `JUDGMENT_OUTCOMES` in `projects/content/src/lib/display.ts`.
- At most three replaced cards are drawn; older ones are dropped from view, never from the log.
- Every consequence also shows its one-line sentence; nothing is icon-only. `prefers-reduced-motion`: show each beat's end state at once, in order.
- No tap-to-skip. No rule logic in components. UI text follows CLAUDE.md casing; all strings are catalog keys in `en.ts` and `vi.ts` (Vietnamese draft). All behaviour sits behind `rules.judgmentNotice`.
- Bump `PROTOCOL_VERSION` by one from its current value (2 on this branch) because `GameClockView` gains `startsAt`.

## Review Focus

1. A game with no person-controlled seat gets zero lead-in and never stalls on a judgment. (Task 4)
2. A changer's two-step ask (use? then pick) uses one clock and times out to a decline without leaving the selection pending. (Task 2)
3. Switching language or minimizing and restoring the Judgment popup mid-sequence does not restart the beats or lose a decision in progress. (Task 7)
4. A fourth replaced card, and a damage subject at 0 HP or with a hidden maximum HP, still render sensibly. (Task 7)
5. In Pass and Play the private decision is shown only after the hand-off gate, and the public beats are never hidden by it. (Task 8)

## File Structure

- Modify `projects/engine/src/lib/rules/decisionClock.ts` (+ spec): kinds, `notice`, lead-in, `startsAt`.
- Modify `projects/engine/src/lib/domain/types.ts`, `pipeline/judgment.ts`, `pipeline/resolve.ts`: `judgmentView.rounds`, `judgmentChange` flag on pending choice and selection.
- Modify `projects/content/src/lib/shared/judgments.ts`, `generals/wei.ts` (Devil), Dark Magic's file: set the flag.
- Modify `projects/content/src/lib/judgmentOutcome.ts`, `display.ts`, readers' outcome functions as needed; `content/data/locales/vi/prose.json`: verdict, effect, rule lines.
- Modify `projects/protocol/src/game.ts`, `version.ts`; `projects/server/src/game/gameRunner.ts`.
- Modify `projects/app/src/app/decision-timer.service.ts`, `online/remote-game.service.ts` (`RemoteDecisionClock`), `game-board/decision-countdown.ts`, `game.service.ts` (bot delay).
- Create `projects/app/src/app/game-board/beat-player.ts` (+ spec): the pure scheduler.
- Modify `game-board/judgment-description.ts`, `judgment-dialog.ts` (rewrite), `compete-dialog.ts`, `compete-result.ts`; create `game-board/judgment-stage.ts` and `game-board/judgment-decision.ts` (+ specs).
- Modify `game-board/game-board.ts` (suppress duplicate dialogs, pass decision data); `i18n/en.ts`, `vi.ts`; docs.

Run tests with `npx jest --selectProjects <engine|content|protocol|server|app> --testPathPatterns <name>` (a bare path argument does not filter).

---

### Task 1: Clock kinds, 3 s notice and lead-in

**Files:**
- Modify: `projects/engine/src/lib/rules/decisionClock.ts`; `projects/engine/src/public-api.ts` if the new exports need it
- Test: `projects/engine/src/lib/rules/decisionClock.spec.ts`

**Interfaces:**
- Produces: `DECISION_SECONDS.notice = 3`, `DECISION_SECONDS.judgmentChange = 10`; `DecisionKind` includes `'judgmentChange'`; `export const JUDGMENT_LEAD_IN_MS = { head: 2100, replace: 1300, tail: 2000 } as const`; `DecisionSpec` gains `leadInMs?: number`; `RunningClock` gains `startsAt: number`; `switchClock` starts a *new* clock at `startsAt = now + (spec.leadInMs ?? 0)` and `endsAt = startsAt + remaining`; a clock resumed from `paused` gets no lead-in (`startsAt = now`); `clockRemainingMs(clock, now)` is the time left on the countdown, never more than `totalMs` and not counting the lead-in; add `clockStartsInMs(clock, now): number | null` (ms until the countdown starts, 0 once it has).

- [ ] **Step 1: Write the failing tests**: `notice is 3 seconds`; `judgmentChange is 10 seconds`; `a new clock with a lead-in starts at now plus the lead-in and ends a full total later`; `clockRemainingMs equals the full total during the lead-in`; `a clock resumed from paused has no lead-in`; `the same key keeps running without a new lead-in`.
- [ ] **Step 2: Run** `npx jest --selectProjects engine --testPathPatterns decisionClock`. Expected: FAIL.
- [ ] **Step 3: Implement** the changes above in `decisionClock.ts`; keep all existing behaviour for specs with no `leadInMs`.
- [ ] **Step 4: Run** the engine project. Expected: PASS. Fix any app/server compile errors from the new required `startsAt` field in the next tasks; here only the engine must pass.
- [ ] **Step 5: Commit** `git commit -m "feat(engine): 3 s notice clock, judgmentChange kind and clock lead-in"`

### Task 2: Judgment rounds and the judgment-change decision

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (`JudgmentView.rounds: number`, `PendingChoice.judgmentChange?: true`, `PendingSelection.judgmentChange?: true`), `pipeline/judgment.ts`, `pipeline/resolve.ts` (where a pending choice or selection is opened), `rules/decisionClock.ts` (`describeDecision`), `domain/redact.ts` if the new fields need masking decisions (they are public)
- Modify: `projects/content/src/lib/shared/judgments.ts` (a helper that marks a changer's ask and selection), `generals/wei.ts` (Devil), the file defining Dark Magic
- Test: `projects/engine/src/lib/rules/decisionClock.spec.ts`, `projects/engine/src/lib/pipeline/judgment.spec.ts` (or the spec beside it), `projects/content/src/lib/generals/wei.spec.ts` and Dark Magic's spec

**Interfaces:**
- Consumes: Task 1.
- Produces: `judgmentView.rounds` (starts 0, incremented each time a *flagged choice* is opened while `judgmentView && !settled`; a changer with no ask step increments when its flagged selection opens); `describeDecision(state, seatId, legal, stepKey, opts?: { leadIn?: boolean })` returns kind `'judgmentChange'` with key `judgmentChange:<judgmentView.rounds>` for a pending choice or selection that has `judgmentChange` while the view is unsettled, with `leadInMs` = HEAD when `rounds === 1`, else REPLACE (all 0 when `opts.leadIn === false`); a settled judgment returns `'notice'` with `leadInMs` = TAIL, plus HEAD when `rounds === 0` (0 when `leadIn === false`). Devil and Dark Magic set `judgmentChange: true` on their ask and their selection.

- [ ] **Step 1: Write the failing tests**:
  - engine: `opening a flagged ask during an unsettled judgment increments rounds`; `an unflagged ask during an unsettled judgment does not`; `describeDecision gives judgmentChange with 10 s for a flagged ask and its follow-up selection under the same key`; `the first ask has the HEAD lead-in and later asks the REPLACE lead-in`; `a settled judgment is notice with TAIL, and HEAD plus TAIL when no ask happened`; `leadIn false gives zero lead-in`; `an unflagged choice during an unsettled judgment keeps the choice kind`.
  - engine: `defaultActionsFor a flagged ask returns decline, and for the follow-up selection returns cancel` (Review Focus 2).
  - content: `Devil's ask and selection carry judgmentChange`, same for Dark Magic.
- [ ] **Step 2: Run** the engine and content specs by name. Expected: FAIL.
- [ ] **Step 3: Implement** the type fields, the counter where the engine opens the pending decision (find the single place a pending choice or selection is set from an `ask` or `selection` effect), the `describeDecision` branches, and the content helper (mark both steps from one place so no changer can forget one). `defaultActionsFor` should already do the right thing; the test pins it.
- [ ] **Step 4: Run** `npx jest --selectProjects engine content`. Expected: PASS (existing judgment specs need `rounds: 0` in fixtures; fix them).
- [ ] **Step 5: Commit** `git commit -m "feat(engine): judgment rounds and a 10 s judgment-change decision"`

### Task 3: Verdict, effect and rule text in content

**Files:**
- Modify: `projects/content/src/lib/judgmentOutcome.ts`, `display.ts` (`JUDGMENT_OUTCOMES` neighbours; new `JUDGMENT_RULES`), `projects/content/data/locales/vi/prose.json`, `projects/content/src/public-api.ts`
- Test: `projects/content/src/lib/judgmentOutcome.spec.ts`, `prose.vi.spec.ts` (parity)

**Interfaces:**
- Produces: `JudgmentOutcome` gains `verdict: 'good' | 'bad' | 'neutral'` and `effect: { kind: 'damage'; amount: number; subject: 'seat' | 'owner' | 'source' } | { kind: 'skip-phase'; phase: 'Draw' | 'Play' } | { kind: 'keep-phase'; phase: 'Draw' | 'Play' } | { kind: 'pass-on' } | { kind: 'none' }`; `judgmentRuleText(readerId: string, locale?: string): string | null` (one sentence stating what makes this judgment good or bad, hand-written per reader id). Both are fixed per reader id and outcome key, using the spec's table with the keys from `JUDGMENT_OUTCOMES`.

- [ ] **Step 1: Write the failing tests**: `every reader and key in JUDGMENT_OUTCOMES has a verdict and an effect` (iterate `judgmentReaderIds()` and each key), `Lightning struck is bad with 3 damage to the seat`, `Capture skip is bad and skip-phase Play, spared is good and keep-phase Play`, `Starvation uses Draw`, `Unyielding damage outcomes are good with 1 damage to the source`, `Dueling Heroes is neutral`, `Lament outcomes are good except none`, `every reader has a rule text in English and in Vietnamese`.
- [ ] **Step 2: Run** `npx jest --selectProjects content --testPathPatterns judgmentOutcome` and the prose parity spec. Expected: FAIL.
- [ ] **Step 3: Implement**: add the data per reader beside its outcome key (in one table, not scattered `if`s), return it from `judgmentOutcome`, add rule lines (English, Vietnamese draft in `prose.json`). **Before implementing each reader's row, check it against that reader's code and list the final table in the report**, since a wrong stamp is visible to players; correct the verdict or effect, never the rule.
- [ ] **Step 4: Run** `npx jest --selectProjects content`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(content): verdict, effect and rule line for every judgment outcome"`

### Task 4: Server and protocol clocks

**Files:**
- Modify: `projects/protocol/src/game.ts` (`GameClockView.startsAt`), `version.ts`; `projects/server/src/game/gameRunner.ts` (`reschedule`, `clockView`, bot move delay, `describeDecision` calls)
- Test: `projects/server/src/game/gameRunner.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2 (`startsAt`, `leadInMs`, `describeDecision` `leadIn` option).
- Produces: `GameClockView.startsAt: number` (server time, ms); `describeDecision` is called with `{ leadIn: this.personControlled() }`; the clock timer fires at `endsAt`; a bot-played seat's move delay for a judgment-change decision is its normal delay plus the decision's lead-in when a person controls a seat; the version bumps by one.

- [ ] **Step 1: Write the failing tests**: `a settled judgment's clock starts after the lead-in and shows startsAt after serverNow`; `a game with no person-controlled seat has zero lead-in for a judgment` (Review Focus 1: run an all-bot game through a judgment and assert it is never held up by more than the bot delay); `a human changer's decision times out after the lead-in plus 10 s with the decline`; `a bot changer waits the lead-in before acting when a person is present`.
- [ ] **Step 2: Run** `npx jest --selectProjects server --testPathPatterns gameRunner`. Expected: FAIL.
- [ ] **Step 3: Implement** the changes; fix compile errors elsewhere from the new required `startsAt` (fixtures, `RemoteGameService` literals) with the smallest edits.
- [ ] **Step 4: Run** `npm run typecheck:server` and `npx jest --selectProjects server protocol`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(server): clock lead-in, startsAt and the judgment-change clock"`

### Task 5: Client clocks and bot delay

**Files:**
- Modify: `projects/app/src/app/decision-timer.service.ts`, `online/remote-game.service.ts` (`RemoteDecisionClock`), `game-board/decision-countdown.ts`, `game.service.ts` (local bot delay)
- Test: `decision-timer.service.spec.ts`, `online/remote-game.service.spec.ts` (or the existing specs beside them), `game-board/decision-countdown.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`clockStartsInMs`, `startsAt`), Task 4 (`GameClockView.startsAt`).
- Produces: `secondsLeft` shows the full total until the lead-in has passed, then counts down; `DecisionTimer` and `RemoteDecisionClock` expose `startsInMs: Signal<number | null>`; a judgment-change clock is shown to the deciding seat (and the notice clock to everyone, as today); the countdown component shows nothing while `startsInMs > 0` (the sequence is still playing); the local bot waits the lead-in before a judgment-change move when a human is present.

- [ ] **Step 1: Write the failing tests**: `the timer's secondsLeft stays at the total during the lead-in`; `at zero a judgment-change timeout submits the decline`; `RemoteDecisionClock shows the judgment-change clock only to the deciding seat`; `the countdown is hidden during the lead-in and visible after`; `the local bot's judgment-change move waits for the lead-in`.
- [ ] **Step 2: Run** `npx jest --selectProjects app --testPathPatterns "decision-timer|remote-game|decision-countdown"`. Expected: FAIL.
- [ ] **Step 3: Implement** the changes.
- [ ] **Step 4: Run** `npx jest --selectProjects app`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): lead-in aware decision clocks"`

### Task 6: The beat scheduler

**Files:**
- Create: `projects/app/src/app/game-board/beat-player.ts`, `projects/app/src/app/game-board/beat-player.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Beat { at: number; run: () => void }   // at: ms from start
  export interface BeatPlayback { stop(): void }
  export function playBeats(beats: readonly Beat[], opts?: { reducedMotion?: boolean }): BeatPlayback;
  export function prefersReducedMotion(): boolean;
  ```
  Beats run in `at` order; with `reducedMotion` all run immediately in order; `stop` cancels what has not run. Pure TypeScript over `setTimeout`, no Angular.

- [ ] **Step 1: Write the failing tests** (fake timers): `runs each beat at its time in order`; `runs everything at once, in order, under reduced motion`; `stop cancels the remaining beats`; `beats added with equal times keep their order`.
- [ ] **Step 2: Run** `npx jest --selectProjects app --testPathPatterns beat-player`. Expected: FAIL.
- [ ] **Step 3: Implement** `playBeats` and `prefersReducedMotion` (guarded `matchMedia`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): beat scheduler for popup sequences"`

### Task 7: The Judgment sequence

**Files:**
- Modify: `game-board/judgment-description.ts` (add verdict, effect, rule line, HP data for the damage subject, up to three replaced cards), `game-board/judgment-dialog.ts` (rewrite around the stage), `i18n/en.ts`, `i18n/vi.ts`
- Create: `game-board/judgment-stage.ts`, `game-board/judgment-stage.spec.ts`
- Test: `judgment-description.spec.ts`, `judgment-dialog.spec.ts`

**Interfaces:**
- Consumes: Task 3 (`verdict`, `effect`, `judgmentRuleText`), Task 6 (`playBeats`), Task 5 (`DecisionCountdown`).
- Produces: `JudgmentDescription` gains `verdict: 'good' | 'bad' | 'neutral' | null`, `effect`, `rule: string | null`, `hp: { current: number; max: number | null } | null` (the damage subject's public HP), `replaced: CardInstance[]` (the last three replaced cards, oldest first). `<app-judgment-stage [description] [decision]>`: renders source, rule, the card stack (flip, old cards struck out and fanned left), the stamp, the consequence area (hearts with the lost ones greying in turn; phase chips with the skipped one struck through; seat chips with an arrow; or the sentence only) and, in the same grid cell, a decision area slot (Task 8). The dialog starts the beats when it opens, unlocks Continue at the beat time, shows the 3 s countdown from unlock, and closes itself or on Continue. Beats run once per popup; a language switch re-renders text without restarting them.

- [ ] **Step 1: Write the failing tests**:
  - description: `carries verdict and effect from content`, `keeps only the last three replaced cards`, `reads the damage subject's HP from public state and tolerates a hidden maximum` (Review Focus 4).
  - stage (fake timers): `plays source, rule and card in order`, `draws a check for a good verdict, a cross for a bad one and nothing for neutral`, `strikes out and fans replaced cards`, `shows the damage hearts and greys the lost ones`, `shows the skipped phase struck through`, `shows the pass-on arrow`, `Continue is disabled until the unlock beat`, `reduced motion shows the final state at once`, `a language switch mid-sequence does not restart the beats` (Review Focus 3).
  - dialog: `closes through the existing close callback on Continue and when the 3 s countdown ends`.
- [ ] **Step 2: Run** `npx jest --selectProjects app --testPathPatterns "judgment"`. Expected: FAIL.
- [ ] **Step 3: Implement** the description extension, the stage component and the dialog rewrite, using the beat timings in the Global Constraints. Mirror the colours of the mock: the Force theme for the frame, `--force` for the source panel, good and bad verdict colours from existing semantic tokens (not Shu red for the cross if a better error token exists). Strings: new catalog keys for the rule label, the consequence tags ("−{n} HP"), phase chips, Continue.
- [ ] **Step 4: Run** `npx jest --selectProjects app`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): fixed Judgment sequence"`

### Task 8: The decision area

**Files:**
- Modify: `game-board/ask-dialog.ts`, `game-board/selection-dialog.ts` (extract the inner content into reusable panels `AskPanel` and `SelectionPanel` in new files `ask-panel.ts`, `selection-panel.ts`, used by the dialogs and by the stage), `game-board/judgment-stage.ts`, `game-board/judgment-dialog.ts`, `game-board/game-board.ts`
- Create: `game-board/judgment-decision.ts` (+ spec): the pure view-model
- Test: `ask-dialog.spec.ts`, `selection-dialog.spec.ts`, `judgment-decision.spec.ts`, `judgment-dialog.spec.ts`, `game-board.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`judgmentChange` flag), Task 5 (clocks), Task 7 (stage).
- Produces: `judgmentDecision(state, viewerSeatId, legal, tr): JudgmentDecisionView | null` where the view is `{ kind: 'mine'; steps: AskDescription | SelectionDescription; deciderName: string } | { kind: 'watching'; deciderName: string }`; the stage renders the panel for `mine` and the waiting line ("Waiting for {seat} to decide whether to change the judgment" plus spinner) for `watching`, each with the decision's 10 s countdown. The board does not open the Ask or Selection dialog for a pending decision that has `judgmentChange` while the Judgment dialog is open. The dialog opens the decision area at the beat the sequence reaches the decision round (after the head beats), and each round (first ask, replacement, next asker) re-runs the card, decision and replacement beats; the verdict beat runs when `settled` becomes true.

- [ ] **Step 1: Write the failing tests**:
  - panels: `AskDialog and SelectionDialog render through the shared panels and behave as before` (the existing specs keep passing).
  - decision: `a flagged ask for the viewer is mine with the ask description`, `after Use the selection is the next step for the same decision`, `another seat's flagged decision is watching with that seat's name`, `an unflagged decision is not a judgment decision`.
  - dialog: `shows the decision area after the head beats and not before`, `Use then a card submits the engine's own actions`, `a replacement strikes the old card and the next asker's round starts`, `the verdict waits for the last round`, `minimizing and restoring keeps the decision and its picks` (Review Focus 3).
  - board: `does not open the Ask or Selection dialog for a judgment-change decision while the Judgment dialog is open, and still opens them for other decisions`; `in Pass and Play the gate shows before the private decision area opens and the public beats are unaffected` (Review Focus 5).
- [ ] **Step 2: Run** `npx jest --selectProjects app --testPathPatterns "ask-dialog|selection-dialog|judgment|game-board"`. Expected: FAIL.
- [ ] **Step 3: Implement** the panels, the view-model, the stage's decision slot and the board suppression. The panels must submit only actions the engine offered (`legalActions`), never build their own.
- [ ] **Step 4: Run** `npx jest --selectProjects app`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): judgment-change decisions inside the Judgment popup"`

### Task 9: The Compete sequence

**Files:**
- Modify: `game-board/compete-dialog.ts` (rewrite around the beats), `game-board/compete-result.ts` (add the compared ranks and the tie line data), `i18n/en.ts`, `i18n/vi.ts`
- Test: `compete-dialog.spec.ts` (create if absent), `compete-result.spec.ts`

**Interfaces:**
- Consumes: Task 6 (`playBeats`).
- Produces: `AUTO_CLOSE_SECONDS = 3`; `CompeteResult` gains `comparison: { winnerRank: string; loserRank: string; tie: boolean }`; the dialog shows both sides in their own Force colours with a VS badge, lays the cards down, turns them together, lights the winner (scale, glow, Winners tag) and dims the loser, shows the comparison line ("K beats 8"; for a tie "9 ties 9. A tie counts as a loss for {challenger}"), then the outcome line, then unlocks Continue and starts the 3 s countdown; on a tie the challenged player is the winner. Several Competes still queue one at a time.

- [ ] **Step 1: Write the failing tests** (fake timers): `plays the beats in order with the winner lit and the loser dimmed`, `lights the challenged player on a tie and says so`, `Continue unlocks at 4200 ms and the dialog closes 3 s later`, `reduced motion shows the end state at once`, `two Competes open one after the other`; result: `carries the compared ranks and the tie flag`.
- [ ] **Step 2: Run** `npx jest --selectProjects app --testPathPatterns compete`. Expected: FAIL.
- [ ] **Step 3: Implement** the dialog and the result fields from the log data the popup already derives (no new engine fields).
- [ ] **Step 4: Run** `npx jest --selectProjects app`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): fixed Compete sequence"`

### Task 10: Docs, spec amendment and verification

**Files:**
- Modify: `docs/architecture/frontend.md` (Judgment popup, Compete popup, beats and the decision area), `docs/architecture/rules-engine.md` (clocks: kinds, lead-in, `rounds`), `docs/architecture/backend-and-deployment.md` (`GameClockView.startsAt`, protocol version), `docs/superpowers/specs/2026-10-26-judgment-compete-animation-design.md` (replace the three-row lead-in table with this plan's two-row rule), `docs/superpowers/specs/2026-10-20-judgment-popup-design.md` (a one-line note that the timer is now 3 s and the animation lifts the "no animation" non-goal)

- [ ] **Step 1: Update the docs** in their existing style and fix anything now wrong (grep for `notice`, `10 s`, `Compete popup`, `judgmentView`).
- [ ] **Step 2: Run** `npx jest` (all projects), `npm run typecheck:server`, and `npx ng build app`. Expected: all PASS; the build may print the existing bundle-budget warning.
- [ ] **Step 3: Check in the running app** (use the `run` skill) one judgment with no decision, one with a decision you decline, one with a replacement, and a Compete, at desktop and phone width. If you cannot view the UI, say so in the report; do not claim it was checked.
- [ ] **Step 4: Commit** `git commit -m "docs: judgment and compete animations"`
