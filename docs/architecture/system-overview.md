# System overview

This doc maps the whole system: the projects, the rules about who may import
whom, and the path one player move takes from a click to a new screen.

## Layers and projects

CLAUDE.md requires four layers. Here is where each one lives today.

| Layer | Project | What it holds | Framework |
|---|---|---|---|
| Game engine | `projects/engine` | rules, state transitions, actions, effects, triggers, legality, visibility, decision clocks | none (plain TypeScript) |
| Game content | `projects/content` | cards, generals, skills, decks, the Kingdom War mode, display text, card and General data, Vietnamese data | none for logic; data is JSON |
| Application layer | `projects/server` (authoritative) and `projects/app/src/app/game.service.ts` (local) | the server runs online and solo games, accounts, rooms, persistence; `GameService` runs one in-process game for Pass and Play and Play vs Bots | Node, Fastify, Postgres; Angular (injectable service) |
| Presentation layer | `projects/app/src/app` | components, dialogs, wiki, view-model helpers, i18n, `RemoteGameService` | Angular, Material |

Three more projects are not layers but support them:

| Project | Purpose |
|---|---|
| `projects/protocol` | the wire contract between app and server: schemas, message types, limits, error codes, `PROTOCOL_VERSION`. Framework-free. |
| `projects/bots` | computer opponents. Framework-free; they only see a redacted state and the engine's legal actions. |
| `projects/sim` | a headless simulator and invariant checker that plays whole games under Node, plus a leak checker and a bot tournament runner. |

There are two application-layer shapes on purpose. `GameService` is the
in-tab one. The server is the authoritative one, and the app talks to it
through `RemoteGameService`, which presents the same surface to the board. See
[Backend and deployment](backend-and-deployment.md) and
[Frontend](frontend.md).

## Dependency rules

```
engine  <--  content  <--  bots  <--  sim
  ^             ^            ^
  +-------------+------------+------  server  -->  protocol
  +-------------+------------+------  app     -->  protocol
```

Read as: dependencies point towards `engine`, and `engine` points at nothing. `server` also imports `bots`, and `sim` imports `engine`, `content` and `bots`.

| Project | May import | Must not import |
|---|---|---|
| `engine` | nothing outside itself | Angular, browser APIs, content, bots, protocol, server |
| `content` | `engine` | Angular, bots, app, server |
| `bots` | `engine`, `content` (display and skill helpers the rules bot reads) | Angular, app, server |
| `sim` | `engine`, `content`, `bots` | Angular, app, server |
| `protocol` | `engine` types, TypeBox | server, content, Angular |
| `server` | `engine`, `content`, `bots`, `protocol`, Node libraries | Angular, app |
| `app` | `engine`, `content`, `bots`, `protocol`, Angular | server, nothing else forbidden, but see below |

This is checked by the build, not only by convention: each project is mapped
by a path alias in the root [tsconfig.json](../../tsconfig.json) (`engine`,
`content`, `bots`, `protocol`, `protocol/schemas`) and a per-project Jest
config in [jest.config.js](../../jest.config.js). The engine's suite runs in a
plain `node` environment with no alias to anything else, so an import of
content or Angular from the engine fails its tests. `content` has its own
`importGraph.spec.ts` guarding its internal layering.

What the app must not do, even though it can import everything it needs:

- **Implement rules.** Components ask the engine what is legal
  (`getLegalActions`) and what an effect would really do (`previewEffect`).
  They never decide whether a Sha may be played.
- **Hold authoritative game state.** The UI keeps only presentation state:
  the selected card, open dialogs, hover, animation.
- **Read content JSON directly.** It goes through content's display helpers
  (`generalDisplayData`, `cardDisplayData`, `abilityName`, and so on).
- **Depend on database shapes.** The server maps rows to wire types; the app
  sees only `protocol` types.

## What one move looks like

Locally, one move is a function call:

```
 click ("Play Sha on Seat 1")
   |
   v
 component -- builds the engine's own Action, taken from getLegalActions --+
   |                                                                       |
   v                                                                       |
 GameService.submit(action)                                                |
   |   resolve(state, action, { registry, mode })       <------------------+
   |        +- validate -> queue -> drain effects -> log events -> triggers
   |           -> stop at the next decision, or when the game ends
   v
 GameService._state.set(nextState)                       (a signal)
   |
   +- visibleState = redactStateForSeat(state, viewerSeat)   (computed)
   |        +- components render from this, never from the raw state
   +- legalActions = getLegalActions(state, activeSeat)      (computed; empty for bots)
   +- scheduleBotIfDue(): if the next seat is a bot, a timer asks the bot
        policy for an action and submits it the same way
```

Online, the same pipeline runs on the server and the call becomes a message:

```
 component -> RemoteGameService.submit -> socket game.submit
   -> Room serial queue -> GameRunner: validate, resolve, persist, publish
   -> each member gets a game.update with ITS view, ITS legal actions and the new events
   -> RemoteGameService replaces its signals; components render as before
```

Everything that happens in a move is data in `state.log`. The UI derives its
Action History, sounds and popups from that log, so adding presentation never
means changing the engine.

## Determinism and serializability

Three properties hold across the engine, content and bots, and the rest of the
design leans on them:

1. **Pure transitions.** `resolve(state, action, ctx)` returns a new state; it
   does not mutate its input and keeps no hidden state.
2. **Seeded randomness.** All randomness goes through a counter-based seeded RNG
   stored in `state.rng` (see [rng.ts](../../projects/engine/src/lib/rng/rng.ts)).
   The engine, content and bots never call `Math.random` or read the clock.
   Same seed plus same actions gives the same game.
3. **Plain data.** `GameState`, `Action`, `Effect` and `EngineEvent` are plain
   discriminated unions with no functions, class instances or cycles. The
   pending decisions and the resolution queue are part of the state, so a game
   can be saved and resumed at any decision.

The simulator checks the third property on every game: it round-trips the final
state through JSON and compares it.

## Tooling

| Task | Command |
|---|---|
| Dev server and API together | `npm start` (watches `angular.json`, tsconfigs and `package.json` too; the API listens on 4201 and `/api` is proxied to it) |
| Dev server alone | `npm run web` |
| API alone | `npm run server` |
| Local Postgres | `npm run db:up` (port 5433), `npm run db:down` |
| All tests | `npm test` (Jest, seven projects) |
| One project | `npx jest --selectProjects engine` (or `content`, `bots`, `sim`, `protocol`, `server`, `app`) |
| Server tests against Postgres | `npm run test:db` |
| Type-check `protocol` and `server` | `npm run typecheck:server` |
| Simulator and tournaments | `npm run sim -- <command>` |
| Vietnamese review status | `npm run i18n:status` |
| Build the libraries | `npm run build` (`engine`, then `content`) |

The workspace is an Angular CLI workspace. `engine` and `content` are
library projects; `app` is the application. `bots`, `sim`, `protocol` and
`server` are plain TypeScript projects that the app, the server and Jest reach
through the path aliases; none has its own build target, and the server runs
under `tsx`.
