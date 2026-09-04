# Project Architecture — Sanguosha Board Game App

A web-based Sanguosha board game application built with Angular. These
rules are project-wide and apply across all sub-projects (engine, content,
application layer, presentation layer). They OVERRIDE default behavior —
follow them exactly.

## Layering

The application MUST maintain a clear separation between:

- **Game Engine** — rules, state transitions, actions, effects, targeting,
  and resolution.
- **Game Content** — cards, generals, skills, and their definitions.
- **Application Layer** — orchestration of games, players, sessions, and
  persistence.
- **Presentation Layer** — Angular components, views, animations, and user
  interaction.

The core game engine MUST NOT depend on Angular components, templates,
browser APIs, or UI state. The game engine SHOULD be executable
independently of the Angular UI so it can be tested through automated
simulations. UI components MUST NOT directly implement game rules.

Current status: the engine sub-project (rules engine for Kingdom War /
Guozhan mode) is in design — see
`docs/superpowers/specs/2026-09-03-guozhan-engine-design.md` for the
current spec (workspace layout, domain model, pipeline, extensibility).
The application layer and Angular presentation layer are future
sub-projects; the constraints below apply once work on them begins.

## Domain modeling

The game MUST be modeled around explicit domain concepts — Game, Player,
Seat, General, Skill, Card Definition, Card Instance, Deck, Card Zone,
Target, Action, Effect, Damage, Turn, Phase, Event, Response, Game Result —
where applicable. Domain concepts SHOULD have clear responsibilities and
MUST NOT be represented solely through loosely structured objects when a
stronger model improves correctness.

Game state transitions MUST be explicit and predictable. Actions SHOULD
follow a predictable resolution pipeline (Player Action → Validation →
Target Selection → Response Window → Effect Resolution → State Update →
Triggered Effects → Next Game State); the exact pipeline MAY evolve as the
rules become better understood. The system MUST support response and
interruption mechanics, since Sanguosha contains effects that require
players to respond to an action.

Game state SHOULD be serializable when practical, to support saving,
reconnection, debugging, replay, and server synchronization.

## Extensibility

The architecture MUST allow new cards, card variants, generals, skills,
effects, and game modes to be added without unnecessarily modifying
unrelated systems. Adding a new card SHOULD generally require adding its
definition and behavior rather than modifying a central conditional
containing every card in the game. The same principle applies to generals
and skills. Avoid large switch/if structures that become registries of all
game content — use data-driven registries instead.

## Process

Rules MUST be specified before implementation of substantial mechanics:
before implementing a new general's skill, a new card's behavior, or a new
game-mode rule, write out its precise rule text first — don't jump straight
to code for non-trivial mechanics. Trivial additions that just reuse an
already-specified pattern don't need a fresh round of spec-writing.

## Presentation layer (Angular)

Game rules MUST be implemented independently from presentation.

Angular components SHOULD primarily be responsible for: rendering game
state, receiving user interaction, dispatching player actions, presenting
available actions, and managing UI-specific state. Components MUST NOT
contain substantial game-rule logic; game behavior SHOULD be implemented
in dedicated TypeScript services, domain classes, or engine modules
instead.

The Angular UI MUST treat the game engine as the source of truth for game
rules. The UI MAY maintain presentation-specific state — selected card,
hover state, animation state, modal visibility, drag-and-drop state,
visual effects — but MUST NOT maintain authoritative game rules
independently. For example, the UI MUST NOT determine whether a player is
allowed to play Slash; it SHOULD ask the game/application layer for the
legal actions available to the player.

Angular Signals SHOULD be preferred for reactive UI state where
appropriate. Dependency Injection SHOULD be used for application services
and replaceable infrastructure. The application SHOULD favor standalone
Angular components and modern Angular patterns rather than legacy
NgModule-heavy architecture.

## Application / backend layer

Communication with a backend MUST use explicit application/domain
contracts. The frontend MUST NOT depend directly on database schemas.
Persistence models MAY differ from domain models — an explicit mapping
layer between them is expected, not a shortcut to avoid.

The architecture SHOULD allow the game engine to eventually run
authoritatively on a server. This should be a natural extension rather
than a redesign: the engine is a pure, framework-free TypeScript package,
executable under plain Node (proven by the headless simulation harness in
the engine sub-project), and its state is plain serializable data.
