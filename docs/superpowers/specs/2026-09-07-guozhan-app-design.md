# Guozhan Hotseat App — Design Spec

Status: Approved for implementation planning
Date: 2026-09-07

## Purpose

Build the first Angular presentation-layer sub-project on top of the
Guozhan rules engine (`projects/engine`, `projects/content`,
`projects/sim`): a local, single-browser-tab, pass-and-play ("hotseat")
UI that lets human players actually play a game of Guozhan, replacing
the sim harness's random-legal-move bot with real human decisions for
every seat.

No networking, persistence, or application/session-orchestration layer
exists yet (all explicitly deferred by the engine milestone's spec), so
this sub-project deliberately scopes around that: everything runs
in-process, in one browser tab, with no server and no saved state across
a page reload.

## Scope of this milestone

In scope:

- A new `projects/app` Angular CLI application (the `@angular/build:application`
  builder, not `ng-packagr` — this is a deployable app, not a redistributable
  library).
- A setup screen: choose seat count (2-8) and an optional seed, start a game
  via the engine's existing `guozhanMode`/`createGame`/`gameSetup`.
- All seats are human-controlled, taking turns on the same device
  ("pass-and-play"). No bot-controlled seats in this milestone.
- A reveal-gate mechanic: before showing any seat's private view, an
  interstitial requires an explicit tap ("Pass to Seat N — tap to reveal").
  Honor-system against peeking during the physical pass, same as a real
  pass-and-play board game — no cryptographic or technical prevention of
  looking at the previous seat's screen.
- A small, rule-texted extension to the engine's existing
  `redactStateForSeat` so opponent hand contents and the draw pile are
  actually hidden (see "Engine change" below) — the current function only
  masks unrevealed generals.
- A functional-first UI: legal actions rendered as a list of buttons (using
  the engine's existing `getLegalActions`, which already returns fully
  targeted `Action` objects — no client-side target-picking UI is needed),
  seat/HP/hand-count summaries, and a plain-text event log. No card art or
  board layout.
- A game-over screen showing the `GameResult` and a "New Game" button.

Explicitly out of scope (deferred to later sub-projects):

- Networking / multiplayer synchronization (a real client-server hotseat
  substitute for the same device).
- Persistence of game/session state across a page reload.
- Bot-controlled seats within the app (the `sim` project's bot is unrelated
  and untouched).
- Visual/board fidelity beyond plain lists and buttons.
- Any UI for the deferred engine-review findings I1/I2/I6 (phase/turn
  enforcement, a `CardDefinition` playability descriptor, response-window
  edge cases) — this app only ever offers actions `getLegalActions` itself
  returned, so none of those gaps are reachable from this UI.

## Engine change: extend `redactStateForSeat`

**Current gap:** `projects/engine/src/lib/domain/redact.ts`'s
`redactStateForSeat(state, viewerSeatId)` only masks other seats'
unrevealed `GeneralInstance`s. Two further things pass through
untouched:

- Every `CardZone`'s `cards` — including other seats' `hand` zones and
  the shared `drawPile` — so a card's real `definitionId`/`suit`/`rank`
  is visible regardless of viewer. This was previously identified and
  deferred (final engine review, finding I4) as out of scope until an
  application layer needed it — it does now.
- `Seat.kingdom` — Guozhan assigns each seat's kingdom independently
  of which general it holds (`guozhan.ts`'s setup round-robins
  `KINGDOM_ORDER` by seat index, unrelated to the general's own
  `GeneralDefinition.kingdom`), and it is exactly as secret as the
  generals per the spec's own scope ("each secretly assigned a
  kingdom... and two hidden generals"). This was not caught during
  brainstorming; found while writing the implementation plan.

**Rule text** (function signature `(state, viewerSeatId) => GameState`
is unchanged — this only changes what it returns):

- For every `CardZone` in `state.zones` with `kind === 'hand'` and
  `ownerSeatId !== viewerSeatId`: replace each card in `cards` with a
  masked copy — `definitionId: 'hidden'` (mirroring the existing
  `HIDDEN_GENERAL_ID` sentinel pattern), `suit` and `rank` set to fixed
  placeholder values (`'spade'`, `0`). `instanceId` is preserved
  unchanged, and the array's length is preserved unchanged — card
  *identity* is hidden, card *count* is not (matches standard Sanguosha:
  you always see how many cards an opponent holds).
- For every `CardZone` with `kind === 'drawPile'`: masked the same way,
  for **every** viewer without exception — nobody, including a
  hypothetical system/spectator view, ever knows draw-pile order or
  contents.
- `kind === 'discardPile' | 'equip' | 'judgment'` zones are left
  untouched for every viewer — these are public information in Sanguosha
  (played, equipped, and judgment-zone cards are visible to everyone).
- A seat's own `hand` zone (`ownerSeatId === viewerSeatId`) is never
  masked, regardless of the zone-kind rules above.
- `Kingdom` widens from `'Wei' | 'Shu' | 'Wu' | 'Qun'` to also include
  `'hidden'` (same sentinel convention as `generalDefinitionId`). Every
  seat other than the viewer has its `kingdom` replaced with `'hidden'`
  unless already revealed — Guozhan has no separate "kingdom reveal"
  action distinct from general reveal, so treat a seat's kingdom as
  revealed exactly when either of its generals is revealed (consistent
  with the real game: revealing a general reveals which kingdom you're
  playing). The viewer's own `kingdom` is never masked.

**Verification:** extend `projects/engine/src/lib/domain/redact.spec.ts`
with cases covering: an opponent's hand is masked but its length is
unchanged; the draw pile is masked for every seat including the state's
"first" seat; discard/equip/judgment zones are untouched; the viewer's
own hand is untouched; an opponent's kingdom is masked while both
generals are hidden; an opponent's kingdom becomes visible once either
general is revealed; the viewer's own kingdom is always visible.

## Architecture: state management

A single injectable `GameService` (no NgRx or other state library — see
design discussion; nothing here is async or has complex derived state
that a signals-based facade over already-pure engine functions doesn't
already handle):

```ts
class GameService {
  readonly state: WritableSignal<GameState | null>;
  readonly revealedSeatId: WritableSignal<string | null>;
  readonly lastError: WritableSignal<string | null>;

  readonly activeSeatId: Signal<string | null>; // computed: pendingResponse?.respondingSeatId ?? turn.ownerSeatId
  readonly legalActions: Signal<Action[]>;       // computed: getLegalActions(state(), activeSeatId())
  readonly visibleState: Signal<GameState | null>; // computed: redactStateForSeat(state(), revealedSeatId())

  startGame(seatCount: number, seed?: number): void; // wraps createGame/guozhanMode.setup
  reveal(seatId: string): void;                       // sets revealedSeatId
  submit(action: Action): void;                       // try/catch around resolve(); on success
                                                       // updates state and resets revealedSeatId to null
                                                       // (forcing the next reveal gate); on throw, sets lastError
}
```

No component holds `GameState` itself; every component reads from
`GameService`'s signals via DI.

## Screens & routing

Angular Router with two routes:

- `/setup` — `SetupComponent`.
- `/game` — `GameBoardComponent`. Game-over is a state within this route
  (`GameService.state().result` set), not a separate route, since it's
  the same board with the action list replaced by a result summary.

The reveal gate is not a route — it's an overlay rendered by
`GameBoardComponent` whenever `revealedSeatId() !== activeSeatId()`.
`RevealGateOverlayComponent` itself only emits a `revealed` output when
tapped (it is purely presentational, per the component breakdown below);
`GameBoardComponent` handles that output by calling
`gameService.reveal(activeSeatId())`, which clears the overlay and
exposes that seat's `visibleState()`.

## Component breakdown

- **`SetupComponent`** — seat-count input (2-8) + optional seed field.
  On submit: `gameService.startGame(seatCount, seed)`, navigate to
  `/game`. No rules logic.
- **`GameBoardComponent`** — top-level container for `/game`. Renders one
  `SeatSummaryComponent` per seat from `visibleState()` (kingdom/generals
  if revealed, HP, hand *count* for non-viewer seats), the
  `RevealGateOverlayComponent` when `revealedSeatId() !== activeSeatId()`,
  an `ActionListComponent` bound to `legalActions()`, an
  `EventLogComponent`, and swaps in `GameOverComponent` once
  `state().result` is set. Also renders `lastError()` as a dismissible
  banner if set.
- **`ActionListComponent`** — presentational: `@Input() actions: Action[]`,
  `@Output() actionChosen: Action`. Renders one button per action with a
  human-readable label derived from the action's kind/card/target via a
  small label-lookup helper. No legality logic — only ever renders what
  it's given.
- **`RevealGateOverlayComponent`** — presentational: `@Input() seatId`,
  `@Output() revealed`.
- **`EventLogComponent`** — renders `state().log` as human-readable lines
  via the same label-lookup helper as `ActionListComponent`.
- **`GameOverComponent`** — renders `GameResult`, a "New Game" button
  navigating back to `/setup`.

## Data flow: the action submission loop

1. `GameBoardComponent` reads `activeSeatId()` from `GameService`.
2. If `revealedSeatId() !== activeSeatId()`: show
   `RevealGateOverlayComponent`; block the rest of the board.
3. Else: show that seat's `visibleState()` and `legalActions()`.
4. User picks an action → `ActionListComponent` emits it →
   `GameBoardComponent` calls `gameService.submit(action)`.
5. `GameService.submit` calls the engine's `resolve(state, action, ctx)`
   (pure) inside a try/catch. On success: replace `state`, reset
   `revealedSeatId` to `null`. On throw: set `lastError` to the error's
   message; `state` is left unchanged.
6. Re-render: `activeSeatId()` recomputes from the (possibly new) state.
   Because `revealedSeatId` was reset to `null` on every successful
   submit, the reveal gate always reappears before the next seat's view
   is shown — including when the same seat acts again (e.g. multiple
   actions in one Play phase), which costs an extra tap but never leaks
   a view without an explicit reveal.

This loop is identical whether the active seat is acting on its own turn
or responding to a pending response (e.g. playing Shan) — `getLegalActions`
already returns the correct action set for both cases.

## Error handling

The UI only ever offers buttons for actions `getLegalActions` returned,
so there is no "illegal action" input surface. The one real failure mode
is `resolve()` throwing (a genuine engine bug, or one of the engine's own
defensive guards firing — e.g. `MAX_TRIGGER_DEPTH`, a zone-lookup guard).
`GameService.submit` catches this, sets `lastError` to the error's
message, and leaves `state` on the last good value — the board keeps
working from there rather than crashing. No retry logic and no automatic
error recovery beyond the state remaining valid and the error being
visible.

## Testing strategy

- **Engine change:** Jest unit tests in `projects/engine`, extending the
  existing `redact.spec.ts` (see "Engine change" verification above).
- **`GameService`:** Jest unit tests treating it as a plain class —
  construct it directly, call `startGame`/`submit`/`reveal`, assert on
  the resulting signals. No `TestBed` needed; it has no component/DI
  dependencies of its own beyond the engine/content functions it wraps.
- **Components:** Angular's testing utilities (`TestBed`,
  `ComponentFixture`) via this workspace's existing Jest runner (no
  Karma). Focused coverage on `GameBoardComponent` (active-seat/reveal-gate
  derivation) and `ActionListComponent` (label rendering); light smoke
  tests for the purely presentational components.
- **No end-to-end/browser test runner** in this milestone — manual
  click-through in the dev server (`ng serve app`) is the acceptance
  check for the full setup → play → game-over flow, consistent with this
  milestone's functional-first scope.

## Open items for implementation planning

- Confirm `@angular/build:application`'s handling of the `engine`/`content`
  path-mapped source imports doesn't hit the same `rootDir` restriction
  `ng-packagr` did for `content` (see the engine milestone's fix for that
  issue) — the application builder is not a library packager, so this is
  expected to be a non-issue, but should be verified early rather than
  assumed.
- Exact human-readable label text for each action/event kind is an
  implementation-plan-level detail, not a design-level one; the plan
  should enumerate them per card/general/action kind actually in the
  Guozhan content set.
