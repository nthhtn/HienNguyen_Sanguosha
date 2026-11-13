# Architecture docs

Start here. These docs explain how the Sanguosha (Guozhan) app
is put together, for engineers who are new to the codebase or about to change
it.

| Doc | Read it when you want to know… |
|---|---|
| [System overview](system-overview.md) | What the projects are, who may depend on whom, and how a click becomes a state change |
| [Rules engine](rules-engine.md) | How the rule-based engine is modeled: state, actions, effects, events, triggers, decisions, visibility |
| [The event chain](event-chain.md) | Exactly how one move resolves, with real traces (the deep dive on the pipeline) |
| [Content and extensibility](content-and-extensibility.md) | How cards, generals, skills and modes are defined, and how to add one |
| [Frontend](frontend.md) | How the Angular app renders the engine's state, plays locally or online, sends actions back, and speaks English and Vietnamese |
| [Backend](backend.md) | The Node server: accounts, rooms, the socket protocol, the game runner, persistence and restore, and what is not built yet |
| [Deployment](../deployment.md) | How the server and app run live on Render and Supabase, and what to check after a deploy |
| [Bots and simulation](bots-and-simulation.md) | The computer opponents, the headless simulator, invariants, leak checks and the test layout |
| [How the bots decide](how-bots-decide.md) | In plain words, how the shipped bot reads the table, picks targets, forms truces, avoids waste and responds |
| [CI and guardrails](../ci-and-guardrails.md) | How a change is checked before it merges (`npm run verify`, GitHub Actions), and what the agent may not do (merge, push to `main`) |

The project-wide rules (layering, domain modeling, extensibility, UI text
style) live in [CLAUDE.md](../../CLAUDE.md). The design specs and plans that
led to this code are in [docs/superpowers/](../superpowers/).

## The one-paragraph version

The game is a **pure TypeScript rules engine** (`engine`) that takes the
current game state and one player action and returns the next state. Around it:

- **Content** (`content`): The engine knows no card or General by name. Every
  card, skill, deck and mode is content, registered with the engine through
  plain interfaces.
- **Bots** (`bots`): They choose actions for computer seats.
- **Simulator** (`sim`): A headless simulator plays whole games under plain
  Node to check invariants and that no view leaks hidden information.
- **Angular app** (`app`): It shows each viewer a redacted copy of the state
  and turns clicks into the engine's own actions. It plays a local game
  in-process, or an online game on the server.
- **Server** (`server`): It runs the same engine authoritatively, stores each
  game as its seed and action log, and talks to the app through the contract in
  `protocol`.

Nothing in the engine touches Angular, the browser, the clock or `Math.random`,
which is what lets the same engine run in a tab, under a test and on the server.
