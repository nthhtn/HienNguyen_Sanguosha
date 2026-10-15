# Bots and simulation

How computer opponents decide, how whole games are played headlessly to find
bugs, and how the test suites are laid out. Both projects are framework-free
TypeScript that depend only on the engine (and content for the simulator).

## Bots (`projects/bots`)

A bot is a **policy**:

```ts
interface BotPolicy {
  readonly id: string;
  // `view` is the bot seat's redacted view; `legal` is the engine's legal
  // actions for that seat. The returned action is always one of `legal`.
  decide(view: GameState, seatId: string, legal: Action[], registry: ContentRegistry,
         memory: BotTurnMemory | null): BotDecision;
}
```

Three properties keep bots honest and simple:

1. **They see what a player sees.** The caller passes `redactStateForSeat`
   output, so a bot cannot read hidden cards by construction.
2. **They only choose among legal actions.** `decide` returns one of the
   engine's own `getLegalActions`, so a bot cannot make an illegal move or
   encode a rule. Where an action is a template (a selection with no ids yet),
   the bot fills it in (`fillSelection`, `fillPick`).
3. **They are deterministic given their inputs.** Randomness is the seeded
   RNG; no `Math.random`.

There are two policies:

| Policy | File | Behavior |
|---|---|---|
| Random | `random.ts` (`pickRandomAction`) | uniformly picks a legal action, with sane fills for templates. Used by the simulator to explore many unusual lines of play. |
| Rule-based | `rule-based.ts` (`ruleBasedPolicy`) | the opponent a person plays against. Its heuristics include: treat same-Kingdom seats as allies, target the weakest non-ally, keep Peach, Shan and Sha on top when arranging, cancel harmful Tools aimed at itself, and discard its least useful cards. |

The rule-based bot's per-pack knowledge sits beside it (`wind.ts`, `fire.ts`,
`forest.ts`, `mountain.ts`, `skills.ts`), each answering questions such as
"should I use this skill now?" and "which cards fill this skill's selection?".
`BotTurnMemory` tracks a little per-turn state (Sha played, actions taken) and
`MAX_BOT_ACTIONS_PER_TURN` caps a turn so a bot always ends its phase.

In the app, `GameService` calls the rule-based policy on a timer for each bot
seat. In the simulator, `runGame` does the same in a loop.

### Adding bot support for new content

A new card or skill is playable by the **random** bot with no work (it is just
another legal action). The rule-based bot needs a rule only when its default is
poor: add a case to the matching pack file or to `skills.ts`, with a test in
that file's spec. A skill with no bot rule is simply not used by the bot.

## Simulation (`projects/sim`)

The simulator plays complete games with no UI, under plain Node, and checks
the result.

```
createGame(kingdomWarMode, registry, seatIds, seed)      deterministic start
  └─ runGame(state, ctx, botSeed, maxActions, 'random' | 'rule-based')
        loop until state.result or the action budget runs out:
          seat = getActiveSeatId(state)
          action = bot.decide(redactStateForSeat(state, seat), legal actions)
          state = resolve(state, action, ctx)
          optional per-step hook (used for resting-state checks)
  └─ checkInvariants(finalState) → list of violations
```

`runGame` is [runGame.ts](../../projects/sim/src/runGame.ts); the command-line
entry point is [cli.ts](../../projects/sim/src/cli.ts) (`single <seed> <seats>`
prints a game's log; `batch <games> <seats>` reports how many pass). The same
functions are what the Jest specs call.

`tournament <games> <seats> <challenger> <baseline> [firstSeed]` compares two
bots ([tournament.ts](../../projects/sim/src/tournament.ts)). Seats alternate
between the two bots and the pattern flips every game, so each bot sits in each
seat equally often. Each finished game gives the challenger's share of winning
seats minus the baseline's; the report shows the mean of that difference with a
95% interval and says which bot is better only when the interval excludes 0.
Bots are `random`, `rule-based` and `rule-based-v1` (weakest-first targeting,
kept as a fixed opponent). Today `rule-based` and `rule-based-v1` are the same
bot, so comparing them only measures noise; that is a useful harness check. The
scored alternative, `targetScore` in
[targeting.ts](../../projects/bots/src/lib/targeting.ts), is not registered: it
did not beat weakest-first on fresh seeds. To test a new ranker, register it
in `policies.ts` under its own id and run it against `rule-based-v1`, for
example `npm run sim -- tournament 4000 4 <new-id> rule-based-v1`.

### Invariants

[invariants.ts](../../projects/sim/src/invariants.ts) holds checks that must be
true of any reachable state. They are the safety net for rules code that unit
tests did not think of:

| Check | Catches |
|---|---|
| a living seat is never at 0 HP or below without a rescue round pending | a missed dying round |
| pending responses, choices, selections and arrangements never name an unknown or eliminated seat | a decision opened for a dead or missing seat |
| every card instance is in exactly one zone, once | a duplicated or lost card |
| General selection is cleared once it ends; every seat has Generals | a broken setup |
| a General is held by one seat only; a seat's Generals match its Kingdom | a bad deal or choice |
| an equip zone holds at most one card per slot; a judgment zone holds no duplicate delayed Tool | a broken equip or delay rule |
| an eliminated seat holds no cards | a missed elimination discard |
| a `GameResult` names known seats once each | a malformed result |
| a hidden General never fires a compulsory skill (`checkCompulsoryWhileHidden`) | a reveal-to-use bug |
| the game rests only where someone must decide (`checkRestingState`) | the engine stalling mid-chain |

The specs also check that every game **terminates**, and that the final state
survives a JSON round trip unchanged, which is the serializability property the
whole design relies on.

### Forced pairings: proving every skill fires

Random games rarely exercise one specific General. `withForcedPairing` deals a
chosen pair of Generals to `seat-0` (every other seat gets five others), and the
per-pack specs (`skills.spec.ts`, `wind.spec.ts`, `fire.spec.ts`,
`forest.spec.ts`, `mountain.spec.ts`) play seeded games until each coded skill
of each General has left a trace in the log (`firedSkills`) or a seed budget is
spent. A skill that never fires is reported as missing. If a rules change makes a
rare skill stop firing within the budget, the budget is a test parameter: raise
the seed range rather than assuming a bug, but check the skill still fires at
all.

## Test layout

Jest runs five projects from the root `jest.config.js`, each with its own
environment and import aliases:

| Project | Environment | What its tests are |
|---|---|---|
| `engine` | node | the pipeline, legality, redaction, phases, triggers, with tiny hand-written content so the engine is tested without the real cards |
| `content` | node | each card and skill, on small hand-built `GameState`s (`table()` and `harness()` in `generals/skills.testing.ts`); the Kingdom War mode; the data and wiki builders |
| `bots` | node | bot decisions on built states |
| `sim` | node | whole simulated games, invariants and per-skill firing |
| `app` | jsdom (`jest-preset-angular`) | the service, view-model functions, dialogs and board behavior |

Habits that keep the suite useful:

- **Test the rule, not the plumbing.** Content tests build the smallest table
  that shows the rule (five seats, a few cards) and assert on hands, HP and the
  log.
- **Specs live beside the code** (`foo.ts` and `foo.spec.ts`), and a new rule
  is written test first.
- **A bug found by the simulator becomes a unit test** in the project that owns
  the rule, so it cannot regress silently.
- **The app's pure modules** (`actionHistory`, `competeResults`,
  `describeResponse`) are tested without Angular; only components need TestBed.
