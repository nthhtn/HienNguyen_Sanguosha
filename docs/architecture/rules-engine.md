# The rules engine

How the rule-based engine in `projects/engine` is modeled. For a step-by-step
trace of one move, read [The event chain](event-chain.md); this doc is the
map that doc zooms into.

## What the engine is

A function and a set of types:

```ts
resolve(state: GameState, action: Action, ctx: EngineContext): { state: GameState; events: GameEvent[] }
```

`ctx` is `{ registry, mode }`: the content the game is played with and the
game mode's rules. Given the same inputs, `resolve` always returns the same
output. It never mutates `state`, reads the clock, calls `Math.random`, or
touches Angular or the browser.

Besides `resolve` the public API ([public-api.ts](../../projects/engine/src/public-api.ts))
offers:

| Function | What it answers |
|---|---|
| `getLegalActions(state, seatId, registry)` | what may this seat do right now? (the UI and bots only ever submit one of these) |
| `getActiveSeatId(state)` | whose decision is pending? |
| `previewEffect(state, effect, ctx)` | what would this pending effect really do once before-triggers rewrite it? |
| `redactStateForSeat(state, seatId)` | the state as that seat is allowed to see it |
| `createGame(mode, registry, seatIds, seed, rules?)` | a new game, in the General Selection phase |
| `skillsInPlay`, `skillOf` | which skills a seat holds right now |
| `cardsOverHandLimit`, `discardOwed` | Discard Phase accounting |

## The domain model

These are the concepts CLAUDE.md asks for, with where they live in
[domain/types.ts](../../projects/engine/src/lib/domain/types.ts).

| Concept | Type | Notes |
|---|---|---|
| Game | `GameState` | the whole game, plain serializable data |
| Seat | `Seat` | position, Kingdom, two Generals, combined HP, zone references, flags (face down, silenced…) |
| Player | `Player` | name and human or bot; a seat's stable key is its seat id |
| General | `GeneralInstance`, `GeneralDefinition` | an instance records which General a seat holds and whether it is revealed; the definition is content |
| Skill | `SkillDefinition` | content; owned at run time through an `AbilityOwner` |
| Card definition / instance | `CardDefinition`, `CardInstance` | the definition is content; an instance is one physical card (id, suit, rank) |
| Deck, Card Zone | `CardZone` | the draw pile, discard pile, "processing" area, and each seat's hand, equipment, judgment area and piles are all zones distinguished by `kind` |
| Target | `Target` | a seat, or one of a seat's Generals |
| Action | `Action` | the only input from outside |
| Effect | `Effect` | an instruction to change the state |
| Event | `EngineEvent` | a record that something happened, appended to `state.log` |
| Damage | `Damage` | source, target, amount, nature, and what caused it |
| Turn, Phase | `Turn`, `Phase` | the turn owner, per-turn counters and flags; `GeneralSelection`, `Start`, `Judgment`, `Draw`, `Play`, `Discard`, `End` |
| Response | `PendingResponse` | an open window where one seat may answer with a card |
| Game Result | `GameResult` | winners and losers, when the mode's win check says so |

### Combined HP

A seat has one HP pool: half the printed HP of its two Generals, rounded
down (`combinedMaxHp`). Damage and healing apply to that pool; the rounding
bonus and the Main and Deputy reveal thresholds are rules in the Kingdom War
mode, not in the engine core.

### Hidden information

Kingdom War is a hidden-information game: hands, the draw pile and unrevealed
Generals are secret. The state stored by the application is the **full** state;
`redactStateForSeat(state, viewer)` produces what one seat may see:

- other seats' hands and the draw pile show as masked cards
  (`definitionId: 'hidden'`);
- another seat's unrevealed General shows as `'hidden'`, and its Kingdom stays
  hidden until a General is revealed;
- a pending selection or choice has hidden cards masked, and a *secret* choice
  hides its options from everyone but its chooser;
- skill ids of another seat's hidden Generals read `'hidden'` wherever they
  appear: in pending decisions, in queued work and in the log. One set of such
  skills per state and viewer (from the log, the pending decisions and the
  queue) masks them all. Besides skill, ability and conversion ids, the skill
  is masked as a token inside decision id strings (`ask-hidden-seat-b-3`),
  `acted` ability keys (`seat-b:main:hidden`), use counter and tally keys
  (`seat-b/main/hidden`) and turn flags. Card and General ids are never
  masked as tokens, so a Wine card stays Wine while Dong Zhuo's hidden Wine
  skill is masked;
- the log is otherwise public: events are written that way (a face-down card
  move carries no face, a revealed card is shown on purpose), and the only
  per-viewer change is the hidden-skill masking above.
  `redactEventsForSeat(state, events, viewer)` masks a slice of the log with
  the same set as `redactStateForSeat`.

Bots receive the redacted state too, so they cannot cheat by construction.

## State is a resting place, not a call stack

The engine never blocks waiting for a player. Whatever is still to resolve sits
in `state.resolutionQueue`, and a decision is a field on the state:

| Pending field | Meaning |
|---|---|
| `pendingResponse` | one seat may answer with a card (Shan to a Sha, Wuxie, Peach in a dying round) or pass |
| `pendingChoice` | one seat picks an option (Steal's card, an "Use this skill?" ask) |
| `pendingSelection` | one seat picks cards or seats (Axe's two cards, a skill's targets) |
| `pendingArrangement` | one seat orders cards from the draw pile |
| none, in `Play` or `Discard` | the turn owner acts: play a card, use a skill, end the phase, discard |

`advanceToDecision` drains the queue until one of these appears (or the game
ends), then returns. The next `resolve` call carries the player's answer and
continues from the same state. That is why a saved game can resume at any
decision, and why a server can hold the state between requests.

`getActiveSeatId` says whose turn it is to decide, so callers never need to
interpret the pending fields themselves.

## The pipeline in one page

```
resolve(state, action)
 ├─ resolveAction: validate the action (right seat, legal targets, window open),
 │    then queue what it leads to. It resolves nothing itself.
 └─ advanceToDecision: loop
      pop the front of the queue
        an Effect:  before-triggers may rewrite or cancel it
                    → applyEffect changes the state and returns events
                    → events go in the log
                    → each event's after-triggers queue follow-ups at the FRONT
        an Action:  resolveAction (queues more)
      after each item, ask the mode whether the game is over
      stop when a decision is pending, the queue is empty, or there is a result
      empty and nobody to decide? enter the next phase, queue its triggers
```

Details, a real three-call trace of a lethal Sha, and the Tool, choice and
judgment lifecycles are in [The event chain](event-chain.md).

### Safety rails

- `MAX_RESOLUTION_STEPS` (10,000) bounds the items one `resolve` call may
  process. A content trigger cycle fails loudly, naming the item, instead of
  looping.
- `MAX_AUTO_PHASE_STEPS_PER_SEAT` (times the seat count, plus one more round)
  bounds how many phases `advanceToDecision` enters automatically before
  someone must decide.
- `resolve` refuses any action once the game has a result.
- `resolveAction` validates every action itself (right seat, card in hand,
  targets among the engine's legal lists, window open) and throws on a bad one.
  A UI or bot bug therefore surfaces as a thrown error and an unchanged state,
  not a corrupted game.

## Triggers: how content reacts

A `SkillTrigger` is `{ point, condition, effect }`, where `point` is
`before:<EffectKind>` or `after:<EventKind>`.

- **before** triggers see an effect about to apply and may rewrite or cancel it
  (Silver Lion capping damage, Black Shield ignoring a Sha).
- **after** triggers see an event that just happened and return follow-up
  effects or actions (a damaged General asking to draw, the mode putting a
  seat into the dying state).

`gatherTriggeredSkills` collects candidates in a fixed order so resolution is
deterministic: the mode's triggers first, then each seat's Generals' skills in
play (seat by seat, Main before Deputy), then worn equipment. A hidden
General's *compulsory* skills are off; its optional skills still trigger but
using one reveals the General first (`needsReveal`; the reveal rule is under
"Reveal to use" in [the event chain](event-chain.md)). The `owner` passed to a
trigger says whose skill it is, so the same General can sit at two seats.

## Decisions are data, not callbacks

Because the state must stay serializable, a decision cannot carry a function.
Instead it carries **plain data describing what happens next**:

- A `ChoiceOption` carries `effects`, queued at the front when it is picked.
- A `PendingSelection.then` is a `SelectionContinuation`: "discard the picked
  cards", "use them as a Sha", or "queue this skill step with the picked ids
  added to its data".
- `CardStepEffect` and `SkillStepEffect` name a step of a card or skill
  (`'sha-shan'`, `'compete-user'`) and carry its data. The card's or skill's
  `onStep` is looked up in the registry when the step comes up.

This is the mechanism behind multi-move mechanics such as Compete, Bewilder's
doubt round and Sha's dodge sequence: they are chains of steps whose state
lives in the queue.

## Game modes

`GameModeDefinition` is the engine's only view of the rules of a particular
mode:

```ts
interface GameModeDefinition {
  id: string;
  setup(seatIds, registry, rng, rules?): { state, rng };
  checkWinCondition(state): GameResult | null;
  triggers: SkillTrigger[];
  maxSeats?(registry): number;
}
```

`kingdomWarMode` ([kingdomWar.ts](../../projects/content/src/lib/modes/kingdomWar.ts))
is the one implementation. It deals five Generals to each seat, builds and
shuffles the deck, and deals four cards. Its `triggers` carry the mode's
rules:

- the Draw Phase draw and the Judgment Phase;
- HP at 0 or below starts the dying round (an HP drop reveals nothing; a death
  reveals both Generals, in the engine's elimination step);
- elimination discards everything the seat holds;
- the kill reward and penalty, and the reveal bonuses.

Optional table rules chosen at game creation are stored in `state.rules`
(`GameRules`) so they survive saving and replay. Today the one option is the
first-reveal bonus.

## Errors

Invalid input throws. The application layer decides how to surface it
(`GameService` stores the message in `lastError` and leaves the state
unchanged). Content bugs that can be detected up front, such as hand-coded
skills with no data file or a card with no printings, throw while the
registry or deck is built, so they fail at start-up rather than mid-game.
