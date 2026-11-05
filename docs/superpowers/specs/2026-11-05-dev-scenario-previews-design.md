# Dev scenario previews — design

Date: 2026-11-05. Status: implemented.

## Intent

The developer checks UI changes by hand: a Wuxie prompt, a dying Peach prompt, a judgment popup, the
Game Over screen. Reaching each one means playing bot games until it happens. This adds a dev-only
`/preview` page that lists named scenarios; opening one puts the real board in that exact situation,
playable, so the UI can be tested in seconds.

## Goals

- A `/preview` index of scenarios in four groups: Play board, Response windows, Choice prompts, Other screens.
- Each scenario opens the real `GameBoard` (or the real screen) in the described situation, interactive:
  clicks run the real engine. A Reset button restarts the scenario from the same setup.
- Scenarios are engine-driven: a recipe starts a seeded real game, sets up the state, and runs the
  engine until the wanted window is open. No hand-written render-only state.
- Adding a scenario is one registry entry. No change to the board or to other scenarios.
- Only available in dev mode; production builds do not ship it.

## Non-goals and anti-goals

- Not a product feature, not linked from the app's navigation, no Vietnamese or i18n for the dev pages
  themselves (English only; the board inside is localised as usual).
- No server, accounts or online flows. Online-only screens (lobby, rooms) are out.
- Scenario recipes must not duplicate game rules. They set up state and let the engine decide the rest.
- No separate renderer: if a scenario does not look like the real game, it is a failure.

## Decisions (from the conversation)

- State source: engine-driven scenarios (not frozen fixtures), interactive.
- State edits: free. Recipes may set hands, HP, Equipment, judgment areas and phase directly, then let
  the engine run from there. No validity check is required.
- Placement: committed, on its own branch, dev-only.
- First scope covers all four groups.

## Design

**Route.** `/preview` (index) and `/preview/:scenarioId`, added to the routes only when `isDevMode()` is true.
The Game Over preview already built becomes the first "Other screens" entries (its cases move over).

**Registry.** `Scenario { id; group; title; description; seatCount; seed; setup(ctx) }`, a plain array
per group in `dev/scenarios/*.ts`, concatenated in one `SCENARIOS` list.

**Recipe helpers.** A small builder over the engine: `start(seed, seats)`, `give(seat, cardIds)`,
`setHp(seat, n)`, `reveal(seat, general)`, `skipTo(phase)`, `play(seat, action)`, `untilDecision(kind)`.
It uses the engine's public API (`createGame`, `resolve`, `getLegalActions`); where the engine has no
way to place a card, the helper edits the plain serializable state directly. The helper returns a
`GameState`.

**Loading into the board.** `GameService` gets one small method, `startFromState(state, mode)`, that
sets the state, mode and revealed seat the way `startGame` does. A `/preview/:scenarioId` page component
builds the state, calls it, and renders `<app-game-board>`. Reset calls it again with a fresh build.
This is the only production-code change.

**Bots.** The human is seat 0 in vs-bots mode, so other seats are bots and respond by themselves, as in
a real game.

**Initial scenarios (my call; the list is easy to extend).**
- Play board: own turn, Play Phase with a full hand; another seat's turn; a seat with Equipment and
  delayed Tools in the judgment area; a 6-seat table.
- Response windows: respond to Sha with Shan; Wuxie on a Tool; Duel; Barbarians and Arrows; dying with
  Peach; discard to the hand limit.
- Choice prompts: Start popup and reveal choice; skill trigger (optional and compulsory); picking a
  card from another seat; Compete; Judgment popup.
- Other screens: General selection; Game Over (the eight existing cases).

## Constraints

- Follows CLAUDE.md layering: dev code lives in the app project, the engine stays framework-free and
  unaware of it.
- UI text on dev pages follows the UI text style (Title Case labels, sentence case sentences).
- A scenario that stops reaching its window after an engine change must fail loudly.

## Calls made while writing (the developer can override any)

- Mode and deck: vs-bots mode, human at seat 0, the default Kingdom Wars deck. Hotseat and online-style
  views are out of scope.
- Kinds of scenario: `Scenario` has a `kind`. `board` scenarios return a `GameState` and a `reaches`
  target (a decision kind or a predicate on the state) and open the board. `screen` scenarios render a
  standalone component with fixtures: Game Over (a different entry type, since it takes final seats and
  a result, not a game state) and General selection (its own component, not the board). The eight Game
  Over cases come from the uncommitted `game-over-preview.ts`, which is the source of truth.
- The "fails loudly" test is engine-only: it builds every `board` scenario and checks `reaches`. UI-only
  popups with no engine decision (animations, playback) are covered by opening the scenario by hand.
- Popups that only exist on unmerged branches (Judgment, Compete UX) get scenarios once those branches
  are on `main`; the first version covers what `main` has.
- Determinism: bots in a scenario take their decisions from the game's seeded RNG, so Reset reproduces
  the setup. Recipes stop before any bot move is due, so they do not depend on bot timing.
- `startFromState` must also start the bot timer and playback bookkeeping the way `startGame` does. If
  that needs a small refactor of `startGame` to share code, that refactor is allowed.

## Left to the builder

- Exact helper names and the shape of the builder.
- How to keep `/preview` out of production builds (route guard on `isDevMode()` versus a build-time file
  replacement), as long as the production bundle does not contain it.
- Which seeds to use, found by running the recipes.
- One automated check: every registered scenario's `setup` reaches its stated window (a test that
  loops over `SCENARIOS`).
