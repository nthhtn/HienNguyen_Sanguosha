# Kingdom Wars Bots, Part 3: No Wasted Plays — Design Spec

Status: Approved by the developer on 2026-11-11
Date: 2026-11-11
Parent: `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-design.md`
(Part 3 section, and its "How it is judged", "Where the knowledge lives" and
anti-goals, which all still hold). Builds on Part 2 (PR #74,
`feat/kingdom-wars-bots-part-2`), not yet merged; this branch starts from it.

## Why

The developer watched bot games and named these as the plays that stand out:

1. Bots play a Sha into Black Shield, and Tools into Lu Xun's Humility.
2. Bots don't know whether to answer a Duel with Sha or just take the damage.
3. Bots don't know whether attacking Liu Shan is worth it.
4. Bots don't know whether to play Sha or Shan against Lu Bu.

So Part 3 grows from "skip plays that do nothing" (the parent spec) to **"don't
spend cards where they buy nothing"**. The developer also chose to fold in
Part 2's two loose ends: the legacy per-skill targeting that ignores the truce,
and the bloodier games Part 2 caused.

## Goals

Part 3 serves the parent spec's Goal 1 (less waste) and Goal 4 (fewer own
casualties), and finishes Goal 5 (alliances) for skills.

- **A. Stopped plays.** The bot does not play a card or skill on a target when
  something visible on that target would stop it outright.
- **B. Costly targets.** The bot counts the extra cost some targets impose
  before choosing them.
- **C. Answer or take the hit.** When asked to answer (Shan to a Sha, Sha in a
  Duel), the bot weighs keeping its cards against keeping its HP, using its
  exposure until its next turn.
- **D. The parent's other waste.** Discarding a card the bot could have used
  this turn to gain an advantage, and using a skill whose only effect is to
  reveal a General for nothing.
- **E. Legacy skill targeting on the ranker.** The per-skill target picks in
  `skills.ts`, `wind.ts`, `fire.ts`, `forest.ts` and `mountain.ts` that harm
  a seat move onto Part 2's table ranker, so they respect `HOLD_FIRE` and the
  truce, and get A and B's checks.
- **F. Bloodshed tracked.** HP lost per game is watched so it does not rise
  further from Part 2's level. Keeping cards (rule C) takes priority over
  lowering it (the developer's decision).

## Non-goals

- Lookahead search (parent non-goal). "Possible next moves" are estimated from
  what is visible (rule C2), not played out.
- Card counting beyond what rule C1 allows, and hidden-kingdom inference.
- Engine rule changes, app or server changes.
- A full migration of every legacy skill switch: only the picks that choose a
  seat to harm (Goal E) must move.

## Anti-goals

- **Never use what the seat cannot see** (parent, absolute). A hidden General
  is assumed to have no skill. An opponent's hand is a count, never its cards.
- **No central registry of content in the bots.** Whether something stops a
  card is declared by the card, equipment or skill that does the stopping, in
  `projects/content`, and read through the registry. Adding a new armor or
  skill must not mean editing a list in `bots`.
- **No slower games**: the 8-seat game time stays within 3x of `rule-based-v3`
  (parent bar). Part 2 is at 1.27x.

## The rules

Rule text before code (CLAUDE.md). These are the rules the plan must implement;
numbers marked *tunable* are the builder's first values.

### A. Stopped plays

A1. Before a card or skill is used on a target seat, the bot asks the
registry whether any **revealed** ability of that seat (General skill or
equipment) would stop it with no effect. If one would, that target is
skipped. If no target is left, the play is not made.

A2. The facts are declared in content next to the stopping ability, as a pure
function of the bot's view: given the card being used (its definition, the
`as` it is used as, colour, suit), the user seat and the target seat, does this
ability stop it outright? It must give the same answer as the engine's trigger
in the situations the bot can see, including when the stop is turned off (Black
Pommel ignoring armor turns Black Shield's answer to no). The examples the
developer named, and the ones known today:

- Black Shield: a black Sha.
- Wood Armor: a Sha with no nature. (Barbarians and Hail of Arrows already
  skip its wearer as a target, so the engine handles those.)
- Lu Xun's Kingdom Wars Humility: Steal and Capture. Humility, Kingdom Wars
  Empty City and Behind the Curtain already carry a `CancelsCard` predicate
  (`shared/cancel.ts`, `cancelsCardsOnOwner`); exposing it as the fact is the
  natural route.
- Liu Shan's Pleasure: a Sha, when the user has no other Basic card in hand
  (with one, see B).
- Any other armor or skill whose trigger logs a `no-effect` outcome. A content
  spec lists every ability that can log `no-effect` and fails when one declares
  no stop fact, so a new one cannot be forgotten.

A3. A mass card (Barbarians, Hail of Arrows) is not skipped because some
targets are stopped; those targets just count for nothing in its value.

### B. Costly targets

B1. A target can declare an extra cost for a card used on it, also in content
next to the ability. Today: Liu Shan's Pleasure (a Sha on him costs another
Basic hand card).

B2. The bot uses such a target only when it can pay and the play is still
worth it: the target ranks above every target without the cost by the table
ranker, or it is the only target, and the bot would still keep its last Shan or
Peach after paying (*tunable*: never pay with the last Shan or Peach unless the
target can be killed by this Sha).

### C. Answer or take the hit

C1. **Reading a duel.** The bot counts the Sha it can play (conversions
included). The opponent's Sha are estimated from its hand count only, at a
fixed share of its hand (*tunable*, first value 0.3 Sha per card) plus any
Sha the opponent showed publicly this game and has not used since. Against
Matchless (Lu Bu, the `doubleAnswers` modifier) each round costs the bot two
Sha.

C2. **Exposure until the bot's next turn.** For each living seat that acts
before the bot's next turn and is not on the bot's side: it counts if it can
reach the bot (in attack range, or holding enough cards to plausibly have a
Tool that needs no range). Each counted seat adds a threat weighted by its hand
size, a damage-adding weapon, and its Part 2 danger; a truce partner counts at
a fraction (*tunable*). Against that, protection: Peach in hand, Shan that
would be left after this answer, armor, and revealed seats on the bot's side
with cards. The bot is **exposed** when the expected damage before its next
turn could bring it to dying and its protection could not cover it.

C3. **Fight or take it.**
- Always answer when the hit would kill the bot or leave it dying.
- When the attacker is a truce partner, take the hit (don't win a Duel against
  an ally) unless C3's first point applies or the bot is exposed.
- In a Duel against an enemy: fight when the bot's Sha are expected to outlast
  the opponent's (C1), or when the bot is exposed. Otherwise take the 1 damage
  at once and keep the hand.
- Against a Sha: answer when the bot can answer fully (two Shan against
  Matchless) and either it is exposed or keeping the Shan buys nothing (it has
  more Shan than C2's threats need). If it cannot answer fully, it never plays a
  partial answer.
- This replaces what the shipped bot does today: with `shanHold` off it
  answers every card's damage it can. (`shouldHoldShan`, 3+ HP and fewer
  than 2 Shan, exists but is off in `rule-based`.)

C3a. **Other answers** (my call). Hail of Arrows (Shan) and Barbarians (Sha)
follow the Sha rule: one answer, judged with C2's exposure. For a mass card,
C2 counts only the seats that act after the mass card has resolved. Answers
asked by a skill keep their current logic unless the skill's answer is a Shan
or Sha against damage aimed at the bot, which then follows the same rule.

C4. **The same judgment on attack.** The bot does not start a Duel against a
seat expected to outlast it (C1 in reverse), and counts Matchless the same way
when it is the one Dueling Lu Bu.

### D. The parent's other waste

D1. At the discard step, the bot keeps cards a rule could have used this turn
ahead of cards no rule could use (it already ranks with `keepRank`; the rule
makes "usable now but held" rank higher).

D2. The bot does not use a skill on a hidden General when the skill's only
effect would be the reveal: no target, no card, no HP gained.

### E. Legacy skill targeting

E1. Every legacy pick that chooses a seat to harm (damage, discard, steal, a
harmful Judgment) ranks candidates with the table ranker and drops
`HOLD_FIRE` seats, like Part 2's harmful selections.

E2. Picks that help a seat (heal, give cards) keep their own logic.

E3. Each moved pick also gets A and B.

## Where the knowledge lives

As in the parent: stop and cost facts in `projects/content`, next to the
ability (A2, B1). Play judgment (C, D, E) in `projects/bots/src/lib/rules/`
and the existing helpers. `content` does not import `bots`.

## How it is judged

Challenger `rule-based-waste` against `rule-based-v5` (`rule-based` at the end
of Part 2, frozen), Kingdom Wars deck, two seed ranges not used before.

New simulator counts, reported per policy over the same games:

- **Wasted plays per game**: cards and skills that ended with a logged
  `no-effect` outcome caused by the target, plus answers given that did not
  stop the damage (a single Shan against Matchless, Sha spent in a Duel that
  was lost anyway).
- HP lost per game and deaths per game (already reported by `balance`).

**The bar** (my call, the developer may override): at 6 seats, on both seed
ranges, in `balance` runs (every seat one bot):

1. Wasted plays per game: paired difference wholly below 0.
2. HP lost per game: paired difference not wholly above 0 (the developer's
   decision: rule C's "take the hit and keep the card" stands even though it
   pushes HP lost up, so HP lost must not get clearly worse but need not
   drop). Deaths per game of the bot's own side are reported next to it.
3. Leader-won rate: not wholly above 0 (Part 2's gain is not undone).

And the mirrored tournament's seat share is not wholly below 0 on both ranges.
The 8-seat time bar holds. Up to three tuning sets of the *tunable* values are
allowed between ranges, recorded.

Results go in this spec under `Results`, and a summary in the parent spec.

## Constraints

- Framework-free, deterministic, redacted view only; the leak checks in
  `projects/sim` keep passing.
- `npm run verify` and the tests green; merging is the developer's. PR #74
  merges first; this branch is then rebased on `main`.

## Left to the builder

- The tunable values and their tuning.
- How the stop and cost facts are typed on abilities.
- The order of work, and how the legacy picks are grouped while moving them.
- The exact report format of the waste count.

## Results

**The bar and seeds** (written before any run). At 6 seats, on the seed ranges
starting at `1500000` and `1600000` (not used before), `balance` runs of 2000
games each, every seat one bot (A is `rule-based-waste`, B is
`rule-based-v5`; differences are A minus B, paired by seed, 95% intervals):

1. Wasted plays per game: the whole interval below 0.
2. HP lost per game: not wholly above 0. Deaths per game are reported next to it.
3. Leader-won rate: not wholly above 0.

And `tournament 4000 6 rule-based-waste rule-based-v5 <seed> mirrored`: the
seat-share difference not wholly below 0 on both ranges. The 8-seat time
(`/usr/bin/time -p npm run sim -- balance 400 8 <bot> <bot> 1400000`) of
`rule-based-waste` stays within 3x of `rule-based-v3`. Up to three tuning sets
of `EXPOSURE_WEIGHTS` (`projects/bots/src/lib/exposure.ts`) may be tried on the
first range only, each recorded with its numbers; the second range runs once,
with the final set.
