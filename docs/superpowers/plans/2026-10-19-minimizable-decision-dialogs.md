# Minimizable Decision Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player hide a decision popup (Response, Ask, Choice, Selection, Arrange, Discard) to inspect the board, see a banner that says a decision is still pending, and re-open the popup with its state intact.

**Architecture:** The popup is hidden by a panel class, not closed, so its selection survives. A root-provided `DecisionDock` (signals) holds which dialog is minimized. A `MinimizeButton` in each popup's title row minimizes it; a `DecisionBanner` under the error banner in `GameBoard` shows the pending decision with the existing `DecisionCountdown` and restores on click. Engine and game rules are untouched.

**Tech Stack:** Angular (standalone, signals), Angular Material dialog, Jest.

**Spec:** Approved in chat on 2026-10-19 (no spec file): option A from the mock at https://claude.ai/artifact/7qrRjEMoYonXnBjvEuVwvK — "View Board" button in the popup header, banner click to re-open, no quick Pass on the banner, all decision popups, shared `GameBoard` changed additively.

## Global Constraints

- UI text casing (CLAUDE.md): English Title Case for names and short labels ("View Board", "Response Needed"), sentence case for sentences; Vietnamese is sentence case everywhere. Vietnamese strings start as drafts (no `review.json` entry).
- Every new `en.ts` key needs a `vi.ts` key with the same placeholders (`catalogs.spec.ts` enforces it).
- No game rules in components; the dock holds presentation state only.
- Do not change how a dialog closes or submits: choosing still closes via `dialogRef.close(action)`.
- Branch: `feat/minimizable-decisions` off `main`. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A dialog is closed (decision settled, timed out) while minimized: banner must disappear and nothing stays hidden.
- Minimize then restore: the Response dialog still has the option the player picked.
- Two minimizes in a row on different dialogs: the banner shows the latest, and the earlier dialog closing does not clear it.
- A minimized dialog is not focusable or readable by screen readers (hidden with `display: none`), and the banner is a real `<button>`.
- Opening an info dialog (General or card info) while minimized must not restore or close the minimized decision.

## File Structure

- Create `projects/app/src/app/game-board/decision-dock.ts` (+ spec): state service.
- Create `projects/app/src/app/game-board/minimize-button.ts` (+ spec): title-row button.
- Create `projects/app/src/app/game-board/decision-banner.ts` (+ spec): banner.
- Modify `projects/app/src/styles.scss`: hide minimized panel and its backdrop.
- Modify `projects/app/src/app/i18n/en.ts`, `vi.ts`: new keys.
- Modify the six dialog components and `game-board.ts` (template and `imports`).

---

### Task 1: DecisionDock, styles and messages

**Files:**
- Create: `projects/app/src/app/game-board/decision-dock.ts`, `decision-dock.spec.ts`
- Modify: `projects/app/src/styles.scss`, `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MinimizedDecision { readonly title: string; readonly context: string | null; }
  @Injectable({ providedIn: 'root' })
  export class DecisionDock {
    readonly minimized: Signal<MinimizedDecision | null>;
    minimize(ref: MatDialogRef<unknown, unknown>, title: string, context?: string | null): void;
    restore(): void;
  }
  ```
- New message keys: `decision.viewBoard` ("View Board" / "Xem bàn") and `decision.open` ("Open" / "Mở"). The banner shows the dialog's own title, so it needs no key of its own.

- [ ] **Step 1: Write failing tests in `decision-dock.spec.ts`.** Use a fake ref `{ addPanelClass: jest.fn(), removePanelClass: jest.fn(), afterClosed: () => closed$ }` with a `Subject`. Tests: (a) `minimize(ref,'Response Needed','Seat 1 used Sha')` sets `minimized()` to `{title:'Response Needed', context:'Seat 1 used Sha'}` and calls `addPanelClass('decision-minimized')`; (b) `restore()` clears it and calls `removePanelClass('decision-minimized')`; (c) emitting on `afterClosed` clears `minimized()`; (d) minimizing ref B while A is minimized replaces the entry, and A's `afterClosed` then does not clear B's entry; (e) `restore()` with nothing minimized is a no-op.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board/decision-dock.spec.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement `DecisionDock`** with a private `signal<{ref, title, context} | null>`; `minimized` is a `computed` that drops `ref`. `minimize` subscribes once to `ref.afterClosed()` and clears only when the entry's ref is still that ref. When replacing an entry, leave the earlier dialog's own state alone (it closes through existing code).
- [ ] **Step 4: Add styles in `styles.scss`:** `.decision-minimized` on the pane hides its overlay wrapper, and the backdrop goes with it, using `:has()`: `.cdk-global-overlay-wrapper:has(.decision-minimized), .cdk-overlay-backdrop:has(+ .cdk-global-overlay-wrapper .decision-minimized) { display: none; }`. Verify in the browser (Task 3 step 7) that the backdrop is removed; if the DOM order differs, adjust the sibling selector.
- [ ] **Step 5: Add the two keys** to `en.ts` and `vi.ts` next to `respDialog.title`.
- [ ] **Step 6: Run** `npx jest projects/app/src/app/game-board/decision-dock.spec.ts projects/app/src/app/i18n` — expect PASS.
- [ ] **Step 7: Commit** `feat(app): the decision dock and minimized dialog styles`.

### Task 2: MinimizeButton

**Files:**
- Create: `projects/app/src/app/game-board/minimize-button.ts`, `minimize-button.spec.ts`

**Interfaces:**
- Consumes: `DecisionDock.minimize`, `MatDialogRef`, `decision.viewBoard`.
- Produces: standalone `MinimizeButton`, selector `app-minimize-button`, `@Input() context: string | null = null`. Renders `<button mat-button type="button" class="minimize">{{ 'decision.viewBoard' | t }}</button>`. On click it calls `dock.minimize(ref, title, context)`, where `title` is the trimmed text of the dialog's `[mat-dialog-title]` element, found from the component's own host via `closest('.mat-mdc-dialog-container')` (fallback: the `decision.viewBoard` text).

- [ ] **Step 1: Write failing tests.** Host a title `<h2 mat-dialog-title>Response Needed</h2>` plus `<app-minimize-button context="Seat 1 used Sha">` inside an element with class `mat-mdc-dialog-container`; provide a fake `MatDialogRef` and spy on `DecisionDock.minimize`. Assert click calls it with `(ref, 'Response Needed', 'Seat 1 used Sha')`; assert the label is "View Board" and "Xem bàn" under Vietnamese (follow the existing `*.vi.spec.ts` pattern, e.g. `dialogs.vi.spec.ts`).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board/minimize-button.spec.ts` — expect FAIL.
- [ ] **Step 3: Implement `MinimizeButton`** as described.
- [ ] **Step 4: Run** the spec — expect PASS.
- [ ] **Step 5: Commit** `feat(app): the View Board button for decision dialogs`.

### Task 3: Put the button in the six dialogs

**Files:**
- Modify: `response-dialog.ts`, `ask-dialog.ts`, `choice-dialog.ts`, `selection-dialog.ts`, `arrange-dialog.ts`, `discard-dialog.ts` (all in `projects/app/src/app/game-board/`) and their specs.

**Interfaces:**
- Consumes: `MinimizeButton`.

- [ ] **Step 1: Write failing tests** in `response-dialog.spec.ts` (and one smaller test per other dialog spec): the dialog renders `app-minimize-button`; in the Response spec also assert the picked option is unchanged after the dock minimizes and restores (select a card, call `DecisionDock.minimize` then `restore` on the real dock with a fake ref, assert the radio is still checked and `confirm()` still closes with that action); and that its `context` is `data.description.source`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board` — expect the new tests FAIL.
- [ ] **Step 3: Implement.** Wrap each `<h2 mat-dialog-title>` in a flex title row (`.title-row`) with `<app-minimize-button />` at the end, import `MinimizeButton`, and pass `[context]="data.description.source"` in `ResponseDialog` only. Keep each dialog's existing title text and layout otherwise.
- [ ] **Step 4: Run** `npx jest projects/app/src/app/game-board` — expect all PASS, including existing dialog specs.
- [ ] **Step 5: Commit** `feat(app): decision dialogs can be minimized`.

### Task 4: DecisionBanner in GameBoard

**Files:**
- Create: `projects/app/src/app/game-board/decision-banner.ts`, `decision-banner.spec.ts`
- Modify: `projects/app/src/app/game-board/game-board.ts` (template: after the `lastError()` block; `imports` array), `game-board.spec.ts`

**Interfaces:**
- Consumes: `DecisionDock.minimized`, `DecisionDock.restore`, `DecisionCountdown`, `decision.open`.
- Produces: standalone `DecisionBanner`, selector `app-decision-banner`, no inputs. Renders nothing when `minimized()` is null. Otherwise one `<button type="button" class="banner">` (full width) with a pulsing dot, the title, the context when present, `<app-decision-countdown>` and an "Open" label; click calls `dock.restore()`. Dot pulse is disabled under `prefers-reduced-motion`. Styled with `--mat-sys-*` tokens in the same style as `.error-banner`, not Shu red.

- [ ] **Step 1: Write failing tests.** (a) Hidden with nothing minimized. (b) After `dock.minimize(ref,'Response Needed','Seat 1 used Sha')` it shows both texts and an "Open" label, and is a `button`. (c) Clicking it calls `restore` and hides it. (d) In `game-board.spec.ts`, with a response pending: open the dialog, click `.minimize`, assert the overlay pane is hidden (`display: none` on its wrapper, or has `decision-minimized`) and `app-decision-banner .banner` exists; click the banner; assert the pane is visible again and the banner gone. (e) Opening a General info dialog while minimized leaves the banner showing and the decision dialog still open. (f) Settling the decision (use the existing timeout or pass path in that spec) while minimized removes the banner.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board/decision-banner.spec.ts projects/app/src/app/game-board/game-board.spec.ts` — expect FAIL.
- [ ] **Step 3: Implement `DecisionBanner`** and add it to `GameBoard` imports and template.
- [ ] **Step 4: Run** the full app suite `npx jest --selectProjects app` (if the project name differs, run `npx jest projects/app`) and `npm run i18n:status` — expect PASS; the two new keys show as draft only.
- [ ] **Step 5: Manual check in the browser** (use the `run` skill): start a vs-bots game, wait for a Sha at you, click View Board, confirm the board and a banner with a running countdown show, click the banner, confirm the popup returns with your pick, and confirm the backdrop is gone while minimized. Fix the sibling selector from Task 1 if the backdrop remains.
- [ ] **Step 6: Commit** `feat(app): banner for a minimized decision`.
