# Mobile and Tablet Landscape Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app usable on phones, tablets and desktops: a navigation drawer on small screens, a landscape-only game board that fits phone heights (wide screens keep today's board), and a layout switch that works the same everywhere.

**Architecture:** One `Layout` service reads the window size and decides `'phone'` or `'wide'` (wide means width ≥ 900 px and height ≥ 600 px; Task 7b adds a third size, `'large'`, at width ≥ 1280 px). It writes the result to `<html data-layout="…">`, so CSS in every component keys off one attribute (`:host-context([data-layout='phone'])`) and code reads the same signal. Presentation only: no engine, bot, protocol or game-service change.

**Tech Stack:** Angular (standalone, signals), Angular Material (`MatSidenav`), Jest with `jest-preset-angular`. Tests run with `npm test`; `npm run verify` is lint, typecheck and build.

**Spec:** `docs/superpowers/specs/2026-11-03-mobile-landscape-design.md` (approved). Mock-up: https://claude.ai/artifact/5rZyRL17nWayVuPjNBjtkD (a guess at the look; the real board's structure, described below, wins over the mock-up).

## Differences between the spec and the real code (found while planning)

- **No Leave Game flow exists.** The board only has `goToSetup()` (after game over or after an error), and online has no mid-game leave. The spec's "Leave Game button reusing the existing leave flow" has nothing to reuse and adding leave or forfeit is new behaviour. **This plan leaves Leave Game out.** The panel holds only the two tabs.
- **The board is one shared component.** `online/online-game.ts` wraps the same `GameBoard`, so a board change covers local and online games.
- **The board is not the mock-up's layout.** Today it is a grid: a round table (`RoundTable`, sized by `fitTable`), then a bottom row of your seat (`.your-seat`, zoomed), your hand and action list, and two small tiles (`app-action-history`, `app-discard-pile`) that each open a full list in a dialog. Below 768 px it stacks and the page scrolls. The plan keeps that structure and compacts it.
- **A wide-layout rail would change the desktop look.** The real wide board shows both tiles in its bottom row, so **at 1280 px and up this plan keeps the tiles and adds no rail.** Updated 2026-11-04: from 900 to 1279 px wide the two tiles squeezed the hand, so Task 7b collapses them into the panel button there.
- The existing 599 px, 767 px and 899 px media rules (`app.css`, `game-board.ts`, `phase-indicator.ts`, `general-selection.ts`) are replaced by `data-layout` rules where they conflict with this plan. List each replaced rule in the pull request.

## Global Constraints

- Phone layout when `width < 900 || height < 600`; wide layout otherwise. One source: `Layout`.
- Touch targets at least 44 × 44 px for anything tappable except hand cards.
- Space priority when tight: all seats visible, then the hand row, then 44 px touch size.
- Only one of the nav drawer and the board panel is open at a time.
- Rotate message only when the board is on screen, layout is `'phone'` and the window is portrait.
- UI text: Title Case for labels, sentence case for sentences; Vietnamese in sentence case, marked draft. New strings: `nav.menu` "Menu", `board.rotate.title` "Rotate Your Device", `board.rotate.hint` "The Guozhan board needs a landscape screen. Turn your phone sideways to keep playing.", `board.panel.open` "History" (button label).
- Large layout (1280 px wide and up) must look identical to today (anti-goal): same bottom-row tiles, no rail; verify with before and after screenshots. The medium layout (900 to 1279 px) is a deliberate change.
- Engine, bots, protocol, `GameService`, `RemoteGameService`: untouched. Local Setup and Game may change layout only.
- Use `dvh`, not `vh`. Keep seats and buttons clear of `env(safe-area-inset-*)`.

## Review Focus

- Rotating or resizing mid-game (phone to wide and back): game state is untouched, open panels close, nothing is stuck open.
- A decision dialog (Choice, Targets, Arrange, Judgment, Compete) taller than a 344 px viewport scrolls inside itself and its buttons stay reachable.
- The nav drawer open when a game decision arrives: the dialog appears above it and focus goes to the dialog.
- A hand of 0 cards and a hand of 20 or more cards in a 344 px tall viewport: no overflow of the page, the row scrolls sideways.
- Two seats and the maximum seat count on the folded Fold5 size (882 × 344): every seat visible, none overlapping.

---

## File structure

- Create `projects/app/src/app/layout.service.ts` — `Layout` (size rule, `data-layout`, drawer and panel state).
- Create `projects/app/src/app/game-board/board-panel.ts` — `BoardPanel` (tabbed History and Discard Pile; slide-over on phone only).
- Create `projects/app/src/app/game-board/rotate-prompt.ts` — `RotatePrompt`.
- Create `projects/app/src/app/game-board/action-history-list.ts`, `discard-history-list.ts` — list bodies extracted from the two dialogs so the dialogs and the panel share them.
- Modify `app.ts`, `app.html`, `app.css`, `index.html`, `styles.css` (the app's global stylesheet; find it under `projects/app/src`), `game-board.ts`, `phase-indicator.ts`, `action-history-panel.ts`, `discard-pile.ts`, `i18n/en.ts`, `i18n/vi.ts`, plus the other screens found in Task 8.
- Scratch (not committed): screenshots in the session scratchpad.

---

### Task 1: Baseline screenshots of the wide layout

**Files:** none changed. Output goes to the scratchpad.

- [ ] **Step 1:** Using the `run` skill, start the app and a local bot game. Capture screenshots at 1366 × 768, 1920 × 1080 and 2560 × 1440 of: `/setup`, a running game board (Play Phase, hand with cards), `/rooms`, `/wiki/rules/overview`. Save under `<scratchpad>/baseline/<width>-<page>.png`.
- [ ] **Step 2:** Report where the files are. No commit.

### Task 2: `Layout` service

**Files:**
- Create: `projects/app/src/app/layout.service.ts`, `layout.service.spec.ts`

**Interfaces — Produces:**
```ts
export const WIDE_MIN_WIDTH = 900;
export const WIDE_MIN_HEIGHT = 600;
export type LayoutKind = 'phone' | 'wide';
export function layoutFor(width: number, height: number): LayoutKind;
@Injectable({ providedIn: 'root' })
export class Layout {
  readonly kind: Signal<LayoutKind>;
  readonly wide: Signal<boolean>;
  readonly portrait: Signal<boolean>;      // innerHeight > innerWidth
  readonly navOpen: Signal<boolean>;
  readonly panelOpen: Signal<boolean>;
  openNav(): void;    // closes the panel
  closeNav(): void;
  openPanel(): void;  // closes the nav
  closePanel(): void;
  togglePanel(): void;
}
```

- [ ] **Step 1: Write failing tests** in `layout.service.spec.ts`:
  - `layoutFor` table: `667×375`, `852×393`, `780×360`, `915×412`, `882×344`, `841×673`, `744×1133` → `'phone'`; `1133×744`, `1194×834`, `1280×800`, `1366×768`, `1920×1080` → `'wide'`; `1000×500` → `'phone'`; `899×900` → `'phone'`; `900×600` → `'wide'`.
  - Setting `window.innerWidth`/`innerHeight` and dispatching `resize` updates `kind` and `portrait`.
  - `openNav()` then `openPanel()` leaves `navOpen()` false and `panelOpen()` true, and the reverse.
  - After a resize from phone to wide, `navOpen()` and `panelOpen()` are false.
  - Construction sets `document.documentElement.dataset['layout']` to the current kind, and a resize updates it.
- [ ] **Step 2:** Run `npx jest projects/app/src/app/layout.service.spec.ts` → FAIL (module missing).
- [ ] **Step 3: Implement `Layout`.** Hold width and height in signals seeded from `window`, update them from a `resize` listener (also `orientationchange`), derive the rest with `computed`, and keep `dataset.layout` in sync with an `effect`. Close both overlays when `kind` changes.
- [ ] **Step 4:** Run the spec → PASS.
- [ ] **Step 5: Commit** `feat: Layout service decides phone or wide from the window size`

### Task 3: Viewport, safe areas and a compact app bar

**Files:**
- Modify: `projects/app/src/index.html`, the global stylesheet, `app.css`, `app.html` (bar only), `game-board/phase-indicator.ts`
- Test: `app.spec.ts`

- [ ] **Step 1: Failing test** in `app.spec.ts`: with `window.innerWidth = 852; innerHeight = 393` (and the `Layout` created), `document.documentElement.dataset['layout']` is `'phone'`. (Guards the wiring of Task 2 into the app: `App` must inject `Layout` so it is constructed.)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `App` injects `Layout` (protected readonly `layout`). Change the viewport meta in `index.html` to `width=device-width, initial-scale=1, viewport-fit=cover`.
- [ ] **Step 4: CSS.** In the global stylesheet add, for `:root[data-layout='phone']`, a compact bar: `--mat-toolbar-standard-height: 44px; --mat-toolbar-mobile-height: 44px;` (the phase indicator's `top` and the board height already read these variables). Pad `.app-bar` and `.content` left and right with `max(16px, env(safe-area-inset-left/right))`. Replace the `max-width: 599px` rules in `app.css` and `phase-indicator.ts` with `:host-context([data-layout='phone'])` equivalents.
- [ ] **Step 5:** `npx jest projects/app/src/app/app.spec.ts` → PASS.
- [ ] **Step 6: Commit** `feat: viewport-fit cover, safe areas and a compact app bar on phones`

### Task 4: Navigation drawer

**Files:**
- Modify: `app.ts`, `app.html`, `app.css`, `i18n/en.ts`, `i18n/vi.ts`
- Test: `app.spec.ts`

**Interfaces — Consumes:** `Layout.wide`, `Layout.navOpen`, `Layout.openNav()`, `Layout.closeNav()`.

- [ ] **Step 1: Failing tests** in `app.spec.ts`:
  - Phone layout: the bar shows a button with `aria-label` "Menu" (`nav.menu`), the brand, and the music and sound toggles, and none of the links `.nav-play`, `.nav-online`, `.nav-rules` are inside the bar.
  - Clicking the menu button opens a `mat-sidenav` containing the same links the bar has today: Play (only when `flags.playOffline`), Play Online, one group per `deckMenus` entry with its pages, the `rulesPages`, the Battlefield options (only when `backgrounds.available()`), the account entry (Sign In, or the name with Create Account and Sign Out), the language switcher, and Playback Speed (only when `flags.playbackSettings`).
  - Choosing a link, pressing Escape or clicking the backdrop calls `closeNav()`.
  - Wide layout: the bar is exactly as it is today (existing tests keep passing unchanged).
  - `nav.menu` exists in `en` and `vi` (`catalogs.spec.ts` enforces key parity).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Wrap the app in `MatSidenavContainer` with `<mat-sidenav mode="over">` bound to `layout.navOpen()`. In the drawer use `mat-nav-list` items (min height 48 px). Reuse the existing arrays, labels, flags and handlers; do not copy link lists: extract the deck and rules items into an `ng-template` used by both the bar menus and the drawer, or iterate the same arrays twice. Return focus to the menu button on close (`MatSidenav` does this when `autoFocus` and `restoreFocus` are left at their defaults; test it).
- [ ] **Step 4:** Add `nav.menu` to `en.ts` (`'Menu'`) and `vi.ts` (`'Trình đơn'`, draft).
- [ ] **Step 5:** `npx jest projects/app/src/app` → PASS. Run `npm run i18n:status` and note the new draft key.
- [ ] **Step 6: Commit** `feat: collapse the navigation bar into a drawer on phones`

### Task 5: History and Discard Pile panel

**Files:**
- Create: `game-board/action-history-list.ts`, `discard-history-list.ts`, `board-panel.ts`, and a `.spec.ts` for each
- Modify: `action-history-panel.ts` (dialog uses the list), `discard-pile.ts` (same)

**Interfaces — Produces:**
```ts
// Selector app-action-history-list / app-discard-history-list: the <ol> bodies from the two dialogs.
export class ActionHistoryList { readonly history = input.required<ActionHistoryEntry[]>(); }
export class DiscardHistoryList { readonly history = input.required<DiscardHistoryEntry[]>(); }  // shows the summary line and the grid
// Selector app-board-panel
export class BoardPanel {
  readonly actionHistory = input.required<ActionHistoryEntry[]>();
  readonly discardHistory = input.required<DiscardHistoryEntry[]>();
}
```

- [ ] **Step 1: Failing tests.** (a) The two dialogs still render the same entries as before (existing specs stay green). (b) `BoardPanel` shows tabs "Action History" (`history.title`) and "Discard Pile" (`discard.pile`); Action History is selected first; switching shows the other list; with empty histories each shows its existing empty text.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Move each dialog's `<ol>` (and the discard summary line) into its list component with its styles, and have the dialogs render the list component. `BoardPanel` uses `MatTabGroup`.
- [ ] **Step 4:** Run `npx jest projects/app/src/app/game-board` → PASS.
- [ ] **Step 5: Commit** `refactor: share the history lists between the dialogs and a new board panel`

### Task 6: Board layout, panel placement and the rotate prompt

**Files:**
- Create: `game-board/rotate-prompt.ts`, `rotate-prompt.spec.ts`
- Modify: `game-board.ts`, `game-board.spec.ts`, `i18n/en.ts`, `i18n/vi.ts`

**Interfaces — Consumes:** `Layout.kind`, `Layout.portrait`, `Layout.panelOpen`, `Layout.togglePanel()`, `Layout.closePanel()`, `BoardPanel`.

- [ ] **Step 1: Failing tests** in `game-board.spec.ts` (use the file's existing fixtures for a running game):
  - Phone layout, landscape: no `app-action-history` or `app-discard-pile` tile in the bottom row; a button with `aria-label` "History" (`board.panel.open`) is present and is at least 44 px square; clicking it shows `app-board-panel`; clicking the dimmed backdrop hides it; Escape hides it.
  - Wide layout: the board keeps the two tiles, with no panel button and no `app-board-panel`.
  - Phone layout, portrait: `app-rotate-prompt` shows "Rotate Your Device" and the hint; landscape: it is absent. Wide layout in portrait (1000 × 1200): absent.
  - The rotate prompt does not remove the board from the DOM (state and dialogs stay mounted) and does not appear on `app-general-selection` or the no-game fallback.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.**
  - `RotatePrompt`: a full-viewport fixed overlay (`z-index` above the board, below dialogs), `role="alert"` not needed; a turning phone icon (respect `prefers-reduced-motion`), title and hint via `TPipe`.
  - In `game-board.ts`: inject `Layout`. In the phone layout hide the two tiles and place a 44 × 44 px icon button (`history` icon, `aria-label` from `board.panel.open`) at the top right of `.board`, plus a slide-over `BoardPanel` (about 40% of the width, `max-width: 360px`) with a dim backdrop; opening it calls `layout.openPanel()`. Pass `actionHistory()` and `discardHistory()`, which the board already computes. The wide layout is unchanged.
  - Replace the `max-width: 767px` stacking rule: the phone layout keeps one screen (no page scroll) with the grid sized from the viewport, never `70vh`.
  - Add the `board.rotate.*` and `board.panel.open` strings to `en.ts` and `vi.ts` (Vietnamese drafts: `'Hãy xoay thiết bị'`, `'Bảng Quốc chiến cần màn hình ngang. Hãy xoay điện thoại sang ngang để tiếp tục chơi.'`, `'Lịch sử'`).
- [ ] **Step 4:** `npx jest projects/app/src/app` → PASS.
- [ ] **Step 5: Commit** `feat: board history panel on phones and rotate prompt`

### Task 7: Fit the board to phone heights

This task is mostly CSS in `game-board.ts`, `round-table.ts`, `seat-tile.ts`, `hand-view.ts`, `action-list.ts` and the dialogs. Browser work, so each step ends with a screenshot.

- [ ] **Step 1: Failing test** for the part that is logic: `fitTable` with the folded Fold5 table size (about 882 × 250 for the battlefield) and 2, 5 and 7 opponent seats returns a scale of at least `MIN_SCALE` with no overlapping tiles (use the existing `table-layout.spec.ts` helpers). If it already passes, record that and skip to Step 3.
- [ ] **Step 2:** If it fails, fix `fitTable` inputs (not its algorithm) so the table is given the real height after the compact bar, phase line and bottom row.
- [ ] **Step 3: Phone-layout CSS.** Under `:host-context([data-layout='phone'])`: `--bottom-height` about 40% of the viewport height but not under 120 px; `.your-seat` zoom lowered until it fits; hand row single line with sideways scroll and a fade at the edge; action buttons min height 44 px and pinned bottom right; phase indicator one line, smaller font, wrapping off; decision banner and countdown on one line. Dialog panels (`ChoiceDialog`, `TargetsDialog`, `ArrangeDialog`, `JudgmentDialog`, `CompeteDialog`, `SelectionDialog`, `ResponseDialog`, `GeneralInfoDialog`): `max-height: calc(100dvh - 16px)` with the content area scrolling and the buttons in a sticky footer.
- [ ] **Step 3b: Safe areas.** Pad the board's left and right with `env(safe-area-inset-left/right)`.
- [ ] **Step 4: Check by eye** with browser device emulation at every phone size in the spec table, in a running bot game with 2, 5 and the maximum number of seats, with a 0-card and a 20-card hand, and with each dialog open. Save screenshots; list anything that does not fit.
- [ ] **Step 5:** `npx jest projects/app/src/app/game-board` → PASS.
- [ ] **Step 6: Commit** `feat: fit the game board to phone heights`

### Task 7b: Medium layout, your seat above the hand, shrunk hand

Added 2026-11-04 after the developer saw History and Discard Pile crowding the hand. Decisions are in the spec (Decision summary 5 to 7, and Open Question 3). Mock-up: the Landscape Layout Preview.

- [ ] **Step 1: Failing tests.** In `layout.service.spec.ts`: `layoutFor` returns `'phone'` below 900 px wide or 600 px tall, `'medium'` from 900 to 1279 px wide, `'large'` from 1280 px wide (both with height ≥ 600). `wide()` stays true for medium and large, and a new `panelAsOverlay()` is true for phone and medium. In `game-board.layout.spec.ts`: at medium the History button and `app-board-panel` are used and the two tiles are absent; at large the tiles stay and there is no button.
- [ ] **Step 2: Implement `Layout`.** Add the `'medium'` and `'large'` kinds and `LARGE_MIN_WIDTH = 1280`. Update the `data-layout` attribute and the existing `wide()` users. Make the board show the button and panel when `panelAsOverlay()` is true.
- [ ] **Step 3: Your seat above the hand.** In phone and medium layouts, move `.your-seat` out of the bottom row: a compact tile centred right above the hand, still at the bottom of the screen. The bottom row is the hand and the action buttons. Check the round table's seats do not overlap it (`fitTable` gets the reduced height).
- [ ] **Step 4: Hand as Scroll and Shrink.** In phone layout, hand cards at about 80% of the normal size, one row, sideways scroll, edge fade. Medium layout keeps its larger cards.
- [ ] **Step 5: Check by eye** at 1133 × 744, 1194 × 834, 1280 × 800 and the phone sizes, and compare 1366 × 768 with the Task 1 baseline.
- [ ] **Step 6:** `npx jest projects/app/src/app` → PASS.
- [ ] **Step 7: Commit** `feat: medium layout collapses History, seat above the hand, shrunk hand`

### Task 8: Every other routed page at 360 px

**Files:** the pages found by walking `app.routes.ts` and `wiki/wiki.routes.ts`.

- [ ] **Step 1:** Using device emulation at 360 × 740 and 740 × 360, walk every route (setup, rooms, room lobby, my games, sign in, sign up, guest, forgot and reset password, every wiki page, general selection) and list each page with horizontal page scroll, clipped text or targets under 44 px. Write the list into the pull request description.
- [ ] **Step 2:** Fix each with CSS only, replacing fixed widths and `vh` with `dvh` and wrapping rows. `setup.ts` has `min-height: calc(100vh - 64px)`: change to `dvh` and the compact bar height variable.
- [ ] **Step 3:** `npx jest projects/app/src/app` → PASS.
- [ ] **Step 4: Commit** `fix: every page fits a 360 px wide screen`

### Task 9: Whole-change verification

- [ ] **Step 1:** `npm run verify` and `npm test` → all pass.
- [ ] **Step 2:** `npm run i18n:status` → the new Vietnamese keys listed as draft; mention them in the pull request.
- [ ] **Step 3:** Repeat Task 1's screenshots at the same widths and compare with the baseline; any visible difference in the wide layout must be explained or fixed.
- [ ] **Step 4:** Run the nine-device check from the spec in emulation (`667×375`, `852×393`, `780×360`, `915×412`, `882×344`, `841×673`, `1133×744`, `1194×834`, `1280×800`): finish a bot game on each, with the panel and drawer opened once.
- [ ] **Step 5:** Tell the developer a real phone and a real tablet check is still needed before merge. Do not merge or push to `main`.
- [ ] **Step 6: Commit** any fixes; open the pull request only if the developer asks.
