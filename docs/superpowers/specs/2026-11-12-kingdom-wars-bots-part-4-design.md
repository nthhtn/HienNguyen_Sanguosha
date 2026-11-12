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
