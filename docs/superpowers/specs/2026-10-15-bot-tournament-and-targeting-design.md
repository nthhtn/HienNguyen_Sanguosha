# Bot Tournament Harness and Smarter Targeting — Design Spec

Status: Approved in conversation, pending written-spec review
Date: 2026-10-15

## Purpose

The rule-based bot is a fixed priority list. Its targeting is "the weakest
non-ally" (`fillPick`, `targetedPlays` and the conversion rules in
`projects/bots`). We want to improve it, but today there is no way to tell
whether a change makes the bot better or worse.

This stage delivers two things, in this order:

1. **A tournament harness** in the `sim` project that measures how one bot
   policy performs against another over many seeded games.
2. **Smarter targeting** in the `bots` project, judged by that harness.

Success: over 500 or more games on the mixed table, the new targeting wins
by more than its margin of error. If it does not, the result is reported and
the change is not presented as an improvement.

## Scope

In scope:
- `runGame` accepting a policy per seat
- a tournament module and CLI command in `sim`
- a `targeting` module in `bots`, and the rules that choose targets using it
- keeping the previous behaviour available as `rule-based-v1`

Out of scope (later stages of the bot roadmap):
- hidden-kingdom inference
- card counting, response judgement, General selection, lookahead
- engine changes, app screens, bot pacing

Layering is unchanged: `engine ← content ← bots ← sim`. Both parts are plain
TypeScript with no Angular, DOM or timers.

## Part 1: Tournament harness (`projects/sim`)

### `runGame` takes a policy per seat

`runGame` today picks one policy for all seats through `botKind`. Add an
optional `policyFor?: (seatId: string) => BotKind | BotPolicy`. When given, it
takes precedence over `botKind`; when omitted, behaviour is unchanged (every
existing test and the CLI keep working). Bot memories stay per seat.

`BotKind` is widened to the registered policy ids: `'random'`, `'rule-based'`
and `'rule-based-v1'`. Policy lookup lives in `bots` as a small registry by id
(`policyById`), not a switch in `sim`.

### Pairing

A tournament is `{ games, seats, challenger, baseline, firstSeed }`.

- Game `i` uses seed `firstSeed + i`.
- Seats alternate: seat `k` plays the challenger when `(k + i) % 2 === 0`,
  otherwise the baseline. The pattern therefore flips every game, so each
  policy sits in each seat position equally often (for an even seat count).
- An odd seat count is rejected, so both sides always have equal seats.
- Game setup is the same as the CLI's `createGame(kingdomWarMode, registry,
  seatIds, seed)`.

### Scoring

A game's `result.winningSeatIds` decides it. A seat counts as a win for the
policy that played it, so a team made of both policies that wins gives each
policy wins for its own seats. Tallies per policy:

- seat-games (one per seat per game) and seat-wins, hence win rate
- a breakdown by the seat's kingdom at game end
- games that ended without a result inside the action cap (`maxActions`),
  reported separately and excluded from win rates

Because seats within one game are not independent, the comparison is made
over games, not seat-games. Each finished game gives a *challenger share* (the
fraction of challenger seats that won) and a *baseline share*; the game's
difference is the first minus the second. The report gives the mean
difference with a 95% interval (mean ± 1.96 × standard error over finished
games) and the number of games used. The challenger is better only when the
whole interval lies above 0. Per-policy win rates are shown for reference.

### Output and CLI

`sim tournament <games> <seats> <challenger> <baseline> [firstSeed]` prints a
plain-text table (policy, seat-games, wins, rate, interval, per-kingdom rates,
unfinished games). The same arguments always give the same numbers. Policy ids
are validated against the registry, with an error naming the valid ids.

### Testing

- A tournament of a few games with fixed seeds returns identical tallies on a
  second run.
- Pairing: each policy gets each seat position equally often; an odd seat
  count throws.
- Scoring: a hand-built result (two policies, known winners) produces the
  expected wins, rates and unfinished count.
- `runGame` with `policyFor` omitted behaves as before (existing specs).

## Part 2: Smarter targeting (`projects/bots`)

### The score

A new `targeting.ts` exports `targetScore(view, me, target)`; higher is a
better target. Damage is taken as 1 (a Sha or Duel; Wine's extra point is
ignored). Factors, in the order they matter:

1. **Kill chance.** The play's damage reaches the target's HP: a large bonus.
2. **Defence.** Penalties for an Eight Trigrams worn, and for a large hand
   (more chance of a Shan); a small bonus for an empty hand.
3. **Threat.** A bonus for a seat that attacked us or a known ally earlier
   this game, read from the visible event log.
4. **Weakness.** Lower HP scores higher, as today, as the tiebreaker.

Allies are never scored: `isAlly` still filters them out first. Weights are
named constants in one place so they can be tuned against the harness.
Everything the score reads is in the bot's redacted view; no hidden
information is used.

### Where it applies

`fillPick`, `targetedPlays`, the conversion target sorts (`conversionsAs`,
the Sha conversion, `byWeakest`) and the Delayed-Tool rules that rank targets
by HP switch to `targetScore`. Rules that rank by a different quantity on
purpose (Capture's highest HP, Starvation's biggest hand) keep it. Each
changed call site has a spec that shows the new choice.

### Keeping the baseline

The bots library registers two policies:
- `rule-based-v1`: the current behaviour, frozen, so the harness has a
  fixed opponent.
- `rule-based`: the new targeting. The app and server keep using
  `rule-based`.

`rule-based-v1` shares all other rules with `rule-based`; the targeting
function is the only injected difference, so the two cannot drift apart.

### Testing

- `targeting.spec.ts`: a killable target outranks a healthier one; Eight
  Trigrams lowers a target's score; a seat that attacked us outranks an
  otherwise equal one; ties resolve by weakness, then seat index.
- Existing `rule-based.spec.ts` stays green, with expectations updated only
  where the new choice is intended and explained in the spec.
- A seeded tournament (new vs `rule-based-v1`) runs as a script, not in the
  unit suite, because it takes minutes.

## Acceptance

1. `sim tournament` runs and is deterministic for a given seed range.
2. The new `rule-based` is compared with `rule-based-v1` over at least 500
   games on a 4-seat table; the result is recorded in the stage notes.
3. All existing unit tests pass.
4. If the new targeting does not beat `rule-based-v1` outside the interval,
   the weights are revisited or the change is dropped, and the stage notes
   say so.
