# Bot Improvement Roadmap — Design Spec

Status: Approved in conversation, pending written-spec review
Date: 2026-10-15

## Purpose

The rule-based bot is a fixed priority list (see the bot opponents spec). The
tournament harness (`docs/superpowers/specs/2026-10-15-bot-tournament-and-targeting-design.md`)
can now measure whether a change makes it stronger. The first change tried,
scored targeting, gave +1 to +2.5 pp but never cleared its margin of error.
This roadmap improves the bot in stages, each judged the same way, and first
fixes the measurement so that gains of 1 to 3 pp can be seen.

## Scope

In scope, in this order:

0. **Mirrored seed pairs** in the tournament harness.
1. **Card play** (resource use in the Play phase).
2. **Responses** (what to answer with, and when).
3. **Knowledge**: card counting, and hidden-kingdom inference, from one module.
4. **General selection.**

Out of scope: lookahead search, the engine, the app and the server. Bots only
choose among legal actions and see only their redacted view; neither changes.

Each stage has its own branch, spec, plan and recorded result. Stages are
independent: a stage that does not ship does not block the next.

## How every stage is judged

1. The stage's behaviour is added under its own policy id, as a variant built
   with `createRuleBasedPolicy` (or a small extension of it), registered in
   `policies.ts`. The shipped `rule-based` and the frozen `rule-based-v1` are
   not edited during the experiment.
2. It plays the **current shipped bot** with the tournament on mirrored pairs,
   4 seats, at least 4000 games (2000 pairs) on a first seed range.
3. It ships only if the whole 95% interval is above 0 on that range **and**
   again on a second range it was not tuned on. Tuning (changing constants)
   happens only between those two runs, at most three sets, all recorded.
   Anything else is reported as not shipped and left unregistered or, if useful
   later, registered under its own id.
4. When it ships, the policy that was shipped is frozen under the next id
   (`rule-based-v2`, `-v3`, …) so the next stage has a fixed baseline, and
   `rule-based` becomes the new behaviour. The app and server keep using
   `rule-based`; no app or server code changes.
5. The result, with every run, goes into that stage's spec under `Results`.

Rule text before code: each stage's spec states its rules in plain words
before implementation, per `CLAUDE.md`.

## Stage 0 — Mirrored seed pairs

Today each game uses a new seed, so the interval includes the luck of the deal
and of the Generals. A **pair** plays one seed twice with the sides swapped:
in game A seat `k` plays the challenger when `k` is even; in game B when `k` is
odd. The pair's value is the mean of the two games' differences (challenger
share of seats won minus baseline share).

- `runTournament` gains `mirrored?: boolean` (default `true` for the CLI,
  `false` in the config so existing callers keep their numbers). When on, game
  `i` uses seed `firstSeed + floor(i / 2)` and flips sides on odd `i`; an odd
  `games` count is rejected.
- The interval is taken over pairs: a pair counts only when both games finish.
  The report states pairs used and the number of unfinished games.
- Both games of a pair share one seed, so the deal and the Generals offered
  match; only the side assignment differs. (The `random` bot's stream is shared
  by all `random` seats and drifts once the sides swap; this does not affect
  the validity of the pair means.)
- Per-policy win rates and kingdom tables are summed over all finished games
  as before.
- Checks: two bots that behave identically (`rule-based` against
  `rule-based-v1`) give exactly 0.0 pp with a zero-width interval in mirrored
  mode, which verifies the pairing (same deal, sides swapped) but cannot show
  narrowing. Narrowing is checked on two close bots, the same comparison run
  unmirrored and mirrored at the same number of games. `rule-based` against
  `random` is still clearly positive. All numbers are recorded in this
  stage's results.
- `sim tournament` gets `--mirrored` / `--unmirrored` behaviour by a trailing
  argument; the default is mirrored.

## Stage 1 — Card play

Rules (plain words; finalised in the stage spec):

- **Peach:** the bot plays a Peach on itself during its Play phase when below
  max HP, but keeps one Peach when a revealed ally is at 2 HP or less or the bot
  would otherwise hold no Peach for a dying round.
- **Wine:** plays Wine before a Sha only when it holds a Sha that can be played
  after it this turn.
- **Equipment:** replaces a worn piece when the new piece is better by a fixed
  ranking per slot (for example a longer-range or stronger weapon), not only
  into an empty slot.
- **Reserve:** before playing a Sha beyond the first, or discarding, keeps at
  least one Shan and one Peach.

## Stage 2 — Responses

- A **Shan** answer is held back when the incoming damage is not lethal, the bot
  has fewer than two Shan, and it is above 2 HP.
- A **Wuxie** is also used to protect a revealed ally from a harmful Tool, and
  against an enemy's helpful Tool (Draw Two, Peach Garden when it heals more
  enemies than allies); it never answers a Wuxie unless it protects its own
  target.
- Responses are ordered by the value of the card spent (`keepRank`), not by
  the order the engine lists them.

## Stage 3 — Knowledge

A new `knowledge.ts` in `bots` derives, on every decision, from the redacted
view only (the public log, the discard pile, revealed Generals); nothing is
stored between decisions.

- **Card counting:** for each card definition, copies in the deck minus copies
  seen (discard pile, worn equipment, the bot's own hand, cards revealed in the
  log). Used for the odds that a seat holds a Shan or Peach, in targeting
  (not shipped on its own) and in Stage 2's responses.
- **Kingdom inference:** a score per hidden seat from who it helped or attacked
  (log events), combined with the cap on seats per kingdom given the Generals
  already revealed. It returns `ally`, `foe` or `unknown` with a threshold; the
  bot's `isAlly` consults it, so every existing rule benefits.
- Both parts are unit-tested on hand-built views and judged together by the
  tournament; if only one helps, only that one ships.

## Stage 4 — General selection

The bot chooses the pair with the highest score instead of the highest combined
max HP: kingdom match is required (as now); a per-General value table (named
constants, one place) rates generals by how useful their skills are to the
rule-based bot's play, and max HP breaks ties. The table is tuned in at most
three sets, as above.

## Testing

- Unit specs for every new function, on hand-built views, as the existing bot
  specs do.
- Each stage's tournament is a script, not part of the unit suite.
- The full suite (`npx jest --selectProjects bots sim app`) and
  `npm run typecheck:server` stay green at every commit.

## Acceptance

- Stage 0: mirrored mode implemented with the control and sanity results
  recorded.
- Each later stage: either shipped under the rule above, or reported as not
  shipped with all runs recorded.

## Stage 0 results

Date: 2026-10-15. Stage 0 implemented as specified. All runs 4 seats.

| Run | Unmirrored | Mirrored |
|---|---|---|
| `rule-based` against `random`, 200 games, seed 0 | +39.3 pp (+34.1 to +44.4), ±5.2 | +41.8 pp (+36.4 to +47.1), ±5.4 over 100 pairs |
| scored targeting against `rule-based-v1`, 4000 games from seed 10000 (unmirrored: seeds 10000 to 13999; mirrored: 2000 pairs, seeds 10000 to 11999) | +1.2 pp (−0.4 to +2.8), ±1.6 | +1.1 pp (+0.1 to +2.2), ±1.05 over 2000 pairs |
| `rule-based` against `rule-based-v1` (identical behaviour), 4000 games, seed 0 | n/a | 0.0 pp (0.0 to 0.0) over 2000 pairs |

What this says:

- Identical bots give exactly zero in mirrored mode, so the pairing (same deal,
  sides swapped) works. It checks the pairing, not the size of the noise.
- Against `random` there was no measurable narrowing at this size (±5.4 against
  ±5.2 over only 100 pairs, so the width itself is uncertain by several per
  cent). A plausible reason, not measured, is that `random` adds so much noise
  of its own that the deal is a small part of the variance.
- Between two close bots, which is the case the harness exists for, mirroring
  narrowed the interval by about a third (±1.6 to ±1.05) for the same number of
  games, equivalent to roughly 2.3 times as many unmirrored games. This rests
  on one run per arm. The point estimate barely moved (+1.2 and +1.1 pp), as it should.
- The mirrored scored-targeting run was made by temporarily switching
  `rule-based` to `targetScore` (default weights) in the working tree and
  restoring the file afterwards; nothing of it is committed. It shows the
  scored targeting just above its
  margin on seed 10000 (+0.1 to +2.2). That is one run on a range that was
  already used, so it is a lead for a later attempt, not a result: the
  acceptance rule still requires it on two fresh ranges, and the earlier
  tuned-weights run on a fresh range (+1.1, −0.5 to +2.7, unmirrored) did not
  clear it.
