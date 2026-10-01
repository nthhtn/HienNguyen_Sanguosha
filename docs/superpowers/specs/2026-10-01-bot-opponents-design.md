# Bot Opponents — Design Spec

Status: Approved for implementation planning
Date: 2026-10-01

## Purpose

Let one person play a Kingdom War game against computer-controlled opponents,
instead of passing one device between human players. Today every seat is
human-controlled through the reveal-gate pass-and-play flow, and the only bot is
the sim harness's random-legal-move picker, which is not reachable from the app.

Decisions settled during brainstorming:

- **Bot behaviour:** a simple, explainable **rule-based policy**. The sim's
  random bot stays available as a second policy.
- **Where bots live:** a new framework-free library, `projects/bots`, which
  depends on `engine` and `content`. The app and the sim both use it.
- **Modes:** Setup offers **Play vs bots** (the default) and **Pass-and-play**
  (today's behaviour, unchanged).
- **Seating:** in vs-bots mode the human is `seat-0` and every other seat is a
  bot.
- **No reveal gate** in vs-bots mode. The board always shows the human seat's
  redacted view.
- **Pacing:** bots act about 700 ms apart, so the human can follow along.

## Scope

In scope:
- the `bots` library: rule-based and random policies
- the sim moving onto the `bots` library
- app-layer bot orchestration in `GameService`
- the Setup mode switch
- board "thinking…" state and gate removal in vs-bots mode

Out of scope:
- smarter AI (lookahead, card counting, inferring hidden kingdoms)
- choosing which seat the human sits in
- bot difficulty levels
- networking
- engine rule changes (bots only ever choose among `getLegalActions` results)

## Layering

```
engine  ←  content  ←  bots  ←  app
                        ↑
                       sim
```

`bots` is plain TypeScript: no Angular, DOM or timers, so it is executable under
Node. It may import `content` only for card ids (`'sha'`, `'shan'`, …) and
registry lookups. The app's Angular `GameService` is the only place that adds
timing.

## The `bots` library

```ts
// projects/bots/src/lib/policy.ts
export interface BotTurnMemory {
  turnNumber: number;      // memory resets when this differs from state.turn.turnNumber
  shaPlayed: number;       // Sha plays this turn (self-imposed limit of 1)
  actionsThisTurn: number; // safety cap counter
}

export interface BotDecision {
  action: Action;
  memory: BotTurnMemory;
}

export interface BotPolicy {
  readonly id: 'rule-based' | 'random';
  // `view` is redactStateForSeat(state, seatId): a bot never sees hidden info.
  // `legal` is getLegalActions(state, seatId, registry) on the full state.
  // Must return one of `legal` (by identity), and must throw if `legal` is empty.
  decide(view: GameState, seatId: string, legal: Action[], registry: ContentRegistry, memory: BotTurnMemory | null): BotDecision;
}

export const ruleBasedPolicy: BotPolicy;
export function randomPolicy(rng: RngState): { policy: BotPolicy; rngAfter: () => RngState }; // seeded
export const MAX_BOT_ACTIONS_PER_TURN = 30;
```

The random policy is the sim's current `pickRandomAction` logic, moved here
unchanged in behaviour (seeded `nextInt` over `legal`). The exact factory shape
can be adjusted in the plan, as long as it stays seeded and deterministic.

## Rule-based policy: rule text

Helpers, all read off the bot's redacted `view`:
- **own hand:** the bot's hand-zone cards.
- **own HP:** `combinedHp` / `maxCombinedHp` of the bot's seat.
- **ally of the bot:** another living seat whose `kingdom` in the view equals
  the bot's own kingdom, where the bot's own kingdom is not `'Qun'` and the
  other seat's kingdom is not `'hidden'`.
- **non-ally:** every other living seat. Hidden-kingdom seats count as
  non-allies, because the bot can't know otherwise.

The bot evaluates these rules in order and takes the first that yields an
action from `legal`:

1. **General selection** (`phase === 'GeneralSelection'`): choose the
   `ChooseGeneralsAction` with the highest `maxHp(main) + maxHp(deputy)`. Ties
   go to the first in `legal` order.
2. **Responding** (`view.pendingResponse` names this bot): if `legal` has a
   `RespondAction`, take the first one. Every response the engine currently
   offers (Shan to Sha; Sha or Wuxie to Duel) cancels damage to the bot, so
   responding is always at least as good as passing. Otherwise take the
   `PassAction`.
3. **Safety cap:** if `memory.actionsThisTurn >= MAX_BOT_ACTIONS_PER_TURN` and
   an `EndPhaseAction` is legal, take it.
4. **Not the Play phase** (Judgment, Draw, Discard, End): take `EndPhaseAction`.
5. **Play phase**, first match wins:
   a. **Peach** when own HP < max: the untargeted `PlayCardAction` of a Peach.
   b. **Equipment** (`registry` category `'equipment'`): the untargeted play of
      an equipment card whose definition id is not already in the bot's equip
      zone.
   c. **Sha**, when `memory.shaPlayed === 0`: a `PlayCardAction` of a Sha
      targeting a non-ally. Prefer the target with the lowest `combinedHp`;
      ties go to the lowest seat index. Increment `shaPlayed`.
   d. **Duel**: a `PlayCardAction` of a Duel targeting a non-ally, with the same
      target preference.
   e. Otherwise: `EndPhaseAction`.
6. **Fallback:** if no rule matched (an action shape the policy doesn't know),
   take the first `EndPhaseAction`, else the `PassAction`, else `legal[0]`. A
   bot never stalls.

Every decision increments `memory.actionsThisTurn`. Memory resets
(`shaPlayed = 0`, `actionsThisTurn = 0`) whenever `state.turn.turnNumber`
differs from `memory.turnNumber`. Untargeted plays of Sha and Duel are never
chosen, because they are engine no-ops.

## App orchestration (`GameService`)

New state:
```ts
type GameMode = 'vs-bots' | 'pass-and-play';
readonly mode: Signal<GameMode>;
readonly humanSeatId: Signal<string | null>; // 'seat-0' in vs-bots, null in pass-and-play
readonly botThinkingSeatId: Signal<string | null>;
startGame(seatCount: number, seed?: number, mode: GameMode = 'vs-bots'): void;
```

- `GameState.players` gets `kind: 'human'` for the human seat and `'bot'` for
  the others, in vs-bots mode. In pass-and-play every player is `'human'`.
  `createGame`'s players list is post-processed in the app layer, so the mode
  setup stays unchanged.
- **Bot loop:** after `startGame` and after every successful `submit`, if
  `activeSeatId()` is a bot seat and the game has no result,
  `botThinkingSeatId` is set and the bot's decision is scheduled after
  `BOT_DELAY_MS` (default 700, injectable via an `InjectionToken` so tests can
  use 0). When it fires, the service:
  1. recomputes `view = redactStateForSeat(state, botSeat)` and
     `legal = getLegalActions(state, botSeat, registry)`;
  2. calls `ruleBasedPolicy.decide`;
  3. stores the bot's memory;
  4. resolves the action through the same path as `submit`.

  This repeats until a human seat is active or the game ends. Only one bot
  timer is pending at a time. `startGame` cancels any pending timer.
- **Human view in vs-bots:** `revealedSeatId` is fixed to `humanSeatId`, and
  `visibleState` is always the human's redacted view, even while bots act.
  `legalActions` is empty unless the human is the active seat.
- **Errors:** if a bot's resolve throws, `lastError` is set and the bot loop
  stops (no retry). This surfaces engine bugs instead of spinning.
- **Pass-and-play:** behaviour is exactly as today (reveal gate, all seats
  human, no bot timers).

## UI

- **Setup:** a `mat-button-toggle-group` above the seat toggles, with "Play vs
  bots" (default) and "Pass-and-play", bound to the mode passed to `startGame`.
  It includes one hint line explaining the chosen mode.
- **GameBoard in vs-bots mode:**
  - No reveal gate.
  - The general-selection view is shown only while the human is choosing.
    While bots choose, a "Bots are choosing their generals…" card shows
    instead.
  - The table is always shown from `seat-0`.
- **RoundTable centre:** when `botThinkingSeatId` is set, it shows
  "<seat> is thinking…", with a small `mat-progress-spinner`.
- **Seat tiles** show a small robot icon (`smart_toy`) on bot seats.

## Testing

- **bots:** unit tests for every rule above on hand-built states:
  - general pick by HP
  - respond vs pass
  - safety cap
  - non-Play phases end
  - Peach only when hurt
  - equipment not duplicated
  - one Sha per turn, at the lowest-HP non-ally
  - allies never targeted; Qun has no allies
  - Duel
  - fallback
  - memory reset on a new turn
  - the returned action is always one of `legal`
- **sim:**
  - the bot spec and the property test switch to the `bots` library
  - the property test additionally runs the same seeds with `ruleBasedPolicy`
    for every seat
  - every game must terminate with no invariant violations
- **app:**
  - `GameService` with a 0 ms delay and fake timers:
    - a vs-bots game marks players human/bot
    - the human chooses generals, then the bots choose
    - bots play until the human's turn
    - the human can respond to a bot's Sha
    - the loop stops on game over
    - `startGame` cancels pending bot timers
    - pass-and-play is unchanged
  - Setup mode toggle tests.
  - GameBoard: no gate in vs-bots, the "choosing" card, and the thinking
    indicator.
- **Manual:** a browser click-through of a full vs-bots game.
