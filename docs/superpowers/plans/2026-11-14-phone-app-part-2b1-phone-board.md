# Phone App, Part 2b-1 (The Phone Board) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the `'compact'` layout a game is played on a board laid out for a landscape phone: opponents along the top and down the sides, a centre band, and a bottom row with the viewer's seat, the hand and the action column. Nothing is scaled down.

**Architecture:** New components beside the web board, not styles on it, so the medium and large layouts cannot change: a pure placement function, `PhoneSeatTile`, `PhoneCentreBand` and `PhoneBoard`. `GameBoard` renders `PhoneBoard` in place of its `.board` when `layout.kind()` is `'compact'`, and passes it the same per-seat data it gives `RoundTable`. `Layout` learns when a phone board is open, so the app hides its toolbar.

**Tech Stack:** Angular (standalone components, signals), Jest (`npx jest --selectProjects app -- <pattern>`).

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, section "3. The phone board" and "Sizes". Reference: The device preview artifact named in the spec (the spec's text wins where they differ).

## What 2b-1 covers, and what waits for 2b-2

The developer chose two pull requests for 2b (2026-11-14).

- **2b-1 (this plan):** Seat placement, the three bands, the phone seat tile (full and slim) with its states, the centre band, the hand, the action column with the viewer's skills, the hidden toolbar, the History panel, and phone-board preview scenarios. The `phoneBoard` flag stays off in production.
- **2b-2 (next plan):** Seat Details (the tap on an opponent), the text badges on the tile (Face Down, No Skills, Form), chat placement, the three small fixes left from the 2a review, then the flag turns on.

## Decisions

- **The viewer's skills go in the action column** (developer, 2026-11-14), as buttons above the board actions, only those the engine offers now (`AvatarSkill.action` not null). The viewer's tile has the same shape as the others.
- **New components under `projects/app/src/app/game-board/phone/`** (the spec leaves this to the builder). `SeatTile`, `RoundTable` and `HandView`'s web styles are not edited, except one opt-in input on `HandView` (Task 4).
- **No "move to the sides earlier" rule.** At the 760 px floor with 12 seats, the spec's table already gives 78 px tiles, over the 76 px minimum (pinned in Task 1). The spec allows the rule; it is not needed.
- **Tile sizes** (the builder's call, from the approved preview): Padding 8 px, gap 5 px; bottom row `clamp(104px, 30% of the height, 124px)`; tile height `min(110px, (height − bottom row − 21px) / 2)`; top tiles `min(150px, room / count)` wide; side columns 124 px, or the top tiles' width when tiles are slim. A tile under 110 px wide is slim.
- **The centre band reuses `app-phase-indicator`** (phase, whose turn, Draw Pile count) and shows the newest Action History line, the turned-up cards, the Menu button and the History button.
- **The toolbar is hidden by an attribute:** `Layout` writes `data-board="open"` on `<html>` while a phone board is open, and `styles.scss` sets `--mat-toolbar-standard-height: 0px` there, so every `calc()` that subtracts the toolbar keeps working. `App` does not render the `mat-toolbar` then.
- **`PhoneBoard` is `position: fixed` over the content area**, inside the safe areas (`env(safe-area-inset-*)`), so the app's 16 px content padding does not apply.

## Global Constraints

- Presentation only. No engine, content, bots, protocol, server or sign-in changes.
- The medium and large layouts do not change in any visible way, and the local Setup and Game screens keep their behaviour.
- Sizes on the phone board: **No text under 12 px; 14 px or more** for names, HP, hand counts, card names, prompts, button labels and Action History lines; **tap targets at least 44 × 44 px; nothing scaled down** (`seatScale`, `centreScale`, `zoom` and `transform: scale` are not used on the phone board).
- Rules stay in the engine: The board asks the game service for legal actions; placement and sizes are presentation only.
- UI text follows `CLAUDE.md`. Every new string gets English and a Vietnamese draft.
- Work on `feat/phone-app-board`, branched from `feat/phone-app-layout-rules` (PR 81). The agent never merges or pushes to `main`.
- `npm run verify` and `npx jest --selectProjects app` pass before the pull request.

## Review Focus

- **An eliminated seat:** It keeps its place in the top row or a side column (placement does not close gaps), and shows the Eliminated stamp. Pinned in Task 1 and Task 2.
- **The viewer is not seat 0** (an online game seats the viewer anywhere): Turn order still starts from the viewer. Pinned in Task 1.
- **A spectator or a game with no viewer seat** (`viewerSeatId` null): The board shows every seat as an opponent and an empty bottom-left. Pinned in Task 1 and Task 5.
- **Playback target lines and damage pictures:** Every tile's wrapper carries `data-seat-id`, so `PlaybackLayer`'s lookup finds phone tiles. Pinned in Task 5.
- **The panel, the drawer and prompts with the toolbar hidden:** They start at the top of the screen, not 44 px down. Pinned in Task 6.

---

### Task 1: Where each seat sits, and how wide

**Files:**
- Create: `projects/app/src/app/game-board/phone/phone-seat-layout.ts`
- Test: `projects/app/src/app/game-board/phone/phone-seat-layout.spec.ts`

**Interfaces:**
- Produces:
  - `export interface PhoneSeats { left: Seat[]; top: Seat[]; right: Seat[] }`, each list in screen order (top to bottom for the columns, left to right for the top row).
  - `export function phoneSeats(seats: Seat[], viewerSeatId: string | null): PhoneSeats`
  - `export interface PhoneSizes { bottomHeight: number; tileHeight: number; topTileWidth: number; sideWidth: number; slim: boolean }`
  - `export function phoneSizes(width: number, height: number, seats: PhoneSeats): PhoneSizes`
  - `export const SLIM_BELOW = 110; export const SLIM_MIN = 76;`

- [ ] **Step 1: Write the failing tests.**
  - The spec's table, for 2 to 12 seats (viewer `seat-0`): Side counts 0/0 for 2 to 8, 1/1 for 9, 2/2 for 10 to 12; the top row holds the rest.
  - Turn order, 12 seats, viewer `seat-0`: `right` is `[seat-2, seat-1]` (seat-1, next in turn, at the bottom), `top` is `[seat-9 … seat-3]` left to right, `left` is `[seat-10, seat-11]`.
  - 5 seats, viewer `seat-3`: `top` is `[seat-2, seat-1, seat-0, seat-4]`, so `seat-4` (next after the viewer) is nearest the right.
  - Viewer null, 4 seats: All four in `top`.
  - An eliminated seat keeps its place.
  - Sizes: 8 seats at 915 × 412 give full tiles (`topTileWidth ≥ 110`, `slim` false); 12 seats at 915 × 412, 780 × 360 and 760 × 340 give slim tiles with `topTileWidth ≥ 76` and `sideWidth === topTileWidth`; `bottomHeight` is 124 at 915 × 412 and 104 at 760 × 340; `tileHeight ≤ 110`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- phone-seat-layout`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement** with the sizes in "Decisions". Turn order is the seats sorted by `index`, rotated to start after the viewer; the right column takes the first `s`, the top row the next ones (placed right to left), the left column the last `s`.

- [ ] **Step 4: Run the tests**

Run: `npx jest --selectProjects app -- phone-seat-layout`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/phone
git commit -m "feat(app): place seats on the phone board"
```

### Task 2: The phone seat tile

**Files:**
- Create: `projects/app/src/app/game-board/phone/phone-seat-tile.ts`
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`
- Test: `projects/app/src/app/game-board/phone/phone-seat-tile.spec.ts`

**Interfaces:**
- Produces `PhoneSeatTile` (selector `app-phone-seat-tile`):
  - Inputs, as `SeatTile`'s: `seat` (required), `name`, `handCount`, `isTurnOwner`, `isResponding`, `isViewer`, `isBot`, `equipment`, `judgment`, `dying`, `cue`, `damageEffect`, `dimmed`; and `slim = input(false)`.
  - Output: `opened = output<void>()`, on a tap anywhere on an opponent's tile (2b-2 opens Seat Details from it). The viewer's tile emits nothing.
  - Host classes, as `SeatTile`'s: `turn-owner`, `responding`, `eliminated`, `dying`, `dimmed`, plus `slim`.
- Strings (accessible names only): `phone.seat.chained` "Chained" / "Bị xích"; `phone.seat.ambitionist` "Ambitionist" / "Dã tâm gia"; `phone.equipment.empty` "Empty" / "Trống". Check the Vietnamese terms against `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` and use the existing catalog words where they exist.

What it shows, top to bottom (the spec's arrangement):
- **Name row**, coloured by force (Ambitionist colour for an Ambitionist), with the Ambitionist mark, the bot icon and up to 3 Judgment boxes at the right. A slim tile shortens "Seat 12" to "S12" only when the full name does not fit (CSS ellipsis first; the short form is the `title`).
- **Both Generals' pictures** side by side, using the same art lookup as `SeatAvatar`; a hidden General shows "?".
- **HP and hand count**, then the chained mark at the end of the row.
- **4 Equipment boxes** (Weapon, Armor, +1 Mount, −1 Mount), labelled W, A, +1, −1 (slim: W, A, +, −); an empty box is an outline.
- **States:** The Eliminated stamp across the tile, Dying, the turn owner's gold border, the cue callout and the damage sprite as `SeatTile` draws them.

- [ ] **Step 1: Write the failing tests:** A full tile shows the name, `♥ 3/4` style HP text, the hand count, three Judgment boxes with one filled, four Equipment boxes with the filled ones labelled; a slim tile uses the short labels; the chained mark appears only when `seat.chained` and has the accessible name "Chained"; the Ambitionist mark appears for an Ambitionist; an eliminated seat has the class and the stamp; a click on an opponent emits `opened`, on the viewer it does not; no element's computed `font-size` is set below 12 px in the component styles (read the component's `styles` string and assert every `font-size` value is at least 12 px).

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- phone-seat-tile`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement.** Names and numbers 14 px, other text 12 px. The whole tile is a `button` for an opponent (one tap target), a plain `div` for the viewer.

- [ ] **Step 4: Run the tests**

Run: `npx jest --selectProjects app -- phone-seat-tile`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/phone projects/app/src/app/i18n
git commit -m "feat(app): a seat tile for the phone board"
```

### Task 3: The centre band

**Files:**
- Create: `projects/app/src/app/game-board/phone/phone-centre-band.ts`
- Test: `projects/app/src/app/game-board/phone/phone-centre-band.spec.ts`

**Interfaces:**
- Produces `PhoneCentreBand` (selector `app-phone-centre-band`): Inputs `state` (required), `viewerSeatId`. It shows `app-phase-indicator` (static, not sticky), the newest Action History line (the same `actionHistory(...)` text the web board uses, one line, ellipsis), the turned-up cards of the processing zone as small cards, a Menu button (`layout.openNav()`, label `nav.menu`) and a History button (`layout.togglePanel()`, label `board.panel.open`), both 44 × 44 px with icons.

- [ ] **Step 1: Write the failing tests:** The phase indicator is inside; the newest history line is shown; Menu calls `openNav` (the Layout's `navOpen()` becomes true); History opens the panel (`panelOpen()` true); turned-up cards render when the processing zone has cards.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- phone-centre-band`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests**

Run: `npx jest --selectProjects app -- phone-centre-band`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/phone
git commit -m "feat(app): the phone board's centre band"
```

### Task 4: The hand overlaps, then scrolls

**Files:**
- Modify: `projects/app/src/app/game-board/hand-view.ts`
- Test: `projects/app/src/app/game-board/hand-view.spec.ts`

**Interfaces:**
- Produces:
  - `export function handStep(width: number, count: number, cardWidth: number, gap: number, minStrip = 44): { step: number; scrolls: boolean }`: The distance from one card's left edge to the next. `cardWidth + gap` when they fit; less (overlap) when they do not; never under `minStrip`, and then `scrolls` is true.
  - `HandView.fit = input<'row' | 'overlap'>('row')`. `'row'` is today's behaviour, unchanged. `'overlap'` measures the host's width (ResizeObserver), places cards at `handStep` and makes the overlay buttons at least 44 px tall.

- [ ] **Step 1: Write the failing tests:** `handStep(600, 8, 70, 8)` is about 75.7 and does not scroll; `handStep(800, 8, 70, 8)` is 78; `handStep(300, 8, 70, 8)` is 44 and scrolls; one card: step is `cardWidth + gap`. A rendered `HandView` with `fit` left at `'row'` has no inline card offsets (today's markup).

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- hand-view`
Expected: FAIL, `handStep` is not exported.

- [ ] **Step 3: Implement.** A focused or tapped card is raised above its neighbours (`z-index`) so its whole overlay is reachable.

- [ ] **Step 4: Run the tests**

Run: `npx jest --selectProjects app -- hand-view`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/hand-view.ts projects/app/src/app/game-board/hand-view.spec.ts
git commit -m "feat(app): a hand that overlaps, then scrolls, for the phone board"
```

### Task 5: The phone board, in the game

**Files:**
- Create: `projects/app/src/app/game-board/phone/phone-board.ts`
- Modify: `projects/app/src/app/game-board/game-board.ts`
- Test: `projects/app/src/app/game-board/phone/phone-board.spec.ts`, `projects/app/src/app/game-board/game-board.layout.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 to 4; `AvatarSkill` (`avatar-skills.ts`).
- Produces `PhoneBoard` (selector `app-phone-board`):
  - Inputs: `state` (required), `viewerSeatId`, `thinkingSeatId`, `botSeatIds`, `cues`, `damageEffects`, `resolving` (as `RoundTable`'s); `hand: CardInstance[]`, `handActions: Action[]`, `boardActions: Action[]`, `skills: AvatarSkill[]`, `registry`.
  - Outputs: `played = output<Action>()` (from the hand), `actionChosen = output<Action>()` (action list and skill buttons).
  - Each tile sits in a wrapper with `data-seat-id`. It renders `app-playback-layer` over the board with the centre band's position.
- `GameBoard`: When `layout.kind() === 'compact'`, renders `app-phone-board` instead of `.board`, with the data it already computes (`zoneCards`, `seatCueMap`, `damageEffects`, `viewerSkills`, `ownHand`, `legalActions`, `boardActions`); outputs go to the handlers the web board uses. The panel scrim and `aside.panel` render for both.

- [ ] **Step 1: Write the failing tests.**
  - `phone-board.spec.ts` with a built state: 8 seats put 7 tiles in the top row and none at the sides; 12 seats put 2 + 7 + 2; every tile wrapper has `data-seat-id`; the viewer's tile is in the bottom row and is full; a usable skill renders as a button in the action column and clicking it emits `actionChosen` with its action; a skill with `action` null is not shown; viewer null leaves the bottom-left empty and shows every seat at the top.
  - `game-board.layout.spec.ts`, a new block "on the phone board (installed, 915 × 412)" with `FEATURE_FLAGS.phoneBoard` true and `DISPLAY_MODE_OVERRIDE` `'fullscreen'`: `app-phone-board` is present, `app-round-table` is not; the History button opens `app-board-panel`. The medium and large blocks stay as they are and still pass.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- phone-board game-board.layout`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement** with a CSS grid: Left column, top row, right column, the centre band between them; the bottom row across the width: The viewer's tile (150 px), the hand (`fit="overlap"`), the action column (128 px, scrolls inside itself when long).

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board
git commit -m "feat(app): the phone board replaces the table on the compact layout"
```

### Task 6: Hide the toolbar during a game

**Files:**
- Modify: `projects/app/src/app/layout.service.ts`, `projects/app/src/app/app.html`, `projects/app/src/styles.scss`, `projects/app/src/app/game-board/phone/phone-board.ts`
- Test: `projects/app/src/app/layout.service.spec.ts`, `projects/app/src/app/app.spec.ts`

**Interfaces:**
- Produces on `Layout`: `boardOpen: Signal<boolean>`, `setBoardOpen(open: boolean): void`, and `toolbarHidden: Signal<boolean>` (`kind() === 'compact' && boardOpen()`). An effect writes `data-board="open"` on `<html>` while `toolbarHidden()`, and removes it otherwise.
- `PhoneBoard` calls `setBoardOpen(true)` when created and `false` when destroyed.

- [ ] **Step 1: Write the failing tests:** `toolbarHidden` is true only for compact with a board open; the attribute follows; turning the phone to a layout that is not compact shows the toolbar again. In `app.spec.ts`: With `toolbarHidden` true, there is no `mat-toolbar` and the navigation drawer still opens from `layout.openNav()`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- layout.service app.spec`
Expected: FAIL, `toolbarHidden` is undefined.

- [ ] **Step 3: Implement.** In `styles.scss`: `html[data-board='open'] { --mat-toolbar-standard-height: 0px; --mat-toolbar-mobile-height: 0px; }`.

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src
git commit -m "feat(app): hide the app toolbar while the phone board is open"
```

### Task 7: Preview scenarios, checks and the pull request

**Files:**
- Modify: `projects/app/src/app/dev/scenarios/play-board.ts` (or a new `phone-board.ts` in the same folder, added to `index.ts`), `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `docs/architecture/frontend.md` (a "Phone board" section)
- Test: `projects/app/src/app/dev/scenarios/scenarios.spec.ts` (the existing checks cover new entries)

- [ ] **Step 1: Add three board scenarios** at 4, 8 and 12 seats in the Play Phase with the viewer holding cards, each with a title and description (`preview.phone-4.title` and so on). The description says to open them at a phone size with `?display=fullscreen`.

- [ ] **Step 2: Run the static checks and all tests**

Run: `npm run verify && npx jest --selectProjects app server`
Expected: Both pass. (If plain lint trips on another session's worktree under `.claude/worktrees/`, run `npx eslint . --ignore-pattern '.claude/worktrees/**'` and say so in the pull request.)

- [ ] **Step 3: Check in the browser** (dev server, `?display=fullscreen`), each scenario at 915 × 412, 780 × 360 and 760 × 340:
  - No page scroll; nothing overlaps; every tile visible.
  - No text under 12 px (`getComputedStyle` over `app-phone-board *`).
  - Every button at least 44 × 44 px.
  - A card can be played from the hand; History opens; Menu opens the drawer; no toolbar.
  - 1133 × 744 and 1440 × 900 with `?display=auto`: The board looks as on `feat/phone-app-layout-rules`.

- [ ] **Step 4: Write the doc section and commit**

```bash
git add projects/app/src/app docs
git commit -m "feat(app): phone board preview scenarios, and docs"
```

- [ ] **Step 5: Push and open a pull request** against `feat/phone-app-layout-rules`. Say the flag stays off, what 2b-2 adds, and that the real-phone check comes before Part 2 merges. Do not merge.
