# Judgment Notice, Stage 4: The Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every judgment shows a popup to every seat (source, card with each replacement, consequence, 10 s countdown, Close, View Board), the game waits for it, and new local and online games turn the rule on.

**Architecture:** A pure `judgmentDescription()` turns the table-wide public state into everything the popup shows (using stage 2's `judgmentOutcome` and `judgmentOutcomeText`). `GameBoard` computes it from a new `publicState` of its game service, opens a `JudgmentDialog` while a judgment view exists and closes it when it goes, and wires Close to the stage 3 `closeJudgment`. The dialog reads the description live, so replacements and a language switch update it in place. Last, the rule is switched on in `GameService.startGame` and the server's `startGame`.

**Tech Stack:** Angular (standalone, signals), Angular Material dialog, TypeScript, Jest.

**Spec:** `docs/superpowers/specs/2026-10-20-judgment-popup-design.md` ("Application layer and UI", "Online"). Stages 1 to 3 are built (engine view and wait, outcome text, server/bots/local runtime).

## Global Constraints

- UI text casing (CLAUDE.md): English Title Case for names and short labels ("Judgment", "Consequence"), sentence case for sentences; Vietnamese sentence case everywhere; keywords (seat, card, General names, forces, HP) keep capitals; no ids shown. New Vietnamese strings are drafts.
- No game rule in a component: the consequence comes from content's `judgmentOutcome`, who may close from the services (`canCloseJudgment`).
- The popup shows only public information: it is built from a table-wide view in which hands and unrevealed Generals are masked.
- Reuse `openForceDialog`, `MinimizeButton`, `DecisionBanner`, `DecisionCountdown`, `app-card-art`, `app-playing-card`; do not change how the other dialogs behave.
- Every new `en.ts` key has a `vi.ts` key with the same placeholders (`catalogs.spec.ts`).
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch: `feat/judgment-notice-popup` off `feat/judgment-notice-runtime`. Stage `git add` with explicit paths only (the working tree holds the user's unrelated edits to `projects/app/src/app/game-board/seat-avatar.spec.ts`, `projects/content/src/lib/assets.ts` and `assets.spec.ts`).

## Review Focus

- Pass and Play: the popup opens over the "Pass the device" gate with no hand-off, shows no hidden hand card or unrevealed General, and its Close works from there (Tasks 1, 4).
- A reader without outcome text: the popup opens and shows no consequence line, never crashes (Task 2).
- A skill owner's Response or Ask popup opens over the Judgment popup, and answering it adds the replacement line to the same open popup (Task 4).
- A language switch while the popup is open or minimized updates its text and the banner title (Task 4).
- Back-to-back judgments (River Goddess): the popup closes at the acknowledgement and a new one opens for the next card (Task 4).
- A viewer who cannot close (a bot-played seat, offline, a spectator) sees the countdown but no Close button (Tasks 1, 3).
- Online: no "thinking…" marker for a notice clock a person is closing, and no 1.5 s countdown for a bot's close (Task 1).
- With the rule on, a whole local game and a whole server game still play to the end (Task 5).

## File Structure

- Modify `projects/protocol/src/game.ts` (+ schema if the client validates it), `projects/server/src/game/gameRunner.ts` (`clockView`): `bot` flag on the clock.
- Modify `projects/app/src/app/game.service.ts`, `online/remote-game.service.ts` (+ specs): `publicState`, `canCloseJudgment`, clock fixes, `BoardGame`.
- Create `projects/app/src/app/game-board/judgment-description.ts` (+ spec, + vi spec).
- Create `projects/app/src/app/game-board/judgment-dialog.ts` (+ spec, + vi spec).
- Modify `projects/app/src/app/game-board/game-board.ts` (+ spec): open/close, close wiring, rebuild list.
- Modify `projects/app/src/app/i18n/en.ts`, `vi.ts`.
- Modify `projects/server/src/rooms/roomService.ts` and the specs that stall (Task 5).

---

### Task 1: Services, clock fixes and the public view

**Files:**
- Modify: `projects/protocol/src/game.ts`, `projects/server/src/game/gameRunner.ts`, `projects/app/src/app/game.service.ts`, `projects/app/src/app/online/remote-game.service.ts`
- Test: `projects/server/src/game/gameRunner.spec.ts`, `projects/app/src/app/game.service.spec.ts`, `projects/app/src/app/online/remote-game.service.spec.ts`

**Interfaces:**
- Produces:
  - `GameClockView.bot?: true` — set by the server's `clockView()` when the timer is a bot move (`timer.kind === 'bot'`).
  - `GameService.publicState: Signal<GameState | null>` = `redactStateForSeat(state, '')` (a viewer id matching no seat: every hand and unrevealed General masked), null without a game; `GameService.canCloseJudgment: Signal<boolean>` = a judgment is settled and the acting seat is not a bot seat.
  - `RemoteGameService.publicState` = its own `state` (already the member's redacted view); `canCloseJudgment` = `legalActions()` contains an `AcknowledgeJudgmentAction`.
  - `BoardGame` gains `'publicState' | 'canCloseJudgment' | 'judgmentSettled' | 'closeJudgment'`.
  - `LocalClock.bot: boolean` (from `clock.bot === true`); `botThinkingSeatId` ignores a `'notice'` clock that is not a bot's; `RemoteDecisionClock.own` returns a `'notice'` clock only when `!clock.bot`.

- [ ] **Step 1: Write failing tests**:
  - `gameRunner.spec.ts`: `'a bot's move timer is flagged bot in the clock, a person's clock is not'` (after `settle` with no person playing, `updateFor(...).clock` has `bot: true`; with a person playing it has no `bot` key).
  - `game.service.spec.ts`: `'publicState masks every hand and unrevealed General, even the acting seat's'`; `'canCloseJudgment is true for the human and in Pass and Play, false when a bot acts'` (use `settleJudgment` from `settled-judgment.testing.ts`).
  - `remote-game.service.spec.ts`: `'canCloseJudgment follows the server's offer'`; `'a notice clock on a bot-played seat that a person is closing is not "thinking"'` (clock `{ seatId: 'seat-1', kind: 'notice' }` without `bot`, seat-1 a bot seat ⇒ `botThinkingSeatId()` null); `'a bot's own notice clock is "thinking" and shows no countdown'` (same with `bot: true` ⇒ `botThinkingSeatId()` is `'seat-1'`, `RemoteDecisionClock.secondsLeft()` null).
- [ ] **Step 2: Run** `npx jest projects/server/src/game/gameRunner.spec.ts projects/app/src/app/game.service.spec.ts projects/app/src/app/online/remote-game.service.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the items above (the existing clock specs must keep passing: a clock without `bot` on a bot seat and kind other than `'notice'` is still "thinking").
- [ ] **Step 4: Run** `npx jest projects/server projects/app projects/protocol` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): public view and close offer for the judgment popup; fix the notice clock display`.

### Task 2: What the popup shows

**Files:**
- Create: `projects/app/src/app/game-board/judgment-description.ts`, `judgment-description.spec.ts`, `judgment-description.vi.spec.ts`
- Modify: `projects/app/src/app/i18n/en.ts`, `vi.ts`

**Interfaces:**
- Consumes: `judgmentOutcome`, `judgmentOutcomeText`, `generalDisplayData`, `abilityName` from `content`; `forceOf`, `Force`, `seatName`, `generalDisplayName`, `abilityDisplayName`, `cardIdDisplayName`, `shownCardId`, `cardFaceLabel` from `../labels`; `Translator`, `localeOf` from `../i18n/translator`.
- Produces:
  ```ts
  export type JudgmentSource =
    | { kind: 'skill'; generalId: string | null; generalName: string; abilityName: string; skillText: string | null }
    | { kind: 'card'; cardName: string; seatName: string };
  export interface JudgmentDescription {
    force: Force;                 // the skill owner's seat force; for a card, the judged seat's; 'none' when hidden
    source: JudgmentSource;
    judgedSeatName: string;
    card: CardInstance;           // as it stands now
    changes: { text: string; card: CardInstance }[];   // one line per replacement
    settled: boolean;
    outcome: string | null;       // only once settled, and only for a reader with an entry
    waiting: string | null;       // only while not settled
  }
  export function judgmentDescription(state: GameState, registry: ContentRegistry, tr: Translator): JudgmentDescription | null; // null without a judgmentView
  ```
- New message keys (en / vi, drafts): `judgment.title` ("Judgment" / "Phán xét"), `judgment.card` ("Judgment Card" / "Lá phán xét"), `judgment.outcome` ("Consequence" / "Hệ quả"), `judgment.source.card` ("{card} on {seat}" / "{card} của {seat}"), `judgment.changed` ("{owner}'s {ability} replaced {old} with {new}" / follow `history.judgmentChanged`), `judgment.waiting.seat` ("Waiting for {seat} to decide whether to change the judgment" / …), `judgment.waiting` ("Waiting for skills that can change the judgment" / …).
- Behavior: General and skill text as `competeResults` does (`generalId` null when the slot is `'hidden'`; skill text found by the skill's display name); `outcome` is `judgmentOutcomeText(readerId, key, { seat, owner, source }, localeOf(tr))` with seat names from `seatName` and `source` falling back to the owner's name; `waiting` names the seat in `pendingChoice?.seatId ?? pendingSelection?.seatId` when there is one, else the generic line.

- [ ] **Step 1: Write failing tests** (`judgment-description.spec.ts`, states from the content `skills.testing` helpers or hand-built, public-masked with `redactStateForSeat(state, '')`):
  - `'a skill judgment names the General, the skill and the owner's force'` (e.g. a revealed Wei seat with `unyielding`: `source.kind === 'skill'`, `force: 'Wei'`, `generalId` set, `skillText` non-null).
  - `'a card judgment names the card and the judged seat, in the judged seat's force'` (Lightning on a Shu seat).
  - `'a hidden judged seat is the neutral force'` (unrevealed seat ⇒ `'none'`).
  - `'each replacement is a line'` (two changes ⇒ two texts naming owner, skill and both faces).
  - `'unsettled: waiting names the deciding seat, no outcome'`, `'settled: the outcome text and no waiting'`, `'a reader without an entry has no outcome'` (a stub reader id).
  - `'null without a judgment view'`.
  - `judgment-description.vi.spec.ts`: the same description in Vietnamese (`I18n.setLocale('vi')`, as `compete-result`'s vi spec does): outcome and waiting text in Vietnamese.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board/judgment-description` — Expected: FAIL.
- [ ] **Step 3: Implement** `judgmentDescription` and add the keys to `en.ts` and `vi.ts`.
- [ ] **Step 4: Run** `npx jest projects/app` — Expected: PASS (`catalogs.spec.ts` enforces key parity).
- [ ] **Step 5: Commit** `feat(app): what the judgment popup shows, in English and Vietnamese`.

### Task 3: The dialog

**Files:**
- Create: `projects/app/src/app/game-board/judgment-dialog.ts`, `judgment-dialog.spec.ts`, `judgment-dialog.vi.spec.ts`

**Interfaces:**
- Consumes: Task 2's `JudgmentDescription`; `CardArt`, `PlayingCard`, `DecisionCountdown`, `MinimizeButton`, `TPipe`, `ui.close`.
- Produces: standalone `JudgmentDialog` (selector `app-judgment-dialog`) and
  ```ts
  export interface JudgmentDialogData {
    description: Signal<JudgmentDescription | null>;   // read live
    canClose: Signal<boolean>;
    close: () => void;                                  // submits the close
  }
  ```
  Template: `.title-row` with `<h2 mat-dialog-title>{{ 'judgment.title' | t }}</h2>` and `<app-minimize-button />`; the source (General art `app-card-art [skin]="true"` and "General · Skill" with skill text, or the card line), the judgment card (`app-playing-card`) with one `.change` line per replacement; a `.outcome` section ("Consequence" + sentence) only when `outcome` is non-null; a `.waiting` line when `waiting` is non-null; and, only while `settled`, `<app-decision-countdown />` and a `button.close` (label `ui.close`) that is present only when `canClose()` and calls `data.close()`. Themed through `force-dialog-<force>` by the opener, like the Compete dialog.

- [ ] **Step 1: Write failing tests** (render with `MAT_DIALOG_DATA` and a `MatDialogRef` mock, as `response-dialog.spec.ts` does):
  - `'shows the source, the card and each replacement'`; `'shows the consequence only when there is one'`; `'unsettled: the waiting line, no countdown, no Close'`; `'settled: the countdown and a Close button that calls close'` (click `button.close` ⇒ `data.close` called once); `'settled but the viewer cannot close: no Close button, countdown still there'`; `'updates in place when the description signal changes'` (set the signal to a description with one more change and a different outcome, `detectChanges`, the new text is shown); `'has a View Board button'` (`app-minimize-button`).
  - `judgment-dialog.vi.spec.ts`: title "Phán xét", Close "Đóng", outcome and waiting lines in Vietnamese.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board/judgment-dialog` — Expected: FAIL.
- [ ] **Step 3: Implement** `JudgmentDialog`, with styles in the style of `compete-dialog.ts` (source block tinted with `var(--force)`, title in `var(--force-text)`).
- [ ] **Step 4: Run** `npx jest projects/app` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(app): the judgment dialog`.

### Task 4: The board opens it

**Files:**
- Modify: `projects/app/src/app/game-board/game-board.ts` (a computed, an effect, `openJudgmentDialog`, `closeJudgment`, the rebuild list)
- Test: `projects/app/src/app/game-board/game-board.spec.ts`, `game-board.vi.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3; `GameService` (or `RemoteGameService` through `OnlineGame`) `publicState`, `canCloseJudgment`, `closeJudgment`, `humanSeatId`, `revealedSeatId`.
- Behavior: `private readonly judgmentView = computed(() => { const s = this.gameService.publicState(); return s ? judgmentDescription(s, this.gameService.registry, this.i18n.translator) : null; })`. An effect on `judgmentView() !== null` (untracked inside) opens the dialog when it appears and closes it when it goes: `openForceDialog(this.dialog, JudgmentDialog, description.force, { data, width: 'min(92vw, 560px)', disableClose: true })` with `data = { description: this.judgmentView, canClose: this.gameService.canCloseJudgment, close: () => this.gameService.closeJudgment(this.gameService.humanSeatId() ?? this.gameService.revealedSeatId()) }`; the ref is cleared in `beforeClosed`. It opens regardless of the Pass and Play gate. `rebuildMinimizedDecision`'s reopen list gains `if (this.judgmentView()) this.openJudgmentDialog()` so a minimized judgment gets its banner title in the new language.

- [ ] **Step 1: Write failing tests** (use `settleJudgment` and `gameService.startGame(..., { judgmentNotice: true })`):
  - `'opens the judgment popup when a judgment is on show, and closes it when it is acknowledged'` (the overlay holds `app-judgment-dialog`; `closeJudgment` ⇒ gone).
  - `'in Pass and Play the popup opens over the gate and Close works from there'` (`revealedSeatId()` null, the gate overlay present, the popup present, click `button.close` ⇒ acknowledged with `by` null or the holder).
  - `'its description holds no hidden hand card'` (the dialog text contains no hand card name of another seat).
  - `'minimizing it shows the banner titled Judgment with the countdown; clicking the banner restores it'`.
  - `'a skill owner's Response popup opens over it, and answering adds the replacement line to the same popup'` (drive a changer skill's ask with a revealed Devil-like General from the content `skills.testing` fixtures, or an engine-level `JudgmentChangedEvent` injected into the state; the dialog count of `app-judgment-dialog` stays 1).
  - `'switching language while it is open updates its text; while minimized, also the banner title'` (`game-board.vi.spec.ts`: "Phán xét" in the dialog title and in the banner).
  - `'back-to-back judgments: it closes at the acknowledgement and a new one opens for the next card'`.
  - `'a bot's judgment with no human left: the popup shows the countdown and no Close'` (vs-bots with the human eliminated).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board/game-board` — Expected: FAIL.
- [ ] **Step 3: Implement** the computed, the effect, `openJudgmentDialog`, the rebuild-list entry, and add `'publicState' | 'canCloseJudgment' | 'judgmentSettled' | 'closeJudgment'` use sites (the online board gets them through the `GameService` alias in `OnlineGame`).
- [ ] **Step 4: Run** `npx jest projects/app` and `npx tsc --noEmit -p projects/app/tsconfig.app.json` — Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat(app): the board opens the judgment popup`.

### Task 5: Turn the rule on

**Files:**
- Modify: `projects/app/src/app/game.service.ts` (`startGame`), `projects/server/src/rooms/roomService.ts` (`startGame`), and any spec that stalls
- Test: `projects/app/src/app/game.service.spec.ts`, `projects/server/src/rooms/roomService.spec.ts`

**Interfaces:**
- Behavior: `GameService.startGame(...)` creates the game with `{ ...rules, judgmentNotice: rules?.judgmentNotice ?? true }`. `roomService.startGame(entry)` uses `const rules = { ...room.record.rules, judgmentNotice: true }` for both `openingState(...)` and `tx.games.create({ ..., rules })`. The lobby snapshot's `rules` (from `rulesFrom`) is unchanged.

- [ ] **Step 1: Write failing tests**: `game.service.spec.ts` `'new games have the judgment notice on unless a rule says otherwise'` (`state().rules?.judgmentNotice` true by default, false when `startGame(..., { judgmentNotice: false })`); `roomService.spec.ts` `'a started game stores judgmentNotice true and the room's rules stay as chosen'` (the stored game's `rules.judgmentNotice` is true, `room.rules` has no such key).
- [ ] **Step 2: Run** the two specs — Expected: FAIL.
- [ ] **Step 3: Implement** both merges.
- [ ] **Step 4: Run the whole suite** `npm test` and `npx tsc --noEmit -p projects/app/tsconfig.app.json`. Specs that play real games may now stall on a settled judgment (candidates: server `gameSocket.spec.ts` with its 3 s timeout and takeover waits, `roomGames.spec.ts`, `soloRooms.spec.ts`, app `game-board.spec.ts` loops, `decision-timer.service.spec.ts` seed searches). Fix each by pinning the old behavior in that spec (`{ judgmentNotice: false }` for local games; for the server, an injectable `RoomServiceOptions.judgmentNotice` defaulting to true that those specs set to false) or by closing the judgment in the loop; leave the production default on, and record each pin in the commit message. Expected: all PASS.
- [ ] **Step 5: Run a real game** with the `run` skill: start vs-bots, play until a judgment (Lightning or a skill), and check the popup, the countdown, Close, View Board with the banner, and a language switch; report what you saw.
- [ ] **Step 6: Commit** `feat: new games wait for the judgment popup (judgmentNotice on)`.
