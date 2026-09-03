# Kingdom War (Guozhan) Rules Engine — Design Spec

Status: Approved for implementation planning
Date: 2026-09-03

## Purpose

Build the first sub-project of a web-based Sanguosha board game application:
a headless, framework-independent rules engine implementing the Kingdom War
(国战/Guozhan) mode, plus a minimal content set and simulation harness
sufficient to exercise and automatically test it. No Angular UI, networking,
persistence, or application/session layer is in scope for this sub-project —
those are later sub-projects built on top of this engine.

This engine is the foundation for the project-wide requirement that the core
game engine (rules, state transitions, actions, effects, targeting,
resolution) be fully decoupled from Angular, browser APIs, and UI state, and
be independently executable and testable via automated simulation.

## Scope of this milestone

In scope:
- Kingdom War mode: 2-8 players, each secretly assigned a kingdom (Wei, Shu,
  Wu, Qun/Neutral) and two hidden generals (main + deputy).
- Combined HP pool, voluntary + forced general reveal, kingdom-based win
  condition.
- A hand-picked minimal content set: ~4-6 generals (covering distinct skill
  trigger shapes) and the basic card set (Sha, Shan, Peach, Duel, Wuxie
  Kongjie / Nullify, plus a couple of equipment cards).
- A headless simulation runner driving random-legal-move bots, for both
  interactive debugging (single game, full event log) and batch invariant
  testing (many seeded games).
- Jest-based unit and property-style tests for the engine and content
  libraries.

Explicitly out of scope (deferred to later sub-projects):
- Networking / multiplayer synchronization.
- Persistence of game/session state.
- The application/orchestration layer (sessions, matchmaking, players).
- The Angular presentation layer.
- The full general/card roster beyond the hand-picked test set.
- Any AI beyond uniformly-random legal-move selection.

## Workspace layout

Single Angular CLI workspace, with the engine and content as pure
TypeScript library projects (no Angular/browser dependencies), and a
separate headless Node CLI project for simulation:

```
projects/engine/    — pure TypeScript library, zero Angular/browser deps
  src/lib/state/    — GameState, Player, GeneralSlot, CardInstance types
  src/lib/events/   — GameEvent definitions, EventPipeline / resolve()
  src/lib/skills/   — Skill/Trigger registration API, skill resolution
  src/lib/rules/    — targeting/legality queries, phase/turn structure,
                       Kingdom War setup/reveal/win-condition rules
  src/lib/rng/      — seeded RNG carried inside GameState

projects/content/   — pure TypeScript library, depends only on `engine`
  src/lib/          — general/card/skill *definitions* (data + effect fns)

projects/sim/       — headless Node CLI, depends on `engine` + `content`
  src/              — simulation runner: random-legal-move bots, batch runs

projects/app/       — Angular application — added in a LATER sub-project
```

Dependency direction is strictly one-way:
`app → (future application layer) → content → engine`. `engine` never
imports from anything above it in this graph. `content` depends only on
`engine` and never on Angular, so it can be exercised entirely by `sim`
with no browser involved.

Test runner: Jest, used within `projects/engine` and `projects/content`.
No Karma/browser test runner is needed for this milestone since nothing
here touches Angular.

## Core engine design

### GameState

A single immutable, serializable tree:

```
GameState {
  players: Player[]
  turn: { activePlayerId: string, phase: Phase }
  cardPiles: { drawPile: CardInstance[], discardPile: CardInstance[] }
  log: GameEvent[]
  rng: RngState
}

Player {
  id: string
  kingdom: Kingdom            // Wei | Shu | Wu | Qun
  generals: { main: GeneralSlot, deputy: GeneralSlot }
  combinedHp: number
  maxCombinedHp: number
  hand: CardInstance[]
  equipped: CardInstance[]
  eliminated: boolean
}

GeneralSlot {
  generalId: string
  revealed: boolean
}
```

While a `GeneralSlot.revealed` is `false`, the real `generalId` is only
exposed in the owning player's redacted view of state; other players'
views substitute a placeholder. This hidden-information rule is modeled
explicitly in the engine (as a state-redaction function), not left as a
UI-layer concern, since it is core game rule behavior — even though no
consumer of it (a real multiplayer view) exists yet in this milestone.

### Event pipeline

An `EngineAction` (e.g. `PlayCard`, `DeclareTarget`, `RevealGeneral`,
`EndPhase`) is submitted to a pure function:

```
resolve(state: GameState, action: EngineAction): { state: GameState, events: GameEvent[] }
```

Steps:
1. Validate legality via the rules/targeting module; reject illegal actions
   without mutating state.
2. Expand the action into one or more base `GameEvent`s.
3. For each event, gather skills subscribed to `before:<eventType>` and
   `after:<eventType>` trigger points — including built-in forced triggers
   such as reveal-on-damage-threshold.
4. Let subscribed skills contribute replacement or follow-up events/actions.
5. Fold everything into a new immutable `GameState` plus an ordered `events`
   log appended to `state.log`.

`resolve` is pure, and all randomness is drawn from the seeded `RngState`
carried inside `GameState`. Replaying the same action sequence from the
same initial state/seed reproduces identical results, which the simulation
harness and tests rely on for determinism.

### Skills

Skills are plain declarative data, not imperative engine calls:

```
SkillDefinition {
  id: string
  triggers: Array<{
    point: TriggerPoint            // e.g. 'after:DealDamage'
    condition: (state: GameState, event: GameEvent) => boolean
    effect: (state: GameState, event: GameEvent) => EngineAction[] | GameEvent[]
  }>
  activation: 'auto' | 'player-choice'
}
```

A skill author (in `content`) never calls engine internals directly — a
skill's `effect` returns data describing what should happen next, and the
engine pipeline is responsible for applying it.

### Targeting / legality

A pure query module, given `GameState` + a proposed action/context, returns
legal targets and legal actions. It has no notion of "which UI/player asked
for this" — it is equally usable by a human-driven interface (later), an AI
bot, or the simulation harness enumerating legal moves.

## Kingdom War mode rules

Modeled as engine-level rules (mode rules, not content data):

- **Setup**: each player is assigned a kingdom and two hidden generals (main
  + deputy), both starting with `revealed: false`.
- **HP**: `maxCombinedHp = main.maxHp + deputy.maxHp`; all damage and
  healing applies to the single `combinedHp` pool.
- **Reveal**: `RevealGeneral` is a first-class `EngineAction`.
  - Voluntary: the owning player may reveal a general at defined action
    windows (e.g. before activating a skill that requires that general be
    revealed).
  - Forced: automatically triggered via a built-in forced trigger on the
    `after:DealDamage` / `after:Heal` points once `combinedHp` crosses a
    general-specific threshold — using the same trigger mechanism as any
    other skill, with no special-casing in the pipeline itself.
- **Win condition**: evaluated as a rule-module query after every state
  change. The game ends when all non-eliminated players belong to a single
  kingdom. Exact Qun/Neutral win semantics (individual win vs. grouped with
  survivors) have more than one common convention in existing Guozhan
  implementations and will be pinned down precisely during implementation
  of that rule module, defaulting to individual-win-for-Qun unless
  implementation reveals a stronger reason to do otherwise.

## Content model (minimal set)

`projects/content` defines:
- ~4-6 generals, one or two per kingdom, `{ id, kingdom, maxHp, skills }`,
  chosen to cover distinct trigger shapes: an on-play damage modifier, a
  heal/lifesteal trigger, a card-draw trigger, a forced/negative trigger,
  and a distance/range modifier.
- The basic card set: Sha (杀), Shan (闪), Peach (桃), Duel (决斗), Wuxie
  Kongjie / Nullify (无懈可击), plus a couple of equipment cards. Each card
  is `{ id, type, play: (state, ctx) => EngineAction[] }`.

## Simulation harness

`projects/sim` is a headless Node CLI that:
- Seeds an RNG and sets up a Kingdom War game for N players (2-8),
  auto-assigning kingdoms/generals from the content pack.
- Drives the game to completion using a random-legal-move bot: at each
  decision point, queries the engine's legality module for valid actions
  and picks uniformly at random.
- Supports two modes: a single game with full event-log output (for
  debugging a specific interaction), and a batch mode running many seeded
  games for crash/invariant checking.

## Testing strategy

- Jest unit tests in `projects/engine` covering the `resolve()` pipeline,
  targeting/legality queries, and Kingdom War rule modules (setup, reveal,
  win condition) in isolation.
- Jest unit tests in `projects/content` covering individual general/card
  skill definitions.
- Property-style tests that run the `sim` harness across many seeds and
  assert invariants such as: combined HP never goes negative, every game
  terminates within a bounded number of actions, and the win condition is
  always eventually satisfied.
- No Karma/browser-based testing is used anywhere in this milestone.
