# Backend and deployment

**There is no backend today.** The whole game runs in one browser tab: the
Angular app holds the state, runs the engine and the bots in-process, and
saves nothing across a reload. This is by design for the current stage (the
app spec lists networking, multiplayer and persistence as out of scope).

This doc has two parts. The first says precisely what is true now. The second
is a **proposal**, not built code: how the existing design carries a
server-authoritative game, what is already ready, and what has to be added.
Anything under "Proposed" is a plan to review, not a description of the code.

## Today

```
 Browser tab
 ┌────────────────────────────────────────────────────────────┐
 │ Angular components                                         │
 │        │ Action                       ▲ visibleState       │
 │        ▼                              │ legalActions       │
 │ GameService ── resolve() ── engine ── content              │
 │        │                                                   │
 │        └── bot timer ── bots (rule-based policy)           │
 └────────────────────────────────────────────────────────────┘
   state lives in a signal; static assets served by the dev server
```

- **Hosting:** `ng build` produces a static site (the `app` project). Card art
  and audio are copied in from `projects/content/assets` under `/card-art` and
  `/audio` by `angular.json`. Any static host works.
- **Persistence:** none for games. The only thing stored in the browser is the
  music on/off preference, in `localStorage`.
- **Trust:** the browser has the full, unredacted state, including every hand
  and the draw pile. That is fine for local play and unacceptable for a
  networked game; see "Visibility" below.
- **Pass and Play** hides other players' hands with a gate overlay, not with a
  security boundary: it is the honor system on one device.

## Why a server is a natural extension

CLAUDE.md asks that running the engine authoritatively on a server be "a
natural extension rather than a redesign". These properties of the current
code are what make that true:

| Property | Where | Why it matters for a server |
|---|---|---|
| The engine is plain TypeScript with no Angular or browser imports | `projects/engine` | it runs unchanged under Node; the simulator already does |
| Transitions are pure functions of `(state, action)` | `resolve` | a server can hold the state between requests and apply one action at a time |
| All randomness is seeded and stored in the state | `state.rng` | the server is the only source of shuffles; a replay from the seed is exact |
| State is plain, JSON-round-trippable data, including pending decisions and the resolution queue | `GameState` | a game can be saved, restored after a crash and resumed at any decision |
| The log is a complete, ordered record | `state.log` | it can be streamed to clients, stored, and used for replay and debugging |
| Views are produced by a function | `redactStateForSeat` | one authoritative state, one safe view per seat |
| Bots depend only on a redacted view and legal actions | `projects/bots` | bots can run server-side as ordinary seats |
| Legality is the engine's | `getLegalActions` | the server rejects illegal actions without any UI logic |

## Proposed: a server-authoritative game

### Responsibilities

| Concern | Client (Angular) | Server |
|---|---|---|
| Game state | none; only the latest view it was sent | the full `GameState`, per game |
| Rules | none | `resolve`, `getLegalActions`, the mode and content |
| Randomness | none | the seeded RNG; the seed never leaves the server |
| Who is whose seat | shows "you are Seat 2" | authenticates a player and binds them to a seat |
| Bots | none | runs the bot policy for bot seats on a timer |
| Decision clocks | displays the remaining time | owns the clock and applies the default at zero |
| Presentation (dialogs, sounds, popups, history lines) | derives them from the log | sends the log; nothing else |

The client's derived views already work from public inputs (`state.log`, a
redacted state, legal actions), so the presentation layer needs no rewrite.

### Contracts

CLAUDE.md requires explicit application contracts, and requires that the
frontend not depend on database schemas. A minimal set:

| Contract | Direction | Content |
|---|---|---|
| `CreateGame` | client → server | seat count, seat kinds (human or bot), names, optional `GameRules`; returns a game id and the creator's seat |
| `SubmitAction` | client → server | game id, seat, and the engine's `Action`; answered with the new view or a validation error |
| `GetView` | client → server | game id, seat; the redacted state plus the legal actions for that seat |
| `Updates` | server → client | for a game: the new events since a log index, and the new view when the seat's decision changes (pushed, or polled) |

The `Action` and the redacted `GameState` can be used directly as wire types:
they are plain data, and they are already the domain contract. What must **not**
cross the wire is the unredacted state or anything the database schema adds.

### Visibility: what has to change first

`redactStateForSeat` hides other seats' hands, the draw pile, hidden Generals
and secret choices. Two things need attention before it is a network boundary:

1. **The RNG seed is in the state, and the redacted copy keeps it.** The
   redaction spreads the whole state and does not remove `rng`. Locally that is
   harmless; on a server a client that knows the seed and counter could predict
   a reshuffle. A server must strip `rng` from every view, either inside a
   view-mapping layer or by extending the redaction.
2. **The log is public by design, but it is not filtered.** Events are written
   so a face-down move carries no face, but a server should test that no event
   leaks a hidden card or General to a seat that should not see it (now
   `projects/sim/src/leakProperty.spec.ts`).
3. **Card ids must not name cards.** Done in backend Stage 1: the deck names
   each card `card-<position>` after the shuffle, and a reshuffle gives every
   reshuffled card a fresh `r<counter>-<position>` id, so neither a masked
   card nor the draw-pile order can be read from ids. `projects/sim/src/leaks.ts`
   checks views, the log and reshuffles over simulated games.

Both belong in a server-side mapping layer between the engine's types and the
wire contracts, which also gives a single place to version the contract.

### Processing a request

```
SubmitAction(gameId, seat, action)
  1. authenticate the caller; check they own `seat`
  2. load the game (state + version)            ── per-game lock, or compare-and-swap
  3. check seat is the active seat (getActiveSeatId) for human seats
  4. next = resolve(state, action, ctx)         ── throws on an illegal action
  5. persist (state or action log) with version + 1
  6. publish: new events, and each seat's new view / legal actions
  7. if the next decider is a bot: schedule its move
```

Actions for one game must be applied one at a time and in order. Stale or
duplicate submissions are already rejected by the engine's own ids
(`pendingResponseId`, `choiceId`, `selectionId`), but the server should also
version each game so two requests cannot both act on the same state.

### Persistence

Two designs fit; the choice is open:

| Design | Stores | Pros | Cons |
|---|---|---|---|
| **Snapshots** | the `GameState` after each action (or periodically) | simple restore; reconnect is a read | larger rows; the stored shape is the engine's shape, so it needs a mapping layer to stay decoupled |
| **Event sourcing** | the seed, the creation parameters and the ordered list of actions | tiny; exact replay and debugging; the engine is deterministic | restoring replays the whole game (cheap, but grows); content changes can break old games, so they must be versioned |

Either way, persistence models may differ from the domain models (CLAUDE.md);
keep a mapper between them. Record the **content version** (which cards, which
Generals, which rules) with every game so an old game replays against the
content it was played with.

### Clocks and bots

The decision clock (`describeDecision`, `switchClock`) and the timeout defaults
(`defaultActionsFor`) are engine functions, so the server runs the same clock:
it knows each human decision's budget, pauses when no decision is open, and on
timeout submits the same engine-legal default the client does today (No Response,
the first option, End Phase). Bots run as server-side seats using the same
`ruleBasedPolicy.decide` over a redacted view, with the same per-move delay.

### Reconnection

A reconnecting client calls `GetView` and receives the current view and legal
actions. Because the pending decision, resolution queue and log are all in the
state, there is nothing else to restore. The client's "how much of the log have
I shown" markers reset on connect, so it shows no old popups or sounds.

### Hosting sketch

A small Node service imports `engine`, `content` and `bots` directly (they are
framework-free) and exposes the contracts above over HTTP plus a push channel
(WebSocket or server-sent events). The Angular app becomes a thin client of that
service: `GameService` keeps its public signals (`visibleState`,
`legalActions`, `submit`) and swaps its in-process engine call for a remote
call, so components do not change.

### Open decisions

- Snapshot or event-sourced storage.
- Authentication and seat assignment (accounts, invite links, or anonymous
  game codes).
- Push channel: WebSocket or server-sent events.
- Whether the server may also host a spectator view (a view with no seat).
- How content versions are named and retained.
- How a human seat that disconnects is treated (the clock continues, then the
  default, or a bot takes over).

None of these requires changing the engine.
