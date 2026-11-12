# Bots and simulation

How computer opponents decide, how whole games are played headlessly to find
bugs, and how the test suites are laid out. Both projects are framework-free
TypeScript. Bots depend on the engine and content; the simulator on engine,
content and bots.

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
| Rule-based | `rule-based.ts` (`ruleBasedPolicy`) | the opponent a person plays against. Its heuristics include: treat same-Kingdom seats as allies, rank non-allies by the table (below), keep Peach, Shan and Sha on top when arranging, cancel harmful Tools aimed at itself, and discard its least useful cards. |

The rule-based bot's per-pack knowledge sits beside it (`wind.ts`, `fire.ts`,
`forest.ts`, `mountain.ts`, `skills.ts`), each answering questions such as
"should I use this skill now?" and "which cards fill this skill's selection?".
`BotTurnMemory` tracks a little per-turn state (Sha played, actions taken) and
`MAX_BOT_ACTIONS_PER_TURN` caps a turn so a bot always ends its phase.

### The rule registry (`projects/bots/src/lib/rules`)

Newer play judgment lives in a data-driven registry, `KINGDOM_WARS_RULES`
([kingdom-wars.ts](../../projects/bots/src/lib/rules/kingdom-wars.ts)): one
`BotRule` per card or skill id, with no switch over ids. A rule fills in only
the hooks it has an opinion on (`play` early or late in the ladder,
`wantsToUse`, `select`, `choose`, `answer`) and returns `undefined` to leave a
decision to the ladder. The ladder consults the registry through the policy's
`BotFeatures`; a policy with no registry (`NO_FEATURES`) behaves as it did
before it existed. The rules sit in `projects/bots` rather than `content`
because they need the bots' own helpers, and `content` may not import `bots`;
facts about content (what stops a card, how dangerous a skill is) belong in
`content`.

To give a card or skill a rule, write its rule text in plain words first, add a
`BotRule` keyed by its id to the matching file in `rules/` (`tools.ts`,
`equipment.ts`, `skills.ts`, `wuxie-guo.ts`), list it in `KINGDOM_WARS_RULES`,
and test it in the neighbouring spec. `coverage.spec.ts` fails when a Kingdom
Wars card, or a skill with an active, a conversion or a trigger, is in none of
`KINGDOM_WARS_RULES`, `LEGACY_HANDLED` (the old ladder and pack files already
play it) or `IGNORED` (with a stated reason), in
[coverage.ts](../../projects/bots/src/lib/rules/coverage.ts).

Three callers run it: `GameService` on a timer for each bot seat of a local
game, the server's `GameRunner` for each bot seat (and for a human seat it
has taken over) of an online game, and the simulator's `runGame` in a loop.
All three hand the policy the seat's redacted view and its legal actions.

### Reading the table (`table.ts`, `danger.ts`, `table-rank.ts`)

`rule-based` builds a picture of the table from its redacted view
([table.ts](../../projects/bots/src/lib/table.ts)), enabled by
`BotFeatures.tableReading`:

- **Forces.** A force is a Kingdom's living seats whose allegiance is `kingdom`
  and whose Kingdom is revealed; each living Ambitionist is a force of one. A hidden seat belongs to no force.
  A force has seats (a count) and HP (summed `combinedHp`).
- **The leading force** (`leadingForceOf`) has at least 2 seats and strictly
  more seats than every other force. It is weakened, and no longer leads, as
  soon as it loses that, or its HP is not above the HP of the force with the
  next most seats.
- **Relations** (`relationOf`, from the bot's side): `self`, `ally` (as
  `isAlly`), `truce` (a seat of a force that is neither the bot's own nor the
  leading force, while another force leads) and `foe` (everything else). When
  the bot's own force leads there is no truce: it plays as before towards
  everyone. Nothing is announced; the alliance only changes what each bot
  chooses.
- **Danger.** Skills carry a hand rating, `high`, `medium` or `low`, as content
  data keyed by skill id (`skillDanger` in `content`, from `data/decks/kingdom-wars/skill-danger.json`, with its own coverage
  spec; the criteria are in the Kingdom Wars bots spec). A General's danger is
  its highest rating (2, 1, 0) plus 10 times its value in `GENERAL_VALUES`
  (`generalDanger`); a seat's danger is the sum over its revealed Generals. A
  seat with danger 2 or more is dangerous.
- **Whom to attack** (`tableRank`, a `RankerFactory` built per decision from the
  registry): a leading-force seat +1000, a hit that would bring the target to 0
  HP +500, 20 per danger, 30 per hostile act (up to 3), less 10 per HP and a
  tiebreak by seat index. A truce partner is `HOLD_FIRE`, which the ladder reads
  as "never attack", unless it has 3 HP or more and is dangerous; then it still
  ranks below every leading-force seat. `HOLD_FIRE` is a convention of the
  ranker's return value in `helpers.ts`: card plays, conversions, target
  templates and harmful seat selections skip a `HOLD_FIRE` target, and a play
  with no other target is not made.
- **Dying and mass attacks.** A bot saves a dying truce partner with a Peach as
  an ally. Barbarians and Hail of Arrows are played when enemies outnumber
  friends, with a truce partner counted by its HP and danger.

The per-skill targeting in `skills.ts`, `wind.ts`, `fire.ts`, `forest.ts` and
`mountain.ts` is not on the ranker yet; those skills keep sorting by HP.

`balance <games> <seats> <policyA> <policyB> <firstSeed>`
([balance.ts](../../projects/sim/src/balance.ts)) judges it: every seat plays
the same bot, and for each seed it records the first force that led, whether
that force won (`leader won`), the deaths and the HP lost. The report gives the
leader-won rate with an interval per bot, win rates per force (the
`ambitionist:<seat>` entries shown as one Ambitionist row), and A minus B for
each measure, paired by seed. Part 2 passed when the leader-won difference was
wholly below 0 on two seed ranges; the results are in the Kingdom Wars bots
spec.

### Adding bot support for new content

A new card or skill is playable by the **random** bot with no work (it is just
another legal action). The rule-based bot needs a rule only when its default is
poor: write the rule text in plain words, add a `BotRule` keyed by its id to
`rules/` (registered in `KINGDOM_WARS_RULES`), and test it in the neighbouring
spec. `coverage.spec.ts` fails until every Kingdom Wars card and non-compulsory
skill is in `KINGDOM_WARS_RULES`, `LEGACY_HANDLED` or `IGNORED` (with a reason)
in `rules/coverage.ts`, so nothing is left without a bot decision by accident.

## Simulation (`projects/sim`)

The simulator plays complete games with no UI, under plain Node, and checks
the result.

```
createGame(guozhanMode, registry, seatIds, seed)      deterministic start
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

`tournament <games> <seats> <challenger> <baseline> [firstSeed] [mirrored|unmirrored]` compares two
bots ([tournament.ts](../../projects/sim/src/tournament.ts)). Seats alternate
between the two bots and the pattern flips every game, so each bot sits in each
seat equally often. Each finished game gives the challenger's share of winning
seats minus the baseline's. By default the tournament is **mirrored**: each seed
is played twice with the sides swapped, and a pair's average is one data point,
which cancels the luck of the deal and of the Generals. The report shows the
mean over pairs with a 95% interval and says which bot is better only when the
interval excludes 0. Add `unmirrored` as a last argument for one fresh seed per
game.
Bots are `random`, `rule-based`, and frozen opponents `rule-based-v1`,
`rule-based-v2` (weakest-first targeting, General pairs by highest max HP; `v2`
is what Stage 4 was judged against) and `rule-based-v3` (`rule-based` before
the Kingdom Wars rule registry; the baseline Part 1 was judged against, and the
bot the older specs pin through `decide` in `testing.ts`) and `rule-based-v4`
(`rule-based` at the end of Part 1, before it read the table; the baseline Part 2
was judged against, and the control the table specs compare with). `rule-based` chooses its General pair with
a measured value table, `GENERAL_VALUES` in
[general-values.data.ts](../../projects/bots/src/lib/general-values.data.ts),
generated by `npm run sim -- fit-generals <games> <seats> <firstSeed>` (random
pairs, win-rate lift per General, shrunk by sample count). Since Kingdom Wars
Part 4, Kingdom Wars Generals are picked by their own table, `KINGDOM_WARS_VALUES`
and `KINGDOM_WARS_PAIR_BONUSES` in
[general-values.kingdom-wars.data.ts](../../projects/bots/src/lib/general-values.kingdom-wars.data.ts),
generated by `npm run sim -- fit-generals 8000 4-8 2000000 kingdomWars` (by full
id, plus a bonus for candidate pairs that win more together); Identity games and
the danger rating keep `GENERAL_VALUES`. `rule-based-v6` is `rule-based` before
Part 4, picking by `GENERAL_VALUES` for every deck. The variants
`rule-based-cards`, `rule-based-responses` and `rule-based-picks` stay registered
as recorded experiments (Stage 1 and 2 shipped nothing). The scored targeting
alternative, `targetScore` in
[targeting.ts](../../projects/bots/src/lib/targeting.ts), is not registered: it
did not beat weakest-first on fresh seeds. To test a change, register it in
`policies.ts` under its own id and run it against the current `rule-based`, for
example `npm run sim -- tournament 4000 4 <new-id> rule-based`; fit and judge on
different seed ranges. The Kingdom Wars rules were judged this way, at
commit `c3834ebf` with the challenger registered as `rule-based-kw`; today the same
comparison is `npm run sim -- tournament 4000 <seats> rule-based rule-based-v3
<seed> mirrored`. Part 2 was judged at commit `0f5e6607` with the challenger
registered as `rule-based-table`; today that comparison is `rule-based` against
`rule-based-v4`. The results are in
[the Kingdom Wars bots spec](../superpowers/specs/2026-11-11-kingdom-wars-bots-design.md).

The report ends with a **usage table**: for each card and skill that offered a
decision, how often it was offered and how often the bot used it, per side
([usage.ts](../../projects/sim/src/usage.ts)). `Part 1 uses per game` is the
challenger's uses of the Kingdom Wars keys (`PART_1_KEYS`) minus the
baseline's, with a 95% interval over pairs; a key at 0 for the challenger means
its rule never fires.

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

### Leaks: proving a seat learns nothing secret

[leaks.ts](../../projects/sim/src/leaks.ts) and `leakProperty.spec.ts` replay
simulated games and, at every step and for every seat, check that the redacted
view, each log event and every reshuffle reveal no hidden card, no unrevealed
General (including candidates, spares and forms a seat holds) and no hidden
skill id. This is the test that makes the server's per-seat views safe to send;
`leakForced`, `leakBequeathed` and `leakSorrow` cover the skills that move
secret information. A change to redaction, to card ids or to a skill that
shows or hides cards should run these first.

### Forced pairings: proving every skill fires

Random games rarely exercise one specific General. `withForcedPairing` deals a
chosen pair of Generals to `seat-0` (every other seat gets five others), and the
per-pack specs (`skills.spec.ts`, `wind.spec.ts`, `fire.spec.ts`,
`forest.spec.ts`, `mountain.spec.ts`, and `kingdomWars.spec.ts` for the Kingdom Wars
deck's variants) play seeded games until each coded skill
of each General has left a trace in the log (`firedSkills`) or a seed budget is
spent. A skill that never fires is reported as missing. If a rules change makes a
rare skill stop firing within the budget, the budget is a test parameter: raise
the seed range rather than assuming a bug, but check the skill still fires at
all.

## Test layout

Jest runs seven projects from the root `jest.config.js`, each with its own
environment and import aliases:

| Project | Environment | What its tests are |
|---|---|---|
| `engine` | node | the pipeline, legality, redaction, phases, triggers, clocks, with tiny hand-written content so the engine is tested without the real cards |
| `content` | node | each card and skill, on small hand-built `GameState`s (`table()` and `harness()` in `generals/skills.testing.ts`); the Guozhan mode; decks; the data, wiki and Vietnamese-data checks |
| `bots` | node | bot decisions on built states |
| `sim` | node | whole simulated games, invariants, leaks and per-skill firing |
| `protocol` | node | schemas and shared validators (names, chat) |
| `server` | node | accounts, rooms, the game runner and the socket end to end, on the in-memory store; `npm run test:db` also runs the repository contract on Postgres |
| `app` | jsdom (`jest-preset-angular`) | the services, view-model functions, dialogs, board behavior and the Vietnamese catalogs |

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
