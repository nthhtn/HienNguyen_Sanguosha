# Animation Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only `/preview/animations` page where one button plays one animation on the real board, replayable on demand.

**Architecture:** Each animation is a registry entry that, given the clean base table, returns the same table with real engine events appended (and the facts those events record). The page shows the clean base table, then on the next tick the appended table, via a new `GameService.showState`; the board's playback director sees a longer log and plays the new events. The Victory reveal is a separate view with the standalone Game Over screen; Judgment and Compete link to the existing `/preview` scenarios.

**Tech Stack:** Angular (standalone, signals), `engine` events, the app's playback director, jest.

**Spec:** `docs/superpowers/specs/2026-11-05-animation-lab-design.md`

## Global Constraints

- Work on the existing branch `feat/dev-scenarios` (the lab builds on `/preview`); never push to or merge `main`.
- Dev code in `projects/app/src/app/dev/lab/`; the only production-code change is `GameService.showState`.
- The lab table is `playableGame(registry, 7, 4)` with seat-0's Play Phase (`setTurn(…, 'seat-0', 'Play')`), nothing pending; bots never move (no pending decision is ever set).
- Entries set only facts their events record (HP, revealed General, eliminated, `chained`); never a pending decision.
- Dev pages are English only; UI text style: Title Case for names and labels, sentence case for sentences.
- Production build excludes the lab (it is reached only through `dev-routes.ts`).
- `npm run verify` and `npm test` pass before any PR.

## Review Focus

- Playing the same animation twice in a row shows it twice (each Play starts from the clean base).
- Playing Heal or Reveal on a seat that already looks healed or revealed in a previous run does not break: each run starts clean.
- A new beat kind added to `BEATS`, or a new `SpriteId`, with no lab entry fails the coverage test.
- Leaving the lab page stops everything (`GameService.stop()`), and opening a scenario after it starts clean.
- The Victory Replay restarts the reveal sequence (the component is recreated).

---

### Task 1: `GameService.showState`

**Files:**
- Modify: `projects/app/src/app/game.service.ts`
- Test: `projects/app/src/app/game.service.spec.ts`

**Interfaces:**
- Produces: `showState(state: GameState): void` on `GameService`. Sets the state signal and clears `lastError`. It does not touch bot memories, mode, move start, game number or the revealed seat, and does not schedule a bot.

- [ ] **Step 1: Write the failing test** `showState swaps the state without starting a new game` (start a vs-bots game with `startGame(3, 1, 'vs-bots')`, record `gameNumber()` and `revealedSeatId()`, call `showState({ ...state, log: [...state.log] })`, assert the new object is `state()`, `gameNumber()` and `revealedSeatId()` are unchanged, and `botThinkingSeatId()` is `null` when seat-0 is active).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game.service.spec.ts -t showState`. Expected: FAIL, `showState is not a function`.
- [ ] **Step 3: Implement** `showState` as above, with a comment saying it is for the dev animation lab.
- [ ] **Step 4: Run** the whole `game.service.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: GameService.showState for the animation lab`.

### Task 2: Lab types and the beat animations

**Files:**
- Create: `projects/app/src/app/dev/lab/lab-animation.ts`, `projects/app/src/app/dev/lab/beat-animations.ts`, `projects/app/src/app/dev/lab/animations.ts`
- Test: `projects/app/src/app/dev/lab/animations.spec.ts`

**Interfaces:**
- Produces in `lab-animation.ts`:
  - `type LabParamValue = string | number`
  - `interface LabParam { key: string; label: string; kind: 'seat' | 'number' | 'choice'; options?: { value: LabParamValue; label: string }[]; default: LabParamValue }` (`seat` options are `seat-0`…`seat-3`).
  - `interface LabAnimation { id: string; group: 'Beats' | 'Sprite Effects'; title: string; description: string; params?: LabParam[]; play(base: GameState, params: Record<string, LabParamValue>): GameState }`
  - `labTable(registry: ContentRegistry): GameState`: `setTurn(playableGame(registry, 7, 4), 'seat-0', 'Play')`.
  - `withEvents(state: GameState, events: EngineEvent[], patch?: (s: GameState) => GameState): GameState`: appends `events` to `state.log` then applies `patch`.
  - `defaultParams(a: LabAnimation): Record<string, LabParamValue>`.
- Produces in `beat-animations.ts`: `BEAT_ANIMATIONS: LabAnimation[]`, one or more entries for each event kind that has a `BEATS` entry: `TurnAdvancedEvent`, `PhaseChangedEvent`, `CardsDrawnEvent`, `CardPlayedEvent` (a play with targets, and a response), `ResponsePassedEvent`, `CardMovedEvent`, `DamageDealtEvent`, `HpLostEvent`, `HealEvent`, `SeatDyingEvent`, `SeatSavedEvent`, `GeneralRevealedEvent`, `SeatEliminatedEvent`, `AbilityUsedEvent`. Parameters: the acting seat, targets, amount, phase, count, as each event needs. Facts patched alongside: HP for damage, HP lost and heal; the `generals[…].revealed` flag for a reveal; `eliminated: true` for an elimination.
- Produces in `animations.ts`: `ANIMATIONS: LabAnimation[]` (beats, then sprites once Task 3 exists) and `findAnimation(id: string)`.

- [ ] **Step 1: Write the failing tests** in `animations.spec.ts`:
  - `every beat kind in BEATS has at least one lab animation`: collect, for each `BEAT_ANIMATIONS` entry run with `defaultParams`, the kinds of the appended events; assert every key of `BEATS` (import from `../../game-board/playback/beats`) is covered.
  - `every beat animation appends events and each plans a visible beat`: for each entry, `play(labTable(registry), defaultParams(a))` has a longer log than the base, and `planBeat(event, index, { zoneKindOf, previous })` of each new event has a non-null `visual` and `durationMs > 0`.
  - `play does not change the base table` (the base object's log length is unchanged).
  - `animation ids are unique`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/dev/lab`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the types and helpers, then the beat entries one at a time, running the spec after each. Read `beats.ts`, `displayed-state.ts` and `playbackTiming.ts` for what each event must carry (a `CardPlayedEvent` needs a `UsedCard`; a `CardMovedEvent` needs real zone ids from the table; a `GeneralRevealedEvent` needs the seat's slot). Use real card instances from the table for card events.
- [ ] **Step 4: Run** the lab specs. Expected: PASS.
- [ ] **Step 5: Commit** `feat: animation lab types and beat animations`.

### Task 3: Sprite effect animations

**Files:**
- Create: `projects/app/src/app/dev/lab/sprite-animations.ts`
- Modify: `projects/app/src/app/dev/lab/animations.ts`
- Test: `projects/app/src/app/dev/lab/animations.spec.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces: `SPRITE_ANIMATIONS: LabAnimation[]` with one entry per `SpriteId` (`slash`, `slash-fire`, `slash-lightning`, `damage`, `fire`, `lightning`, `chain`), parameterised by target seat. Damage entries append a `DamageDealtEvent` shaped so `damageEffectsFor` yields that image: nature `normal`/`fire`/`thunder` and `cause.card.as` `sha`/`fire-attack`/`lightning-attack` per `damageImageOf`; `chain` appends a `ChainToggledEvent` (`chained: true`) and patches the seat's `chained` flag. An extra entry "Chain wave" appends a fire hit on a chained seat plus the unchain and the chained hits that follow, to show the wave.

- [ ] **Step 1: Write the failing tests:** `every sprite id has a lab animation whose events yield it` (for each id in the list of `SpriteId`s, some entry's appended events give `damageEffectsFor(events)` or `chainEffectsFor(events)` containing that `image`; list the `SpriteId`s as a literal array and add an assertion that it matches `Object.keys` of the sprite manifest used by `spriteSheet`, so a new sheet breaks the test); `the chain wave entry reaches more than one seat`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/dev/lab`. Expected: FAIL.
- [ ] **Step 3: Implement** the entries and add them to `ANIMATIONS`.
- [ ] **Step 4: Run** the lab specs. Expected: PASS.
- [ ] **Step 5: Commit** `feat: animation lab sprite effects`.

### Task 4: The lab page, route and index link

**Files:**
- Create: `projects/app/src/app/dev/lab/animation-lab-page.ts`
- Modify: `projects/app/src/app/dev/dev-routes.ts` (add `{ path: 'preview/animations', … }` before `preview/:scenarioId`), `projects/app/src/app/dev/dev-index.ts` (a link "Animation Lab" to `/preview/animations`)
- Test: `projects/app/src/app/dev/lab/animation-lab-page.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–3, `GameBoard`, `GameService`, `GAME_OVER_CASES`, `findScenario`.
- Produces: `AnimationLabPage` (standalone). Layout: the real `<app-game-board />` filling the page, a collapsible side panel. Panel sections: "Beats" and "Sprite Effects" (a row per animation: title, its parameter controls, a "Play" button); "Dialogs" (links to `/preview/choice-judgment` and `/preview/choice-compete`, labelled "Judgment Popup" and "Compete Result"); a "Victory Reveal" view switch. Behaviour:
  - On creation: `GameService.startFromState(labTable(registry), 'vs-bots')` then `stop()` so no bot moves; destroy calls `stop()`.
  - `play(a)`: `showState(base)`, then on the next tick (`setTimeout(0)`) `showState(a.play(base, params))`, where `base` is the clean table built once per page and params come from the row's controls.
  - "New Table" rebuilds the base and shows it.
  - Victory view: replaces the board with `<app-game-over>` for the selected `GAME_OVER_CASES` key (a select), with a "Replay" button that recreates the component.

- [ ] **Step 1: Write the failing tests** in `animation-lab-page.spec.ts` (same TestBed setup as `dev-pages.spec.ts`, instant playback, fake timers):
  - `shows the board and a Play button for every animation`.
  - `Play appends the animation's events to the table` (click Play of the Damage entry, run timers, `gameService.state()!.log.length` is greater than the base's, and `gameNumber` is unchanged).
  - `playing twice gives the same table both times` (JSON of the state after the second Play, minus nothing, equals the state after the first).
  - `no bot moves after a Play` (after running all timers, seat log has no bot-authored extra events beyond the entry's).
  - `Victory Reveal shows the Game Over screen, and Replay recreates it` (element identity differs after Replay).
  - `Judgment Popup links to /preview/choice-judgment`.
  - `leaving the page stops the bots`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/dev/lab/animation-lab-page.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the page, route and index link. Add the lab's route-order comment. Keep each row's control state in a signal map keyed by animation id.
- [ ] **Step 4: Run** `npx jest projects/app/src/app/dev projects/app/src/app/app.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: animation lab page`.

### Task 5: Docs and verification

**Files:**
- Modify: `docs/architecture/frontend.md` (a paragraph under "Dev scenarios" on the lab and how to add an animation), spec status to "Implemented".

- [ ] **Step 1:** Write the docs paragraph.
- [ ] **Step 2:** Run `npm run verify` and `npm test`. Expected: both pass.
- [ ] **Step 3:** Run `npm run build:app` and `grep -rl "Animation Lab\|animation-lab" dist/app`. Expected: no matches.
- [ ] **Step 4:** Open `http://localhost:4200/preview/animations` and check by hand: one entry of each group, Play twice, Victory Replay, the two dialog links.
- [ ] **Step 5: Commit** `docs: animation lab`; leave the branch for the human to merge or push.
