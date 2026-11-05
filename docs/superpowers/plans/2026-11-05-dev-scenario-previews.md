# Dev Scenario Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only `/preview` page that opens the real board (or a standalone screen) in a named situation, playable, so the UI can be checked without playing bot games.

**Architecture:** A scenario registry in the app project. A `board` scenario's recipe builds a real engine `GameState` (seeded game, direct state edits, engine run to the wanted window); `GameService.startFromState` loads it into the real `GameBoard`. A `screen` scenario renders a standalone component from fixtures. A jest test loops over the registry and checks every board scenario reaches its stated window. Production builds swap the dev routes for an empty list.

**Tech Stack:** Angular (standalone, signals), the `engine`, `content` and `bots` packages, jest.

**Spec:** `docs/superpowers/specs/2026-11-05-dev-scenario-previews-design.md`

## Global Constraints

- Branch off `main` as `feat/dev-scenarios`; never push to or merge `main`.
- Dev code lives in `projects/app/src/app/dev/`. The engine stays framework-free and unaware of it. The only production-code change is in `game.service.ts`.
- Human is seat 0, vs-bots mode, default Kingdom Wars deck (`deck: 'kingdomWars'` in `GameRules`; check the id spelling in `content`).
- Recipes edit state freely (hands, HP, Equipment, judgment area, phase) and then let the engine run. No validity check is required.
- Dev pages are English only. UI text style: Title Case for labels and buttons, sentence case for sentences, ids never shown as ids.
- Production bundle must not contain the dev pages.
- `npm run verify` and `npm test` pass before the PR.

## Review Focus

- A scenario whose window disappears after an engine change fails the registry test with its id in the message.
- Reset gives the same window again (seeded, no bot move due when the recipe returns).
- An unknown `/preview/:scenarioId` shows "Scenario not found" with a link back to `/preview`, not a blank page.
- Opening a second scenario after the first starts a clean game: no leftover bot timer or state.
- Leaving a scenario stops its bot timer.

---

### Task 1: `GameService.startFromState`

**Files:**
- Modify: `projects/app/src/app/game.service.ts` (`startGame`, around line 150)
- Test: `projects/app/src/app/game.service.spec.ts`

**Interfaces:**
- Produces: `startFromState(state: GameState, mode: GameMode = 'vs-bots'): void` on `GameService`. It does what `startGame` does after the game is created: cancels the bot timer, clears bot memories and move-start, sets mode, increments `gameNumber`, sets state and revealed seat (`humanSeatId()`), clears the error, then `scheduleBotIfDue()`.

- [ ] **Step 1: Write the failing tests** in `game.service.spec.ts`: `startFromState loads the given state and reveals seat-0 in vs-bots mode` (build a state with `startGame(4, 1, 'vs-bots')`, read `service.state()`, call `startFromState` with a changed copy, assert `state()` is the copy, `revealedSeatId()` is `'seat-0'`, `gameNumber()` went up); `startFromState restarts the bot timer` (state whose active seat is a bot; with `botDelayMs = 0` and fake timers, a bot move happens).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game.service.spec.ts -t startFromState`. Expected: FAIL, method not defined.
- [ ] **Step 3: Implement.** Extract the shared tail of `startGame` into a private `adopt(state: GameState, mode: GameMode): void` and call it from both `startGame` and `startFromState`. `startGame` behaviour must not change.
- [ ] **Step 4: Run** the whole `game.service.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: GameService.startFromState for dev scenarios`. (First create the branch: `git checkout -b feat/dev-scenarios main`; the uncommitted design and plan docs go in a first commit `docs: dev scenario previews design and plan`. Leave the temporary `game-over-preview.ts` and its route line out of every commit until Task 5 moves them.)

### Task 2: Scenario types and recipe helpers

**Files:**
- Create: `projects/app/src/app/dev/scenario.ts`, `projects/app/src/app/dev/recipe.ts`
- Test: `projects/app/src/app/dev/recipe.spec.ts`

**Interfaces:**
- Produces in `scenario.ts`:
  - `type ScenarioGroup = 'Play Board' | 'Response Windows' | 'Choice Prompts' | 'Other Screens'`
  - `interface BoardScenario { kind: 'board'; id: string; group: ScenarioGroup; title: string; description: string; seatCount: number; build(registry: ContentRegistry): GameState; reaches(state: GameState): boolean }`
  - `interface ScreenScenario { kind: 'screen'; id: string; group: ScenarioGroup; title: string; description: string; component: () => Promise<Type<unknown>>; inputs?: Record<string, unknown> }`
  - `type Scenario = BoardScenario | ScreenScenario`
- Produces in `recipe.ts` (all pure functions over `GameState`, returning a new state):
  - `playableGame(registry: ContentRegistry, seed: number, seatCount: number): GameState`: `createGame` (same rules as `GameService.startGame`: `judgmentNotice: true`, `logPasses: true`, default deck), then drive General Selection with `ruleBasedPolicy` from `bots` until `phase` leaves `'GeneralSelection'`. Players are `human` for seat-0, `bot` for the rest, with names.
  - `give(state, seatId: string, definitionIds: string[]): GameState`: moves the first matching card of each definition id from the draw pile (or any other zone if the pile has none) into the seat's hand zone, using `moveCard`.
  - `equip(state, seatId, definitionId): GameState`, `placeJudgment(state, seatId, definitionId): GameState` (same, into the equipped / judgment zone).
  - `setHp(state, seatId, hp: number): GameState`.
  - `setTurn(state, seatId, phase: Phase): GameState`: the seat's turn, in that phase, nothing pending.
  - `stepUntil(state, registry, done: (s: GameState) => boolean, maxSteps = 200): GameState`: while not done, take the active seat's move from `ruleBasedPolicy` and `resolve` it; throws `Error('stepUntil: window not reached')` after `maxSteps` or if `state.result` is set.
  - `act(state, registry, action: Action): GameState`: `resolve` with the registry and Guozhan mode, returns the new state.
  - `windowOf(state): 'response' | 'choice' | 'selection' | 'arrangement' | 'judgment' | null` classifying what is pending (`pendingResponse`, `pendingChoice`, `pendingSelection`, `pendingArrangement`, `judgmentView`).

- [ ] **Step 1: Write failing tests** in `recipe.spec.ts`: `playableGame reaches a playable phase` (`phase !== 'GeneralSelection'`, 4 seats, seat-0 human); `give puts the named cards in the hand and removes them from where they were` (count of the card across all zones is unchanged); `setHp sets combinedHp`; `setTurn makes the seat active in that phase` (`getActiveSeatId(state)` is the seat); `stepUntil throws when the window is never reached`; `windowOf is null for a resting state`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/dev/recipe.spec.ts`. Expected: FAIL, modules missing.
- [ ] **Step 3: Implement** the signatures above. Use `moveCard`, `findZoneByKind` and the seat's `CardZoneRef` from the engine; read how existing specs (`projects/engine/src/**/*.spec.ts`) place cards before inventing a way.
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit** `feat: dev scenario types and recipe helpers`.

### Task 3: Registry and the reachability test

**Files:**
- Create: `projects/app/src/app/dev/scenarios/index.ts` (exports `SCENARIOS: Scenario[]` and `findScenario(id: string): Scenario | undefined`), `projects/app/src/app/dev/scenarios/play-board.ts` (exports `PLAY_BOARD_SCENARIOS: BoardScenario[]`)
- Test: `projects/app/src/app/dev/scenarios/scenarios.spec.ts`

**Interfaces:**
- Consumes: Task 2 types and helpers.
- Produces: `SCENARIOS`, `findScenario`. Group files each export an array, concatenated in `index.ts`.

- [ ] **Step 1: Write the failing test** in `scenarios.spec.ts`: `every scenario id is unique`; `every board scenario builds and reaches its window` (for each `BoardScenario`, `const state = s.build(buildContentRegistry())`; `expect(s.reaches(state)).toBe(true)` with the scenario id in the failure message, e.g. `expect({ id: s.id, ok: s.reaches(state) }).toEqual({ id: s.id, ok: true })`); `building twice gives the same state` (JSON equal, so Reset reproduces it); `a built state leaves no bot move due`: the active seat is seat-0 or a decision is pending for seat-0.
- [ ] **Step 2: Run** the spec. Expected: FAIL (no registry).
- [ ] **Step 3: Implement** `index.ts` with an empty-group array plus the Play Board scenarios: `play-own-turn` (seat-0 Play Phase, full hand with Sha, Shan, Peach, a Tool), `play-other-turn` (a bot's Play Phase, seat-0 waiting), `play-equipment` (seat-0 with Weapon, Armor, Mount and a delayed Tool in the judgment area), `play-six-seats` (6 seats, seat-0 Play Phase). `reaches` checks the active seat, phase and zone contents the title promises.
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit** `feat: dev scenario registry with Play Board scenarios`.

### Task 4: Response and choice scenarios

**Files:**
- Create: `projects/app/src/app/dev/scenarios/responses.ts` (`RESPONSE_SCENARIOS`), `projects/app/src/app/dev/scenarios/choices.ts` (`CHOICE_SCENARIOS`)
- Modify: `projects/app/src/app/dev/scenarios/index.ts` (concatenate both)
- Test: the loop in `scenarios.spec.ts` covers them; add one `it` per group asserting the group has at least the listed ids.

**Interfaces:**
- Consumes: `playableGame`, `give`, `setHp`, `setTurn`, `act`, `stepUntil`, `windowOf`.
- Produces: scenarios with these ids, each `reaches` = `windowOf(state)` is the stated kind and `pending…` names seat-0 as the one who must act (except `choice-start-popup`, which stops where the Start popup shows):
  - Responses: `respond-sha` (a bot used Sha on seat-0, seat-0 holds Shan), `respond-wuxie` (a bot played a Tool, seat-0 holds Wuxie), `respond-duel` (Duel from a bot, seat-0 holds Sha), `respond-barbarians`, `respond-arrows`, `respond-dying-peach` (seat-0 at 0 HP holding Peach), `respond-discard` (seat-0 over the hand limit in Discard Phase).
  - Choices: `choice-start-popup`, `choice-skill-optional` and `choice-skill-compulsory` (pick Generals with real triggers and name them in the description), `choice-pick-card` (seat-0 picks a card from another seat, via a Tool such as Dismantle), `choice-compete`, `choice-judgment` (a judgment popup showing). Skip any whose popup is not on `main` and say so in `description` of an `Other Screens` note; do not stub it.

- [ ] **Step 1: Add the failing tests** for the two group files (ids listed above exist).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/dev`. Expected: FAIL.
- [ ] **Step 3: Implement** the scenarios one by one, running the loop test after each. Seeds are found by running recipes; commit the seed in the recipe.
- [ ] **Step 4: Run** the loop test. Expected: PASS, every scenario reached.
- [ ] **Step 5: Commit** `feat: dev response and choice scenarios`.

### Task 5: Screen scenarios

**Files:**
- Create: `projects/app/src/app/dev/scenarios/screens.ts` (`SCREEN_SCENARIOS: ScreenScenario[]`), `projects/app/src/app/dev/game-over-fixtures.ts`
- Delete: `projects/app/src/app/game-board/game-over-preview.ts`; remove the `preview-game-over` line from `app.routes.ts`.
- Modify: `scenarios/index.ts`

**Interfaces:**
- Produces: `GAME_OVER_CASES: Record<string, { label: string; seats: FinalSeatView[]; result: GameResult }>` (the eight cases from the existing preview file, moved verbatim), and screen scenarios `over-two`, `over-three`, `over-four`, `over-six`, `over-ambitionist`, `over-lone`, `over-draw`, `over-hidden`, plus `general-selection` (the real General Selection component with a seeded selection state; read `game-board/general-selection.ts` for its inputs).

- [ ] **Step 1: Failing test** `screen scenarios cover the eight Game Over cases and General selection`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Move** the fixtures out of the preview file, build the scenarios, delete the preview file and its route line.
- [ ] **Step 4: Run** `npx jest projects/app/src/app/dev`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: dev screen scenarios (Game Over, General selection)`.

### Task 6: Pages, routes and production exclusion

**Files:**
- Create: `projects/app/src/app/dev/dev-index.ts`, `dev-scenario-page.ts`, `dev-routes.ts`, `dev-routes.prod.ts`
- Modify: `projects/app/src/app/app.routes.ts`, `angular.json` (production `fileReplacements`)
- Test: `projects/app/src/app/dev/dev-pages.spec.ts`

**Interfaces:**
- `DEV_ROUTES: Routes` from `dev-routes.ts`: `{ path: 'preview', loadComponent: DevIndex }` and `{ path: 'preview/:scenarioId', loadComponent: DevScenarioPage }`. `dev-routes.prod.ts` exports `DEV_ROUTES: Routes = []`; the production build replaces `dev-routes.ts` with it. `app.routes.ts` spreads `...DEV_ROUTES`.
- `DevIndex`: lists scenarios grouped by `ScenarioGroup`, each a link to `/preview/<id>` with title and description.
- `DevScenarioPage`: reads `scenarioId`; unknown id shows "Scenario not found" and a link "Back to Scenarios". A `board` scenario: builds the state with `GameService.registry`, calls `startFromState(state, 'vs-bots')`, renders `<app-game-board>`; a toolbar with "Reset" (rebuilds and reloads) and "All Scenarios" (link to `/preview`). A `screen` scenario: loads its component and sets its inputs. On destroy it must stop the bot timer (add `GameService.stop()` that cancels the timer and clears the state if none exists; test it).

- [ ] **Step 1: Failing tests** in `dev-pages.spec.ts`: index lists every group heading and a link per scenario; the page for `respond-sha` renders the board with a pending response for seat-0; Reset gives an equal state; unknown id shows "Scenario not found"; destroying the page stops the bot timer (no move after `botDelayMs`).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/dev/dev-pages.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the pages, routes, `GameService.stop()` and the `fileReplacements` entry.
- [ ] **Step 4: Run** `npx jest projects/app/src/app/dev` and `npm run build:app`. Expected: PASS and a clean build; then `grep -rl "respond-sha" dist/` prints nothing.
- [ ] **Step 5: Commit** `feat: dev scenario pages and routes`.

### Task 7: Docs and verification

**Files:**
- Modify: `docs/architecture/frontend.md` (a short "Dev scenarios" section: where they live, how to add one, that production builds exclude them)
- Modify: the spec's status line to "Implemented"

- [ ] **Step 1:** Write the docs section.
- [ ] **Step 2:** Run `npm run verify` and `npm test`. Expected: both pass.
- [ ] **Step 3:** Open `http://localhost:4200/preview` and check by hand: one scenario per group, Reset, an unknown id.
- [ ] **Step 4: Commit** `docs: dev scenarios`, push the branch, open a PR against `main` with the attribution line from the session.
