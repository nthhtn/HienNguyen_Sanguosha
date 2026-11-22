# Phone App, Part 2b-2 (Seat Details, Badges, Chat, Flag On) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the phone board: a tap on any seat tile opens Seat Details, the tiles carry their text badges, Chat moves into the centre band, three small fixes from the 2a review land, and the phone board is turned on for the live site.

**Architecture:** A new `SeatDetailsDialog` (a Material dialog) reads the same visible state the board shows and opens the existing General and card info windows. `PhoneSeatTile` gains the badges the spec places on each General. The chat's open state moves from `BoardChat` into a small `BoardChatState` service the lobby page provides, so the centre band can show a Chat button. The `phoneBoard` flag's factory becomes `true`.

**Tech Stack:** Angular (standalone components, signals, Material dialog), Jest (`npx jest --selectProjects app -- <pattern>`).

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, section "3. The phone board" (Seat tiles, Seat Details, chat) and the 2a review leftovers. Part 3 (windows) stays separate.

## Decisions

- **The developer's answers (2026-11-22):**
  - **Flag on at the end of 2b-2.** The windows rely on the existing short-screen dialog rule until Part 3 fits them; the real-phone check of the board needs the flag on in the live build.
  - **The viewer's own tile opens Seat Details too.** Skills stay usable only from the action column; Seat Details shows them as text.
  - **Chat is a button in the centre band**, beside Menu and History, with the unread count; the chat panel slides over the right side at full height.
  - **The three 2b-1 leftovers wait** (thinking line, hand padding, toolbar timing). Task 6 records them in `docs/deferrals.md`.
- **My calls:**
  - **The flag stays as a kill switch:** Its factory returns `true` instead of `isDevMode()`; tests that set it `false` keep working, and it can be turned off in one line.
  - **"Touch device" is `(pointer: coarse)`**, read once by `Layout` (`coarsePointer`), `false` without `matchMedia`.
  - **Dying becomes a badge across both Generals** (red), as the spec lists it with Face Down, replacing 2b-1's status strip.
  - **One new string:** `phone.badge.form` "Form" / "Hóa thân" (the lead word of the existing `seat.form`). Everything else reuses catalog keys (`seat.faceDown`, `seat.noSkills`, `seat.dying`, `seat.equipment`, `seat.judgment`, `seat.underGeneral`, `seat.farms`, `avatar.hidden`, `ui.close`, `lobby.chat`, `chat.unread`). Seat Details' title is the seat's name.

## Global Constraints

- Presentation only. No engine, content, bots, protocol, server or sign-in changes.
- The medium and large layouts do not change in any visible way. `BoardChat` keeps its floating button and panel there.
- Phone board sizes: No text under 12 px; 14 px for names, numbers, card names and buttons; tap targets at least 44 × 44 px; nothing scaled down.
- Seat Details shows only what the viewer may see: It reads the visible (redacted) state the board already has.
- UI text follows `CLAUDE.md`; the new string gets English and a Vietnamese draft.
- Work on `feat/phone-app-seat-details`, branched from `feat/phone-app-board` (PR 82). The agent never merges or pushes to `main`.
- `npm run verify` and `npx jest --selectProjects app` pass before the pull request.

## Review Focus

- **A hidden General in Seat Details:** It shows "Hidden" and is not a button; it never names the General or its skills. Pinned in Task 2.
- **Seat Details open while the seat changes** (a card is equipped, the seat is eliminated): The window follows the live state. Pinned in Task 2.
- **A solo game (no chat) on the phone board:** No Chat button in the centre band. Pinned in Task 3.
- **Turning a phone from compact to another layout with the chat open:** The web panel shows, still open, with its own button. Pinned in Task 3.
- **The production build after the flag turns on:** An installed phone gets the phone board; a phone browser tab gets the install hint only on a touch screen. Pinned in Task 4 and Task 5.

---

### Task 1: Text badges on the phone tile

**Files:**
- Modify: `projects/app/src/app/game-board/phone/phone-seat-tile.ts`, `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`
- Test: `projects/app/src/app/game-board/phone/phone-seat-tile.spec.ts`

**Interfaces:**
- Produces on the tile: `.badge` elements, each inside the General it is about (`.general[data-slot]`) or in `.badges-across` lying across both. A red badge has class `red`.

What goes where (spec, "What a phone tile leaves out and keeps"):
- **No Skills for one General** (`seat.silencedSlots`): `seat.noSkills` on that General.
- **Form** (`seat.forms.chosen`): `phone.badge.form` on the General in `seat.forms.slot`.
- **Across both:** Face Down (`seat.faceDown`), No Skills for the whole seat (`seat.silenced`), Dying (`seat.dying`, red). Several stack in one column.
- **Unchanged:** The Eliminated stamp, the chained mark (no text), the Ambitionist mark.
- A badge wraps to two lines on a narrow General; its text is 12 px.

- [ ] **Step 1: Write the failing tests:** One per row above (where the badge appears and its text), Face Down with No Skills stacking across, a dying seat having the red badge and no `.status` strip, and the existing "no text under 12 px" test still passing.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- phone-seat-tile`
Expected: FAIL, no `.badge` elements.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests**

Run: `npx jest --selectProjects app -- phone-seat-tile`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/phone projects/app/src/app/i18n
git commit -m "feat(app): text badges on the phone seat tile"
```

### Task 2: Seat Details

**Files:**
- Create: `projects/app/src/app/game-board/phone/seat-details-dialog.ts`
- Modify: `projects/app/src/app/game-board/phone/phone-seat-tile.ts` (the viewer's tile is a button too), `projects/app/src/app/game-board/phone/phone-board.ts`
- Test: `projects/app/src/app/game-board/phone/seat-details-dialog.spec.ts`, `projects/app/src/app/game-board/phone/phone-board.spec.ts`, `projects/app/src/app/game-board/phone/phone-seat-tile.spec.ts`

**Interfaces:**
- Produces:
  - `export interface SeatDetailsData { state: Signal<GameState>; seatId: string }`. A signal, so the open window follows the game.
  - `SeatDetailsDialog` (selector `app-seat-details-dialog`), opened with `MatDialog.open(SeatDetailsDialog, { data, width: 'min(92vw, 560px)' })`.
- `PhoneSeatTile`: Every tile, the viewer's included, is one `button` that emits `opened`.
- `PhoneBoard`: On `opened`, opens Seat Details for that seat with its `state` input as the signal.

What Seat Details shows, for the seat in the visible state:
- **Title:** The seat's name. HP and hand count under it.
- **Generals:** For each, the portrait, the name and its skill names (`generalDisplayData(...).skills`); a button that opens `GeneralInfoDialog`. A hidden General (`generalDefinitionId === 'hidden'`) shows `avatar.hidden` and is not a button. The Form badge text (`seat.form`) under the General that holds it.
- **States:** Face Down, No Skills (seat or per General), Chained, Dying, Eliminated, as text, when they apply.
- **Equipment, Judgment, Under General, Set Aside Cards:** Each a short list of card names (with "counts as" for Judgment), each a button that opens `CardInfoDialog`. A section with no cards is left out.
- **Close:** A `ui.close` button in `mat-dialog-actions`, outside the scrolling content, so it stays on screen at 760 × 340.

- [ ] **Step 1: Write the failing tests** in `seat-details-dialog.spec.ts` (open it through `MatDialog` with a `signal(state)`):
  - It shows the name, HP and both Generals with their skill names; clicking a General opens `GeneralInfoDialog` with its id.
  - A hidden General shows "Hidden", is not a button, and no skill names appear for it.
  - Equipment and Judgment list card names; clicking one opens `CardInfoDialog` with that card.
  - Setting the signal to a state where the seat has a new Equipment card updates the list without reopening.
  - States show as text (Face Down, Chained, Eliminated).
  - The Close button closes it.
- In `phone-board.spec.ts`: Clicking an opponent's tile and the viewer's tile each opens `SeatDetailsDialog` with that seat id (spy on `MatDialog.open`).

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- seat-details phone-board phone-seat-tile`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement.** Section headings 14 px, list buttons at least 44 px tall, portraits small (about 64 px tall).

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/phone
git commit -m "feat(app): Seat Details for a tapped seat on the phone board"
```

### Task 3: Chat in the centre band

**Files:**
- Create: `projects/app/src/app/online/board-chat-state.service.ts`
- Modify: `projects/app/src/app/online/board-chat.ts`, `projects/app/src/app/online/lobby-page.ts` (provide the service), `projects/app/src/app/game-board/phone/phone-centre-band.ts`
- Test: `projects/app/src/app/online/board-chat.spec.ts` (existing behaviour kept), `projects/app/src/app/online/board-chat-state.service.spec.ts`, `projects/app/src/app/game-board/phone/phone-centre-band.spec.ts`

**Interfaces:**
- Produces `BoardChatState` (provided by `LobbyPage`, not root): `open: Signal<boolean>`, `unread: Signal<number>`, `available: Signal<boolean>`, `toggle(): void`, `setYou(playerId: string | null): void`, `setAvailable(on: boolean): void`. The unread rule is `BoardChat`'s today (messages after the last seen id, not from you, 0 while open).
- `BoardChat`: Uses the service; marks it available while it exists; on the compact layout it renders no floating button and its panel runs from the top of the screen (the toolbar height variable, 0 there) to the bottom.
- `PhoneCentreBand`: `inject(BoardChatState, { optional: true })`; when `available()`, a 44 × 44 Chat button (icon, `lobby.chat` or `chat.unread` as its label, the count as a small badge) that calls `toggle()`.

- [ ] **Step 1: Write the failing tests:**
  - Service: unread counts others' messages after the last seen, is 0 while open, and opening marks everything seen.
  - `board-chat.spec.ts`: Its existing tests pass unchanged (they provide the service); on the compact layout there is no `.chat-toggle`, and opening through the service shows the panel.
  - Centre band: No Chat button without the service or while `available()` is false; with it, the button shows the unread count and toggles the panel state.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- board-chat phone-centre-band`
Expected: FAIL, the service does not exist.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app
git commit -m "feat(app): chat from the phone board's centre band"
```

### Task 4: The three fixes from the 2a review

**Files:**
- Modify: `projects/app/src/app/layout.service.ts`, `projects/app/src/app/game-board/game-board.ts`, `projects/app/src/app/install-prompt.service.ts`
- Test: `projects/app/src/app/layout.service.spec.ts`, `projects/app/src/app/install-hint.spec.ts`, `projects/app/src/app/game-board/game-board.spec.ts`, `projects/app/src/app/install-prompt.service.spec.ts`

**Interfaces:**
- `Layout.coarsePointer: Signal<boolean>`, from `(pointer: coarse)`; `installWouldHelp` also requires it. `stubDisplayMode` in `layout.testing.ts` gains an optional `{ coarse: boolean }` (default `true`, so existing hint tests keep their meaning).
- `GameBoard` holds the wake lock only while `gameService.state()` is set and has no result.
- `InstallPrompt.install()` catches a rejected `prompt()` or `userChoice`; the offer is dropped either way.

- [ ] **Step 1: Write the failing tests:** A browser tab at 915 × 412 with a fine pointer: `installWouldHelp` false and no hint; with a coarse pointer: true. The board on the "No game in progress" screen does not hold the lock. `install()` with a rejecting `prompt` resolves and leaves `available` false.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- layout.service install-hint install-prompt game-board.spec`
Expected: FAIL on the three new tests.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app
git commit -m "fix(app): install hint on touch screens only, wake lock only in a game, quiet install failures"
```

### Task 5: Turn the phone board on

**Files:**
- Modify: `projects/app/src/app/feature-flags.ts`, `projects/app/src/app/feature-flags.spec.ts`, `docs/deferrals.md` (delete "The phone board is off in production"; add "Phone board leftovers": the thinking line, the hand row's padding, the toolbar timing, the spectator layout at 12 seats, the played card filling the band at 340 px), `docs/architecture/frontend.md` (the flag is on; Seat Details, badges, chat)

- [ ] **Step 1: Write the failing test:** `feature-flags.spec.ts`: In a production-like injector (`isDevMode` mocked to `false`), `phoneBoard` is `true` and `playOffline` is `false`.

- [ ] **Step 2: Run it and see it fail**

Run: `npx jest --selectProjects app -- feature-flags`
Expected: FAIL, `phoneBoard` is false.

- [ ] **Step 3: Implement:** The factory returns `phoneBoard: true`; the comment says it is a kill switch.

- [ ] **Step 4: Run the static checks and all tests**

Run: `npm run verify && npx jest --selectProjects app server`
Expected: Both pass. (If plain lint trips on another session's worktree under `.claude/worktrees/`, run `npx eslint . --ignore-pattern '.claude/worktrees/**'` and say so.)

- [ ] **Step 5: Check in the browser** (dev server, `?display=fullscreen`, 915 × 412 and 760 × 340):
  - Tap an opponent and your own tile: Seat Details opens, fits, its Close button is on screen; a General and a card open their info windows.
  - Badges: Use a scenario or the console to set Face Down and No Skills on a seat; they lie where the spec says.
  - Chat in an online room with a second player (or the solo-room check that there is no Chat button).
  - 1133 × 744: The chat button and panel are as before.
  - The production build through the Node server at 915 × 412 with a phone user agent: `/device-info` says the layout follows the display mode (installed is forced only in dev, so only the browser-tab case is checkable here: blocked with the hint).

- [ ] **Step 6: Commit the docs and the flag**

```bash
git add projects/app/src/app/feature-flags.ts projects/app/src/app/feature-flags.spec.ts docs
git commit -m "feat(app): turn the phone board on"
```

- [ ] **Step 7: Push and open a pull request** against `feat/phone-app-board`. Say that merging the chain puts the phone board on the live site, and that the real-phone check comes first. Do not merge.
