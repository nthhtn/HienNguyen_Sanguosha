# The Event Chain

How one player move becomes a series of state changes in the rules engine.
This doc is for anyone who changes the engine or adds content (cards, skills,
modes): every new mechanic plugs into this chain, so it is worth knowing
exactly how it runs.

The code lives in [`resolve.ts`](../../projects/engine/src/lib/pipeline/resolve.ts)
(the pipeline) and [`effects.ts`](../../projects/engine/src/lib/pipeline/effects.ts)
(the state changes). The worked example below is a real trace from the engine,
not an illustration.

## Four kinds of object

| Concept | What it is | Who creates it | Examples |
|---|---|---|---|
| **Action** | What a player wants to do. The only input from outside the engine. | The UI or a bot | `PlayCardAction`, `PassAction`, `EndPhaseAction` |
| **Effect** | An instruction to change the state. | Card definitions, triggers, the pipeline itself | `DamageEffect`, `MoveCardEffect`, `OpenResponseEffect` |
| **Event** | A record that something happened. Appended to `state.log`. | `applyEffect`, and the pipeline for phase/turn changes and card plays | `DamageDealtEvent`, `CardMovedEvent`, `CardPlayedEvent` |
| **Trigger** | A reaction declared by content, attached to an effect (before it applies) or an event (after it happens). | General skills, the game mode | Kingdom War's "at 0 HP, the seat is dying" |

Actions produce effects, effects produce events, and events wake triggers.
Triggers return more effects or actions, and the chain keeps going until
nothing new happens. Everything still to resolve waits in one queue, stored
in the state, so the game can stop for a player's answer at any point and
pick up exactly where it left off. The engine itself knows no card or skill
by name: it asks content what a card does (`CardDefinition.play`) and who
reacts (triggers).

## The pipeline

```
resolve(state, action)                      ← the only entry point
 ├─ resolveAction(action)                     validate, then queue what it leads to
 │    (a card play logs CardPlayedEvent, moves the card out of the hand,
 │     and queues: the move, CardPlayedEvent's trigger follow-ups, play()'s effects)
 └─ advanceToDecision(state)
      loop:
        drain the queue, front first:
          an Effect → before:<EffectKind> triggers → applyEffect → events logged
                      → each event's after-trigger follow-ups go to the FRONT
          an Action → resolveAction (queues more)
          stop when a response or choice is pending, the queue is empty, or the game is over
        response pending / player must decide / game over? stop
        otherwise enter the next phase (logs PhaseChangedEvent, queues its triggers)
```

### Stage by stage

**`resolve`** is the one function the application layer calls. It refuses
any action once the game has a result, lets `resolveAction` queue what the
action leads to, then settles the game with `advanceToDecision`.

**`resolveAction`** validates first: the right seat, the card in hand, the
targets among the engine's own legal target lists
([`legality.ts`](../../projects/engine/src/lib/rules/legality.ts)). While a
response is pending, only that window's allowed actions are accepted. Then it
asks content what the action means, and queues it; it resolves nothing
itself. For a card play it logs a `CardPlayedEvent`, counts the play, and puts
at the front of the queue: the move of the used card to the discard pile
(so it can't be reused mid-resolution; Equipment places itself instead), the
play's after-trigger follow-ups, then the effects `CardDefinition.play()`
returned.

**The resolution queue** is plain data in `GameState.resolutionQueue`: effects
and actions, front first. It is absent, never `[]`, when empty. Its rules:

- **Trigger follow-ups go to the front**, ahead of the effect's siblings, so
  a reaction always finishes before the next sibling starts.
- **A pending response pauses draining.** Whatever is still queued waits,
  through any number of calls, and even through a save and reload.
- **The game ending drops what's left.** The mode's win check runs after
  every item; once there is a result, the rest of the queue is discarded.

**Before-triggers** (`before:DamageEffect`, …) see an effect before it
applies. Each returns the replacement effect, or nothing to cancel it. A
damage-reduction skill works this way.

**`applyEffect`** is the only place state changes. It is a pure function: old
state in, new state and events out. Each event is appended to `state.log`.
The Tool lifecycle's effects (below) only reshape the queue or open a window,
so they are applied beside it, in
[`toolLifecycle.ts`](../../projects/engine/src/lib/pipeline/toolLifecycle.ts).

**After-triggers** (`after:DamageDealtEvent`, …) are gathered from the game
mode and from every living seat's generals. Each one whose `condition` holds
returns follow-ups, which go to the front of the queue.

**`advanceToDecision`** drains the queue, then walks through phases that need
no input (Start → Judgment → Draw → Play), each a `PhaseChangedEvent` whose
after-triggers are queued and drained in turn. Kingdom War's Draw phase, for
instance, is an `after:PhaseChangedEvent` trigger that deals 2 cards. The
loop stops when a player must decide (their Play phase, or a Discard over the
hand limit), when a response is pending, or when the game is over.

### Safety rails

- **Step budget.** One `resolve` call may resolve at most
  `MAX_RESOLUTION_STEPS` (10,000) queue items. Beyond that the engine throws,
  naming the item, so a content trigger loop fails loudly instead of running
  forever.
- **Phase-step limit.** `advanceToDecision` throws if phases keep advancing
  without reaching a decision (6 steps per seat, plus 6).
- **Win check.** The mode's `checkWinCondition` runs before draining and
  after every queue item.

## Prime example: a lethal Sha

Three seats. Seat A plays Sha on Seat B, who is at 1 HP with both generals
hidden, and no one holds a Shan or a Peach. This is the real event log the
engine produces, across three calls.

### Call 1: `resolve(PlayCardAction: A plays Sha on B)`

1. `resolveAction` checks the play is legal, then logs the play:
   **`CardPlayedEvent`** (A used Sha ♠7 on B).
2. The used Sha goes to the discard pile, right after the play:
   **`CardMovedEvent`** (sha-1, seat-a:hand → discardPile).
3. The play is counted toward the turn's Sha limit (`turn.cardPlays.sha`).
4. `sha.play()` returned one effect:
   `OpenResponseEffect`: B must play a Shan, otherwise `DamageEffect` A→B, 1.
   Applying it stores a `PendingResponse` in the state. It logs no event.
5. The queue stops at the pending response, and so does `advanceToDecision`.

The call returns. The UI shows "Waiting on Seat B", and B is offered
`PassAction` (and a `RespondAction` per Shan in hand, if they had one).

### Call 2: `resolve(PassAction by B)`

1. `resolveAction` clears the pending response and queues the effect it was
   holding back: the `DamageEffect`.
2. Before-triggers on `DamageEffect` run. None apply here.
3. `applyEffect`: B's HP goes 1 → 0.
   **`DamageDealtEvent`** (A→B, 1 normal, caused by sha-1).
4. Kingdom War's three after-triggers on `DamageDealtEvent` are gathered,
   all checked against the state right after the damage:
   their follow-ups go to the front of the queue, in this order:
   - HP ≤ half and main general hidden → `RevealGeneralAction(main)`
     → **`GeneralRevealedEvent`** (B, main)
   - HP ≤ 0 and deputy general hidden → `RevealGeneralAction(deputy)`
     → **`GeneralRevealedEvent`** (B, deputy)
   - HP ≤ 0 → `DyingEffect` (the rescue round, starting at the turn owner)
     → **`SeatDyingEvent`** (B). The round looks for the next seat
     to ask: A holds no Peach and is skipped; B, the dying seat, is always
     asked. A new window opens: B may play a Peach.
5. `advanceToDecision` sees the pending window and stops.

### Call 3: `resolve(PassAction by B)`: No Response to the rescue

1. The rescue window's held-back effect is the rest of the round. No one is
   left to ask, so B is eliminated: **`SeatEliminatedEvent`** (B).
2. `advanceToDecision`: the win check runs. Two kingdoms are still standing,
   so there is no result. It is still A's Play phase, so it stops and waits
   for A.

Had B (or anyone) played a Peach instead, the window's `onAnswer` would heal B
and ask again, and B would be saved (`SeatSavedEvent`) once above 0 HP.

### The log after all three calls

```
CardPlayedEvent       seat-a used sha-1 (♠7) on seat-b
CardMovedEvent        sha-1  seat-a:hand → discardPile
DamageDealtEvent      seat-a → seat-b, 1 normal, cause sha-1
GeneralRevealedEvent  seat-b main
GeneralRevealedEvent  seat-b deputy
SeatDyingEvent        seat-b
SeatEliminatedEvent   seat-b
```

The log is the public record of the game. The app's Action History and
Discard History are views built from it, never separate records.

## Pausing for a response

A card can't stop in the middle of a function to wait for a player. Instead
it emits `OpenResponseEffect`, which stores a `PendingResponse`: who must
answer, with which cards, and the effect to apply if they don't
(`context.effect`). The queue stops draining, `resolve` returns, and the game
resumes with the next action, with everything still queued behind the window:

- **`PassAction`** queues the held-back effect (the Sha's damage, above).
- **`RespondAction`** plays the answering card. By default the held-back
  effect is then dropped: a Shan cancels a Sha.
- If the window records the card that opened it (`PendingResponse.sourceCard`),
  that card's `onResponse` decides what the answer leads to instead.
- A window the engine opens itself can carry `onAnswer`: effects queued
  after the answering card's own. The dying round uses it to heal the dying seat
  and ask again.

### Example: Duel

Duel uses `onResponse` to alternate. A plays Duel on B, and once its Wuxie
check (below) has passed:

1. Duel opens a window: B plays a Sha, or takes 1 damage from A.
2. B answers with a Sha. Duel's `onResponse` opens the next window, reversed:
   A plays a Sha, or takes 1 damage from B.
3. This repeats until someone passes. Their window's held-back damage applies.

No Duel-specific code is in the engine; the alternation lives entirely in
[`duel.ts`](../../projects/content/src/lib/cards/duel.ts).

## The Tool lifecycle

Every Tool resolves the same way on each of its targets, and the engine runs
it without naming a card:

1. The Tool's `play()` returns one **`ToolOnTargetEffect`** per target, in
   order (content's `toolOnTargets` builds them). Each carries the Tool as a
   `UsedCard` and the counter card ids content supplies (`['wuxie']`). A
   target eliminated before its turn comes is skipped.
2. Each `ToolOnTargetEffect` becomes a **`WuxieCheckEffect`** followed by a
   **`ToolRuleEffect`**, at the front of the queue.
3. The check asks the living seats in seat order **from the Tool's user**,
   but only those holding a counter card at that moment. Passing asks the
   next holder; nobody left means no cancel.
4. A seat that plays a Wuxie queues, after it, a counter-check (from the seat
   after it; it is never asked about its own card) and a **`SkipNextEffect`**.
   If nobody counters, the skip removes what the Wuxie guards: the
   `ToolRuleEffect`. A Wuxie on that Wuxie queues its own check and skip, and
   its skip removes the first Wuxie's skip, so the Tool goes ahead. Any length
   of Wuxie-on-Wuxie chain falls out of queue order this way.
5. **`ToolRuleEffect`** calls the Tool's `CardDefinition.onTarget`, whose
   effects go to the front of the queue. That is where a Tool's own rule
   lives.

### Example: Barbarians

A uses Barbarians at a four-seat table. Only C holds a Wuxie, and B holds a
Sha.

1. Barbarians' `play()` queues three `ToolOnTargetEffect`s: B, C, D.
2. B's check: C is the only holder and passes. `onTarget` opens a window:
   B plays a Sha or takes 1 damage from A. B plays the Sha.
3. C's check: C plays its Wuxie. The counter-check (D, A, B) finds no holder,
   so the skip removes the `ToolRuleEffect` for C. C is spared.
4. D's check finds no holder (C's Wuxie is spent). D's window opens; D passes
   and takes 1 damage.

Every step that waits for a player is a window, and everything after it
stays queued until the answer comes.

## Choices

Some Tools ask a seat to pick one of several things: Steal and Break pick one
of a seat's cards, and Harvest picks one of the turned-up cards. A pick is a
**pending choice**, and the queue waits for it the way it waits for a response:

- `OpenChoiceEffect` stores a `PendingChoice` in `state.pendingChoice`: who
  picks, why (its `reason`), whether the card is taken or discarded (`verb`),
  and the options. Each option says what it shows and which effects it queues.
- While a choice is pending, the chooser is the active seat and its only legal
  actions are one `ChooseOptionAction` per option.
- `ChooseOptionAction` logs `ChoiceMadeEvent` and queues the option's effects
  at the front. The queue then carries on.
- **A hand is never shown.** It is a single `hidden-hand` option with only its
  size. Its effect, `MoveRandomCardEffect`, picks a card with the seeded RNG.
- **Harvest's cards** are turned up into the face-up `processing` zone
  (`RevealToProcessingEffect`). Whatever no seat took is discarded at the end
  (`DiscardZoneEffect`).

Redaction masks any card a viewer can't see wherever it appears in the queue
or a pending decision, so a choice can't leak a hand card.

## Judgments

A **delayed Tool** (Capture, Lightning, Starvation) doesn't take effect when it
is played. Its `play()` puts it face up in a seat's Judgment slot
(`Seat.judgment`; `CardDefinition.delayed` stops `PlayCardAction` from
discarding it).

In Kingdom War, entering the Judgment Phase queues two steps for each card in
the turn owner's Judgment slot, last in, first out:

1. `ToolOnTargetEffect` on the owner. It runs the usual Wuxie check, asked from
   the owner. If nobody cancels, the Tool's `onTarget` queues a `JudgeEffect`.
2. `DelayedCleanupEffect`. It always runs, cancelled or not. It runs the card's
   `onCleanup` (Lightning moves on). Without one, it discards the card if it is
   still in the judgment area.

`JudgeEffect` turns up the draw pile's top card into `processing` and logs
`JudgmentEvent`. It then queues the Tool's `onJudged` reading of that card,
followed by the judged card's move to the discard pile. With no card left
anywhere, nothing is judged.

A reading usually sets a **turn flag** (`SetTurnFlagEffect`). `advancePhaseOrTurn`
passes over any phase whose skip flag (`skipFlagOf(phase)`, e.g. `skipPlay`) is
set, and `PhaseSkippedEvent` records it. Flags end with the turn.

## Plugging into the chain

| To add… | Write… | Example |
|---|---|---|
| A card's effect | `CardDefinition.play()` returning effects | Peach returns `HealEffect` |
| A card that asks someone to answer | `OpenResponseEffect` from `play()` | Sha asks for a Shan |
| A Tool's rule on each target | `play()` returning `ToolOnTargetEffect`s (content's `toolOnTargets`), and `CardDefinition.onTarget` | Barbarians opens a Sha window on each target |
| A pick among cards or options | `OpenChoiceEffect` with options whose `effects` say what each pick does | Steal offers the target's hand (face down) and each worn card |
| What answering does, beyond cancelling | `CardDefinition.onResponse()` and `sourceCard` on the window | Duel turns back on the other player |
| A reaction to something that happened | An `after:<EventKind>` trigger on a skill or mode | Kingdom War's dying round at 0 HP |
| Effects that follow an answer to an engine-opened window | `onAnswer` on the `PendingResponse` | The dying round's Peach heals, then asks again |
| A change to something about to happen | A `before:<EffectKind>` trigger returning the replacement effect, or nothing | A skill that reduces damage |

A new card or skill should need only its own definition. If a change seems to
need a branch for one card inside the pipeline, look for the hook above that
fits instead.

## Things to watch for

1. **After-trigger conditions are checked together, once.** All triggers
   for an event are gathered against the state right after that event, then
   their follow-ups are queued in order. In the example, the deputy reveal and
   the dying round were both decided before the main reveal applied. That is
   right for today's triggers, but a trigger that depends on an earlier
   trigger's outcome for the same event won't see it.
2. **Trigger conditions are checked when gathered.** A follow-up waits in the
   queue; its trigger's condition was checked against the state at the moment
   the event happened, not when the follow-up runs.
3. **Before-triggers only rewrite the effect.** They can't change the state
   themselves. Each one sees the state as it was when the effect began
   resolving, along with the effect as rewritten by the triggers before it.
