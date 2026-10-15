# Frontend

How the Angular app in `projects/app` shows the game and sends the player's
choices to the engine. The guiding rule (CLAUDE.md): the UI renders state,
collects input and dispatches actions. It never decides what the rules allow.

## Shape of the app

A standalone-component Angular app (no NgModules), with Angular Material for
widgets and signals for reactive state.

```
projects/app/src/app/
  app.ts, app.routes.ts      shell: toolbar nav, music, lazy routes
  game.service.ts            the application layer: owns the game (see below)
  decision-timer.service.ts  per-decision countdowns
  music.service.ts           background music and sound effects
  labels.ts                  names and formatting shared by every screen
  setup/                     the Game Setup screen
  game-board/                the board, its dialogs and its view-model helpers
  wiki/                      Cards and Rules pages, built from content data
```

Routes ([app.routes.ts](../../projects/app/src/app/app.routes.ts)) are lazy so
the first bundle holds only the shell: `/setup`, `/game`, `/wiki/...`, and
`/play`, a guard that never renders and redirects to `/game` when a game is in
progress, otherwise to `/setup`. The guard imports `GameService` lazily, so the
engine and content code stay out of the initial bundle.

## GameService: the application layer, in-process

[game.service.ts](../../projects/app/src/app/game.service.ts) is the only place
that calls the engine. It is a root-provided service that holds one game:

| Signal | Meaning |
|---|---|
| `state` | the **full**, unredacted `GameState`. Components render from `visibleState`; they read `state` only for public facts such as player names and the log |
| `visibleState` | `redactStateForSeat(state, revealedSeat)`: what the current viewer may see |
| `legalActions` | `getLegalActions` for the active seat, empty while a bot is to move |
| `activeSeatId` | `getActiveSeatId(state)`: who must decide |
| `revealedSeatId` | whose view is on screen (the human in vs-bots; the gated seat in pass-and-play) |
| `botSeatIds`, `botThinkingSeatId` | which seats are bots, and whose move is scheduled |
| `lastError`, `mode`, `gameNumber` | engine errors, vs-bots or pass-and-play, and a counter that stops one game's bookkeeping leaking into the next |

Its methods are the whole write API: `startGame(seatCount, seed, mode, names,
rules)`, `submit(action)`, `submitAll(actions)` (one move made of several
actions, such as a whole Discard Phase), `reveal(seatId)` (pass-and-play hand-off)
and `clearError()`.

What happens on a submit:

1. `resolve(state, action, ctx)` runs inside a `try`. A thrown error becomes
   `lastError`; the state is unchanged.
2. On success the new state replaces the old, and in pass-and-play the view is
   gated again (`revealedSeatId` resets) so the next player must tap to reveal.
3. `scheduleBotIfDue()` looks at the next decider. If it is a bot, a timer
   (1.5 s, so a person can follow) asks the rule-based policy for an action
   from that seat's **redacted** state and the engine's legal actions, then
   submits it by the same path as a human move.

Humans can never submit for a bot seat: `submit` ignores the call while a bot is
the active seat.

### Two modes

| Mode | Seats | Views |
|---|---|---|
| Play vs Bots | the human is always `seat-0`; every other seat is a bot | the viewer is fixed on seat 0 |
| Pass and Play | every seat is human, one device | a gate overlay hides the board between turns; tapping reveals the active seat |

### Where the application layer goes later

`GameService` is deliberately the one seam: it takes an action in, gives a
state out, and owns bots and views. A server would replace what is *behind*
`submit`, not what components see. See
[Backend and deployment](backend-and-deployment.md).

## Rendering the board

[game-board.ts](../../projects/app/src/app/game-board/game-board.ts) is the
board component. It renders from `visibleState` and nothing else. The pieces:

| Piece | Role |
|---|---|
| `round-table`, `table-layout` | seat positions around the table |
| `seat-tile`, `seat-avatar`, `avatar-skills` | a seat: General art, HP, hand count, equipment, skill buttons |
| `hand-view`, `playing-card`, `card-art` | the viewer's cards |
| `action-list` | the buttons for what the engine says is legal (end phase, use skill) |
| `action-history-panel`, `discard-pile` | what has happened, and what has been discarded |
| `phase-indicator`, `game-over` | turn and result display |
| `general-selection`, `reveal-gate-overlay` | the pre-game pick and the pass-and-play hand-off |

### Decisions become dialogs

A decision is state (`pendingResponse`, `pendingChoice`, `pendingSelection`,
`pendingArrangement`, or a Discard Phase owed). The board turns each into a
Material dialog with the same pattern:

```
computed  responseDue / choiceDue / selectionDue / arrangementDue / discardsDue
            └─ "the id of the pending decision the viewer owes", or null
effect    when the id changes: close the old dialog, open one for the new id
dialog    shows the question and the engine's own options;
          on close it returns the Action the engine offered
board     submit(action)
```

Each dialog opens **once per pending id**, and is closed if the decision is
settled some other way (a timeout, a bot). The dialogs are:
`response-dialog` (answer a Sha with a Shan, pass), `choice-dialog` (take a
card), `ask-dialog` (use a skill? Use or Don't), `selection-dialog` (pick cards
or seats), `arrange-dialog`, `discard-dialog`, and `targets-dialog`.

A dialog never constructs an action from its own logic. It is handed the
`Action` objects the engine listed (`getLegalActions`) and returns one of them.

### Events become presentation

The log is public and append-only, so the board derives presentation from it
without engine changes. Each of these is a pure function over `state.log` plus
a small effect that remembers how much of the log it has already shown, so
joining mid-game or starting a new game shows nothing old:

| Derived view | Function | Used for |
|---|---|---|
| Action History lines | `actionHistory(log, zones, players, seats)` | the history panel |
| Discard history | `discardHistory(log, pileId)` | the discard pile |
| Sounds | `soundsFor(events)` | injure, heal, weapon, armor, mount |
| Compete popup | `competeResults(log, from, seats, players)` | the Compete result dialog |

**Worked example, the Compete popup.** When a Compete resolves, the engine
logs two `CardShownEvent`s and an `AbilityUsedEvent` with outcome
`compete-won` or `compete-lost`. `competeResults` turns those into a
`CompeteResult` (source General and skill, both players and cards, winner,
outcome text). A board effect queues each result and opens
[compete-dialog.ts](../../projects/app/src/app/game-board/compete-dialog.ts)
for it, one at a time, themed by the source seat's Force. The outcome wording
("Seat 0 can play one more Sha this turn…") comes from content's
`competeOutcomeText`, so the UI holds no skill-specific text. It closes with
Continue or after 15 seconds.

### Describing decisions without knowing the rules

The engine's pending decisions are data, so the app has pure "describe"
modules that turn them into words and button labels:
`response-description` (`describeResponse`), `choice-description`
(`describeChoice`) and `ability-description` (`describeAsk`,
`describeSelection`, `describeArrangement`). They read the state and content's display
helpers and return a view-model; components render it. These modules are where
UI wording lives, and they are unit-tested without Angular.

`GameService.previewEffect` lets the UI say what a pending effect *would*
really do once before-triggers apply (a Sha's damage capped by Silver Lion),
so the description matches the result. The engine computes it; the UI only
displays it.

### Theming by Force

`openForceDialog` opens any dialog with panel classes `force-dialog` and
`force-dialog-<Wei|Shu|Wu|Qun|none>`. `styles.scss` turns those into CSS
custom properties (`--force`, `--force-text`) and recolors the Material tokens,
so a dialog needs no per-Force code. A decision dialog is themed by the
deciding seat's Force; the Compete popup by the source General's.

## State: what the UI may keep

| Kept by the UI | Kept only by the engine |
|---|---|
| selected card, open dialogs, hover | whether a play is legal |
| which log index sounds and popups have reached | HP, hands, phase, turn, who is dying |
| countdown seconds, music on/off (`localStorage`) | who won |

`DecisionTimer` is UI state too: it times each human decision (a response, a
choice, a pending selection or a discard 60 s, a whole Play Phase 300 s, the
General Selection 300 s), pauses
when the decision is not on screen, and at zero submits an engine-legal
default (No Response, the first option, End Phase). Bots are never timed.

## Wiki

`/wiki/generals`, `/basic`, `/equipment`, `/tools` and `/rules/*` are lazy
routes. The card and General pages are generated from content
(`wiki.ts` builds entries from the data files and marks which skills are
coded); the rules pages are short hand-written components. Rules text changes
when a rule changes: add the line to the matching page in `wiki/rules/`.

## Conventions

- **Standalone components**, `inject()` for services, signals for state.
- **Visible text** follows CLAUDE.md's casing rules: Title Case for names and
  short labels ("Start Game", "Discard Pile"), sentence case for anything that
  reads as a sentence ("Seat 1 used Sha (7 ♠) on Hing"), keywords keep their
  capitals (Forces, card names, General names, phases, HP). Ids are never shown
  raw: `labels.ts` turns `seat-0` into "Seat 0".
- **No rules in components.** If a component needs to know whether something
  is allowed, add a query to the engine or content and ask it.
- **Tests** run under Jest with `jest-preset-angular` in a jsdom environment
  (`jest.setup.app.ts`); the pure view-model modules are tested without
  TestBed, dialogs with a stubbed `MAT_DIALOG_DATA`.
