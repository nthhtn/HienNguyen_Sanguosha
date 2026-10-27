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
damage-reduction skill works this way. Anything it returns after the
replacement runs once the replacement has applied (a skill that takes a
judgment's card, then lets the Done step go on).

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
4. `sha.play()` returned one effect, the Sha's first step:
   `CardStepEffect('sha-use')`. Each step's `onStep` queues the next:
   `sha-use` → `sha-targeted` (one per target) → `sha-armor` → `sha-shan`.
   `sha-shan` opens the window: B must play a Shan, otherwise the
   `sha-hit` step goes ahead (the window's `outcome` shows the damage it would
   lead to). Steps log no events of their own.
5. The queue stops at the pending response, and so does `advanceToDecision`.

The call returns. The UI shows "Waiting on Seat B", and B is offered
`PassAction` (and a `RespondAction` per Shan in hand, if they had one).

### Call 2: `resolve(PassAction by B)`

1. `resolveAction` clears the pending response and queues the effect it was
   holding back: the `sha-hit` step, which leads to `sha-damage`, which
   queues the `DamageEffect` and then `sha-damaged { logFrom }` (where the log
   stood before the damage). `sha-damaged` queues `sha-after-damage` only if
   the log since `logFrom` shows the target took damage.
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

A judgment is a short chain of its own:

1. `JudgeEffect` turns up the draw pile's top card into `processing` and logs
   `JudgmentEvent`. With no card left anywhere, nothing is judged. It then
   queues `JudgmentShownEffect`.
2. `JudgmentShownEffect` runs once every skill that may change a judgment has
   had its say. A skill that replaces the card queues `ReplaceJudgmentEffect`,
   which swaps the card (`JudgmentChangedEvent`) and shows the new one again.
3. Once the card stands, `JudgmentResolveEffect` asks the reader (the delayed
   Tool's `onJudged`, or the skill's) what the card does, and
   `JudgmentDoneEffect` moves the card to the discard pile unless the reader
   already took it.

**The judgment notice.** With `state.rules.judgmentNotice` on, `JudgeEffect`
also sets `state.judgmentView` (the judged seat, the reader, the current card,
each replacement so far, `settled: false`, and `rounds`: how many times a skill that may change the card has been asked). A changer's ask (`AskUseEffect.judgmentChange`, set by `judgmentChangeAsk` for Devil and Dark Magic) opens one round while the view is unsettled, and the ask and the card pick after it are marked on the pending choice and selection. When `JudgmentShownEffect` finds a
view, it sets `settled: true` and the pipeline **stops** instead of queueing the
resolve step: the game now rests at a decision, whose actor is the first living
human seat (see [The rules engine](rules-engine.md)). `AcknowledgeJudgmentAction`,
from that seat's Continue or the 5 s notice clock, clears the view, logs
`JudgmentAcknowledgedEvent` (with who closed it, or that it timed out) and
queues `JudgmentResolveEffect`. With the rule off, `JudgmentShownEffect` queues
the resolve step directly, so a game without it plays and replays as before.
The consequence sentence the popup shows is computed by content's
`judgmentOutcome` from the same predicate the reader's `onJudged` uses, so the
text and the rule cannot disagree.

A reading usually sets a **turn flag** (`SetTurnFlagEffect`). `advancePhaseOrTurn`
passes over any phase whose skip flag (`skipFlagOf(phase)`, e.g. `skipPlay`) is
set, and `PhaseSkippedEvent` records it. Flags end with the turn.

## Damage natures and chains

Every `Damage` has a nature: `normal`, `fire` or `thunder`. The nature is data
on the card or skill that deals it (Fire Attack and Blaze deal fire, Lightning
Attack and Lightning thunder), and the engine reads only the field. A card used
as a Sha keeps `as: 'sha'` and carries its nature on its definition, so every
rule about Sha still applies to it.

A seat can be **chained** (`Seat.chained`), set by the Chains card or Shackle
through `SetChainedEffect`. When fire or thunder damage is actually dealt to a
chained seat, `applyEffect` unchains it (`ChainToggledEvent`), and the pipeline
(`chainWave` in `resolve.ts`, not a content trigger) queues a
`ChainPropagationEffect` behind it. That effect deals the damage's **original
amount** (`Damage.base`, recorded before the target's own before-triggers could
change it) to each other living chained seat in turn order (`chainWaveOrder`),
one at a time, flagging each hit `chained` so it does not start a wave of its
own. A seat that died or was unchained meanwhile is skipped. Because the next hit
is queued at the front, a damaged seat's triggers (a dying round, a skill that
reacts to damage) resolve before the next seat in the chain is hit. Plain damage
never propagates, and each seat's own before-triggers (Wood Armor's extra fire
damage) rewrite the hit it receives like any other `DamageEffect`.

## Equipment abilities

A worn card can carry **abilities** (`CardDefinition.abilities`):

- `triggers` join the chain like a General's skill while the card sits in a
  living seat's equip zone. They are gathered after the mode's triggers and
  the Generals' skills, in seat order and then zone order. Their owner is
  `{ kind: 'equipment', seatId, cardInstanceId }`; a General's is
  `{ kind: 'general', seatId, slot }`. Every trigger also receives the
  registry, so it can read other worn cards' modifiers (Silver Lion checks
  Black Pommel).
- `modifiers` (`shaLimit`, `ignoresArmor`) are plain data. The engine never
  reads them; content's queries do, through `activeAbilities`.

When a card leaves an equip zone for any reason, its `onUnequip` runs for the
former wearer, right after the move's own after-triggers (Silver Lion's
parting heal). A trigger can't do this job, because a card that has left is no
longer gathered.

The dying round takes `rescueCardIds: { any, self }`. Any seat may answer
with `any` (Peach); only the dying seat may also use `self` (Wine).

## Card steps, asks, selections and conversions

**Steps.** A card that resolves in stages (Sha; Hail of Arrows' Shan) queues
`CardStepEffect { step, card, userSeatId, target, data }`. Applying one calls
the card's `onStep`, whose effects go to the front of the queue. Step names
belong to content: Sha's are `sha-use`, `sha-targeted`, `sha-armor`,
`sha-shan`, `sha-dodged`, `sha-hit`, `sha-damage`, `sha-damaged` and
`sha-after-damage`.

**Abilities at a step** are `before:CardStepEffect` triggers (content's
`atStep`). One may:
- rewrite the step (Ancient Scimitar adds to `data.extra`);
- replace it with something else (Black Shield's logged `AbilityUsedEffect`,
  and the Sha goes no further at that target);
- or replace it with an ask.

Each marks the step (`actedOn`) so it has its say once. `previewEffect`
re-checks each later trigger against the step as rewritten, and stops when
the step becomes another kind of effect: the rest get their say when it comes
back.

**Asks.** `AskUseEffect { owner, abilityId, effects, otherwise }` opens a
pending choice with two options: Use (`effects`) and Don't (`otherwise`,
usually the marked step).

**Selections.** `pendingSelection` asks a seat for `min`–`max` cards or
seats. It pauses the queue like a choice, and may sit over an open response
window. Its continuation is plain data:
- `discard` (then more effects);
- `use-card` (the picked cards as one card: to play at targets, or to answer
  a window);
- `card-step` (a step with the picks as `data.picked`).

`getLegalActions` offers a `SelectAction` template; `validateSelection`
checks a filled one.

**Conversions.** A worn card's `abilities.conversions` give
`UseConversionAction`s:
- in the Play Phase, one per legal target list of the card made;
- in a window that allows the card made, one each.

Each opens a selection of the cards to use. The result is one `UsedCard`
(`via` names the conversion), which counts toward limits like the real card.

A card in use is always a `UsedCard`: what it counts as, its colour (two cards
of different colours: none), and its physical cards.

## General skills

**Which skills count.** `skillsInPlay(state, seatId, registry)` decides, for
triggers, conversions, active skills and content's modifiers alike:
- a revealed General's skills all count;
- a hidden General's compulsory skills have their modifiers off; its other
  skills count, marked `needsReveal`. Triggers also gather a hidden
  compulsory skill's triggers (`skillsInPlay(…, true)`, `GatheredTrigger.compulsory`),
  so they can ask for the reveal;
- Lord skills never count (Kingdom War has no Lord).

A General's ability owner is `{ kind: 'general', seatId, slot, skillId }`.

**Reveal to use.** An `AskUseEffect` from a hidden General's skill puts a
`RevealGeneralEffect` (with `forAbilityId`) at the front of its Use option. A
hidden General's conversion or active skill reveals when its first selection
is confirmed: `PendingSelection.onSelect` resolves at the confirm, before the
continuation. Cancel leaves the General hidden. A hidden General's after-trigger
that returns neither an ask nor a `RevealGeneralEffect` is wrapped in an
`AskUseEffect` of its own (`withReveal`): Use reveals, then the outputs run; Don't
runs nothing (no outputs, no ask). So every reveal by a condition event, in any
phase of any turn, is the owner's decision. A hidden General's before-trigger that
returns direct effects throws: it cannot wait for the answer ahead of the effect it
rewrites, so content must ask instead. A hidden compulsory skill's *before*-trigger
does not run its content: `rewriteEffect` turns the effect into an `AskUseEffect`
(Use: reveal, then the effect runs again and the now-revealed skill rewrites it as
usual; Don't: `UnaskedEffect { effect, declined }` runs it with the first `declined`
before-triggers not asking, a count so a pending choice names no hidden skill).
`previewEffect` leaves such skills out.

**Reveal windows.** The only free reveal is the Start window: for a human's turn
with a hidden General the turn waits in Start (`Turn.startWindow`) and the owner
confirms one `ConfirmRevealsAction { seatId, slots }` (a template with `slots`
free; none is allowed). It queues a `RevealGeneralEffect` per slot, then
`EnterStartPhaseEffect`, which logs the Start `PhaseChangedEvent` so its triggers
gather as usual. There is no Play Phase reveal: Roar-style content reveals on use
(`shaPlayRevealOwner`: a Sha only a hidden compulsory `shaLimit` allows reveals that
General when played).

**Active skills.** `SkillDefinition.active` gives a `UseSkillAction` in its
owner's Play Phase while `canUse` holds and `Turn.abilityUses` is under
`usesPerTurn`. Using one counts it (`IncrementEffect`) and logs an
`AbilityUsedEvent` (`used`), at once or, when `start` opens with a
cancellable selection, through that selection's `onSelect`.

**Counters.** `Turn.abilityUses` and `Turn.ownerUses` (every card the turn
owner used, answers included) end with the turn; `Seat.marks` last the game.

**Losing HP** (`LoseHpEffect` → `HpLostEvent`) is not damage: damage triggers
don't fire. Kingdom War runs its reveal and dying rules after both.

**The Draw Phase** is one `DrawPhaseEffect { count }`. Before-triggers change
the count or replace the draw.

**Judgments** run in steps, each a queue item:
1. `JudgeEffect`: the top card is turned up into `processing` (nothing left:
   `otherwise` goes ahead).
2. `JudgmentShownEffect`: skills that change judgments hook in here.
   `ReplaceJudgmentEffect` discards the card, puts a hand card in its place
   and shows the judgment again.
3. `JudgmentResolveEffect`: the reader (a card's `onJudged`, or a skill's)
   reads the final card.
4. `JudgmentDoneEffect`: the card goes to the discard pile unless something
   took it first. A reader may place this step itself (Eight Trigrams does,
   ahead of the Shan window it opens).

**More decisions.**
- Choice options may show a seat, a suit or a label (`pick`), and a `give`
  selection is followed by a choice of who gets the cards.
- `pendingArrangement` asks a seat to put cards from the top of the draw
  pile back, some on top and some at the bottom, in its order
  (`ArrangeCardsAction`, checked by `validateArrangement`). Only that seat
  sees the cards.

**Judgment changers' order.** Content lists the skills that may replace a
judgment's card (`JUDGMENT_CHANGERS` in `shared/judgments.ts`), each with the
cards its seat may change one with (Devil: a hand card; Dark Magic: a black
hand or worn card). Each one's
`before:JudgmentShownEffect` trigger acts only when `nextToChange` says its
seat is next: in seat order from the judged seat; after a replacement, from
the seat after the one that replaced it (that seat last). `acted` on the shown
step records who has had their say.

**The Discard Phase's count.** It owes what the owner was over its hand limit
as the phase began (`Turn.discardsLeft`), so a card drawn mid-phase (Linked
Camps) isn't owed too.

**Rescuing through a conversion.** The dying round asks a seat with no rescue
card in hand when one of its conversions could make one (First Aid); the
pipeline supplies that check to `applyDying`.

**Several equal targets in one pick** (stage 9). A card's `targetPick` says
when it may take more than one target now (Sha: Sky Scorcher's +2 with the
last hand card, Heaven's Justice's +1). `getLegalActions` then offers that
card, or that conversion, once: a template with `targets: []` and
`pickTargets { eligibleIds, min, max }`. The player (or bot) fills the targets
and submits without `pickTargets`; `resolve` accepts them when `fitsPick` holds
(distinct, listed, within min..max). A conversion asks `targetPick` with `via`
(how many cards, hand only), so "the last hand cards" can be read before the
cards are picked. Each target then goes through the card's steps on its own,
in seat order; the card is counted once.

**Competing** (content, `shared/compete.ts`) runs as the owning skill's steps:
`competeStart` opens the user's face-down pick (`compete-user`), then the
target's (`compete-target`); both cards are shown and discarded, an
`AbilityUsedEvent` says `compete-won` or `compete-lost`, and the skill's result
step gets `won`. A tie loses.
The app's `competeResults` reads the public log (the two `CardShownEvent`s and
the `AbilityUsedEvent`) into the Compete popup's data; the outcome wording per
skill is `competeOutcomeText` in `display.ts`, and the popup is themed in the
source seat's Force.

**Same-suit pairs.** `Conversion.sameSuit` leaves out cards whose suit can't
make a pair and marks the selection `sameSuit`; `validateSelection` rejects a
mixed pick.

**Fire hooks.** Blaze is a Tool made only by Fire Strategy (`outOfDeck`): its
rule opens the target's pick of a card to show (card step `blaze-shown`), then
the user's optional matching discard (`blaze-hit`) for 1 plain damage.
Nirvana is a `before:DyingEffect` trigger like Refusing Death; it ends with
`TurnFaceUpEffect`. Sudden Attack hooks Sha's `sha-dodged` step, as Green
Dragon Blade does. Eight Arrays shares Eight Trigrams' trigger
(`eightTrigramsTrigger`), with a skill judgment reader and a "no armour worn"
condition.

**Forest hooks** (stage 10).
- **A Tool's end.** `useCard` queues `ToolResolvedEffect` behind a played,
  non-delayed Tool's other items. It does nothing itself; `before:ToolResolvedEffect`
  is "after the Tool finished resolving" (Giant Elephant takes the Barbarians
  card there).
- **A skill's own window.** `PendingResponse.sourceSkill { owner, step, data }`:
  answering the window queues that skill step with `answeredBy` and
  `answeredCard` (the card as used) added to `data`. Upheaval uses it to throw
  the Sha the seat answered with; a Pass runs the window's `context.effect`.
- **A dead seat's cards.** The mode queues one `DiscardZoneEffect` per zone
  after `SeatEliminatedEvent`. Unnatural Death is a `before:DiscardZoneEffect`
  ask on the dead seat's hand zone; `acted` stops a declined ask repeating.
- **Max HP.** `ReduceMaxHpEffect` lowers max HP and clamps HP, logs
  `MaxHpReducedEvent`, and eliminates the seat at 0.
- **Complete Kill** is read when the dying round is built: the mode lists only
  the turn owner and the dying seat in `DyingEffect.order`.
- **Curtain** is the `untargetableByBlackTools` modifier (seat lists of Steal,
  Break, Duel, Coerce, Capture, Starvation, through `untargetableBy`'s
  `colour`) plus a `before:ToolOnTargetEffect` trigger for the rest.

**Mountain hooks** (stage 11).
- **Skills gained for good.** `GainSkillEffect` appends to `Seat.gainedSkills`
  (`{ slot, skillId }`); `skillsInPlay` reads them like printed skills of the
  General in `slot` (a hidden slot still needs a reveal; its compulsory modifiers are off).
  `skillOf` finds them too, so their steps and judgments resolve. A step for a
  skill the seat no longer holds does nothing.
- **Awakening.** `SkillDefinition.awakening`; content's `awakeningAtTurnStart`
  fires once at its owner's turn start when its condition holds and marks the
  seat (`awakened:<skillId>`, an `IncrementEffect`). `limited` and `awakening`
  skills are never offered by Incarnation.
- **Silencing.** `SilenceSeatEffect` sets `Seat.silenced`; `skillsInPlay` then
  returns nothing, so no trigger, modifier, active skill or conversion remains.
- **A skill that outlives its owner.** An eliminated seat has no skills in play.
  `SkillDefinition.afterDeath` skills are gathered for their own seat's
  `SeatEliminatedEvent` only. They include gained skills and the chosen Form
  (the seat's `heldSkills`), not only its printed skills. The killer travels on the dying round:
  `DyingEffect.killerSeatId` (set by the mode from the fatal damage's source) →
  `SeatEliminatedEvent.killerSeatId`.
- **Spare Generals (Forms).** `GameState.spareGenerals` is the pool of Generals
  nobody was dealt. When Generals are chosen, a Kingdom War trigger on
  `after:GeneralsChosenEvent` deals `SkillDefinition.spareGenerals` of them
  (`DealSpareGeneralsEffect`, which logs nothing: the log is public).
  `ChooseFormSkillEffect` sets `Seat.forms.chosen`; `skillsInPlay` then includes
  that skill under the holding slot, and content's `seatGender` follows the Form.
  Incarnation follows the choice with `FireSkillTriggersEffect`, so the new skill's
  after-triggers for the event that caused the choice (Start, End or the reveal)
  fire in that event.
  Redaction hides `forms` while the holder is hidden, shows `held` as hidden
  Generals otherwise, empties the pool, and empties a `PendingChoice.secret`
  choice's options for other viewers.
- **Extra turns.** `GrantExtraTurnEffect` pushes onto `extraTurnStack` and sets
  `Turn.resumeAfterSeatId`; after the extra turn the normal order resumes after
  that seat.
- **A second pile.** `Seat.stash` (Deng Ai's Farms) is a face-up `pile` zone;
  `Conversion.from: 'stash'` draws a conversion's cards from it, and the
  modifier `distanceToOthersFrom(state, seatId)` lets a skill's distance bonus
  depend on the state (each Farm is -1).
- **Clever Change reaches each phase with what exists:** Judgment is asked as the
  turn starts (the phase judges on entry; `skipFlagOf`), Draw is a
  `before:DrawPhaseEffect` replacement, Play is asked as it begins and ended with
  `endFlagOf`, Discard is asked as it begins and skipped with `skipFlagOf`.

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
| A card that resolves in stages | `CardStepEffect`s and `CardDefinition.onStep` | Sha's eight steps |
| An ability at a stage | An `atStep` trigger returning the step changed, replaced, or an `askAtStep` | Axe at `sha-dodged` |
| A "may" | `AskUseEffect` (`askAtStep` in content) | Eight Trigrams before a Shan |
| Picking cards or seats | `OpenSelectionEffect` with a continuation | Axe's 2 cards, Sky Scorcher's targets |
| Using cards as another card | `conversions` (`cards: 1 \| 2`, `from`, `accepts`, `outsideOwnTurnOnly`) | Serpent Spear, Fighting Saint, First Aid |
| A General's skill | `SkillDefinition` (abilities, plus `compulsory`, `lord`, `active`, `onJudged`, `onStep`) | the 25 base Generals (`generals/wei.ts` …) |
| A skill used on purpose | `SkillDefinition.active` → `UseSkillAction` | Kindness, Reconsider |
| Changing or taking a judgment | `before:JudgmentShownEffect` / `before:JudgmentDoneEffect` triggers | Devil, Heaven's Envy |
| Rewriting the Draw Phase | a `before:DrawPhaseEffect` trigger (content's `atDrawPhase`, asked once per draw via `acted`) | Brave Gesture, Bare the Chest, Raid |
| Arranging the draw pile | `OpenArrangementEffect` (`drawPileTop` for the cards) | Astrology |
| A skill deciding in several moves | `SkillStepEffect` → `SkillDefinition.onStep`; a selection's `skill-step` continuation | Raid, Kindness, Sow Revolt |
| A seat using a card a skill made | `UseCardEffect` (not counted, outside limits) | Sow Discord's Duel |
| Showing a card to everyone | `ShowCardEffect` → `CardShownEvent` | Sow Revolt |
| A card lying as another card | `MoveCardEffect.countsAs` → `CardZone.countsAs` (`cardCountsAs`) | Country Scene's Capture |
| Skipping the Discard Phase as it begins | the `skipDiscard` turn flag (`discardOwed`) | Self-Restraint |
| A rule change read by content's queries | `AbilityModifiers` (`distanceToOthers`, `toolsIgnoreDistance`, `untargetableWithEmptyHandBy`, `doubleAnswers`) | Horsemanship, Wondrous Talent, Empty City, Matchless |
| Turning a seat face down | `TurnFaceDownEffect`; its next turn is passed (`SeatTurnedEvent`) | Entrench |
| Ending a Play Phase already entered | the `endFlagOf('Play')` turn flag | Godspeed |
| Cards kept under a General | the seat's `pile` zone (`pileZoneOf`) | Refusing Death |
| A conversion decided later | `Conversion.deferred` → the skill's `deferred` step; a window it answers is set aside, then answered (`UseCardEffect.answering`) or re-opened, only if the seat still has a legal non-Pass answer (else the guarded effect resolves as a Pass) | Bewilder |
| A skill that gains a skill mid-event, and must fire it for the event in progress | `FireSkillTriggersEffect` (one owner's triggers at a point, for a subject event, queued at the front) | Incarnation's Form choice |
| A suit that counts as another | `AbilityModifiers.suitAs`, read through content's `suitOf` / `colourFor` | Beauty |

A new card or skill should need only its own definition. If a change seems to
need a branch for one card inside the pipeline, look for the hook above that
fits instead.

## Things to watch for

1. **After-trigger conditions are checked together, once.** All triggers
   for an event are gathered against the state right after that event, then
   their follow-ups are queued in order. In the example, the deputy reveal and
   the dying round were both decided before the main reveal applied. That is
   right for today's triggers, but a trigger that depends on an earlier
   trigger's outcome for the same event won't see it. The one exception is
   `FireSkillTriggersEffect`, which gathers a newly chosen Form skill's
   after-triggers for the event in progress.
2. **Trigger conditions are checked when gathered.** A follow-up waits in the
   queue; its trigger's condition was checked against the state at the moment
   the event happened, not when the follow-up runs.
3. **Before-triggers only rewrite the effect.** They can't change the state
   themselves. Each one sees the state as it was when the effect began
   resolving, along with the effect as rewritten by the triggers before it.

## Reveal bonuses

Two Kingdom War triggers react to `after:GeneralRevealedEvent` with a
`DrawCardsEffect`:

- **First reveal** (optional, `state.rules.firstRevealDraw`, 5+ seats): the
  first `GeneralRevealedEvent` in the log gives its seat 2 cards.
- **Rounding** (always): when both of a seat's Generals are revealed and their
  printed HP sum is odd, the seat draws 1 card, once, on the second reveal.

## Kill reward and penalty

A Kingdom War trigger on `after:SeatEliminatedEvent` (when `killerSeatId` is
set, is not the dead seat, and is still living):

- killer has revealed a General and shares the dead seat's Kingdom (Qun is one
  Kingdom) → `DiscardZoneEffect` on its hand;
- otherwise → `DrawCardsEffect` of (living seats of the dead seat's Kingdom + the
  dead seat itself).
