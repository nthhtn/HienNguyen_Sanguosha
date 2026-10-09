# Architecture docs

Start here. These docs explain how the Sanguosha (Kingdom War / Guozhan) app
is put together, for engineers who are new to the codebase or about to change
it.

| Doc | Read it when you want to know… |
|---|---|
| [System overview](system-overview.md) | what the projects are, who may depend on whom, and how a click becomes a state change |
| [Rules engine](rules-engine.md) | how the rule-based engine is modeled: state, actions, effects, events, triggers, decisions, visibility |
| [The event chain](event-chain.md) | exactly how one move resolves, with real traces (the deep dive on the pipeline) |
| [Content and extensibility](content-and-extensibility.md) | how cards, generals, skills and modes are defined, and how to add one |
| [Frontend](frontend.md) | how the Angular app renders the engine's state and sends actions back |
| [Backend and deployment](backend-and-deployment.md) | what exists today (no server), and the path to a server-authoritative game |
| [Bots and simulation](bots-and-simulation.md) | the computer opponents, the headless simulator, invariants and the test layout |

The project-wide rules (layering, domain modeling, extensibility, UI text
style) live in [CLAUDE.md](../../CLAUDE.md). The design specs and plans that
led to this code are in [docs/superpowers/](../superpowers/).

## The one-paragraph version

The game is a **pure TypeScript rules engine** (`engine`) that takes the
current game state and one player action and returns the next state. It knows
no card or General by name: every card, skill and mode is **content**
(`content`) registered with the engine through plain interfaces. **Bots**
(`bots`) choose actions for computer seats, and a headless **simulator**
(`sim`) plays whole games under plain Node to check invariants. The **Angular
app** (`app`) holds the state in a signal, shows each viewer a redacted copy,
and turns clicks into the engine's own actions. Nothing in the engine touches
Angular, the browser, the clock or `Math.random`, which is what lets the same
engine run on a server later.
