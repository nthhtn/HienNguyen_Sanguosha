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
| `redactEventsForSeat(state, events, seatId)` | a slice of the log as that seat may see it |
| `isOfferedAction(action, legal)` | is this action one of the offered ones, allowing for the fields a player fills in on a template? (the server's check on every submit) |
| `describeDecision`, `switchClock`, `expireClock`, `clockRemainingMs` | what a seat must decide, which clock it runs on, and the clock's arithmetic (see "Decision clocks") |
| `defaultActionsFor(state, legal)` | what to submit when a decision's clock runs out |
| `skillsInPlay`, `skillOf` | which skills a seat holds right now |
| `cardsOverHandLimit`, `discardOwed` | Discard Phase accounting |
| `isChained`, `chainWaveOrder`, `isSeatDying` | queries the modes and cards share |

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
| Damage | `Damage` | source, target, amount, nature (`normal`, `fire` or `thunder`), and what caused it. A seat that is *chained* passes fire and thunder damage along the chain. |
| Turn, Phase | `Turn`, `Phase` | the turn owner, per-turn counters and flags; `GeneralSelection`, `Start`, `Judgment`, `Draw`, `Play`, `Discard`, `End`. A human's turn rests in `Start` while `Turn.startWindow` is open (see below). |
| Judgment | `Judgment`, `JudgmentView` | a judgment under way, and the public view of it while the game waits on its popup |
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
- `judgmentView` is public (the judged card is already face up), so redaction
  keeps it as it is;
- the log is otherwise public: events are written that way (a face-down card
  move carries no face, a revealed card is shown on purpose), and the only
  per-viewer change is the hidden-skill masking above.
  `redactEventsForSeat(state, events, viewer)` masks a slice of the log with
  the same set as `redactStateForSeat`.

Card ids are opaque: the deck names each card `card-<position>` after the
shuffle, and a reshuffle gives every card a fresh id, so an id never gives
away what a masked card is. `state.rng` holds the seed and is **not** removed
by `redactStateForSeat`; the server strips it from every view it sends.

**Once the game has a result** (`state.result` is set) nothing is left to
play for, so `redactStateForSeat` shows every seat's Generals, Kingdom and
allegiance, for the Game Over screen's victory columns. Only those are lifted:
the held forms (`forms.held`), the spare Generals, hands, the draw pile and
the skill masking in the log stay as they were.

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
| `judgmentView` with `settled: true` | with the `judgmentNotice` rule, the game waits for the judgment popup to be closed (`AcknowledgeJudgmentAction`) |
| none, in `Start` with `Turn.startWindow` | a human turn owner who still holds a hidden General may reveal it before the turn begins, then confirms (`ConfirmRevealsAction`) |
| none, in `Play` or `Discard` | the turn owner acts: play a card, use a skill, end the phase, discard |

`advanceToDecision` drains the queue until one of these appears (or the game
ends), then returns. The next `resolve` call carries the player's answer and
continues from the same state. That is why a saved game can resume at any
decision, and why a server can hold the state between requests.

`getActiveSeatId` says whose turn it is to decide, so callers never need to
interpret the pending fields themselves. While a settled judgment waits, the
active seat is the first living human seat in seat order, or the judged seat
when everyone is a bot. The application layer decides which seats a person is
playing, so it may submit the close on that seat's behalf (`by`).

### Decision clocks

How long a person has is a rule, so the engine owns it, in
[decisionClock.ts](../../projects/engine/src/lib/rules/decisionClock.ts):

| Kind | Seconds | Clock |
|---|---|---|
| `wuxie` (a Wuxie, or a Wuxie against one) | 15 | one per decision |
| `dying` (the dying round's Peach) | 20 | one per decision |
| `response` (any other response window) | 20 | one per decision |
| `ask` (a skill's use-it-or-not) | 15 | one per decision |
| `pick` (a card, seat, suit or recipient: Steal, Break, Harvest, Compete) | 30 | one per decision |
| `arrange` (Astrology) | 60 | one per decision |
| `start` (the Start window's reveal) | 20 | one per window |
| `discard` | 30 | one per decision |
| `selection` (General Selection) | 300 | one per seat for the whole pick |
| `play` | 180 | one for the whole Play Phase, paused while a response is under way |
| `judgmentChange` | 15 | a skill's decision (ask, then card pick) to change an unsettled judgment, one clock per ask |
| `notice` | 3 | a settled judgment popup, after its animation |

A clock can have a **lead-in**: `DecisionSpec.leadInMs` is the animation the
decision follows, and a *new* clock starts counting at `startsAt = now + leadInMs`
(`RunningClock.startsAt`; a clock resumed from paused has none). While it plays,
`clockRemainingMs` reports the full budget and `clockStartsInMs` says how long is
left. The lead-ins are `JUDGMENT_LEAD_IN_MS` (`head` 2100: source, rule, card
turning up; `replace` 1300: a replacement's swap; `tail` 2000: verdict and
consequence). A judgment-change decision waits `head` for its first ask
(`judgmentView.rounds === 1`) and `replace` for later ones; a settled judgment's
notice waits `tail`, plus `head` when no changer was ever asked. Only a caller
with a person at the table passes `{ leadIn: true }`; the default is no lead-in, so
headless games and bots never wait for an animation.

`describeDecision(state, seatId, legal, stepKey, { leadIn })` says what the seat must
decide and which clock it runs on; `switchClock` pauses the old clock and
starts or resumes the new one; `defaultActionsFor` gives the engine-legal
default at zero (Don't or Cancel for a judgment change, No Response, the first option, End Phase, the acknowledgement,
or confirming a Start window with nothing revealed). The engine never reads
the clock: the caller (the Angular timer, or the server's `GameRunner`) passes
the time in and runs the timers.

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
is the one implementation. It deals five Generals to each seat from the pool
of the chosen deck (the Default Generals, or the Alternate ones, never mixed),
builds and shuffles that deck's cards, and deals four cards. A table seats at
most ten, and fewer when the deck's pool is small (`kingdomWarMaxSeats`). Its `triggers` carry the mode's
rules:

- the Draw Phase draw and the Judgment Phase;
- HP at 0 or below starts the dying round (an HP drop reveals nothing; a death
  reveals both Generals, in the engine's elimination step);
- elimination discards everything the seat holds;
- the kill reward and penalty, and the reveal bonuses.

Optional rules chosen at game creation are stored in `state.rules`
(`GameRules`) so they survive saving and replay:

| Rule | Meaning |
|---|---|
| `firstRevealDraw` | with five or more seats, the first seat to reveal a General draws 2 cards |
| `judgmentNotice` | every judgment waits for the popup to be closed (or 3 s) before it is read. It changes the action sequence, so a stored game keeps the value it started with; the app and server turn it on for new games, and the simulator and most tests leave it off. |
| `deck` | the card distribution the draw pile is dealt from (a deck id). Absent means the Default deck. |

Because the options sit in the state, adding a rule never changes how an old
game replays.

## Errors

Invalid input throws. The application layer decides how to surface it:
`GameService` stores the message in `lastError` and leaves the state
unchanged, and the server answers the sender with an error and keeps its state
as it was (only an error in a move the server made itself, such as a bot's,
stops the game). Content bugs that can be detected up front, such as hand-coded
skills with no data file or a card with no printings, throw while the
registry or deck is built, so they fail at start-up rather than mid-game.

## Allegiance (Ambitionists)

A seat's `allegiance` (`'kingdom'` or `'ambitionist'`) is decided once, when it first shows a General
(a death reveal too). The resolver asks the mode (`GameModeDefinition.decideAllegiance`) in the same
step as the reveal, so no other effect or trigger can see a revealed seat that is still undecided.
Kingdom War decides it from the cap of half the table, rounded down, counting every seat that ever
held a slot of that Kingdom, dead ones included. See
`docs/superpowers/specs/2026-10-26-ambitionist-rules.md`.
