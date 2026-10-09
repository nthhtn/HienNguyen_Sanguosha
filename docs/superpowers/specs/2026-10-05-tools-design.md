# Tools — Every Tool Card Playable — Design Spec

Status: Draft for review
Date: 2026-10-05

> **Amended (2026-10-05):** the [roadmap spec](2026-10-05-all-cards-and-skills-roadmap-design.md) makes this spec stages 1–3, adds **Starvation** to stage 3, makes Lightning's damage plain (not thunder), and has the Tool lifecycle carry a `UsedCard` ([Sha-Equipment spec](2026-10-05-sha-equipment-design.md)) from stage 1. The [General Skills spec](2026-10-05-general-skills-design.md) later splits `JudgeEffect` into three steps.

## Purpose

Make every Tool card playable with its real rules. Today Duel and
Wuxie Kongjie are in the game. Wuxie only answers a Duel, and it can't be
cancelled in turn. The other ten Tools are data only.

This spec reorders the card roadmap in the
[cards A spec](2026-10-05-cards-a-equipment-and-simple-cards-design.md). The
Tools now come first, and they absorb that spec's sub-projects B (resolution
queue, multi-target tools, Wuxie), C (choices) and D (judgments).
Sub-project A (equipment abilities) waits. It will reuse the turn flags built
here.

Decisions settled during brainstorming:

- **Staging:** one spec, built in three stages. Each stage is playable on its
  own and adds its Tools to the deck at their printed counts.
  1. The resolution queue and the full Wuxie check. Draw Two, Barbarians,
     Hail of Arrows, Peach Garden. Duel moves onto the common lifecycle.
  2. Choices: Steal, Break, Harvest, Coerce.
  3. Judgments: Capture, Lightning.
- **Wuxie:** offered only to seats holding a Wuxie Kongjie, in seat order
  from the Tool's user. A Wuxie can be cancelled by another.
- **Engine approach:** a resolution queue in the game state. Two rejected
  alternatives: continuations on response windows (they nest deeply with
  several targets and Wuxie chains), and per-card state machines (each Tool
  would duplicate the same loop and its own Wuxie handling).

## Rule text

"Seat order" is turn order. Unless stated otherwise it starts from the seat
after the Tool's user. "Living" excludes eliminated seats.

### Common to every Tool

- A Tool is played in its user's Play phase. Once played it goes straight to
  the discard pile, except a delayed Tool, which goes to a judgment area.
- **Wuxie check.** Before a Tool takes effect on each of its targets, the
  living seats are walked in seat order, **starting with the Tool's user**.
  Each seat holding a Wuxie Kongjie at its moment is asked to play one or
  pass.
  - If everyone asked passes, the Tool takes effect on that target.
  - If someone plays a Wuxie Kongjie, the Tool is cancelled **for that
    target only**. The same question then goes round again about that Wuxie
    Kongjie, starting with the seat after the one that played it. If that Wuxie is itself
    cancelled, the Tool takes effect after all, and so on.
- A delayed Tool's Wuxie check happens when it is judged, not when it is
  placed.
- Wuxie Kongjie is never played on its own. It is played only during a Wuxie
  check.

### Stage 1

- **Draw Two.** No target (the user). The user draws 2 cards.
- **Barbarians.** Targets every other living seat, in seat order. Each target
  in turn must play a Sha or take 1 damage from the user.
- **Hail of Arrows.** As Barbarians, but each target must play a Shan.
- **Peach Garden.** Targets every living seat that is below its max health
  when the card is played, in seat order **starting with the user**. Each
  recovers 1 health, up to its max. Seats at full health are not targets, so
  they get no Wuxie check.
- **Duel** (unchanged rules, already built). Starting with the target, the
  two seats take turns playing a Sha. The first who doesn't takes 1 damage
  from the other. The target's Wuxie Kongjie moves out of Duel's own window
  into the common Wuxie check, so any holder may cancel a Duel.

### Stage 2

- **Steal.** Targets another living seat at distance 1 (`seatDistance`, so
  horses count) that holds at least one card in hand, equipment or judgment
  area. The user chooses one of the target's cards and puts it in their own
  hand. Hand cards are chosen face-down. Equipment and judgment cards are
  chosen by face.
- **Break.** Targets any other living seat holding at least one card. The
  user chooses one of its cards the same way. That card goes to the discard
  pile.
- **Harvest.** Cards are turned up from the draw pile, one per living seat.
  Starting with the user, each living seat in seat order takes one of the
  face-up cards into its hand. Each seat's pick has its own Wuxie check, and
  a seat whose pick is cancelled takes nothing. Cards left over go to the
  discard pile.
- **Coerce.** Targets another living seat that wears a weapon (the holder)
  and a victim, which is a living seat other than the holder within the
  holder's attack range. The holder must play a Sha at the victim. That Sha
  is answered like any Sha (Shan, or 1 damage from the holder). If the holder
  doesn't play one, the holder's weapon goes into the user's hand. The
  Coerced Sha doesn't count toward the holder's Sha limit.

### Stage 3

- **Judgment.** The top card of the draw pile is turned face-up, read, and
  then put in the discard pile.
- **Capture** (delayed). Placed in another living seat's judgment area. A
  seat can't hold two Captures. In that seat's next Judgment phase it is
  judged. Anything but a heart means the seat skips that turn's Play phase.
  Capture is then discarded. If a Wuxie Kongjie cancels it, it is discarded
  without a judgment.
- **Lightning** (delayed). Placed in the user's own judgment area. A seat
  can't hold two Lightnings. In the holder's next Judgment phase it is
  judged.
  - A **spade from 2 to 9** deals 3 thunder damage to the holder, with no
    source. Lightning is then discarded.
  - Anything else moves Lightning to the next living seat in seat order that
    doesn't already hold a Lightning. It goes face-up into their judgment
    area. If no such seat exists, it stays.
  - If a Wuxie Kongjie cancels it, there is no judgment, and it moves on as
    above.
- **Order.** A seat's delayed Tools are judged one at a time, newest first.

## Engine design

### The resolution queue

```ts
// GameState
resolutionQueue: Array<Effect | Action>; // empty at rest; plain serialisable data
```

- **Playing a card.** `PlayCardAction` logs `CardPlayedEvent`, then moves the
  card out of the hand. A normal card goes to the discard pile. Equipment and
  delayed Tools go to the zone their own `play()` names. Then it puts the
  results of `play()` at the **front** of the queue, in order, and drains.
  - This changes event order: the used card's `CardMovedEvent` now comes
    right after `CardPlayedEvent`, before its effects. The card can't be
    reused mid-resolution.
- **Draining.** Repeatedly take the front item and resolve it: an `Action`
  through `resolveAction`, an `Effect` through `resolveEffectWithTriggers`.
  Draining stops when a decision is pending (`pendingResponse` or
  `pendingChoice`) or the queue is empty.
  - Answering a decision (`PassAction`, `RespondAction`, `ChooseOptionAction`)
    puts its outcome at the front of the queue and drains again.
- **Trigger follow-ups.** After-trigger follow-ups go to the **front** of the
  queue, in order. This keeps today's ordering, where reactions resolve
  before the next sibling effect, and lets a reaction pause too.
- **Before-triggers** are unchanged: they rewrite or cancel an effect just
  before it applies.
- **`advanceToDecision`** drains first. It moves to the next phase only when
  the queue is empty and nothing is pending.
- **Loop guard.** `MAX_TRIGGER_DEPTH` is replaced by a step budget per
  `resolve` call (`MAX_RESOLUTION_STEPS`, 10,000). Exceeding it throws, naming
  the item being resolved.

### The Tool lifecycle

New engine effects (no card names in the engine):

```ts
| { kind: 'ToolOnTargetEffect'; tool: CardInstance; userSeatId: string; target: Target; extra?: Target[] }
| { kind: 'WuxieCheckEffect'; subject: WuxieSubject; order: string[] } // order: seats still to ask
| { kind: 'ToolRuleEffect'; tool: CardInstance; userSeatId: string; target: Target; extra?: Target[] }
| { kind: 'SkipNextEffect' }
```

- A Tool's `play()` returns one `ToolOnTargetEffect` per target, in rule
  order. `extra` carries additional chosen targets (Coerce's victim).
- **`ToolOnTargetEffect`** puts two steps at the queue front:
  `WuxieCheckEffect` (subject: this Tool on this target, order: living seats
  in seat order from the user), then `ToolRuleEffect`.
- **`ToolRuleEffect`** calls the card's new hook and puts its results at the
  front:

  ```ts
  // CardDefinition
  onTarget?(state: GameState, ctx: ToolTargetContext): unknown[];
  ```

- **`WuxieCheckEffect`** skips forward to the first seat in `order` that
  holds a Wuxie Kongjie, checked at that moment. If there is none, the check
  ends and the Tool goes ahead. Otherwise it opens a window for that seat:
  - `allowedCardIds: ['wuxie']`
  - **Pass:** `context.effect` = `WuxieCheckEffect` with the rest of `order`.
  - **Answer:** `onAnswer` = `[WuxieCheckEffect(subject: that Wuxie, order
    from the seat after its player), SkipNextEffect]`.
- **`SkipNextEffect`** removes the next queued item. After a Wuxie, that item
  is the guarded `ToolRuleEffect`. If the Wuxie is itself countered, the
  counter's `SkipNextEffect` removes the first `SkipNextEffect` instead, and
  the Tool goes ahead. Wuxie-on-Wuxie falls out of queue order.

### Response windows

```ts
// PendingResponse (additions)
onAnswer?: Effect[];         // queued when the seat answers (engine-owned windows)
reason?: DecisionReason;     // what is being asked, for display

type DecisionReason =
  | { kind: 'wuxie'; tool: CardInstance; toolUserSeatId: string; target: Target }
  | { kind: 'counter-wuxie'; wuxie: CardInstance; wuxieSeatId: string }
  | { kind: 'card-effect'; card: CardInstance; userSeatId: string } // "play a Sha or take 1 damage"
  | { kind: 'choice'; card: CardInstance; userSeatId: string };
```

- The existing `sourceCard` and `onResponse` (Duel's alternation) stay.
- When both `onAnswer` and `sourceCard` are set, `onAnswer` is queued first.

### Choices (stage 2)

```ts
// GameState
pendingChoice: PendingChoice | null;

interface PendingChoice {
  id: string;
  seatId: string;
  reason: DecisionReason;
  options: ChoiceOption[];
}

interface ChoiceOption {
  id: string;
  shows: { kind: 'card'; card: CardInstance } | { kind: 'hidden-hand'; seatId: string; count: number };
  effects: Effect[]; // queued at the front when picked
}

// Action
| { kind: 'ChooseOptionAction'; seatId: string; choiceId: string; optionId: string }
```

- A pending choice pauses the queue like a response window. Active seat,
  legal actions and redaction treat it the same way. Legal actions offer one
  `ChooseOptionAction` per option.
- **Hidden hands.** A seat's hand is a single option, shown as
  `hidden-hand`. Its effect is `MoveRandomCardEffect { fromZoneId, toZoneId }`,
  which picks with the seeded RNG. The chooser never sees the hand's cards.
- **`processing` zone.** A new face-up `CardZone` kind holds Harvest's
  turned-up cards and judged cards while they resolve.
- **Harvest.** `play()` queues `RevealToProcessingEffect(count = living
  seats)`, one `ToolOnTargetEffect` per seat (starting with the user), and a
  final `DiscardZoneEffect(processing)`. Each seat's `onTarget` opens a choice
  over the cards still in `processing`.
- **Coerce.** `legalPlayTargets` returns every `[holder, victim]` pair. Its
  `onTarget` opens a window for the holder (`allowedCardIds: ['sha']`):
  - **Pass:** move the holder's weapon to the user's hand.
  - **Answer:** `onAnswer` = the normal Sha window on the victim, with the
    holder as the source.

### Judgments (stage 3)

- **Judgment zone.** `Seat.judgment: { zoneId }` and zone
  `seat-x:judgment`. The zone kind `judgment` already exists. Kingdom War
  setup creates one per seat.
- **Delayed Tools.** `play()` moves the card into the target's judgment zone.
  The card's `legalPlayTargets` enforce "no two of the same".
- **Judgment phase.** A Kingdom War trigger on entering the phase queues, for
  each card in the owner's judgment zone, newest first:
  `ToolOnTargetEffect(target: owner)` then `DelayedCleanupEffect(card)`.
  - The Wuxie check guards only the rule. The cleanup always runs.
- **`JudgeEffect`.** Moves the draw pile's top card to `processing` and logs
  `JudgmentEvent { seatId, card, forCardInstanceId }`. It then puts the delayed
  Tool's new hook's results at the front, followed by a move of the judged
  card to the discard pile:

  ```ts
  onJudged?(state: GameState, ctx: JudgedContext): unknown[];
  ```

- **Turn flags** (shared with the cards A spec). `Turn.flags?:
  Record<string, boolean>` and `SetTurnFlagEffect`. `advancePhaseOrTurn`
  skips the Play phase when `flags.skipPlay` is set.
- **Capture.** `onTarget` → `JudgeEffect`. `onJudged` sets `skipPlay` unless
  the judged card is a heart. Cleanup discards Capture.
- **Lightning.** `onTarget` → `JudgeEffect`. On a spade 2–9, `onJudged`
  returns `DamageEffect(3 thunder, no source)` and discards Lightning.
  Cleanup moves Lightning, if it is still in the judgment zone, to the next
  eligible seat's judgment zone.

## Bots (rule-based)

- **Wuxie:** play one only when a harmful Tool targets the bot itself
  (Barbarians, Hail of Arrows, Duel, Steal, Break, Capture, Lightning).
  Otherwise pass. Never counter a Wuxie.
- **Using Tools**, in the existing Play-phase priority list:
  - Draw Two: always.
  - Barbarians and Hail of Arrows: when the other living seats include at
    least as many non-allies as allies.
  - Peach Garden: when the bot is hurt.
  - Steal and Break: on the lowest-HP non-ally, preferring one that wears
    equipment.
  - Capture: on the highest-HP non-ally.
  - Lightning: when the bot's HP is at least 3.
  - Coerce: when a non-ally's weapon can reach another non-ally.
- **Choices:** take a weapon, then armour, then a mount, then the hand. For
  Harvest, take the face-up card with the highest keep rank.
- **Answers:** unchanged. Any offered answer is played.

## UI

All options come from the engine. The UI decides nothing about legality.

- **Response window** (built 2026-10-05, ahead of stage 1). Opens by itself
  whenever the viewer owes an answer and can't be dismissed. It shows what
  caused the window, the latest answer if any, and a prompt. Below that is a
  pick-one list: the hand cards the engine offers, the general skills that can
  answer (empty until skills can), and No Response with what it costs. The
  primary button reads No Response until a card or skill is picked. Stage 1
  makes the description use the window's `reason`, for example "Seat 2's
  Steal on you: play Wuxie Kongjie to cancel it?". The table centre's
  "Waiting on X" adds the short reason.
- **Choice window.** For Steal, Break and Harvest, a window like the Discard
  window lists the options as cards, with a hand shown as a face-down card
  with its count. One primary button: Take (Steal, Harvest) or Discard
  (Break). It can't be dismissed.
- **Coerce.** Playing it opens a two-step target picker (holder, then
  victim), filtered to the engine's legal pairs.
- **Judgment area.** Each seat tile shows its judgment cards, small and
  face-up, under the equipment slots.
- **Harvest.** The turned-up cards show in the table centre while it
  resolves.
- **Action History.** New lines for: Wuxie played ("Hing cancelled Seat 1's
  Barbarians on Hing"), a card taken or broken ("Seat 2 took a hand card from
  Hing", "Seat 2 broke Hing's Silver Lion"), Harvest picks, judgments ("Hing's
  Lightning judgment: 5 ♠ — 3 thunder damage"), and Lightning moving on.

## Testing

- **Engine:**
  - The queue drains, pauses and resumes. Trigger follow-ups run before the
    remaining siblings. The step budget throws.
  - Wuxie check: holders only, seat order from the user, cancel for one
    target only, Wuxie-on-Wuxie parity via `SkipNextEffect`.
  - Choices: legal options, the hidden-hand option, seeded randomness.
  - Judgments: the judgment zone, `JudgeEffect`, `skipPlay`.
  - Serialisation: a game paused mid-Barbarians survives a JSON round-trip and
    resumes identically.
- **Content:** one test per rule bullet above, per stage.
- **App:** the reason prompt and Pass, the choice window, the Coerce
  two-step picker, the judgment row, and the new Action History lines.
- **Bots and simulator:** after each stage, seeded batches at 2, 5 and 10
  seats run to completion. New invariants: cards are conserved across zones,
  each seat holds at most one Capture and one Lightning, and the queue is
  empty whenever no decision is pending.
- **Docs:** [the event chain doc](../../architecture/event-chain.md) is updated
  for the queue. Its "a response window isn't a full suspension" caveat goes.

## Out of scope

- **Dying and rescue** (Peach on another seat at 0 HP). Damage at 0 HP still
  eliminates at once.
- **Equipment abilities** (cards A spec).
- **Guozhan-only Tools**, which aren't in the data.
