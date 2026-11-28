# Beginner-Friendly UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clearer popups for beginners: notice and chain clocks retimed, concrete outcome text, a verdict read from the affected seat, and two experiments (skip dead-end windows, show the Blaze card) behind off-by-default flags.

**Architecture:** Clocks are engine constants (`decisionClock.ts`) read by app and server. Outcome text and verdict data live in content (`display.ts`, `judgmentOutcome.ts`, Vietnamese `prose.json`). The experiments are `FEATURE_FLAGS` entries read in `game-board.ts`.

**Tech Stack:** TypeScript, Angular standalone components and signals, Jest (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-28-beginner-friendly-ux-design.md`

## Global Constraints

- Decision clocks (response, Wuxie, ask, dying, pick) keep their current values.
- Notice popups and the Judgment final result: 5 s. Harvest notice: `1.5 s × participants`, minimum 3 s, maximum 7 s.
- Zhen Ji (`river-goddess`, `kingdomWars:goddess-luo`): the first use of the effect asks for 20 s (as now); every "judge again" ask is 8 s.
- The engine never hides a window (`announcePass` stays); the skip is in the app only, behind a flag that ships off. Only Sha, Hail of Arrows, Barbarians and Duel may be skipped; Coerce, Upheaval and Instigate keep their popups.
- Skipped code is kept, not deleted. Tutorial lessons never skip.
- UI text style from `CLAUDE.md`: English sentence case for outcome lines with keywords capitalised ("Play Phase"); Vietnamese sentence case; new Vietnamese is draft.
- Docs follow the documentation style rules in `CLAUDE.md`.
- Run `npm run verify` and `npm test` before the last commit; never push or merge.

## Review Focus

- **A seat with a Shan conversion skill:** Its legal actions include a `UseConversionAction`, so the dialog is not skipped.
- **Tutorial:** With the flag on, lessons still open their response windows.
- **Double submit:** A language change or reopen (`reopenOwedDialogs`) must not submit the Pass twice.
- **Harvest bounds:** 1 and 2 participants give 3 s; 4 give 6 s; 5 or more give 7 s (cap), never fractional below 3.
- **Chain rounds:** Goddess Luo's second and later "judge again" asks are 8 s in both Kingdom Wars and Identity; her first ask stays 20 s.
- **Locale parity:** Every key with English outcome text has Vietnamese text (`prose.json` parity spec).

---

### Task 1: Clocks

**Files:**
- Modify: `projects/engine/src/lib/rules/decisionClock.ts` and `decisionClock.spec.ts`
- Modify: `projects/content/src/lib/resolutionNotices/harvest.ts` (+ its spec)
- Modify: `projects/app/src/app/game-board/resolution-notice-dialog.ts:17` and its spec (`NOTICE_SECONDS` expectation, line ~114)
- Modify: `projects/content/src/lib/resolutionNotice.ts:37` (stale comment), `docs/architecture/rules-engine.md` and `backend.md` (clock tables)

**Interfaces:**
- Produces: `DECISION_SECONDS.notice = 5`, new `DECISION_SECONDS.judgeAgain = 8`, `NOTICE_SECONDS = 5`, `harvestSeconds(participants: number): number` exported from `harvest.ts`.

- [ ] **Step 1: Write failing tests.** In `decisionClock.spec.ts`: a settled judgment gives `kind: 'notice'` with 5 s; a chain ask with `view.rounds === 0` or `>= 1` gives `kind: 'judgeAgain'` (the first use of the skill, a `pendingChoice` without `continuing`, still gives `ask` 20). In the harvest spec: `harvestSeconds(1) === 3`, `(2) === 3`, `(4) === 6`, `(5) === 7`, `(9) === 7`, and the notice's `seconds` equals it.
- [ ] **Step 2: Run** `npx jest projects/engine/src/lib/rules/decisionClock.spec.ts projects/content -t "harvest|clock"`; expect FAIL.
- [ ] **Step 3: Implement.** Set `notice: 5`; add `judgeAgain: 8` ("a Goddess Luo chain's judge-again ask"); in `describeDecision` return `{ ...step('judgeAgain'), leadInMs … }` for the `chainAsk` branch; `harvestSeconds = (n) => Math.min(7, Math.max(3, n * 1.5))`; `NOTICE_SECONDS = 5`; fix the stale comment; update the docs tables to the code values (wuxie 20, ask 20, arrange 90, judgmentChange 20, notice 5, judgeAgain 8).
- [ ] **Step 4: Run** `npx jest projects/engine projects/content projects/app/src/app/game-board/resolution-notice-dialog.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `Retime notices, Harvest and Zhen Ji's judge-again asks`.

### Task 2: Concrete outcome text

**Files:**
- Modify: `projects/content/src/lib/display.ts` (`JUDGMENT_OUTCOMES` ~421, `COMPETE_OUTCOMES` `intense-edge.lost`)
- Modify: `projects/content/data/locales/vi/prose.json` (`judgmentOutcomes`, `competeOutcomes`)
- Modify: `projects/app/src/app/i18n/en.ts`, `vi.ts` (`notice.*`, `response.outcome.*` entries that read vague)
- Test: the existing prose parity and judgment-outcome coverage specs in `projects/content`

**Interfaces:**
- Consumes: `judgmentOutcomeText(readerId, key, names, locale)` (unchanged).

- [ ] **Step 1: Audit.** Run `grep -rn "Nothing happens\|Không có gì xảy ra" projects/` and list every hit (about 10 Judgment keys, `intense-edge.lost`, `rules.*` wiki lines which stay).
- [ ] **Step 2: Write a failing spec** in `projects/content/src/lib/display.spec.ts`: no English `JUDGMENT_OUTCOMES` or `COMPETE_OUTCOMES` text equals "Nothing happens", and `judgmentOutcomeText('capture','spared',…)` returns `"{seat} resumes the Play Phase normally"` with the name filled in.
- [ ] **Step 3: Replace the texts.** Use: `capture.spared` "{seat} resumes the Play Phase normally"; `starvation.spared` "{seat} resumes the Draw Phase normally"; `eight-trigrams.none` and `eight-arrays.none` "{seat} has no Shan from the judgment"; `unyielding.spared` "{source} takes no damage and discards nothing" (check the rule in `wei.ts` first); `iron-cavalry.none` "The Sha can still be dodged"; `lightning-strike.none` and `kingdomWars:lightning-strike.none` "No damage"; `lament.none` "Nothing is gained or lost" only if no better fact exists (read `mountain.ts`); `intense-edge.lost` "{user} takes no card and {target} loses nothing". Add Vietnamese draft lines to `prose.json` in the same keys, keeping the capitalisation rules.
- [ ] **Step 4: Run** `npx jest projects/content`; expect PASS. Run `npm run i18n:status` and note the new draft count.
- [ ] **Step 5: Commit** `Say what each resolution outcome does`.

### Task 3: Verdict from the affected seat, and the outcome box

**Files:**
- Modify: `projects/content/src/lib/judgmentOutcome.ts`, `judgmentOutcome.spec.ts`
- Modify: `projects/app/src/app/game-board/judgment-description.ts` (builds the view), `judgment-stage.ts` (stamp label at ~80-91, outcome box styles ~149 and CSS)
- Test: `judgment-description.spec.ts`, `judgment-stage.spec.ts`

**Interfaces:**
- Produces: `JudgmentOutcome.seats.affected: string` (seat id whose point of view the verdict takes). Defaults to the judged seat; `iron-cavalry` uses `(view.data.step as CardStep).target.seatId`; `unyielding` uses its damage source. Their `PRESENTATION` rows are flipped to that seat's view: `iron-cavalry: { unblockable: bad(), none: good() }`, `unyielding: { 'discard-or-damage': bad(), damage: bad(damage…), spared: good() }`. Every other reader keeps its judged-seat view (`lament` keeps it: its damage-source effects are a mix, an audit-found call).
- Consumes: the view builder passes `affectedSeatName` to the stage in place of `judgedSeatName` for the stamp.

- [ ] **Step 1: Write failing tests.** `judgmentOutcome.spec.ts`: for `iron-cavalry` with a red card, `verdict === 'bad'` and `seats.affected` is the Sha target, not the owner; with a black card `verdict === 'good'`. For `capture`, `seats.affected === seats.seat`. `judgment-description.spec.ts`: the stamp seat name is the affected seat's.
- [ ] **Step 2: Run** the three specs; expect FAIL.
- [ ] **Step 3: Implement** the `affected` field in `judgmentOutcome()`, the flipped rows, and the stamp using the affected seat name (the key `judgment.verdict.good|bad` is unchanged).
- [ ] **Step 4: Outcome box.** In `judgment-stage.ts` shrink the empty space: the box sizes to its text (no fixed min-height) when no consequence line sits in it, and the consequence line is shown larger and centred. Check against the first screenshot (a large blank frame under one line).
- [ ] **Step 5: Run** `npx jest projects/content projects/app/src/app/game-board`; expect PASS. Commit `Read the Judgment verdict from the affected seat`.

### Task 4: Skip windows with no answer (experiment flag)

The windows that can open with only Pass legal are: Sha, Hail of Arrows, Barbarians, Duel, Coerce, Upheaval, Instigate. The developer chose to skip the first four. Coerce, Upheaval and Instigate keep their popups (a pass costs a weapon, HP or a card, so they work as notices).

**Files:**
- Modify: `projects/app/src/app/feature-flags.ts` and `feature-flags.spec.ts`
- Modify: `projects/app/src/app/game-board/game-board.ts` (`responseDue` ~409, effect ~553), plus a spec beside it

**Interfaces:**
- Produces: `type NoAnswerWindow = 'sha' | 'hail-of-arrows' | 'barbarians' | 'duel' | 'coerce' | 'upheaval' | 'instigate'`; `FeatureFlags.skipNoAnswerWindows: readonly NoAnswerWindow[]`, `[]` in `featureFlagsFor` (off); `export const BEGINNER_SKIP_WINDOWS: readonly NoAnswerWindow[] = ['sha', 'hail-of-arrows', 'barbarians', 'duel']`, the list to put in the flag to turn the experiment on.
- Produces: `noAnswerWindowOf(pending: PendingResponse): NoAnswerWindow | null` in `projects/app/src/app/game-board/response-description.ts`, from the pending response's reason (the card's definition id for card effects; `abilityId` `upheaval` or `instigate` for skills). Verify the real ids for Arrows and Barbarians in `mass-attack.ts` callers.
- Consumes: `FEATURE_FLAGS`, `GameService.submit(action)`, the legal `PassAction`.

- [ ] **Step 1: Write failing tests.** Flag `[]`: a viewer with only a PassAction sees the dialog (as today). Flag `BEGINNER_SKIP_WINDOWS`, Sha window: no dialog and `submit` is called once with the PassAction. Same flag, a Coerce, Upheaval or Instigate window: the dialog opens. A legal `UseConversionAction` present: the dialog opens. In a Tutorial lesson: the dialog opens. `noAnswerWindowOf` returns the right name for each of the seven.
- [ ] **Step 2: Run** the specs; expect FAIL.
- [ ] **Step 3: Implement.** Add the flag with a comment pointing to `docs/deferrals.md` ("Experiment flags are code constants, not feature toggles"). In `game-board.ts` add a private `skipsWindow(pending)`: its window name is in the flag's list, not a Tutorial lesson, and every legal action is a `PassAction`. In the effect at ~553, when true, submit the Pass once (remember the pending id so a rebuild does not submit twice) and do not open the dialog; keep `openResponseDialog` untouched.
- [ ] **Step 4: Run** `npx jest projects/app`; expect PASS. Commit `Add an experiment flag to skip chosen response windows with no answer`.

### Task 5: Show the revealed card in the Blaze picker (experiment flag)

**Files:**
- Modify: `projects/app/src/app/feature-flags.ts` (+ spec), `projects/app/src/app/game-board/selection-dialog.ts` (+ spec), the `selection` data builder in `game-board.ts`

**Interfaces:**
- Produces: `FeatureFlags.showBlazeCard: boolean`, off. `SelectionDialogData.shownCard?: CardInstance`, set only for a selection whose `then.step.step === 'blaze-hit'`, to the card the target showed (the `CardShownEvent` of this span; find it from the log as `resolutionNotices/blaze.ts` does).

- [ ] **Step 1: Write failing tests.** Flag on, a `blaze-hit` selection: the dialog renders the shown card's name and face above the choices. Flag off or another selection: nothing extra.
- [ ] **Step 2: Run**; expect FAIL.
- [ ] **Step 3: Implement** the flag, the data field and the dialog header (reuse the existing card component used in the Resolution notice). Text: English "Shown by {seat}", Vietnamese draft "Lá do {seat} lật", sentence case.
- [ ] **Step 4: Run** `npx jest projects/app`; expect PASS. Commit `Add an experiment flag to show the Blaze card in the picker`.

### Task 6: Verify and look at it

- [ ] **Step 1:** Run `npm run verify` and `npm test`; both green.
- [ ] **Step 2:** In the browser pane, start the app (`preview_start` from `.claude/launch.json`) and open the real windows: Iron Cavalry and Contentment Judgments (stamp and outcome box), a Capture "spared" outcome, Harvest's notice length, a Zhen Ji chain (8 s asks). With each flag on in a local build, confirm the skip and the Blaze header. Record anything not seen in `docs/deferrals.md`.
- [ ] **Step 3:** Commit any fixes. Do not push.
