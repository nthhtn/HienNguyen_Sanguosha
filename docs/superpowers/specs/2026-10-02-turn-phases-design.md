# Turn Phases, Auto-Advance, Hand Limit, Max HP and a Phase Indicator — Design Spec

Status: Draft for review
Date: 2026-10-02

## Purpose

1. **Six-phase turns.** A turn has six phases: Start, Judgment, Draw, Play,
   Discard, End. The engine has only five today (`PHASE_ORDER` in
   `rules/phaseSequence.ts` has no Start), so "at the start of your turn"
   skills have nowhere to trigger.
2. **No clicking through empty phases.** Every phase waits for an
   `EndPhaseAction` today, so each turn opens in Judgment with Play greyed
   out until the player clicks End phase twice. Nothing on screen says why.
   This was reported as "I don't see the Play button".
3. **Hand limit.** The Discard phase never makes a player discard. It should
   enforce the hand limit.
4. **Max HP.** A seat's max HP is the sum of its two generals' HP, halved and
   rounded down. Today it is the plain sum (`generalSelection.ts`), so seats
   start at 6–8 HP instead of 3–4. This changes here because the hand limit
   is based on HP.
5. **A clear phase indicator.** The board must show whose turn it is and
   which phase, as "seat-X – Y Phase".

Found while investigating, fixed here because the new phase loop covers them:
- Entering the first phase of a turn raises only a `TurnAdvancedEvent`, never
  a `PhaseChangedEvent`, so no skill can trigger on a turn's first phase. Turn
  1 starts after general selection with no phase event at all.
- If the turn owner is eliminated mid-turn (for example by losing a Duel),
  nobody can act and the game is stuck.

Decisions settled with the user:
- Approach A: the engine advances phases itself. The app, bots and sim never
  submit "End phase" on a player's behalf.
- The hand limit is enforced now, and equals the seat's current HP.
- Max HP = floor((main general's HP + deputy general's HP) / 2).
- End phase can be chosen only in the Play phase. A player cannot skip Draw
  or Discard by choice; only future skills may skip phases.
- The board shows a "seat-X – Y Phase" indicator.

## Rule text

**Turn structure.** Each turn has six phases, always in this order:
**Start → Judgment → Draw → Play → Discard → End**. After End, the next
seat's turn begins at Start. The next seat is the next living seat clockwise,
or the top of the extra-turn stack (unchanged rule). Turn 1 begins at Start
for the first seat as soon as general selection finishes.

**Entering a phase.** Entering any phase raises a `PhaseChangedEvent` for the
turn owner and that phase. This includes Start at the beginning of every
turn. "After" triggers on that event resolve before anything else happens in
the phase.

**Phases that pass on their own.** Once a phase's entry triggers have
resolved, the phase passes to the next one, unless it waits for the player:

| Phase | Waits for the player when… | Otherwise |
|---|---|---|
| Start | never (no Start skills exist yet) | passes |
| Judgment | never (no delayed tricks can be played yet) | passes |
| Draw | never | passes after the draw triggers (2 cards, plus Insight) |
| Play | always | — |
| Discard | the hand holds more cards than the hand limit | passes |
| End | never | passes and starts the next turn |

A phase never passes while a response is pending or after the game has
ended.

**Ending the Play phase.** In the Play phase the turn owner may choose End
phase at any point the game is not waiting on a response. End phase is not
legal in any other phase.

**Max HP.** When a seat's two generals are chosen, its max HP is the sum of
both generals' printed HP, divided by 2 and rounded down. The seat starts at
full HP. Examples: 4 + 4 → 4, 3 + 4 → 3, 3 + 3 → 3. This replaces the engine
design spec's `maxCombinedHp = main.maxHp + deputy.maxHp`. Every other rule
that reads max HP is unchanged and simply sees the new value: Peach's "not at
full HP" check, healing's cap, and the forced reveal at
`combinedHp <= floor(maxCombinedHp / 2)`.

**Hand limit.** A seat's hand limit is its current combined HP
(`Seat.combinedHp`), never below 0. On entering the Discard phase, a seat
holding more cards than its limit must discard cards one at a time, choosing
each from its hand, until it holds exactly its limit. Discarded cards go to
the discard pile. The phase then passes. A seat at or under its limit
discards nothing.

**Turn owner eliminated.** If the turn owner is eliminated during their own
turn, the rest of that turn is skipped: no further phases are entered, and the
next turn begins at Start. Any pending response that the elimination already
resolved is unaffected.

## Engine changes

### Phases

```ts
// domain/types.ts
export type Phase = 'GeneralSelection' | 'Start' | 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End';

// rules/phaseSequence.ts
export const PHASE_ORDER: readonly Phase[] = ['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End'];
```

`advancePhaseOrTurn` is unchanged in shape. Moving from End to the next turn
returns `{ phase: 'Start', turn: <next turn> }`.

### Hand limit and waiting

```ts
// rules/handLimit.ts
export function handLimit(state: GameState, seatId: string): number; // max(0, combinedHp)
export function cardsOverHandLimit(state: GameState, seatId: string): number; // max(0, hand size - limit)

// rules/phaseSequence.ts
// True when the current phase must wait for the turn owner: always in Play;
// in Discard while the owner is over the hand limit; never otherwise.
export function phaseWaitsForPlayer(state: GameState): boolean;
```

Hand-limit modifiers from skills are out of scope. When one is needed it hooks
into `handLimit`, the only place the limit is computed.

### Entering phases: one helper

Two internal helpers in `pipeline/resolve.ts` replace the phase-changing body
of the `EndPhaseAction` case:

- `enterPhase(state, ctx, depth)` logs a `PhaseChangedEvent { seatId:
  turn.ownerSeatId, phase: state.phase }` for the phase the state is already
  in, and runs its "after" triggers.
- `enterNextPhase(state, ctx, depth)` computes `{ phase, turn } =
  advancePhaseOrTurn(state)`. If the turn changed, it logs a
  `TurnAdvancedEvent` (unchanged). It then sets the new phase and turn and
  calls `enterPhase`. So entering Start now raises a `PhaseChangedEvent`
  too, which fixes the missing first-phase event.

### The auto-advance loop

`resolve()` runs a loop after `resolveAction` returns, before the win check:

```
while (
  state.result === null                      // (win check runs inside the loop, see below)
  && state.phase !== 'GeneralSelection'
  && state.pendingResponse === null
  && (turnOwnerEliminated(state) || !phaseWaitsForPlayer(state))
) {
  if (turnOwnerEliminated(state)) state = startNextTurn(state)   // skip the rest of the turn
  else state = enterNextPhase(state)
  check the win condition; stop if the game has ended
}
```

- `startNextTurn` advances the turn the same way End does (extra-turn stack,
  then the next living seat clockwise) and enters Start.
- The win condition is checked after each step, so a game that ends during a
  Start or Draw trigger stops there instead of looping on.
- The loop shares the existing `MAX_TRIGGER_DEPTH` guard idea, as a loop
  bound: more than `MAX_AUTO_PHASE_STEPS = 6 * seats.length + 6` steps in one
  `resolve()` call throws a descriptive error. Every seat's turn passes
  through Play, which always waits, so a legitimate run never gets near that.
- **General selection finishing.** Turn 1 already exists during selection:
  the mode's setup creates `turnNumber: 1`, owned by the first seat. When the
  last seat chooses, `applyGeneralChoice` sets the phase to `'Start'` instead
  of `'Judgment'`. The `ChooseGeneralsAction` case in `resolveAction` then
  calls `enterPhase` (below) to raise turn 1's Start `PhaseChangedEvent`.
  After that, the loop continues as for every other turn.

### Max HP

```ts
// rules/generalSelection.ts, in applyGeneralChoice
const maxCombinedHp = Math.floor((main.maxHp + deputy.maxHp) / 2);
```

The only change to the engine code. `combinedHp` still starts equal to
`maxCombinedHp`. The engine design spec's HP line
(`2026-09-03-guozhan-engine-design.md`, "HP") is updated to match.

### Actions

```ts
// pipeline/actions.ts
| { kind: 'DiscardCardAction'; seatId: string; cardInstanceId: string }
```

- **Legal** only for the turn owner, in the Discard phase, while
  `cardsOverHandLimit > 0`, for a card in their own hand. While it is legal it
  is the owner's only legal action kind: no End phase, no plays.
- **Resolves** to a `MoveCardEffect` from hand to the discard pile, which
  logs the existing `CardMovedEvent`. The auto-advance loop then passes the
  phase once the owner is back at the limit.
- **Why one card per action:** offering every set of k cards to discard
  grows combinatorially (C(12, 6) = 924 actions), and the legal-actions API
  lists concrete actions. The cost: a future skill that triggers on
  "discarding cards during the Discard phase" sees one event per card. Such a
  skill can still count them per phase, so this stays acceptable until one
  exists.

`EndPhaseAction`: `getLegalActions` offers it only in Play, and only when no
response is pending (already true). `resolveAction` throws
`"EndPhaseAction is only legal in the Play phase"` when it is submitted in any
other phase, rather than trusting callers.

## Bots (`projects/bots`)

- **Rule-based policy:** in Discard, discard the lowest-priority card first.
  The priority order: keep Peach and Shan, then Sha, then equipment, then the
  rest. Ties break by hand order, so choices are deterministic. Outside Play
  and Discard there is nothing to do: the bot never sees those phases at rest.
- **Random policy:** unchanged. It already picks from the legal actions,
  which now include only discards in the Discard phase.
- The "End phase outside Play" shortcut in `rule-based.ts` is removed, because
  that situation no longer happens.

## App (`projects/app`)

### Phase indicator

A new standalone component, `PhaseIndicator`, sits at the top of the game
board, above the round table. It stays visible by sticking just below the app
header when the page scrolls. It shows:

> **seat-0 (you) – Play Phase**

- The turn owner's seat id, plus "(you)" when that seat is the viewer's,
  using the same rule as the seat tile's "(you)" label.
- The phase name followed by "Phase": Start Phase, Judgment Phase, Draw
  Phase, Play Phase, Discard Phase, End Phase.
- In the Discard phase while the owner is over the limit: "– discard N more",
  where N comes from the engine's `cardsOverHandLimit`. The UI never computes
  the hand limit itself.
- Hidden during general selection and after the game ends. Those screens
  already say what is happening.

The indicator reads `visibleState()` only. The turn number stays in the
table centre, where "Turn N · Phase" becomes "Turn N" so the phase is not
shown twice.

### Hand

- In the Discard phase, the hand card overlay's main button reads
  **Discard** (delete icon) instead of Play, and is enabled for every hand
  card while a discard is legal. It is matched to `DiscardCardAction`s by
  card instance id, the same way plays are matched today.
- A disabled Play button gets a tooltip, "Only in your Play phase" or "Can't
  be played now". This fixes the reported confusion: a greyed-out button now
  says why.

### Action list and labels

- `actionLabel` gains `DiscardCardAction → "Discard <card name>"`.
- `eventLabel` keeps its "entered the X phase" wording, and now also covers
  Start.
- End phase only appears in Play, which the engine already decides.

## Sim (`projects/sim`)

- **New invariant: the game only rests on a decision.** After every
  `resolve()`, either the game has ended, a response is pending, the phase is
  `GeneralSelection`, or `phaseWaitsForPlayer(state)` is true.
- **New invariant: hand limit.** No seat's turn moves past Discard while that
  seat is over its hand limit.
- Existing property seeds must still terminate under both bot policies. The
  extra discards may lengthen games, so the sim's per-game step budget is
  re-checked and raised in the plan if needed.

## Testing

Engine (Jest, `projects/engine`):
- **Phase order:** End → Start of the next seat. All six phases appear in
  order across one turn's events.
- **Events:** every phase entered raises a `PhaseChangedEvent`, including Start
  at the start of a turn and Start of turn 1 after general selection.
- **Auto-advance:** after general selection, the state rests in turn 1's Play
  phase with exactly 2 Draw-phase cards drawn (3 for Zhuge Liang).
- **Ending Play:** with hand ≤ limit, End phase in Play rests in the next
  seat's Play phase.
- **Discard enforcement:** with hand > limit, End phase in Play rests in
  Discard. Only `DiscardCardAction`s are legal, one per hand card. After the
  required number of discards, the state rests in the next seat's Play phase.
- **Hand limit:** equals current combined HP, 0 when HP is 0.
- **Max HP:** 4 + 4 → 4, 3 + 4 → 3, 3 + 3 → 3, and `combinedHp` starts equal
  to it. Existing specs that assert the old sum (for example a 7- or 8-HP
  seat) are updated to the new values. Specs that set HP directly on a test
  state are left alone.
- **End phase rejected outside Play:** `resolve()` throws for Draw, Discard,
  and so on.
- **Eliminated turn owner:** a Duel that eliminates the turn owner ends their
  turn, and the next living seat rests in Play.
- **Win during auto-advance:** a win reached inside a phase trigger stops the
  loop, and the state carries the result.
- **Loop bound:** a content stub whose Start trigger keeps the phase from
  ever waiting hits the step limit with a descriptive error.
- Existing Insight and Kingdom War Draw-phase specs keep passing unchanged.

Bots: the rule-based discard order, and that a bot in Discard returns a
`DiscardCardAction`.

App: `PhaseIndicator` renders "seat-0 (you) – Play Phase", the "discard N
more" suffix, and hides during selection and game over. The hand shows
Discard in the Discard phase, and the disabled-Play tooltip shows.

## Out of scope

- Delayed tricks and judgments. Judgment always passes until Capture and
  Lightning are implemented (the Judgment phase is ready for them).
- Skills that change the hand limit or skip phases.
- Optional "at the start of your turn" skills that ask the player a question
  at Start. The rule text allows for them, but none exist.
- Discarding a chosen set of cards in one action.
