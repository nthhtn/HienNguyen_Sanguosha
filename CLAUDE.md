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

Current status: the engine (Kingdom War / Guozhan), content, bots and
simulator, the Angular presentation layer, and a Node server with a shared
`protocol` project are all built and in use. `docs/architecture/` is the
guide to how they fit together; read it before changing structure. The
original design is in
`docs/superpowers/specs/2026-09-03-guozhan-engine-design.md`, and the backend
design in `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`.
The per-layer constraints below apply to all of it.

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

`npm run verify` runs the static pre-merge checks (lint, typecheck, build) and CI runs it, with the tests, on every pull request;
merging is human-only: the agent never merges or pushes to `main`. See
`docs/ci-and-guardrails.md`.

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

### UI text style

Every piece of visible text MUST follow these casing rules:

- **Title Case for names and short labels:** titles, headings that name
  something, buttons, tabs and field labels. Examples: "Response Needed",
  "Start Game", "Discard Pile", "Your Name".
- **Sentence case for anything that reads as a sentence:** announcements,
  status lines, prompts, descriptions, hints, empty states and Action History
  lines. Examples: "Bots are choosing their Generals…", "Pass the device to
  Hing", "Nothing yet", "Seat 1 used Sha (7 ♠) on Hing".
- **Keywords keep their capitals inside sentences:**
  - player and seat names, card names, general names;
  - forces (Wei, Shu, Wu, Qun);
  - card types (Basic, Tool, Equipment, Weapon, Armor, Mount);
  - phase names ("Play Phase");
  - the term General(s), including Main General and Deputy General;
  - HP.
- Ids are never shown as they are: show "Seat 0", not `seat-0`.

#### Other languages

The rules above are the English rules. Vietnamese does not use Title Case, so it
follows its own (the full terminology is in
`docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`):

- **Sentence case everywhere**, labels and buttons included ("Kết thúc giai
  đoạn", "Bỏ bài"), with a capital only on the first word.
- **Keywords keep their capitals inside sentences:** player and seat names,
  card names (Sát, Đào, Quyết Đấu), General names and the terms Tướng, Chủ
  tướng, Phó tướng and Sinh lực. Forces are Ngụy, Thục, Ngô, Quần.
- Skill names and titles are sentence case ("Gian hùng"), keeping the capitals of
  proper nouns inside them ("Thiên Công tướng quân"); General and card names are
  capitalised word by word ("Tào Tháo", "Quyết Đấu").
- New Vietnamese text starts as a draft. A native speaker reviews it, and
  `npm run i18n:status` reports what is still draft.

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
