# Kingdom War (Guozhan) Rules Engine — Design Spec

Status: Approved for implementation planning
Date: 2026-09-03 (revised: explicit domain model; named pipeline stages
and registry-based extensibility)

## Purpose

Build the first sub-project of a web-based Sanguosha board game application:
a headless, framework-independent rules engine implementing the Kingdom War
(国战/Guozhan) mode, plus a minimal content set and simulation harness
sufficient to exercise and automatically test it. No Angular UI, networking,
persistence, or application/session layer is in scope for this sub-project —
those are later sub-projects built on top of this engine.

This engine is the foundation for the project-wide requirement that the core
game engine (rules, state transitions, actions, effects, targeting,
resolution) be fully decoupled from Angular, browser APIs, and UI state, be
independently executable and testable via automated simulation, and be
modeled around explicit domain concepts with clear responsibilities rather
than loosely structured objects.

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
- The Angular presentation layer (see [[sanguosha-frontend-constraints]]
  project memory for its constraints, captured separately since it applies
  to a later sub-project).
- The full general/card roster beyond the hand-picked test set.
- Any AI beyond uniformly-random legal-move selection.

## Workspace layout

Single Angular CLI workspace, with the engine and content as pure
TypeScript library projects (no Angular/browser dependencies), and a
separate headless Node CLI project for simulation:

```
projects/engine/    — pure TypeScript library, zero Angular/browser deps
  src/lib/domain/   — Game, Seat, Player, Target, Turn, Phase, GameResult
  src/lib/cards/    — CardDefinition, CardInstance, Deck, CardZone
  src/lib/pipeline/ — Action, Effect, Event types + resolve()
  src/lib/skills/   — Skill/Trigger registration API, skill resolution
  src/lib/rules/    — targeting/legality queries, phase sequencing,
                       generic (mode-agnostic) win-condition evaluation
  src/lib/registry/ — ContentRegistry, GameModeDefinition, ModeRegistry
                       interfaces — the engine's only extension points
  src/lib/rng/      — seeded RNG carried inside GameState

projects/content/   — pure TypeScript library, depends only on `engine`
  src/lib/          — general/card/skill *definitions* (data + effect fns),
                       exported as a populated ContentRegistry instance;
                       Kingdom War's GameModeDefinition also lives here
                       since it is mode content, not generic engine code

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

## Domain model

The engine is modeled around explicit domain concepts, each with a single
clear responsibility, rather than loosely structured generic objects.

### Game

The aggregate concept the whole domain rolls up into. Realized concretely
as `GameState` (data) together with the `resolve()` pipeline and the rule
modules that operate on it (setup, phase sequencing, win condition) — there
is no separate mutable `Game` class; "Game" names the aggregate as a whole,
not a single type.

```
GameState {
  seats: Seat[]
  players: Player[]
  turn: Turn
  deck: Deck
  zones: CardZone[]           // draw pile, discard pile, judgment zone, etc.
  pendingResponse: PendingResponse | null
  log: GameEvent[]
  rng: RngState
  result: GameResult | null
}
```

### Player and Seat

**Seat** is the fixed structural position at the table: index, references
to left/right neighboring seats (used for distance/range calculations),
and the in-game character state for whoever occupies it.

```
Seat {
  id: string
  index: number
  kingdom: Kingdom                          // Wei | Shu | Wu | Qun
  generals: { main: GeneralInstance, deputy: GeneralInstance }
  combinedHp: number
  maxCombinedHp: number
  hand: CardZoneRef                         // reference to a CardZone
  equipped: CardZoneRef
  eliminated: boolean
}

GeneralInstance {
  generalDefinitionId: string
  revealed: boolean                         // false = hidden from other seats
}
```

**Player** is the controller occupying a Seat — decoupled from Seat so a
later application/multiplayer layer can reconnect a Player to a Seat
without any engine change.

```
Player {
  id: string
  seatId: string
  kind: 'human' | 'bot'
}
```

While `GeneralInstance.revealed` is `false`, the real `generalDefinitionId`
is only exposed in the owning seat's redacted view of state; other seats'
views substitute a placeholder. This hidden-information rule is modeled
explicitly in the engine (a state-redaction function), not left as a
UI-layer concern.

### Target

A resolved reference to something an Action or Effect points at, used
throughout instead of raw string ids — necessary because some Kingdom War
skills target a specific general slot rather than the seat as a whole.

```
Target = { kind: 'seat', seatId: string }
       | { kind: 'general', seatId: string, generalSlot: 'main' | 'deputy' }
```

### Card model: CardDefinition, CardInstance, Deck, CardZone

Four distinct concepts replace what would otherwise be loosely-typed arrays:

- **CardDefinition** — static rule data for a card type, lives in
  `content`: `{ id, name, category: 'basic' | 'trick' | 'equipment', play: (state, ctx) => Effect[] }`.
- **CardInstance** — one physical card: `{ instanceId, definitionId, suit, rank }`.
  Suit and rank live on the instance (not the definition) because the
  physical deck has a fixed suit/rank per card and some skills key off them.
- **Deck** — the full shuffled collection of `CardInstance`s built at setup
  from the content pack's per-definition card counts.
- **CardZone** — a generic container: `{ id, kind: 'hand' | 'equip' | 'drawPile' | 'discardPile' | 'judgment', ownerSeatId?: string, cards: CardInstance[] }`.
  Hand, equipment, draw pile, discard pile, and judgment zone are all
  `CardZone`s distinguished only by `kind` and optional `ownerSeatId`, so
  "move cards between zones" is implemented once generically instead of
  being duplicated per zone type.

### Turn and Phase

```
Turn {
  turnNumber: number
  ownerSeatId: string
  extraTurnStack: string[]     // supports Sanguosha's "extra turn" mechanic
}

Phase = 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End'
```

A `PhaseSequence` rule module defines the fixed phase order and the
conditions under which each phase transitions to the next, and a turn-
advancement rule module defines whose turn is next (ordinarily the next
seat clockwise, unless the extra-turn stack says otherwise). Together these
make state transitions explicit and predictable as a structural property of
the rule modules, not merely a convention the rest of the code has to honor.

### Action → Effect → Event pipeline

Three tiers, each with a distinct responsibility:

- **Action** — a request submitted by a player or the engine itself:
  `PlayCardAction`, `RevealGeneralAction`, `RespondAction`, `PassAction`,
  `EndPhaseAction`.
- **Effect** — an atomic *proposed* change produced by resolving an Action
  or a skill trigger: `DamageEffect`, `HealEffect`, `DrawCardsEffect`,
  `MoveCardEffect`, `RevealGeneralEffect`. Effects are still malleable —
  skills subscribed to `before:<EffectType>` can modify, redirect, or
  cancel them before they apply. This is where "prevent/redirect this
  damage" interactions hook in.
- **Event** — the immutable fact appended to `GameState.log` once an Effect
  has actually applied: `DamageDealtEvent`, `CardPlayedEvent`,
  `GeneralRevealedEvent`. Skills subscribed to `after:<EventType>` react to
  facts that already happened.

```
resolve(state: GameState, action: Action): { state: GameState, events: GameEvent[] }
```

`resolve` internally passes the submitted Action through eight named
stages. The exact pipeline may evolve as specific mechanics turn out to
need finer-grained hooks, but this is the current shape:

1. **Player Action** — the submitted `Action` (e.g. `PlayCardAction`),
   already carrying whatever Targets the player chose when submitting it.
2. **Validation** — is the action structurally legal (right card, right
   phase, right zone, actor has priority)?
3. **Target Selection** — are the declared `Target`s legal per the
   targeting/legality module? A structurally legal action can still name an
   illegal target, so this is checked as its own stage.
4. **Response Window** — does resolving this action open a
   `PendingResponse` for another seat (Shan to a Sha, Wuxie to a trick)? If
   so, `resolve()` sets `GameState.pendingResponse` and returns; the
   pipeline only continues once a matching `RespondAction`/`PassAction` is
   submitted (see Response, below).
5. **Effect Resolution** — the action expands into one or more Effects;
   skills subscribed to `before:<EffectType>` may modify, redirect, or
   cancel each one before it applies.
6. **State Update** — the (possibly modified) Effect applies, producing a
   matching Event appended to `GameState.log`.
7. **Triggered Effects** — skills subscribed to `after:<EventType>` fire,
   possibly queuing further Actions/Effects, which re-enter this same
   pipeline from stage 2.
8. **Next Game State** — the settled `GameState` once no `pendingResponse`
   remains and no further triggered Effects are queued.

`resolve` is pure, and all randomness is drawn from the seeded `RngState`
carried inside `GameState`, so replaying the same action sequence from the
same seed reproduces identical results.

### Skills

Unchanged in shape from the prior draft — plain declarative data, not
imperative engine calls:

```
SkillDefinition {
  id: string
  triggers: Array<{
    point: TriggerPoint            // e.g. 'before:DamageEffect', 'after:DamageDealtEvent'
    condition: (state: GameState, subject: Effect | GameEvent) => boolean
    effect: (state: GameState, subject: Effect | GameEvent) => Action[] | Effect[]
  }>
  activation: 'auto' | 'player-choice'
}
```

### Damage

An explicit value object rather than a loose parameter bag, carried by both
`DamageEffect` and `DamageDealtEvent`:

```
Damage {
  source: Target | null
  target: Target
  amount: number
  nature: 'normal' | 'fire' | 'thunder'
  cause?: { cardInstanceId?: string, skillId?: string }
}
```

### Response

Sanguosha requires pausing resolution mid-way to ask a specific seat
whether it wants to respond (e.g. Shan to a Sha, Wuxie to cancel a trick).
Modeled as explicit, inspectable state rather than a hidden call-stack
pause or synchronous callback:

```
PendingResponse {
  id: string
  respondingSeatId: string
  allowedActionKinds: ActionKind[]   // e.g. ['RespondAction:shan', 'PassAction']
  context: { effect: Effect }        // what triggered the response window
}
```

When an Effect opens a response window, `resolve()` sets
`GameState.pendingResponse` and returns without continuing further
resolution. The game only advances again when a `RespondAction` or
`PassAction` targeting that specific `pendingResponse.id` is submitted —
through the same `resolve(state, action)` entry point as any other action.
This keeps the engine's only public entry point as "one action in, one new
state out," with "awaiting a response" as an explicit, serializable state
value rather than something implicit — and generalizes cleanly to a later
networked layer where a real human, not a bot, must answer.

### Targeting / legality

A pure query module, given `GameState` + a proposed Action, returns legal
Targets and legal Actions (including, when `pendingResponse` is set,
constraining legal actions to only what that response window allows). It
has no notion of "which UI/player asked" — equally usable by a human-driven
interface (later), an AI bot, or the simulation harness.

### GameResult

Produced by the win-condition rule module and attached to
`GameState.result` once the game reaches a terminal state:

```
GameResult {
  endedAt: number                  // turn number
  winningKingdom?: Kingdom
  winningSeatIds: string[]
  losingSeatIds: string[]
}
```

## Extensibility

New cards, generals, skills, effects, and game modes must be addable by
adding a definition, never by editing a shared conditional. This is
enforced structurally, not just as a convention:

- **No engine-core branching on content ids.** The engine never contains
  logic like `if (card.id === 'sha')`. It only ever calls
  `CardDefinition.play(...)` or a `SkillDefinition` trigger's `effect(...)`,
  looked up by id through a `ContentRegistry` — an interface the engine
  defines but never implements; `content` provides the populated instance
  (`{ cards: Map<string, CardDefinition>, generals: Map<string, GeneralDefinition> }`).
  Adding a card or general or skill means adding an entry to this registry
  in `content`, never touching `engine`.
- **Game modes are pluggable.** A `GameModeDefinition` interface (setup,
  win-condition check, mode-specific triggers/actions) is the engine's only
  notion of "a mode." Kingdom War is one `GameModeDefinition` instance,
  defined in `content` (it's mode content, not generic engine behavior) and
  selected via a `ModeRegistry` at game setup. The generic `resolve()`
  pipeline, phase sequencing, and targeting/legality modules stay entirely
  mode-agnostic — adding standard Identity mode later means adding another
  `GameModeDefinition`, not modifying the pipeline.
- **Card variants** (e.g. a fire/thunder-nature reprint of a base card) are
  built by composing or parameterizing shared behavior factories (e.g. a
  `makeShaLikeCard(nature)` helper used by multiple `CardDefinition`
  entries), not by special-casing in engine code.

## Kingdom War mode rules

Implemented as a single `GameModeDefinition` instance in `content`,
consumed by the engine's generic setup/win-check machinery — the engine
itself has no Kingdom-War-specific knowledge:

- **Setup**: each Seat is assigned a kingdom and two hidden `GeneralInstance`s
  (main + deputy), both starting with `revealed: false`.
- **HP**: `maxCombinedHp = main.maxHp + deputy.maxHp`; all damage and
  healing applies to the single `combinedHp` pool on the Seat.
- **Reveal**: `RevealGeneralAction` is a first-class Action.
  - Voluntary: the owning seat's player may reveal a general at defined
    action windows (e.g. before activating a skill that requires that
    general be revealed).
  - Forced: automatically triggered via a built-in forced trigger on
    `after:DamageDealtEvent` / `after:HealEvent` once `combinedHp` crosses a
    general-specific threshold — using the same trigger mechanism as any
    other skill, with no special-casing in the pipeline itself.
- **Win condition**: evaluated as a rule-module query after every state
  change; produces a `GameResult` once satisfied. The game ends when all
  non-eliminated seats belong to a single kingdom. Exact Qun/Neutral win
  semantics (individual win vs. grouped with survivors) have more than one
  common convention in existing Guozhan implementations and will be pinned
  down precisely during implementation of that rule module, defaulting to
  individual-win-for-Qun unless implementation reveals a stronger reason to
  do otherwise.

## Content model (minimal set)

`projects/content` defines:
- ~4-6 `GeneralDefinition`s, one or two per kingdom, `{ id, kingdom, maxHp, skills: SkillDefinition[] }`,
  chosen to cover distinct trigger shapes: an on-play damage modifier, a
  heal/lifesteal trigger, a card-draw trigger, a forced/negative trigger,
  and a distance/range modifier.
- The basic `CardDefinition` set: Sha (杀), Shan (闪), Peach (桃), Duel
  (决斗), Wuxie Kongjie / Nullify (无懈可击), plus a couple of equipment
  cards.

## Simulation harness

`projects/sim` is a headless Node CLI that:
- Seeds an RNG and sets up a Kingdom War game for N seats (2-8),
  auto-assigning kingdoms/generals from the content pack.
- Drives the game to completion using a random-legal-move bot: at each
  decision point (including responding to a `PendingResponse`), queries the
  engine's legality module for valid actions and picks uniformly at random.
- Supports two modes: a single game with full event-log output (for
  debugging a specific interaction), and a batch mode running many seeded
  games for crash/invariant checking.

## Testing strategy

- Jest unit tests in `projects/engine` covering the generic `resolve()`
  pipeline (including response-window pause/resume) and targeting/legality
  queries, using minimal fixture registries — no Kingdom-War-specific
  behavior under test here, since the engine has none.
- Jest unit tests in `projects/content` covering individual general/card
  skill definitions and the Kingdom War `GameModeDefinition` (setup,
  reveal, win condition) in isolation.
- Property-style tests that run the `sim` harness across many seeds and
  assert invariants such as: combined HP never goes negative, every game
  terminates within a bounded number of actions, a `pendingResponse` is
  always eventually resolved (never left dangling), and the win condition
  is always eventually satisfied.
- No Karma/browser-based testing is used anywhere in this milestone.
