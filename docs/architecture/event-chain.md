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
nothing new happens. The engine itself knows no card or skill by name: it
asks content what a card does (`CardDefinition.play`) and who reacts
(triggers).

## The pipeline

```
resolve(state, action)                      ← the only entry point
 ├─ resolveAction(action, depth 0)            validate, then turn the action into effects
 │    └─ for each effect:
 │         resolveEffectWithTriggers(effect)
 │           1. before:<EffectKind> triggers  → may rewrite or cancel the effect
 │           2. applyEffect(state, effect)    → new state + events (logged)
 │           3. for each event:
 │                runAfterTriggers(event)
 │                  └─ each matching trigger returns follow-ups
 │                       ├─ an Effect → resolveEffectWithTriggers (depth + 1)  ┐ the chain
 │                       └─ an Action → resolveAction (depth + 1)              ┘ recurses
 └─ advanceToDecision(state)
      loop: win check → response pending? stop → a player must decide? stop
            → otherwise enter the next phase (logs PhaseChangedEvent, runs its after-triggers)
```

### Stage by stage

**`resolve`** is the one function the application layer calls. It refuses
any action once the game has a result, runs the action's whole chain, then
settles the game with `advanceToDecision`.

**`resolveAction`** validates first: the right seat, the card in hand, the
targets among the engine's own legal target lists
([`legality.ts`](../../projects/engine/src/lib/rules/legality.ts)). While a
response is pending, only that window's allowed actions are accepted. Then it
asks content what the action means. For a card play it logs a
`CardPlayedEvent`, calls `CardDefinition.play()` to get the card's effects,
resolves them, and moves the used card to the discard pile.

**Before-triggers** (`before:DamageEffect`, …) see an effect before it
applies. Each returns the replacement effect, or nothing to cancel it. A
damage-reduction skill works this way.

**`applyEffect`** is the only place state changes. It is a pure function: old
state in, new state and events out. Each event is appended to `state.log`.

**After-triggers** (`after:DamageDealtEvent`, …) are gathered from the game
mode and from every living seat's generals. Each one whose `condition` holds
returns follow-ups, resolved through the same functions one level deeper.

**`advanceToDecision`** runs once the action's chain has finished. It walks
through phases that need no input (Start → Judgment → Draw → Play), each a
`PhaseChangedEvent` with its own after-triggers. Kingdom War's Draw phase,
for instance, is an `after:PhaseChangedEvent` trigger that deals 2 cards. The
loop stops when a player must decide (their Play phase, or a Discard over the
hand limit), when a response is pending, or when the game is over.

### Safety rails

- **Depth limit.** Every follow-up from a trigger runs one level deeper.
  Beyond `MAX_TRIGGER_DEPTH` (64) the engine throws, naming the effect or
  action, so a content trigger loop fails loudly instead of overflowing the
  stack.
- **Phase-step limit.** `advanceToDecision` throws if phases keep advancing
  without reaching a decision (6 steps per seat, plus 6).
- **Win check.** The mode's `checkWinCondition` runs before the first phase
  step and after every one.

## Prime example: a lethal Sha

Three seats. Seat A plays Sha on Seat B, who is at 1 HP with both generals
hidden, and no one holds a Shan or a Peach. This is the real event log the
engine produces, across three calls.

### Call 1: `resolve(PlayCardAction: A plays Sha on B)`

1. `resolveAction` checks the play is legal, then logs the play:
   **`CardPlayedEvent`** (A used Sha ♠7 on B).
2. `sha.play()` returns one effect:
   `OpenResponseEffect`: B must play a Shan, otherwise `DamageEffect` A→B, 1.
   Applying it stores a `PendingResponse` in the state. It logs no event.
3. The used Sha goes to the discard pile:
   **`CardMovedEvent`** (sha-1, seat-a:hand → discardPile).
4. The play is counted toward the turn's Sha limit (`turn.cardPlays.sha`).
5. `advanceToDecision` sees the pending response and stops.

The call returns. The UI shows "Waiting on Seat B", and B is offered
`PassAction` (and a `RespondAction` per Shan in hand, if they had one).

### Call 2: `resolve(PassAction by B)`

1. `resolveAction` clears the pending response and resolves the effect it was
   holding back: the `DamageEffect`.
2. Before-triggers on `DamageEffect` run. None apply here.
3. `applyEffect`: B's HP goes 1 → 0.
   **`DamageDealtEvent`** (A→B, 1 normal, caused by sha-1).
4. Kingdom War's three after-triggers on `DamageDealtEvent` are gathered,
   all checked against the state right after the damage:
   - HP ≤ half and main general hidden → `RevealGeneralAction(main)`
     → **`GeneralRevealedEvent`** (B, main), at depth 1
   - HP ≤ 0 and deputy general hidden → `RevealGeneralAction(deputy)`
     → **`GeneralRevealedEvent`** (B, deputy), at depth 1
   - HP ≤ 0 → `DyingEffect` (the rescue round, starting at the turn owner)
     → **`SeatDyingEvent`** (B), at depth 1. The round looks for the next seat
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
(`context.effect`). `resolve` then returns, and the game resumes with the
next action:

- **`PassAction`** applies the held-back effect (the Sha's damage, above).
- **`RespondAction`** plays the answering card. By default the held-back
  effect is then dropped: a Shan cancels a Sha.
- If the window records the card that opened it (`PendingResponse.sourceCard`),
  that card's `onResponse` decides what the answer leads to instead.
- A window the engine opens itself can carry `onAnswer`: effects resolved
  after the answering card. The dying round uses it to heal the dying seat
  and ask again.

### Example: Duel

Duel uses `onResponse` to alternate. A plays Duel on B:

1. Duel opens a window: B plays a Sha (or Wuxie Kongjie), or takes 1 damage
   from A.
2. B answers with a Sha. Duel's `onResponse` opens the next window, reversed:
   A plays a Sha, or takes 1 damage from B.
3. This repeats until someone passes. Their window's held-back damage applies.

No Duel-specific code is in the engine; the alternation lives entirely in
[`duel.ts`](../../projects/content/src/lib/cards/duel.ts).

## Plugging into the chain

| To add… | Write… | Example |
|---|---|---|
| A card's effect | `CardDefinition.play()` returning effects | Peach returns `HealEffect` |
| A card that asks someone to answer | `OpenResponseEffect` from `play()` | Sha asks for a Shan |
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
   their follow-ups run in order. In the example, the deputy reveal and the
   dying round were both decided before the main reveal applied. That is
   right for today's triggers, but a trigger that depends on an earlier
   trigger's outcome for the same event won't see it.
2. **Before-triggers only rewrite the effect.** They can't change the state
   themselves. Each one sees the state as it was when the effect began
   resolving, along with the effect as rewritten by the triggers before it.
3. **A response window isn't a full suspension.** If `play()` returns
   `[OpenResponseEffect, X]`, effect X resolves straight away, before anyone
   answers. Today's cards only ever return the window as their last effect.
   Cards that ask several seats in turn (Barbarians, Hail of Arrows) need a
   resumable resolution queue; that is planned as sub-project B (see the
   [cards spec](../superpowers/specs/2026-10-05-cards-a-equipment-and-simple-cards-design.md)).
