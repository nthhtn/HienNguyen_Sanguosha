# Kingdom Wars Bots, Part 4: The General Value Table — Design Spec

Status: Approved by the developer on 2026-11-12
Date: 2026-11-12
Parent: `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-design.md`
(Part 4 section, "How it is judged", "Where the knowledge lives" and the
anti-goals, which all still hold unless changed below).

## Why

Bots choose their two Generals by the highest summed value in
`GENERAL_VALUES` (`projects/bots/src/lib/general-values.ts`, `bestPair`). That
table was measured once, on 20,000 Identity-deck games at 4 seats
(`npm run sim -- fit-generals 20000 4 500000`, `{ deck: 'identity' }` in
`projects/sim/src/fitGenerals.ts`). Kingdom Wars is the deck people play, so:

- a Kingdom Wars variant is scored as its Identity base (`baseGeneralId`);
- Kingdom Wars-only Generals score 0 and are rarely picked;
- the values come from bots older than Parts 1–3.

The table also feeds Part 2's danger rating (a General's danger is its skill
rating plus 10 × its value), so it shapes whom bots attack as well as whom they
pick.

## What the developer wants, in priority order

1. **Bots that win more.**
2. **Bots that survive longer.**
3. **Bots that pick synergistic-looking Generals:** the deck's Synergistic
   Partners, and pairs whose skills combo or bring extra cards together. The
   developer's examples: Guo Jia & Cao Cao; Zhang Fei / Zhao Yun / Guan Yu &
   Ma Chao / Huang Zhong; Yuan Shao & Tian Feng; Sima Yi & Zhen Ji; Lu Xun &
   Sun Shangxiang; Lu Su & Zhou Tai; Lu Meng & Zhou Tai.
4. **A fairer spread across the forces.**

## Goals

- **G1. Refit on Kingdom Wars.** The table is measured on Kingdom Wars games
  played by today's `rule-based` (Part 3 shipped), across 4 to 8 seats, keyed
  by the full Kingdom Wars General id.
- **G2. Pair synergy, both ways (developer's choice).** A hand-drawn list of
  candidate pairs names which pairs might combo; the fitting run measures each
  candidate's real lift; only candidates that actually do better get a pair
  bonus.
- **G3. Per-deck tables.** Kingdom Wars gets the refit; Identity keeps today's
  table unchanged.

## Non-goals

- **Force crowding** (the parent spec's second "improved" idea) is **dropped**
  (developer's decision): Generals are chosen at the start, when every other
  seat is hidden, so a bot cannot see which force is crowded.
- Changing how bots play once Generals are chosen. Part 4 only changes picks,
  and through the danger rating, whom bots see as dangerous.
- Rule C's rework and the Part 3 review leftovers (separate work).
- Engine, app or server changes.

## Anti-goals

- Bots never use what their seat cannot see (parent, absolute). Picking reads
  only the bot's own candidate Generals.
- No switch over General ids in `bots`. Candidate pairs are data in `content`;
  values and bonuses are a generated table.
- No slower games: 8-seat game time stays within 3x of `rule-based-v3`.

## The rules

### R1. The fitting run

- `fit-generals` takes a deck argument (`identity` or `kingdomWars`) and a seat
  range. *My call:* the Kingdom Wars fit uses 40,000 games, 8,000 at each of
  4, 5, 6, 7 and 8 seats, on seeds not used by any judging run (first seed
  `2000000`).
- The games are played by `rule-based` with **random picks** (as today's fit
  does: a pseudo-random legal pair from the seed and the seat), so a General's
  value is not mixed up with how often it is chosen.
- Each seat's sample is its two General ids (full Kingdom Wars ids) and whether
  it won. A seat count's samples are weighted equally whatever its game count.

### R2. Single values

- As today: a General's value is its win rate minus the overall win rate,
  shrunk by `n / (n + K)` (`SHRINK_K`, today 200).
- Win rates are compared within each seat count first (a seat's base chance of
  winning differs between 4 and 8 seats), then averaged over seat counts.
- No borrowing between variants and bases: a Kingdom Wars game deals only
  Kingdom Wars Generals (the 60 `kingdomWars:` ids), so a base never appears in
  the samples, and with about 240,000 seat samples each General has thousands.
  Every General shrinks toward 0 as today.

### R3. Candidate pairs (facts, in content)

- A data file `projects/content/data/decks/kingdom-wars/combo-pairs.json`
  next to `skill-danger.json` lists candidate pairs, each with a one-line
  reason (for example "both gain from taking damage", "judgment control",
  "card advantage from losing cards", "Sha pressure", "Unyielding partner").
- It starts from the deck's Synergistic Partners (`synergistic-pairs.json`, 19
  pairs, which need no separate entry) and the developer's examples (all of
  which exist in the Kingdom Wars deck and share a Kingdom).
- Ids are written without the prefix, like `synergistic-pairs.json`
  (`"guo-jia"`), and mapped to `kingdomWars:` ids when the fit and the bot read
  them; a content spec checks each maps to a real Kingdom Wars General. *My call:*
  the builder drafts more candidates for every force, including Kingdom
  Wars-only Generals, and **the developer reviews the drafted list once before
  the fit runs** (as with the danger ratings).
- A content spec checks every id in the file is a real Kingdom Wars General and
  both Generals share a Kingdom (Guozhan pairs must).

### R4. Pair bonuses

- For each candidate pair seen in the fitting samples: its lift is the pair's
  average of (won − overall − value A − value B), shrunk by
  `n / (n + K_PAIR)`. *My call:* `K_PAIR` starts at 200.
- A pair with a lift of 0 or less gets no bonus. Pairs not on the list get no
  bonus, whatever their data.
- The fit reports each candidate's sample count. *My call:* if the median
  candidate has fewer than 200 samples, the builder may raise the fitting run
  up to 100,000 games (same seat split) and records why.
- The bonuses are written into the generated table next to the values.

### R5. Picking and the other readers of the table

- The pair score is value(main) + value(deputy) + bonus(pair) + the existing
  max-HP tiebreak, looked up by full id in the deck's table.
- **Which deck** (my call, no engine change): the bot reads it from the ids of
  its own candidate Generals. `kingdomWars:` ids use the Kingdom Wars table;
  any other id uses today's Identity table with its base-id lookup. One policy
  serves both decks.
- **Impetus for Conflicts** (`rules/skills.ts`, "the General with the higher
  table value") reads the same per-deck table by full id. It is a value
  question, so it should use the better values.
- **The danger rating keeps today's table and lookup in Part 4** (my call). The
  tournament then measures the picks alone, and Part 2's tuned danger scale is
  not disturbed. Moving danger onto the refit table is follow-up work, judged
  on its own.

## How it is judged

Challenger `rule-based-picks-kw` (the new table and bonuses) against
`rule-based-v6` (`rule-based` at the end of Part 3, frozen with today's table
and lookup), Kingdom Wars deck, two seed ranges not used before.

New simulator counts, per policy over the same games:

- **Survival:** rounds a seat stays alive per game (to its elimination or the
  game's end), and own-seat deaths per game.
- **Synergy:** share of the policy's seats whose pair is a candidate pair or a
  Synergistic Partner pair.
- Per-force win rates and the gap between the best and worst force (exists in
  reports).

**The bar** (my call, the developer may override). Unlike Parts 1–3, Part 4
must win more to ship (priority 1):

1. Mirrored tournament seat share at **6 seats**: whole 95% interval **above 0**
   on both ranges.
2. At **8 seats**: seat share not wholly below 0 on both ranges.
3. Survival: own-seat deaths per game not wholly above 0 (not clearly worse).
4. Synergy share and the force spread: reported, not gated.
5. 8-seat time within 3x of `rule-based-v3`.

Up to three tuning sets of `SHRINK_K` and `K_PAIR` on the first range, each
recorded; the second range runs once with the final set. If the pair bonuses
do not help, a run without them is reported too, and the better of the two is
the candidate.

**If the bar fails** (my call): Part 4 does not ship, `rule-based` stays as it
is, and the Results say why and which variant came closest. Whether to ship a
partial result is the developer's decision, as it was for Part 3.

## Constraints

- Framework-free, deterministic, redacted view only; leak checks keep passing.
- `content` must not import `bots`. The generated table lives in `bots`
  (as `general-values.data.ts` does today), one file per deck.
- Rule text before code (CLAUDE.md); `npm run verify` and the tests green;
  merging is the developer's.

## Left to the builder

- The candidate list draft (reviewed by the developer before the fit).
- The generated table's exact format and file names.
- How the survival and synergy counts are reported.
- The tuning of `SHRINK_K` and `K_PAIR` within the three sets.

## Amendment (2026-11-12): force-adjusted refit

**Why.** The first fit (Results below) passed the bar, but the final review
found that its values mostly measured the force, not the General: both of a
seat's Generals share a Kingdom, so each General's lift included its force's
lift (average value Qun +0.10, Wu −0.07), and the pair lift subtracted that
force lift twice (no Qun pair got a bonus, all 12 Wu pairs did). Bots learned
"pick Qun"; in all-bot games Qun won 58% and the leading force 57% (today's
bot: 11% and 47%). The developer chose to refit against force, and to **ignore
force entirely when picking** (2026-11-12).

These rules replace R2 and R4; R1, R3 and R5 stand.

### R2′. Force strength, then single values

- A seat's **force** is the printed Kingdom of its Generals (both share one),
  whatever allegiance the seat ends with.
- For each seat count *s* and Kingdom *K*: **force lift** F(K, s) = the win
  rate of seats of Kingdom K at *s* − the overall win rate at *s*.
- A General's value = its weighted mean of (won − overall(s) − F(K, s)) over
  its samples (same seat-count weights as R2), shrunk by `n / (n + K)` as in
  R2. Two equally good Generals in a strong and a weak force get the same
  value.
- The force lifts are reported in the generated table as comments; they are
  not used for picking (the developer's decision).

### R4′. Pair bonuses against force

- A candidate pair's lift = its weighted mean of
  (won − overall(s) − F(K, s) − value A − value B), shrunk by
  `n / (n + K_PAIR)`; only lifts above 0 (after rounding to 4 decimals) give a
  bonus. Force is subtracted once.

### R5 unchanged

The pair score stays value(main) + value(deputy) + bonus + the max-HP
tiebreak. With force removed from the values, picking ignores force.

### Judging the refit

Fresh seed ranges `2500000` and `2600000`. The bar is the same as above, plus
one new gate (developer's priority 4 and Part 2's goal must not regress in the
games players face):

6. **All-bot games** (`balance 2000 <seats> rule-based-picks-kw rule-based-v6
   <seed>`, every seat one bot, at 6 and 8 seats, both ranges): the leader-won
   paired difference is not wholly above 0, and the challenger's best-minus-
   worst force win-rate gap is no more than 5 points larger than
   `rule-based-v6`'s (*my call*). Ambitionist seats count as one group.

If the refit fails, `rule-based` goes back to today's table (the tools and
data stay, unused by the shipped bot) and the Results say why.

## Results

**Fixed before running (2026-11-12).** The bar is the one in "How it is
judged", unchanged. Judging ranges start at seeds `2300000` and `2400000`
(not used by the fit, which starts at `2000000`, or by Parts 1–3). Runs,
Kingdom Wars deck, 4000 games each, one at a time:

- `npm run sim -- tournament 4000 6 rule-based-picks-kw rule-based-v6 <seed> mirrored`
- `npm run sim -- tournament 4000 8 rule-based-picks-kw rule-based-v6 <seed> mirrored`
- Time: `/usr/bin/time -p npm run sim -- balance 400 8 rule-based-picks-kw rule-based-picks-kw 1400000`,
  against `rule-based-v3`'s recorded 49.12 s.

Tuning, only if gate 1 fails at `2300000`: first the challenger with pair
bonuses off, then up to three sets of `SHRINK_K` and `K_PAIR`, on `2300000`
only; `2400000` runs once with the final variant.

Challenger `rule-based-picks-kw` (the table generated by
`npm run sim -- fit-generals 8000 4-8 2000000 kingdomWars`, `SHRINK_K` 200,
`K_PAIR` 200, with pair bonuses) against `rule-based-v6`, run at commit
`12070483`. **No tuning:** gate 1 passed on the first range, so neither the
run without pair bonuses nor any `SHRINK_K` / `K_PAIR` set was tried, and the
second range ran with the first values. Differences are challenger minus
baseline over 2000 mirrored pairs, 95% intervals. Synergy share is the share
of a side's seats whose pair is a candidate pair or a Synergistic Partner
pair.

**Seat share, 6 seats** (`tournament 4000 6 rule-based-picks-kw rule-based-v6 <seed> mirrored`):

| Seed | Win rate, challenger / baseline | Seat-share difference (95%) | Own deaths per game | Turns survived per seat | Synergy share, challenger / baseline |
|---|---|---|---|---|---|
| 2300000 | 37.5% / 22.6% | +14.9 pp (13.5 to 16.3) | -0.45 (-0.49 to -0.41) | +3.88 (3.31 to 4.44) | 19.3% / 17.9% |
| 2400000 | 36.2% / 23.6% | +12.6 pp (11.2 to 14.0) | -0.38 (-0.42 to -0.34) | +2.86 (2.33 to 3.39) | 18.9% / 17.8% |

**Seat share, 8 seats** (`tournament 4000 8 rule-based-picks-kw rule-based-v6 <seed> mirrored`):

| Seed | Win rate, challenger / baseline | Seat-share difference (95%) | Own deaths per game | Turns survived per seat | Synergy share, challenger / baseline |
|---|---|---|---|---|---|
| 2300000 | 32.1% / 18.3% | +13.8 pp (12.7 to 15.0) | -0.55 (-0.60 to -0.51) | +3.79 (3.31 to 4.27) | 18.9% / 17.8% |
| 2400000 | 31.8% / 19.0% | +12.8 pp (11.7 to 14.0) | -0.51 (-0.56 to -0.47) | +4.06 (3.50 to 4.61) | 19.0% / 17.5% |

**Wins by force**, challenger / baseline (%), with the gap between the best
and worst force (Ambitionist included):

| Seats, seed | Wei | Shu | Wu | Qun | Ambitionist | Gap, challenger / baseline |
|---|---|---|---|---|---|---|
| 6, 2300000 | 36.3 / 23.6 | 35.0 / 25.3 | 17.4 / 10.2 | 41.4 / 38.7 | 8.9 / 4.0 | 32.5 / 34.7 |
| 6, 2400000 | 35.5 / 25.5 | 33.7 / 25.7 | 16.7 / 10.4 | 39.5 / 39.3 | 14.4 / 6.5 | 25.1 / 32.8 |
| 8, 2300000 | 28.8 / 19.2 | 25.9 / 19.6 | 13.7 / 8.1 | 37.3 / 35.3 | 6.0 / 1.0 | 31.3 / 34.3 |
| 8, 2400000 | 28.3 / 19.7 | 27.9 / 20.9 | 12.3 / 7.9 | 36.3 / 33.7 | 12.9 / 4.8 | 24.0 / 28.9 |

**No slower games.** 400 balance games at 8 seats, first seed 1400000
(`/usr/bin/time -p npm run sim -- balance 400 8 rule-based-picks-kw rule-based-picks-kw 1400000`,
wall time): 50.56 s against `rule-based-v3`'s 49.12 s, a ratio of 1.03x
against the 3x bar. Passes.

**Verdict: passes every gate, shipped.**

1. 6-seat seat share wholly above 0 on both ranges (+14.9 pp, 13.5 to 16.3;
   +12.6 pp, 11.2 to 14.0).
2. 8-seat seat share not wholly below 0 on both ranges; it is in fact wholly
   above 0 (+13.8 pp; +12.8 pp).
3. Own deaths per game not wholly above 0; they are wholly below 0 on every
   run (-0.38 to -0.55), and seats survive about 3 to 4 more turns.
4. Synergy share rises a little (about 19% against 18%). The force spread
   narrows on every run (best-to-worst gap 2 to 8 points smaller); Wu stays the
   weakest Kingdom.
5. Time 1.03x of `rule-based-v3`.

These are the largest seat-share gains of any Kingdom Wars part (Part 3 without
rule C gained +1.6 and +1.4 pp). They measure the challenger next to a bot that
picks Kingdom Wars Generals by the Identity table, so part of the gain is the
baseline picking worse at the same table, not only the challenger picking
better. The usage counts show the new picks: the challenger offers Goddess Luo
(Zhen Ji) and Envious Moon far more often, and Brave Spirit, Iron Cavalry
and Benevolence far less, so it leans away from the Shu Generals the Identity
table rated highly.

**Shipped (2026-11-12).** `rule-based` now picks with
`{ identity: GENERAL_VALUES, kingdomWars: KINGDOM_WARS_TABLE }`, the same as
`rule-based-picks-kw`; no spec's expected decision changed (the existing
`rule-based` General-selection specs use Identity ids). `rule-based-v6` stays
pinned by its expected decisions as the bot before Part 4. The danger rating
still reads `GENERAL_VALUES` (R5); moving it onto the refit table is follow-up
work.

### Force-adjusted refit

**Fixed before running (2026-11-12).** The bar is gates 1 to 5 of "How it is
judged" plus gate 6 of "Judging the refit", unchanged; no tuning is planned.
Challenger `rule-based-picks-kw` (the table generated by
`npm run sim -- fit-generals 8000 4-8 2000000 kingdomWars` under R2′ and R4′)
against `rule-based-v6`. Judging ranges start at seeds `2500000` and `2600000`
(not used by the fit or by the first fit's judging). Runs, Kingdom Wars deck,
one at a time, each on both seeds:

- `npm run sim -- tournament 4000 6 rule-based-picks-kw rule-based-v6 <seed> mirrored`
- `npm run sim -- tournament 4000 8 rule-based-picks-kw rule-based-v6 <seed> mirrored`
- `npm run sim -- balance 2000 6 rule-based-picks-kw rule-based-v6 <seed>`
- `npm run sim -- balance 2000 8 rule-based-picks-kw rule-based-v6 <seed>`
- Time, run alone: `/usr/bin/time -p npm run sim -- balance 400 8 rule-based-picks-kw rule-based-picks-kw 1400000`,
  against `rule-based-v3`'s recorded 49.12 s (3x bar: 147.36 s).

Gate 6 reads the all-bot runs: the leader-won paired difference (challenger
minus `rule-based-v6`) is not wholly above 0, and the challenger's best-minus-
worst force win-rate gap (Wei, Shu, Wu, Qun, and Ambitionist seats as one
group) is at most `rule-based-v6`'s gap + 5 points, at 6 and 8 seats on both
ranges. If any gate fails, `rule-based` goes back to plain `GENERAL_VALUES`.
