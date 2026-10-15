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
- Both games of a pair share one seed, so the bots' random streams and the
  deal match; only the side assignment differs.
- Per-policy win rates and kingdom tables are summed over all finished games
  as before.
- Check: `rule-based-v1` against itself (control) gives an interval that contains 0
  and is narrower than the unmirrored one at the same game count; `rule-based`
  against `random` is still clearly positive. The numbers are recorded in this
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
