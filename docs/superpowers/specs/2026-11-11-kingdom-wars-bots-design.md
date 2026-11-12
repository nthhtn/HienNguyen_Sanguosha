# Kingdom Wars Bots — Design Spec

Status: Approved by the developer on 2026-11-11
Date: 2026-11-11

## Why

Kingdom Wars is the default deck (and the only one enabled in Game Setup), but
the rule-based bot still plays as if the game used the Identity deck:

- **General picks** come from a value table fitted on Identity games
  (`projects/sim/src/fitGenerals.ts:76`, `{ deck: 'identity' }`, 4 seats).
  Kingdom Wars Generals are scored as their Identity base (`baseGeneralId` in
  `projects/bots/src/lib/general-values.ts`), and Kingdom Wars-only Generals
  score 0. In a 400-game, 6-seat bot-only run (seed 5000) Shu won about 55%,
  Wu, Qun and Ambitionists 6–11% each; with random picks the spread was 13–29%.
- **Skills** that have a Kingdom Wars variant are played by the Identity
  base's logic: the bot strips the id with `baseSkillId` ("a variant is
  offered under its own id and used like its base", `skills.ts`). 60
  Generals have documented differences
  (`projects/content/data/decks/kingdom-wars/differences.json`). Zou Shi's two
  active skills are never used.
- **Cards**: Wuxie Kingdom (`wuxie-guo`) is never played. Amass, Ascertain and
  Ally Far Attack Near are answered when they reach the bot but never played
  from its own hand. Wu Six Swords and Trident Glaive have no handling. Chains
  is never played, and Harvest is only answered, never played. Blaze is partly
  handled.
- **Reading the table**: every seat outside the bot's own revealed force is an
  enemy, ranked by low HP and by hostile acts (`helpers.ts` `isAlly`,
  `targeting.ts`). Force size plays no part, so two small forces wear each other
  down while a large one wins.
- **Waste**: the bot can play a card that will do nothing, for example a black
  Sha into Black Shield. The engine only removes targets that are illegal
  (`untargetableBy`, for example Lu Xun's Modesty once revealed); a card whose
  effect is stopped by a trigger is still legal.

The developer wants bots that play the Kingdom Wars deck well, as opponents for
people.

## Goals

The developer judges success by these five points:

1. **Less waste.** Bots stop playing cards and skills that will have no effect.
2. **Use what helps.** Bots use every card and skill that gains them an
   advantage, rather than holding them.
3. **Proactive skills.** Bots use skills on their own initiative to gain an
   advantage and damage opponents (for example both of Zhou Yu's skills).
4. **Fewer own casualties.** Bots protect themselves and their side (for
   example Zhuge Liang arranging the top of the deck so his own Judgments come
   out well).
5. **Flexible, temporary alliances.** When one force outnumbers the others, the
   other forces stop fighting each other and focus on it until it is weakened,
   then go back to treating each other as enemies.

Plus: the General value table is refitted for Kingdom Wars and improved.

## Non-goals

- **The Identity deck.** It is disabled in Setup until its rules exist. The bot
  must keep working with it (the server still accepts it), but nothing is tuned
  for it.
- **Lookahead search.** The bot stays a rule-based player choosing among legal
  actions.
- **Hidden-kingdom inference and card counting** (Stage 3 "Knowledge" of the
  bot roadmap, not built). Not required here; the builder may use simple
  inference only from public events.
- **Engine rule changes.** Rule mismatches already listed in
  `docs/deferrals.md` (Warrior Saint, Horsemanship, Insanity Streak, Banish
  order) stay as they are; the bot plays the engine's rules.
- **App or server changes.** Both keep using the policy id `rule-based`.

## Anti-goals

- **A bot never uses what its seat cannot see.** It decides only from its
  redacted view and the engine's legal actions. This holds always and without
  exception; the existing leak checks in `projects/sim` must keep passing, and
  the new knowledge (threat, waste, alliances) must be derived from the
  redacted view only.
- **No central registry of all content in the bots.** CLAUDE.md asks for
  data-driven registries: adding a General or card must not mean editing a
  growing switch in `bots`. See "Where the knowledge lives".
- **No slower games.** A bot decision must stay fast enough that the existing
  bot move delay (animation + 1.5 s) is not stretched. My call on the bar: the
  simulator's 8-seat game time grows by no more than 3×.

## Scope, in four parts

The new bot replaces the current one: when it ships, `rule-based` becomes the
new behaviour, and the current bot is frozen as `rule-based-v3` only as the
tournament baseline (the developer chose replace, not an easier difficulty).

### Part 1 — Kingdom Wars rules

Every card in the Kingdom Wars deck and every Kingdom Wars skill variant is
played by its own Kingdom Wars rules:

- Play from hand, with a rule for when it is worth it: Wuxie Kingdom, Amass,
  Ascertain, Ally Far Attack Near, Chains, Harvest, Blaze.
- Equipment with a choice: Wu Six Swords, Trident Glaive (and any equipment
  ability that asks a question).
- Skill variants: each of the 60 Generals listed in `differences.json` is
  checked. Where the variant's wording changes what a good play is, the bot
  gets the variant's own rule instead of the base's. Where it does not, the
  base rule stays and that is recorded.
- Kingdom Wars-only skills: Zou Shi's two active skills, and any other skill a
  registry scan finds that no bot rule offers.

A coverage spec fails when a Kingdom Wars card or an active, triggered or
conversion skill is neither handled by a bot rule nor on an explicit,
commented "deliberately ignored" list.

### Part 2 — Reading the table (threat and alliances)

The bot builds a picture of the table from its redacted view:

- **Force strength.** For each force (and each Ambitionist as a force of one):
  revealed seats, their combined HP, cards in hand and equipment. Hidden seats
  are unknown and count to no force.
- **Seat threat.** Revealed skills, equipment (weapons that extend range or add
  damage, armor), hand size, HP, and hostile acts so far. How dangerous a skill
  is is declared next to the skill (see below), not guessed in the bot.
- **Temporary alliance.** When one force is clearly stronger than every other
  (the leader), every bot outside it treats the leader's seats as its preferred
  targets and avoids hurting seats of other non-leading forces, except where
  the game would otherwise be lost or where an attack is free. When the leader
  is no longer clearly stronger ("weakened"), the alliance ends and bots go
  back to normal targeting. The thresholds for "clearly stronger" and
  "weakened" are the builder's to set and tune with the tournament, with two
  fixed points: a force holding more revealed seats than any other plus at
  least one more seat than the second force counts as leading; the alliance
  must end before the allied forces could no longer win (a bot never helps
  another force win at the cost of its own).
- An alliance is never declared or shown; it only changes what each bot
  chooses. Bots of the leading force do not change behaviour because of it.

### Part 3 — No wasted plays

Before playing a card or skill on a target, the bot asks whether anything
visible on that target would make it do nothing, and skips it if so. Examples:
a black Sha into Black Shield, a Sha into a seat that cannot be damaged, a
Tool into a seat whose revealed skill cancels it. Whether an effect would be
stopped is declared by the card, equipment or skill that stops it (see below),
so a new armor or skill brings its own answer. Hidden Generals are unknown: the
bot does not assume a hidden seat has any skill.

Also counts as waste, and is avoided: discarding a card that the bot could
have used to gain an advantage this turn, and using a skill whose only effect
is to reveal a General for nothing.

### Part 4 — The General value table

After Parts 1–3 ship, refit the table on Kingdom Wars games played by the new
bot:

- `fit-generals` gets a deck argument; the fit runs on `kingdomWars`.
- Values are keyed by the full Kingdom Wars General id, so Kingdom Wars-only
  Generals get a value.
- My call: fit across 4 to 8 seats, not 4 only, since the app allows them all.
- "Improved", beyond the refit, is the builder's to propose with numbers. Two
  candidates to try, each judged by the tournament: a pair term for
  Synergistic Partners (the deck lists them and the engine now rewards them),
  and a force term so a bot does not pick into a force already crowded at the
  table.

Part 4 runs last because a General's value depends on how well bots play it.

## Where the knowledge lives

Two kinds of knowledge, kept in two places (agreed during Part 1):

- **Facts** about a card or skill (what stops a card from doing anything
  against a seat, how dangerous a revealed skill is) are declared next to that
  card or skill in `projects/content`, and the bot reads them through the
  registry. Parts 2 and 3 need these.
- **Play judgment** (when a card or skill is worth using) lives in a
  data-driven registry inside `projects/bots` (`rules/`, one entry per card or
  skill id, no switch). It needs the bots' own helpers (allies, targeting,
  `keepRank`), and `content` may not import `bots`, so it cannot sit in
  `content`.

The dependency rules stand: `bots` may import `content` and `engine`; `content`
must not import `bots`; the engine must not learn about bots. The existing
per-skill switches in `projects/bots/src/lib/skills.ts`, `wind.ts`, `fire.ts`,
`forest.ts` and `mountain.ts` are moved into the registry when a part touches
them; a full migration of untouched skills is not required.

## How it is judged

The roadmap's method (`docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md`)
is kept, with a different ship rule (decided by the developer): each part is
built under its own policy id first, plays the shipped bot in mirrored
tournaments on two seed ranges (Kingdom Wars deck), and is measured by the
counts below on the same games. A part **ships when it clearly improves the
counts for its own goals** on both seed ranges, **even if it does not win more
seats**. It does not ship if it makes win share clearly worse (the whole 95%
interval below 0 on both ranges). A win-share gain is welcome but not
required. What "clearly improves" means for each count (for example, a 95%
interval on the difference that excludes 0) is the builder's to set before the
first run and record. The results go in this spec under `Results`.

New simulator counts, reported per policy over the same games, one per goal:

1. Cards and skills used to no effect (Goal 1).
2. Cards held at the end of the turn that a rule could have used, and skills
   offered but never used, per skill (Goals 2 and 3).
3. Own-side deaths and HP lost per game (Goal 4).
4. Win rate per force across a bot-only run, and how often a leading force wins
   (Goal 5 and the balance problem above).

The developer also watches games in the app to judge what the numbers can't,
mainly whether alliances look sensible.

Calls made for the builder (the developer may override them):

- **Seat count.** The gate runs at 6 seats, where a leading force can form,
  as well as the roadmap's 4. Part 4's refit is also checked at 8.
- **Baselines.** The roadmap's chain: the current bot is frozen as
  `rule-based-v3`; each part that ships becomes `rule-based`, and the bot it
  replaced is frozen under the next id (`-v4`, …). A part that does not ship
  stays off, and the next part builds on the last shipped bot.
- **All-new tables.** Alliances need every non-leading seat to take part, and
  mirrored tournaments mix new and old bots. So Goal 5's counts and Part 2's
  tuning come from bot-only runs where every seat plays the challenger,
  compared with the same seeds where every seat plays the baseline.
- **Identity picks.** The value table becomes per deck. Identity keeps
  today's table; Kingdom Wars gets the refit.

The tournament and fitting must run on the Kingdom Wars deck; today they use
the deck default or Identity.

## Constraints

- Bots stay framework-free, deterministic (no `Math.random`, no clock) and
  decide from the redacted view (`docs/architecture/bots-and-simulation.md`).
- CLAUDE.md: rule text before code. Each part's plan states its bot rules in
  plain words before implementation.
- Branch per part, `npm run verify` and the tests green, merging is the
  developer's.

## Left to the builder

- The thresholds and weights for threat, leading force and weakened.
- The order inside Part 1, and which variants need their own rule.
- Whether Parts 2 and 3 ship together or apart.
- The exact simulator report format.

## Results

### Part 1 — Kingdom Wars rules

**The bar** (decided before any run). Part 1 passes when `Part 1 uses per
game`' whole 95% interval is above 0 on both seed ranges, each of the 12
`PART_1_KEYS` is used at least once by the challenger over the run (any key at 0
is listed and explained), and the seat-share interval is not wholly below 0 on
both ranges. No tuning was done between ranges.

Challenger `rule-based-kw` (the Part 1 registry, now shipped as `rule-based`)
against `rule-based-v3`, 4000 mirrored games each, Kingdom Wars deck, run at
commit `c3834ebf`, with the challenger registered as `rule-based-kw`. Today the
same comparison is `npm run sim -- tournament 4000 <seats> rule-based
rule-based-v3 <seed> mirrored`.

| Seats | Seed | Seat-share difference (95%) | Part 1 uses per game (95%) | Wins by force, challenger / baseline (%) |
|---|---|---|---|---|
| 4 | 900000 | +4.2 pp (3.0 to 5.4) | 3.60 (3.48 to 3.72) | Wei 46.0 / 41.2, Shu 54.1 / 49.7, Wu 21.3 / 18.5, Qun 14.5 / 9.4, Ambitionist 15.5 / 12.8 |
| 4 | 1000000 | +4.9 pp (3.8 to 6.1) | 3.56 (3.44 to 3.68) | Wei 47.1 / 41.1, Shu 55.8 / 50.9, Wu 18.0 / 16.0, Qun 15.8 / 8.2, Ambitionist 16.2 / 10.5 |
| 6 | 900000 | +3.7 pp (2.8 to 4.6) | 4.96 (4.83 to 5.09) | Wei 39.8 / 36.4, Shu 53.6 / 48.5, Wu 9.8 / 8.0, Qun 6.9 / 5.8, Ambitionist 8.2 / 5.1 |
| 6 | 1000000 | +2.7 pp (1.9 to 3.6) | 4.94 (4.81 to 5.07) | Wei 40.0 / 36.4, Shu 51.8 / 49.1, Wu 9.4 / 7.6, Qun 7.5 / 4.2, Ambitionist 8.9 / 7.4 |

Usage of the 12 keys, offered / used, summed over the four runs:

| Key | Challenger | Baseline |
|---|---|---|
| Amass | 53461 / 8952 | 67281 / 0 |
| Ally Far Attack Near | 11734 / 8170 | 32470 / 0 |
| Harvest | 35807 / 2271 | 35325 / 0 |
| Ascertain | 42022 / 13152 | 64844 / 0 |
| Chains | 64656 / 20377 | 95167 / 0 |
| Blaze | 70326 / 7088 | 68505 / 0 |
| Wuxie Kingdom | 34494 / 4628 | 31160 / 4499 |
| Fire Fan | 8104 / 7854 | 7505 / 0 |
| Trident Glaive | 3149 / 1283 | 3008 / 0 |
| Femme Fatale | 650 / 295 | 4409 / 0 |
| Impetus for Conflicts | 2735 / 120 | 2245 / 0 |
| Benevolence | 54280 / 2213 | 47980 / 3656 |

**Verdict: passes, shipped.** On every run the Part 1 uses interval is above 0,
all 12 keys are used by the challenger (none at 0), and the seat-share
difference is above 0 on all four runs with every interval above 0, so the
"not wholly below 0" condition holds with room. The baseline never uses ten of
the keys. It does use Wuxie Kingdom (the engine's default answer) and
Benevolence; the challenger uses Benevolence less, likely because its threshold is
Kingdom Wars' 3.

**No slower games** (anti-goal: 8-seat game time grows by no more than 3x).
200 mirrored 8-seat games, first seed 1100000, each side the same bot
(`tournament 200 8 <bot> <bot> 1100000 mirrored`, wall time):

| Bot | Time | Ratio |
|---|---|---|
| `rule-based-v3` | 11.89 s | 1.00 |
| `rule-based` | 13.20 s | 1.11 |

Passes: 1.11x against the 3x bar.

**The audit that narrowed Part 1.** The coverage scan found that most Kingdom
Wars skill variants already had a bot rule (the base rule fits their wording).
The real gaps were six Tools (Amass, Ascertain, Ally Far Attack Near, Chains,
Harvest, Blaze), Wuxie Kingdom, Fire Fan, Trident Glaive, Zou Shi's two skills
and Benevolence's Kingdom Wars threshold. Part 1 therefore added rules for
those and a coverage spec that fails if a Kingdom Wars card or skill has
neither a rule nor a stated reason.

**A bug the first smoke run found.** Fire Fan's ask names no target, so its
rule never fired. The rule now
reads the Sha's targets from the log. The fix is `c3834ebf`, and the runs above
are from after it.

### Part 2 — Reading the table

**The bar** (decided before any run). Part 2 passes when, at 6 seats on both
seed ranges, the **leader-won rate** paired difference (`rule-based-table`
minus `rule-based-v4`, every seat one bot, `balance`) has its whole 95%
interval below 0; and the mirrored tournament's seat share (`rule-based-table`
against `rule-based-v4`) is not wholly below 0 on both ranges. Deaths per game
and HP lost per game, and the per-force win rates, are reported alongside
(Goal 4 and balance) and not gated. The 8-seat game time stays within the 3x
anti-goal. Up to three tuning sets of the rule 6 and 8 weights were allowed
between the ranges.

Challenger `rule-based-table` (the Part 2 bot, now shipped as `rule-based`)
against `rule-based-v4` (`rule-based` at the end of Part 1, frozen), Kingdom
Wars deck, 6 seats, run at commit `0f5e6607` with the challenger registered as
`rule-based-table`. **No tuning was done**: the weights of rules 6 and 8 are the
first set, and both ranges are untouched by any adjustment. Today the same runs
are `npm run sim -- balance 2000 6 rule-based rule-based-v4 <seed>` and
`npm run sim -- tournament 4000 6 rule-based rule-based-v4 <seed> mirrored`.

Balance, 2000 games each, every seat the same bot (A is the challenger, B the
baseline; differences are A minus B, paired by seed):

| Seed | Leader won A / B | Leader won difference (95%) | Deaths per game | HP lost per game | Wins by force, A / B (%) |
|---|---|---|---|---|---|
| 1200000 | 56.8 / 62.4 | -5.6 pp (-8.0 to -3.2) | +0.08 (0.04 to 0.12) | +2.64 (2.14 to 3.14) | Wei 35.3 / 36.6, Shu 46.5 / 51.4, Wu 14.4 / 8.4, Qun 12.4 / 6.7 |
| 1300000 | 55.7 / 66.5 | -11.0 pp (-13.3 to -8.6) | +0.14 (0.10 to 0.18) | +2.79 (2.28 to 3.30) | Wei 34.7 / 39.1, Shu 45.7 / 50.9, Wu 14.4 / 9.2, Qun 12.6 / 3.3 |

(Per-force rate is wins per seat that ended in that force. The Ambitionist
seats are listed per seat in the report files, as `ambitionist:<seat>`; the
tournament table below has one Ambitionist figure. `formatBalanceReport` now
sums them into one Ambitionist row.)

Mirrored tournament, 4000 games each, 6 seats:

| Seed | Seat-share difference (95%) | Wins by force, challenger / baseline (%) |
|---|---|---|
| 1200000 | +2.2 pp (1.2 to 3.1) | Wei 37.7 / 35.4, Shu 50.7 / 48.3, Wu 12.1 / 10.7, Qun 7.8 / 8.3, Ambitionist 11.0 / 7.8 |
| 1300000 | +1.4 pp (0.5 to 2.3) | Wei 38.3 / 36.3, Shu 49.8 / 48.4, Wu 10.9 / 10.4, Qun 9.8 / 9.3, Ambitionist 9.3 / 9.1 |

**No slower games.** 400 balance games at 8 seats, first seed 1400000, each
side the same bot (`/usr/bin/time -p npm run sim -- balance 400 8 <bot> <bot>
1400000`, wall time): `rule-based-table` 60.14 s, `rule-based-v4` 47.48 s, a
ratio of 1.27x against the 3x bar. Passes.

**The danger ratings were reviewed.** The 93 hand-drafted skill danger ratings
(`high`, `medium`, `low` by the rule 5 criteria) were shown to the developer,
who accepted them as drafted on 2026-11-11.

**Verdict: passes, shipped.** The leader-won paired difference is wholly below 0
on both ranges (-5.6 pp, -8.0 to -3.2; -11.0 pp, -13.3 to -8.6), so a leading
force wins less often when the bots read the table. The seat share is above 0
on both ranges (+2.2 and +1.4 pp, every interval above 0), so the bot is not
weaker for it, and it is slower by 1.27x. Deaths and HP lost are not gated, and
the honest reading is that games got bloodier: +0.08 and +0.14 deaths and +2.64
and +2.79 HP lost per game, with every interval above 0. That works against
Goal 4 (shorter, less grinding games) and is left for a later part. Smaller
forces gain (Wu and Qun win more often in both balance ranges) at the cost of
Shu and Wei.

**Where the shipped rules differ from the sketch in the Part 2 section above.**
The leading force is defined by seats alone: it has at least 2 seats and
strictly more seats than every other force (the sketch said "plus at least one
more seat than the second force", which is the same thing for integer counts).
It is weakened when it no longer has strictly more seats than every other
force, or when its HP is not greater than the HP of the force with the next
most seats; the sketch left "weakened" and the end of the alliance to the
builder, and does not use hand size or equipment, which the picture of the
table leaves out. Danger is the revealed Generals' skill ratings plus 10 times
their value in the General value table, not hostile acts alone; hostile acts
count separately in the ranking (rule 6). The rules are written out in the
plan.

**Decisions made while building.**

- Ambitionists count as truce partners: rule 3 literally, a force of one is a
  force that is neither the bot's own nor the leading force.
- A truce partner's score is clamped below every leading-force seat, however
  dangerous it is, so the leaders are always hit first.
- Harmful seat selections in the ladder (a selection that names seats to hurt)
  also hold fire on a truce partner, not only card plays.
- The legacy per-skill targeting in `skills.ts`, `wind.ts`, `fire.ts`,
  `forest.ts` and `mountain.ts` is not yet on the ranker: those skills sort by
  HP and keep today's notion of foe. Moving them is a follow-up.

### Part 3 — No wasted plays

Full results in `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-part-3-design.md`
(Results). Challenger `rule-based-waste` against `rule-based-v5`, 6 seats,
seed ranges 1500000 and 1600000, after three tuning sets of the exposure
weights on the first range.

**Verdict: fails, not shipped.** Wasted plays per game drop clearly (-3.66 and
-3.91, every interval below 0), HP lost and leader-won are not wholly above 0,
and the 8-seat time is 1.10x of `rule-based-v3`. But the mirrored tournament's
seat share is wholly below 0 on both ranges (-4.2 pp, -5.1 to -3.2; -5.2 pp,
-6.1 to -4.2): next to the old bot, the bot that holds its cards and takes
hits wins fewer seats. `rule-based` is unchanged (equal to `rule-based-v5`).

**Without rule C** (`rule-based-waste-no-c`: A, B, D and E on, rule C off, no
tuning, same bar and seeds): passes every gate. Wasted plays -3.23 and -3.48 per
game (intervals below 0), HP lost and leader-won not wholly above 0, tournament
seat share +1.6 pp (0.7 to 2.5) and +1.4 pp (0.5 to 2.2), 1.30x time.
**Shipped on 2026-11-12:** `rule-based` is now Part 3 without rule C; rule C
stays off behind `answerRule` for a later rework.


### Part 4 — The General value table

Full results in `docs/superpowers/specs/2026-11-12-kingdom-wars-bots-part-4-design.md`
(Results). Challenger `rule-based-picks-kw` (a Kingdom Wars table refit on
40,000 games at 4 to 8 seats, plus pair bonuses) against `rule-based-v6`,
mirrored tournaments, seed ranges 2300000 and 2400000, no tuning.

**Verdict: passes every gate, shipped on 2026-11-12.** Seat share +14.9 pp
(13.5 to 16.3) and +12.6 pp (11.2 to 14.0) at 6 seats, +13.8 pp (12.7 to 15.0)
and +12.8 pp (11.7 to 14.0) at 8 seats; own deaths per game down 0.38 to 0.55
(every interval below 0); synergy share about 19% against 18%; the force
spread narrows on every run; 8-seat time 1.03x of `rule-based-v3`.
`rule-based` now picks Kingdom Wars Generals by the refit table; Identity games
and the danger rating keep `GENERAL_VALUES`.
