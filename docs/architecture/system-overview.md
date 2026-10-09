# System overview

This doc maps the whole system: the projects, the rules about who may import
whom, and the path one player move takes from a click to a new screen.

## Layers and projects

CLAUDE.md requires four layers. Here is where each one lives today.

| Layer | Project | What it holds | Framework |
|---|---|---|---|
| Game engine | `projects/engine` | rules, state transitions, actions, effects, triggers, legality, visibility | none (plain TypeScript) |
| Game content | `projects/content` | cards, generals, skills, the Kingdom War mode, display text, card and General data | none for logic; data is JSON |
| Application layer | `projects/app/src/app/game.service.ts` (today) | orchestrates one in-process game: holds the state, runs bots, tracks who is looking | Angular (injectable service) |
| Presentation layer | `projects/app/src/app` | components, dialogs, wiki, view-model helpers | Angular, Material |

Two more projects are not layers but support them:

| Project | Purpose |
|---|---|
| `projects/bots` | computer opponents. Framework-free; they only see a redacted state and the engine's legal actions. |
| `projects/sim` | a headless simulator and invariant checker that plays whole games under Node. |

The application layer is deliberately thin and lives inside the Angular app
for now. See [Backend and deployment](backend-and-deployment.md) for what
moves out of it when a server arrives.

## Dependency rules

```
        app (Angular)
       /    |      \
    bots  content   engine
      \     |      /
       \    v     /
        engine  <----- content, bots, sim, app
```

Read as: every arrow points at `engine`, and `engine` points at nothing.

| Project | May import | Must not import |
|---|---|---|
| `engine` | nothing outside itself | Angular, browser APIs, content, bots |
| `content` | `engine` | Angular, bots, app |
| `bots` | `engine` (its test helper also builds the content registry) | Angular, app |
| `sim` | `engine`, `content`, `bots` | Angular, app |
| `app` | `engine`, `content`, `bots`, Angular | nothing forbidden, but see below |

This is checked by the build, not only by convention: each project is mapped
by a path alias in the root [tsconfig.json](../../tsconfig.json) (`engine`,
`content`, `bots`) and a per-project Jest config in
[jest.config.js](../../jest.config.js). The engine's suite runs in a plain
`node` environment with no alias to anything else, so an import of content or
Angular from the engine fails its tests.

What the app must not do, even though it can import everything:

- **Implement rules.** Components ask the engine what is legal
  (`getLegalActions`) and what an effect would really do (`previewEffect`).
  They never decide whether a Sha may be played.
- **Hold authoritative game state.** The UI keeps only presentation state:
  the selected card, open dialogs, hover, animation.
- **Read content JSON directly.** It goes through content's display helpers
  (`generalDisplayData`, `cardDisplayData`, `abilityName`, and so on).

## What one move looks like

```
 click ("Play Sha on Seat 1")
   │
   ▼
 component ── builds the engine's own Action, taken from getLegalActions ──┐
   │                                                                       │
   ▼                                                                       │
 GameService.submit(action)                                                │
   │   resolve(state, action, { registry, mode })       ◄──────────────────┘
   │        └─ validate → queue → drain effects → log events → triggers
   │           → stop at the next decision, or when the game ends
   ▼
 GameService._state.set(nextState)                       (a signal)
   │
   ├─ visibleState = redactStateForSeat(state, viewerSeat)   (computed)
   │        └─ components render from this, never from the raw state
   ├─ legalActions = getLegalActions(state, activeSeat)      (computed; empty for bots)
   └─ scheduleBotIfDue(): if the next seat is a bot, a timer asks the bot
        policy for an action and submits it the same way
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
| Dev server | `npm start` (watches `angular.json`, tsconfigs and `package.json` too) |
| All tests | `npm test` (Jest, five projects) |
| One project | `npx jest --selectProjects engine` (or `content`, `bots`, `sim`, `app`) |
| Build the libraries | `npm run build` (`engine`, then `content`) |

The workspace is an Angular CLI workspace. `engine` and `content` are
library projects; `app` is the application. `bots` and `sim` are plain
TypeScript projects that the app and Jest reach through the path aliases;
neither has its own build target.
