# Frontend

How the Angular app in `projects/app` shows the game and sends the player's
choices to the engine. The guiding rule (CLAUDE.md): the UI renders state,
collects input and dispatches actions. It never decides what the rules allow.

## Shape of the app

A standalone-component Angular app (no NgModules), with Angular Material for
widgets and signals for reactive state.

```
projects/app/src/app/
  app.ts, app.routes.ts      shell: toolbar nav, deck menus, language switcher, music, lazy routes
  game.service.ts            the local application layer: one in-process game (see below)
  decision-timer.service.ts  per-decision countdowns for local games
  music.service.ts           background music and sound effects
  labels.ts                  names and formatting shared by every screen
  auth/                      sign-in, sign-up, guest, forgot and reset password, AuthService, requireSignIn
  online/                    Rooms, Lobby, My Games, chat, SocketService, RemoteGameService, OnlineGame
  setup/                     the local Game Setup screen
  game-board/                the board, its dialogs and its view-model helpers
  wiki/                      per-deck Generals and card pages, and the Rules pages, built from content data
  i18n/                      the message catalogs, the I18n service, the t pipe, Vietnamese review status
```

Routes ([app.routes.ts](../../projects/app/src/app/app.routes.ts)) are lazy so
the first bundle holds only the shell:

| Route | Screen |
|---|---|
| `/setup`, `/game` | local Play vs Bots and Pass and Play |
| `/play` | a guard that never renders; it redirects to `/game` when a local game is in progress, otherwise to `/setup` |
| `/rooms`, `/rooms/:id`, `/my-games` | open rooms, a room's lobby and online game, and finished games; all behind `requireSignIn` |
| `/sign-in`, `/sign-up`, `/guest`, `/forgot-password`, `/reset-password` | accounts |
| `/wiki/...` | see "Wiki" below |

The guard and the online pages import the engine and content code lazily, so
those stay out of the initial bundle.

## GameService: the local application layer

[game.service.ts](../../projects/app/src/app/game.service.ts) is the only place in
the app that calls `resolve`. It is a root-provided service that holds one
local game:

| Signal | Meaning |
|---|---|
| `state` | the **full**, unredacted `GameState`. Components render from `visibleState`, log included (it is redacted: another seat's hidden skills read `'hidden'`), and must not bypass it; they read `state` only for public facts such as player names |
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

### Two local modes

| Mode | Seats | Views |
|---|---|---|
| Play vs Bots | the human is always `seat-0`; every other seat is a bot | the viewer is fixed on seat 0 |
| Pass and Play | every seat is human, one device | a gate overlay hides the board between turns; tapping reveals the active seat |

A new local game starts with `judgmentNotice` on, so the judgment popup pauses
the game (see "Events become presentation"). Setup also offers the deck and,
from five seats, the first-reveal draw; both are stored in `state.rules`.

### Online: RemoteGameService

The server is authoritative for online rooms and for Play vs Bots from the
Rooms screen ([Backend and deployment](backend-and-deployment.md)).
[remote-game.service.ts](../../projects/app/src/app/online/remote-game.service.ts)
presents the same surface to the board, typed as `BoardGame`, a `Pick` of
`GameService`. It keeps the latest `GameUpdate` from the room socket and turns
it into the same signals (`visibleState`, `legalActions`, `activeSeatId`,
`botSeatIds`, `judgmentSettled`), and `submit` sends `game.submit` instead of
calling `resolve`. Previews still run on the received view with the local
engine, since an effect preview needs no secret.

`OnlineGame` ([online-game.ts](../../projects/app/src/app/online/online-game.ts))
wraps the unchanged `GameBoard` and provides `RemoteGameService` and
`RemoteDecisionClock` in place of `GameService` and `DecisionTimer` for
everything beneath it, so the board and its dialogs are shared, not copied.
`SocketService` owns the connection: a `hello` with the protocol version,
reconnection with growing delays, and a resync when the log it holds does not
line up. The server never sends the RNG seed, so the client's copy of it is a
placeholder that nothing draws from.

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
| `phase-indicator`, `game-over`, `victory-board` | turn and result display (see "The Game Over window") |
| `general-selection`, `reveal-gate-overlay` | the pre-game pick and the pass-and-play hand-off |
| `decision-dock`, `decision-banner`, `minimize-button` | hide a decision dialog to look at the board, with a banner to bring it back |
| `board-chat`, `chat-panel` (online) | room chat beside the board |

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
or seats), `arrange-dialog`, `discard-dialog`, `targets-dialog` and
`start-reveal-dialog` (the Start window: tick hidden Generals to reveal, then Confirm).

Any decision dialog can be minimized. `DecisionDock` keeps the hidden dialog
open (so what the player picked survives) and shows a banner that brings it
back; it is presentation state only.

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
| Judgment popup | `judgmentDescription` over `state.judgmentView` | the judgment dialog |

**Worked example, the Compete popup.** When a Compete resolves, the engine
logs two `CardShownEvent`s and an `AbilityUsedEvent` with outcome
`compete-won` or `compete-lost`. `competeResults` turns those into a
`CompeteResult` (source General and skill, both players and cards, winner,
outcome text). A board effect queues each result and opens
[compete-dialog.ts](../../projects/app/src/app/game-board/compete-dialog.ts)
for it, one at a time, themed by the source seat's Force. The outcome wording
("Seat 0 can play one more Sha this turn…") comes from content's
`competeOutcomeText`, so the UI holds no skill-specific text. The popup is a
fixed sequence of beats ([beat-player.ts](../../projects/app/src/app/game-board/beat-player.ts)
runs them, and shows each beat's end state at once under reduced motion):
the two players slide in each in their own Force with a VS badge (0 ms), the
cards are laid face down (800), both turn together (1500), the winner is lit
and the loser dimmed with a line such as "K beats 8" (2500), the outcome
appears (3400), and Continue unlocks (4200). A 3 s countdown then closes it, or
Continue does. On a tie the challenged player is lit and the line says a tie
counts as a loss for the challenger. It is a modal on each client, not an
engine pause.

**The judgment popup** is the one presentation that is also a pause. When the
`judgmentNotice` rule is on, the engine holds a settled judgment in
`state.judgmentView` and offers `AcknowledgeJudgmentAction` to the first living
human seat. `judgment-dialog.ts` hosts [judgment-stage.ts](../../projects/app/src/app/game-board/judgment-stage.ts),
a fixed sequence: the source (0 ms), the rule line (500), the card turning up
(1000), the decision area (from 2100, when a skill may change the card), a check
or cross for the judged seat (a good or bad verdict from content's
`judgmentOutcome`, none when neutral), the consequence (HP hearts popping, a
phase struck through, or Lightning moving on, always with its sentence), then
Continue unlocks and a 3 s countdown closes it; Continue submits the
acknowledgement (`closeJudgment` locally, the server's offered action online).
A skill that may change the card is asked **inside the popup**: the Ask and
Selection dialogs are built from `AskPanel` and `SelectionPanel`, which the
decision area reuses, and the board does not open those dialogs for a pending
decision marked `judgmentChange` while the popup is open. Everyone else sees a
waiting line; in Pass and Play the asked seat first gets a hand-off button in
the decision area. Each replacement closes the area, fans the old card out
struck through (the last three stay in view), and opens it again for the next
asker; the verdict waits for the last round. The pause lives in the engine, so
it holds for every client and for replays; the dialog only shows it.

### The Game Over window

`game-over` (local) and `OnlineResult` (online) both show
[victory-board.ts](../../projects/app/src/app/game-board/victory-board.ts)
(`app-victory-board`), a row of up to six columns: Wei, Shu, Wu, Qun, Winning
Ambitionist, Losing Ambitionist. A column exists only if a seat belongs to
it. The pure `victoryColumns(seats, result, youSeatId)` in
`victory-columns.ts` builds the view. Kingdom columns are filled from each
seat's allegiance and printed Kingdom; `result.winningSeatIds` is read only to
decide who won (the sole survivor, or a draw when it is empty) and to split
the Ambitionists:

- a seat's group is its Kingdom, unless its allegiance is `ambitionist`;
  a seat with no decided allegiance sits under its printed Kingdom;
- Ambitionists form two groups, Winning Ambitionist (the seat is a winner and
  the Ambitionist side won) and Losing Ambitionist (every other Ambitionist);
- the winning group is the winning Kingdom if one is set; otherwise, for a
  sole survivor, Winning Ambitionist if it is an Ambitionist, else its
  Kingdom; a draw has none;
- the headline is one of four kinds: Kingdom wins, "{name} wins as the
  Ambitionist!", a lone survivor with no decided allegiance ("{name} wins!"),
  or a draw.

Each member row shows the avatar, name, a "You" tag (not in Pass and Play or
without a seat), the Main and Deputy General names and Survived or Fallen.
The reveal is timed, not blocking: headline first, the columns one after
another, then the winning column lights in its Force colour while the others
dim (a draw lights none); reduced motion shows the end state at once.
Columns are 150 to 190 px and wrap by container query: at 700 px or narrower
two per row, the winning column first.

Locally the seats come from the full `state` (the game is over, so nothing is
secret). Online they come from `lastGame.finalSeats`, which
`RemoteGameService.ending` fills from the live final state; the finished
online card is 980 px wide, has no title of its own and lets the board supply
the "Game Over" eyebrow. A stopped game (`broken` or `outdated`) has no
result, so the card shows its stopped message and no columns. The server only sends the Generals because
`redactStateForSeat` lifts them once a result exists.

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

`DecisionTimer` is UI state too, for local games. The engine says which clock a
decision runs on and how long it has (`DECISION_SECONDS`: a Wuxie 15 s, a dying Peach or other response 20 s, a skill's ask 15 s,
a pick 30 s, an arrangement 60 s, the Start reveal 20 s, a discard 30 s, the General Selection
300 s, a whole Play Phase 180 s, a skill's decision to change a judgment 15 s, a settled judgment notice 3 s). A decision that follows an animation has a lead-in (`leadInMs`): its countdown holds its full length and starts only when the animation has played (`startsInMs`). The timer pauses when the decision is
not on screen, and at zero submits the UI's current pick or an engine-legal
default (`defaultActionsFor`: No Response, the first option, End Phase).
Bots are never timed. Online, the server owns the clock and
`RemoteDecisionClock` only displays it, moved onto this device's time.

## Wiki

Each deck has its own pages, chosen by the parent route's `deck` data:
`/wiki/default/...` and `/wiki/alternate/...`, each with `generals`, `basic`,
`equipment` and `tools`. The card pages share one component. The Default
Generals page and the Alternate Generals page are separate components, since
an Alternate General is shown beside the Default version it differs from. The
older `/wiki/generals`-style addresses redirect to the Default pages, and
`/wiki/rules/*` holds short hand-written Rules pages. The pages are generated
from content (`wiki.ts` and `wikiAlternateGenerals.ts` build entries from the
data files and mark which skills are coded); rules text changes when a rule
changes, so add the line to the matching page in `wiki/rules/`.

## Languages

English and Vietnamese. Every visible string is a catalog key:
`i18n/en.ts` is the source (and ships in the main bundle) and `i18n/vi.ts` is a
lazy chunk. The `I18n` service holds the current locale (remembered in
`localStorage`) and exposes a `Translator`; templates use the `t` pipe, and
services that cannot translate yet hand screens a `Msg` (a key and its
parameters), resolved by the `tm` pipe so a language switch re-renders it.
Card and General names, rules text and skill prose come from content's locale
data (`projects/content/data/locales/vi`), not from the app's catalog. New
Vietnamese text starts as a draft that displays like any other; a native
speaker marks entries reviewed in `review.json`, and `npm run i18n:status`
reports what is left. The casing rules for both languages are in CLAUDE.md.

## Conventions

- **Standalone components**, `inject()` for services, signals for state.
- **Visible text** goes through the catalogs and follows CLAUDE.md's casing rules: Title Case for names and
  short labels ("Start Game", "Discard Pile"), sentence case for anything that
  reads as a sentence ("Seat 1 used Sha (7 ♠) on Hing"), keywords keep their
  capitals (Forces, card names, General names, phases, HP). Vietnamese uses
  sentence case throughout. Ids are never shown
  raw: `labels.ts` turns `seat-0` into "Seat 0".
- **No rules in components.** If a component needs to know whether something
  is allowed, add a query to the engine or content and ask it.
- **Tests** run under Jest with `jest-preset-angular` in a jsdom environment
  (`jest.setup.app.ts`); the pure view-model modules are tested without
  TestBed, dialogs with a stubbed `MAT_DIALOG_DATA`.
