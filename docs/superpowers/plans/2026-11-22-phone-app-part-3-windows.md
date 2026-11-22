# Phone App, Part 3 (Windows on the Phone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every window and screen that can open during a game fits the phone (800 × 366 on the Honor 400 Pro, down to 760 × 340) with buttons at least 44 px tall and no text under 12 px, and three phone board leftovers are closed.

**Architecture:** One block of phone rules in `styles.scss` for everything in the overlay container on the `compact` layout (Material button heights, card names in windows); a few component rules where a window has its own sizes (Seat Details, General info traits); a compact layout for Game Over and the online result; small changes in `PhoneBoard`, `PhoneCentreBand` and `HandView` for the leftovers.

**Tech Stack:** Angular, Material, SCSS, Jest; the browser audit at `/preview` scenarios.

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, section "4. Windows on the phone" and "Sizes".

## The audit (2026-11-22, 800 × 366, `compact`)

Measured on the dev server with every `/preview` scenario in an 800 × 366 frame.

- **Every decision, response and info window fits** (top 8 px, bottom 358 px) with its buttons on screen and no page scroll, thanks to the existing short-screen dialog rule in `styles.scss`.
- **Buttons under 44 px:** Material's buttons are 40 px in every window (View Board, Use, Don't, Confirm, Close); the option buttons in the partners choice are 32 px; Seat Details' card buttons 35 px and Close 32 px; the General info Close 32 px.
- **Text under 12 px:** Card names on the cards inside windows are 11 px (Judgment, Compete, every response window, Discard); the skill trait chips in the General info window and the General picker are 11 px.
- **Game Over overflows:** About 570 px tall on a 366 px screen; the page scrolls and New Game is off screen.
- **Not measured by the audit** (they need a move first): Resolution notices, the Resurgence screen, the Victory reveal, the decision banner and countdowns. Task 5 checks them by hand.

## Decisions

- **The developer (2026-11-22):** Game Over gets a compact title, the winner and loser columns scroll, and New Game stays fixed at the bottom. The thinking line, Seat Details closing with the board, and the hand padding are folded in.
- **My calls:**
  - **Phone rules live in one place** (`html[data-layout='compact'] .cdk-overlay-container` in `styles.scss`) rather than in each dialog, since every window is a Material dialog. Component rules only where a component sets its own size.
  - **Card names in windows are 14 px**, wrapping to two lines, as in the phone hand.
  - **Trait chips are 12 px** (they are labels, not names).
  - **Tests:** jsdom applies no styles, so the CSS rules are pinned by reading the source (as earlier phone tasks did) and the acceptance check is the browser audit at both sizes. Behaviour changes (thinking line, Seat Details closing, hand padding) get ordinary Jest tests.

## Global Constraints

- Presentation only. No engine, content, bots, protocol or server changes.
- The medium and large layouts do not change: Every new rule is scoped to `compact`.
- Same components with phone styles, no second copies.
- Phone sizes: No text under 12 px; 14 px for names, card names and buttons; tap targets at least 44 × 44 px; nothing scaled down.
- Work on `feat/phone-app-windows`, branched from `feat/phone-app-install` (PR 80). The agent never merges or pushes to `main`.

## Review Focus

- **A window taller than the screen** (a long skill text, Discard with many cards): The content scrolls, the buttons stay on screen. Checked in Task 6.
- **Vietnamese** (longer labels): Buttons stay 44 px and wrap rather than overflow. Checked in Task 6.
- **Game Over with 12 seats:** The lists scroll; New Game stays on screen. Pinned in Task 2, checked in Task 6.
- **A bot thinking while you are the one responding:** The thinking line shows only for the bot. Pinned in Task 3.
- **Rotating the phone with Seat Details open:** Seat Details closes with the board. Pinned in Task 4.

---

### Task 1: Window buttons and text on the phone

**Files:** Modify `projects/app/src/styles.scss`, `projects/app/src/app/game-board/phone/seat-details-dialog.ts`, the General info dialog and the picker's trait style (`general-info-dialog.ts`, `general-selection.ts`, or the shared trait component if there is one); test `projects/app/src/app/phone-windows.spec.ts` (new).

- [ ] **Step 1: Failing test** `phone-windows.spec.ts` reading `styles.scss`: A `html[data-layout='compact'] .cdk-overlay-container` block sets the Material button container heights (filled, outlined, text, protected) and the icon button to at least 44 px, and sets `app-playing-card .name` to 14 px. It also reads `seat-details-dialog.ts` (its `.card` and `.close` at least 44 px) and the trait chip style (at least 12 px on compact).
- [ ] **Step 2:** It fails.
- [ ] **Step 3: Implement.** Use Material's button tokens (`--mat-button-filled-container-height` and the others) rather than fixed heights, so buttons stay Material buttons.
- [ ] **Step 4:** `npx jest --selectProjects app -w 4` passes; re-run the browser audit at 800 × 366: no button under 44 px and no text under 12 px in any window.
- [ ] **Step 5: Commit** `feat(app): window buttons and text sized for the phone`.

### Task 2: Game Over and the online result on the phone

**Files:** Modify `projects/app/src/app/game-board/game-over.ts`, `projects/app/src/app/game-board/victory-board.ts`, `projects/app/src/app/online/online-result.ts`; tests in their specs (source-reading for the compact rules).

- [ ] **Step 1: Failing tests:** Each component has a `compact` rule that makes it one screen tall with the standings scrolling inside (`overflow-y: auto` on the columns) and its buttons outside the scrolling part; the VictoryBoard headline is at most 28 px and its subline 14 px on compact.
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement.** New Game (and Play Again / Leave on the online result) at least 44 px tall.
- [ ] **Step 4:** Tests pass; the `game-over` scenario at 800 × 366 and 760 × 340 has no page scroll and New Game on screen.
- [ ] **Step 5: Commit** `feat(app): Game Over fits the phone`.

### Task 3: The thinking line on the phone board

**Files:** Modify `phone-centre-band.ts`, `phone-board.ts` and their specs.

- [ ] **Step 1: Failing tests:** With `thinkingSeatId` set, the centre band shows "<Seat> is thinking…" (`table.thinking`) with a small spinner; without it, nothing. `PhoneBoard` passes its `thinkingSeatId` to the band.
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement** (14 px, one line, in place of the newest history line while a bot thinks).
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat(app): show which bot is thinking on the phone board`.

### Task 4: Seat Details closes with the board, and the hand padding

**Files:** Modify `phone-board.ts`, `hand-view.ts` and their specs; `docs/deferrals.md` (remove the three items from "Phone board leftovers").

- [ ] **Step 1: Failing tests:** Destroying `PhoneBoard` closes the Seat Details it opened (spy on the dialog ref's `close`). `HandView` in overlap mode passes its width minus the row's side padding (8 px) to `handStep`: 8 cards on a host 646 px wide fit without scrolling (`handStep(638, 8, 70, 8)` is used, not 646).
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `fix(app): Seat Details closes with the phone board; hand counts its padding`.

### Task 5: The windows the audit could not reach

- [ ] **Step 1:** On the dev server at 800 × 366 (`?display=fullscreen`), play into each: A Resolution notice (the `notice-*` scenarios: play the card), the Resurgence screen, the Victory reveal (end a game), the decision banner (View Board on a decision), the decision countdown and the game start countdown.
- [ ] **Step 2:** For any that breaks the rules (page scroll, buttons off screen, button under 44 px, text under 12 px), add a failing source test and a `compact` rule in that component, as in Task 1, and commit each as `fix(app): <window> fits the phone`.

### Task 6: Check, document and open the pull request

- [ ] **Step 1:** `npm run verify && npx jest --selectProjects app server content -w 4` pass (lint ignoring `.claude/worktrees/` if another session's worktree trips it).
- [ ] **Step 2:** Browser audit at 800 × 366 and 760 × 340, English and Vietnamese, every scenario: No page scroll, buttons on screen, none under 44 px, no text under 12 px. 1133 × 744: Windows and Game Over as on `feat/phone-app-install`.
- [ ] **Step 3:** Update `docs/architecture/frontend.md` (phone window rules) and commit.
- [ ] **Step 4:** Rebuild the production app for the tunnel so the developer can check on the Honor 400 Pro.
- [ ] **Step 5:** Push and open a pull request against `feat/phone-app-install`. Do not merge.
