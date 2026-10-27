# Victory Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Game Over card's text lists with one column per group that took part (Wei, Shu, Wu, Qun, Winning Ambitionist, Losing Ambitionist), each listing its players, with the winning group lit in its Force colour, for the local game and the online result.

**Architecture:** A pure function `victoryColumns` turns per-seat summaries plus the `GameResult` into a view-model. A shared `FinalSeatView` summary and `finalSeatViews(state)` helper live in the `protocol` package, so the local game, the online client and the server all build the same data. One presentational component, `VictoryBoard`, renders it and is used by both `GameOver` (local) and `OnlineResult`. Once `state.result` is set, engine redaction stops hiding other seats' Generals and allegiance.

**Tech Stack:** TypeScript, Angular 22 standalone components with signals, Angular Material, Jest (`jest-preset-angular`), CSS container queries.

**Spec:** `docs/superpowers/specs/2026-10-26-victory-window-design.md`

**Deviation from the spec:** the spec says the server persists the per-seat summary. `Room.lastGame` is kept in memory only (`protocol/src/rooms.ts`), so there is no persistence or stored-game fallback to build. The summary is a new required field on `LastGame`, and the protocol version bump makes old clients reload.

## Global Constraints

- Columns in this order, at most six: Wei, Shu, Wu, Qun, Winning Ambitionist, Losing Ambitionist. A column exists only if a seat belongs to it.
- Winning column lit in its Force colour (header, border, tint, glow, "Winners" tag); all other columns lose colour and dim. A draw lights none.
- Membership comes from each seat's allegiance and Kingdom, never from `result.winningSeatIds`. Do not change `GameResult`, `checkWinCondition` or `winningSeatIds`.
- Group of a seat: `'Ambitionist'` if `allegiance === 'ambitionist'`, else its Kingdom. A seat with no decided allegiance is shown under its printed Kingdom.
- Winning group: no winners is a draw; `winningKingdom` set is that Kingdom; otherwise the group of the sole survivor.
- "Losing Ambitionists" is plural from two seats; "Winning Ambitionist" is always singular.
- Headline: "{Kingdom} wins!" (`over.kingdomWins`); "{name} wins as the Ambitionist!" (new key); a lone survivor with no decided allegiance "{name} wins!" (`over.namesWin`); a draw `over.draw`.
- Member row: avatar, name, "You" tag, "Main · Deputy" General names, "Survived" or "Fallen". No "You" tag in Pass and Play or for a viewer without a seat.
- Reveal: headline at 50 ms, columns from 500 ms about 130 ms apart, winner lit 500 ms after the last column; reduced motion shows the end state at once. Not blocking.
- Columns 150 to 190 px wide, centred, wrapping; at 700 px container width or narrower, two per row, winning column first.
- UI text follows the casing rules in CLAUDE.md (Title Case labels, sentence case sentences, ids never shown); every string is a catalog key in `en.ts` and `vi.ts` (Vietnamese is draft). No new dependency.
- Engine, content and protocol stay framework-free. No game rules in components.
- `PROTOCOL_VERSION` becomes 2.

## Review Focus

1. A seat whose Kingdom is `'hidden'` (should be impossible after game over) must not crash or throw; it is left out of the columns. (Task 3)
2. A `winningSeatIds` entry that matches no seat summary must not crash; nothing is lit and the headline is the lone-survivor one. (Task 3)
3. Two or more losing Ambitionists share one plural-labelled column, and a Kingdom win with Ambitionists never makes a Winning Ambitionist column. (Task 3)
4. Switching language while the window is open re-renders names, labels and headline. (Task 5)
5. `prefers-reduced-motion` shows the lit winner immediately, with no timers left running after the component is destroyed. (Task 5)

## File Structure

- Create `projects/protocol/src/finalSeats.ts` (+ `.spec.ts`): `FinalSeatView`, `finalSeatViews`.
- Modify `projects/protocol/src/game.ts`, `public-api.ts`, `version.ts`: `LastGame.finalSeats`, export, version 2.
- Modify `projects/engine/src/lib/domain/redact.ts` (+ `redact.spec.ts`): reveal seats once `result` is set.
- Modify `projects/server/src/rooms/roomService.ts` (+ `roomGames.spec.ts`): fill `lastGame.finalSeats`.
- Create `projects/app/src/app/game-board/victory-columns.ts` (+ `.spec.ts`): pure grouping.
- Create `projects/app/src/app/game-board/victory-board.ts` (+ `.spec.ts`): the component.
- Modify `projects/app/src/app/i18n/en.ts`, `vi.ts`; `game-board/game-over.ts` (+ spec), `game-board/game-board.ts`; `online/online-result.ts` (+ spec), `online/remote-game.service.ts`, `online/lobby-page.ts`, `online/testing.ts`.
- Modify `docs/architecture/frontend.md`, `rules-engine.md`, `backend-and-deployment.md`.

Run tests with `npx jest --selectProjects <engine|protocol|server|app> <path>`.

---

### Task 1: Protocol summary and version

**Files:**
- Create: `projects/protocol/src/finalSeats.ts`, `projects/protocol/src/finalSeats.spec.ts`
- Modify: `projects/protocol/src/game.ts` (`LastGame`), `projects/protocol/src/public-api.ts`, `projects/protocol/src/version.ts`

**Interfaces:**
- Produces: 
  ```ts
  export interface FinalSeatView {
    seatId: string;
    kingdom: Kingdom;                       // engine type; the printed Kingdom
    allegiance: 'kingdom' | 'ambitionist' | null; // null: never decided
    mainGeneralId: string | null;           // null when absent or 'hidden'
    deputyGeneralId: string | null;
    eliminated: boolean;
  }
  export function finalSeatViews(state: Pick<GameState, 'seats'>): FinalSeatView[]; // seat order
  ```
  `LastGame` gains `finalSeats: FinalSeatView[]` (empty when the game did not finish). `PROTOCOL_VERSION = 2`.

- [ ] **Step 1: Write the failing tests** in `finalSeats.spec.ts`, building minimal seats cast to `Seat`: `maps allegiance, Kingdom, Generals and eliminated in seat order`; `reads an undecided allegiance as null`; `reads a hidden or missing General as null`.
- [ ] **Step 2: Run** `npx jest --selectProjects protocol projects/protocol/src/finalSeats.spec.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `finalSeatViews` in `finalSeats.ts`; add `finalSeats` to `LastGame`; export both from `public-api.ts`; set the version to 2.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add projects/protocol && git commit -m "feat(protocol): per-seat final summary on LastGame, version 2"`

### Task 2: Reveal every seat once the game is over

**Files:**
- Modify: `projects/engine/src/lib/domain/redact.ts` (`redactStateForSeat`)
- Test: `projects/engine/src/lib/domain/redact.spec.ts`

**Interfaces:**
- Produces: when `state.result` is non-null, `redactStateForSeat(state, viewer).seats` equals `state.seats` (full Generals, Kingdom and allegiance for every seat). Zones, hands and the rest are redacted exactly as before.

- [ ] **Step 1: Write the failing tests** (reuse `makeState`): `shows every seat's Generals, Kingdom and allegiance once the game has a result`; `still masks another seat's hand once the game has a result`; `still hides Generals while there is no result` (the existing tests already cover the last; add one that sets `result: null` explicitly if none does).
- [ ] **Step 2: Run** `npx jest --selectProjects engine projects/engine/src/lib/domain/redact.spec.ts`. Expected: FAIL on the first new test.
- [ ] **Step 3: Implement**: in `redactStateForSeat`, map seats through `redactSeat` only when `state.result` is null.
- [ ] **Step 4: Run** the engine project (`npx jest --selectProjects engine`). Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(engine): show every seat's Generals once the game is over"`

### Task 3: The grouping function

**Files:**
- Create: `projects/app/src/app/game-board/victory-columns.ts`, `projects/app/src/app/game-board/victory-columns.spec.ts`

**Interfaces:**
- Consumes: `FinalSeatView` (Task 1), `GameResult`, `Force` from `labels.ts`.
- Produces:
  ```ts
  export type VictoryGroup = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'WinningAmbitionist' | 'LosingAmbitionist';
  export interface VictoryMember { seatId: string; mainGeneralId: string | null; deputyGeneralId: string | null; survived: boolean; you: boolean }
  export interface VictoryColumn { group: VictoryGroup; force: Force; winning: boolean; members: VictoryMember[] }
  export type HeadlineKind = 'kingdom' | 'ambitionist' | 'lone-survivor' | 'draw';
  export interface VictoryView {
    columns: VictoryColumn[];            // in the fixed order, empty groups left out
    winningGroup: VictoryGroup | null;
    headlineKind: HeadlineKind;
    winnerSeatId: string | null;         // the sole survivor, else null
    winningKingdom: Kingdom | null;      // for the headline, when headlineKind is 'kingdom'
  }
  export function victoryColumns(seats: readonly FinalSeatView[], result: GameResult, youSeatId: string | null): VictoryView;
  ```
  `force` is the Force token name (`'Wei'`…`'Qun'`, `'Ambitionist'`).

- [ ] **Step 1: Write the failing tests**, one per line:
  - `Wei win with fallen teammates: columns are Wei, Shu, Wu, LosingAmbitionist; the fallen Wei seat is in the Wei column with survived false; only Wei is winning; headlineKind kingdom`
  - `Ambitionist win with eight seats gives six columns in the fixed order; WinningAmbitionist holds only the winner; headlineKind ambitionist`
  - `Qun win lists only the Kingdoms that took part`
  - `a draw lights no column and has headlineKind draw`
  - `a lone Kingdom survivor with a decided allegiance lights its own Kingdom's column, headlineKind kingdom`
  - `a lone survivor with a null allegiance lights its printed Kingdom's column, headlineKind lone-survivor`
  - `two losing Ambitionists share LosingAmbitionist; with a Kingdom win there is never a WinningAmbitionist column` (Review Focus 3)
  - `members are in seat order and only youSeatId is marked you; null marks none`
  - `a seat whose Kingdom is hidden and allegiance null is left out without throwing` (Review Focus 1)
  - `a winning seat id with no summary lights nothing and gives lone-survivor` (Review Focus 2)
- [ ] **Step 2: Run** `npx jest --selectProjects app projects/app/src/app/game-board/victory-columns.spec.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `victoryColumns` following the Global Constraints: group each seat, find the winning group, split Ambitionists, order, drop empty groups.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): pure grouping of the final seats into victory columns"`

### Task 4: Message keys

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`; remove `over.winners`, `over.losers`, `over.none` from both once Tasks 6 and 7 no longer use them (do the removal in Task 7).
- Test: `projects/app/src/app/i18n/catalogs.spec.ts` (existing parity and casing checks)

**Interfaces:**
- Produces these keys (English values; Vietnamese is a draft in sentence case, using the existing Vietnamese terms for Kingdoms and Ambitionist):
  `over.ambitionistWins` "{name} wins as the Ambitionist!", `over.sub.kingdom` "Every survivor played for {kingdom}.", `over.sub.ambitionist` "The last survivor, playing alone.", `over.sub.lone` "The last survivor.", `over.sub.draw` "Everyone fell at the same time.", `over.group.WinningAmbitionist` "Winning Ambitionist", `over.group.LosingAmbitionist` "Losing Ambitionist", `over.group.LosingAmbitionists` "Losing Ambitionists", `over.player` "1 player", `over.players` "{n} players", `over.winnersTag` "Winners", `over.survived` "Survived", `over.fallen` "Fallen", `over.you` "You", `over.standings` "Final Standings". Kingdom column titles use the existing `kingdomDisplayName`.

- [ ] **Step 1: Add the keys** to `en.ts` and `vi.ts`.
- [ ] **Step 2: Run** `npx jest --selectProjects app projects/app/src/app/i18n`. Expected: PASS (parity and casing).
- [ ] **Step 3: Run** `npm run i18n:status` and confirm the new keys are listed as draft.
- [ ] **Step 4: Commit** `git commit -m "feat(app): messages for the victory window"`

### Task 5: The VictoryBoard component

**Files:**
- Create: `projects/app/src/app/game-board/victory-board.ts`, `projects/app/src/app/game-board/victory-board.spec.ts`

**Interfaces:**
- Consumes: `victoryColumns` (Task 3), message keys (Task 4), `generalDisplayName`, `kingdomDisplayName` from `labels.ts`, `I18n`, `TPipe`, `CardArt`.
- Produces: `<app-victory-board [result] [seats] [youSeatId] [nameOf]>` where `result: GameResult`, `seats: FinalSeatView[]`, `youSeatId: string | null`, `nameOf: (seatId: string) => string`. Root element `.victory`; headline `.headline` (with `data-force` of the winning group, none for a draw); sub-line `.sub`; each column `section.col` with `data-f` (the Force token), classes `win` and `lose` added after the reveal; members `li.m` with class `fallen` or `alive`.

- [ ] **Step 1: Write the failing tests** (jest fake timers where needed):
  - `renders one column per group present, in order, with member names, General pairs and Survived or Fallen`
  - `lights only the winning column after the reveal and dims the rest` (advance timers past the reveal; assert `.col.win` count 1 and the others `.lose`)
  - `a draw lights nothing and shows the draw headline`
  - `each headline kind reads as the Global Constraints say` (kingdom, ambitionist, lone survivor, draw)
  - `tags only the viewer's seat as You`
  - `uses the plural label for two or more losing Ambitionists`
  - `re-renders names and labels when the language changes` (Review Focus 4: switch `I18n` to Vietnamese, assert the headline text changes)
  - `shows the end state at once under prefers-reduced-motion and leaves no timer running after destroy` (Review Focus 5: mock `matchMedia`, `jest.getTimerCount()` is 0 after `fixture.destroy()`)
- [ ] **Step 2: Run** `npx jest --selectProjects app projects/app/src/app/game-board/victory-board.spec.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the component with the markup, tokens and layout of the spec: Force tokens from `styles.scss` through `data-force`; a size container so the narrow rule responds to the window's width, not the viewport; reveal driven by signals and timers cleared in `DestroyRef`. Avatars use `CardArt` for the main General when present, else an initial. Add a `role="list"` or `aria-label` from `over.standings` on the columns wrapper.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): victory board component"`

### Task 6: Use it in the local Game Over

**Files:**
- Modify: `projects/app/src/app/game-board/game-over.ts`, `projects/app/src/app/game-board/game-board.ts` (the `<app-game-over>` call, line ~70)
- Test: `projects/app/src/app/game-board/game-over.spec.ts`

**Interfaces:**
- Consumes: `VictoryBoard` (Task 5), `finalSeatViews` (Task 1).
- Produces: `GameOver` gains inputs `seats: FinalSeatView[]` and `youSeatId: string | null`, keeps `result`, `players` and the `newGame` output; the card is replaced by `<app-victory-board>` plus the New Game button (the button keeps its text and the `newGame` emit).

- [ ] **Step 1: Update the failing test**: `renders the victory board with its columns and emits newGame on click` (Wei win, four seats; assert the `.col` count, the headline `data-force` is `Wei`, and the click still emits).
- [ ] **Step 2: Run** `npx jest --selectProjects app projects/app/src/app/game-board/game-over.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**: `GameOver` passes `nameOf` built from `seatName(players, id, translator)`; `game-board.ts` passes `[seats]="finalSeatViews(state)"` (full state: all public at game over) and `[youSeatId]="gameService.humanSeatId()"`. Drop the old card styles.
- [ ] **Step 4: Run** `npx jest --selectProjects app projects/app/src/app/game-board`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): local Game Over shows the victory columns"`

### Task 7: Server summary and the online result

**Files:**
- Modify: `projects/server/src/rooms/roomService.ts` (`PendingEnd`, `endGame`, `closeGame`, `lastGame`, around lines 65 and 549), `projects/app/src/app/online/online-result.ts`, `projects/app/src/app/online/remote-game.service.ts` (`ending`, line ~121), `projects/app/src/app/online/lobby-page.ts`, `projects/app/src/app/online/testing.ts` (`LAST_GAME`)
- Test: `projects/server/src/rooms/roomGames.spec.ts`, `projects/app/src/app/online/online-result.spec.ts`

**Interfaces:**
- Consumes: `FinalSeatView`, `finalSeatViews`, `LastGame.finalSeats` (Task 1), `VictoryBoard` (Task 5).
- Produces: `closeGame(entry, game, outcome, result, finalSeats: FinalSeatView[])`; `PendingEnd.finalSeats`; `lastGame.finalSeats` is `finalSeatViews(runner.state)` for a finished game and `[]` otherwise. `OnlineResult` gains `youPlayerId = input<string | null>(null)`; the viewer's seat is the `ending().seats` entry with that `playerId`. A finished game renders `<app-victory-board>` instead of the winners and losers lines, buttons unchanged. `RemoteGameService.ending` fills `finalSeats` from the final state it holds (`finalSeatViews(state)`).

- [ ] **Step 1: Write the failing tests**:
  - server, in `roomGames.spec.ts`: `a finished game's lastGame carries a summary of every seat` (length equals the seat count, Generals non-null, ids match `lastGame.seats`); `a stopped game's lastGame has no summary`.
  - app, in `online-result.spec.ts`: update fixtures; `renders the victory board for a finished game and drops the winners and losers lines`; `tags the viewer's seat as You from youPlayerId`; keep the stopped-game and solo/lobby button tests.
- [ ] **Step 2: Run** `npx jest --selectProjects server projects/server/src/rooms/roomGames.spec.ts` and `npx jest --selectProjects app projects/app/src/app/online/online-result.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the server change (compute `finalSeats` where `result` is taken from `runner.state`, carry it through `PendingEnd`), the `OnlineResult` template, the `ending` computed, the `lobby-page.ts` binding (`[youPlayerId]="lobby.you()"`; confirm `lobby.you()` is the player id and adapt if it is not), and the `LAST_GAME` fixture. Fix any other `LastGame` literals the compiler flags.
- [ ] **Step 4: Run** `npm run typecheck:server`, then `npx jest --selectProjects server,app`. Expected: PASS. Remove the now-unused `over.winners`, `over.losers`, `over.none` keys from `en.ts` and `vi.ts` and re-run `npx jest --selectProjects app`.
- [ ] **Step 5: Commit** `git commit -m "feat: online result shows the victory columns"`

### Task 8: Docs and full verification

**Files:**
- Modify: `docs/architecture/frontend.md` (Victory window next to the Game Over description), `docs/architecture/rules-engine.md` (redaction at the result), `docs/architecture/backend-and-deployment.md` (`LastGame.finalSeats`, protocol version 2)

- [ ] **Step 1: Update the three docs** with the behaviour above, in their current style.
- [ ] **Step 2: Run** `npx jest` (all projects), `npm run typecheck:server`, and the app build (`npx ng build app`). Expected: all PASS, build succeeds.
- [ ] **Step 3: Check it in the running app** (use the `run` skill): finish a local game against bots and look at the window at desktop width and at a phone width (6 columns needs an 8-seat game with an Ambitionist; if that is hard to reach, say so and confirm the four-column case plus the unit tests).
- [ ] **Step 4: Commit** `git commit -m "docs: victory window architecture notes"`
