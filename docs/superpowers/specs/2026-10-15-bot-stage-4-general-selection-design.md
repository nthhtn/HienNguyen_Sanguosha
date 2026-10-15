# Bot Stage 4 — General Selection — Design Spec

Status: Approved; experiment done: shipped on tuning set 1
Date: 2026-10-15

Part of `docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md`
(Stage 4). Stage 3 (knowledge) is deferred by the user and done later. Judged by
the roadmap's rule: a variant against the shipped `rule-based`, mirrored pairs,
4 seats, at least 4000 games, shipping only if the whole 95% interval is above 0
on two fresh seed ranges. At most three tuning sets, all recorded.

## What the bot does today

(`rule-based.ts`, section 1.) Each seat is dealt 5 Generals
(`GENERALS_PER_SEAT`, from a seeded shuffle of the whole registry; about 170
Generals) and must choose an ordered (main, deputy) pair that shares a kingdom.
The bot picks the pair with the highest combined max HP, first in the legal list
on ties. It knows nothing about what the Generals' skills do for it.

## Idea

The choice set is tiny (5 candidates give a handful of same-kingdom pairs), so a
better score only has to rank a few options. The roadmap's per-General value
table is kept, but instead of rating about 170 Generals by hand, the table is
**measured**: play many games where the seats pick a random legal pair, and rate
each General by how often the seat that held it won. This values a General by
how the rule-based bot actually plays it, which is what the roadmap asked for
("how useful their skills are to the rule-based bot's play").

## Design

- **`general-values.ts`** holds the table `GENERAL_VALUES: Record<string, number>`
  (General id → value, in win-rate points; absent ids count 0) and its two
  constants, and is the only place that knows them. A generated file with a
  header comment saying how to regenerate it.
- **Pair score** = `value(main) + value(deputy) + HP_TIEBREAK × combined max HP`,
  with `HP_TIEBREAK` small (0.0001) so max HP only breaks ties. The bot picks the
  highest score; the first legal choice wins a remaining tie. Main versus deputy
  order is a free choice that is made by the same score (equal sums tie, so the
  first legal order stands, as today).
- **`createRuleBasedPolicy`** gains an optional last parameter
  `generalValues?: Record<string, number>`. When absent, the selection is exactly
  today's. The shipped policies pass none.
- **Fitting** is a committed tool, `projects/sim/src/fitGenerals.ts`, run as
  `npm run sim -- fit-generals <games> <seats> <firstSeed>`:
  - Every seat plays `rule-based` but picks a pseudo-random legal pair
    (deterministic from the game seed and the seat), so General choice is not
    confounded with max HP.
  - For each seat-game it records the two Generals chosen and whether that seat's
    side won (the same win score the tournament uses).
  - `value(g) = shrink × (mean win rate of seat-games containing g − overall
    mean win rate)`, with `shrink = n / (n + K)` and `K = 200` named constants,
    so a General with few samples stays near 0.
  - It prints the table as TypeScript for `general-values.ts`, plus each
    General's sample count, so the file can be regenerated and reviewed.
- `policies.ts` registers `rule-based-picks` (the shipped rules plus the table).

## Experiment

1. **Tuning set 1:** fit on 20000 games from first seed 500000 (about 80000
   seat-games, roughly 900 samples per General). Generate the table.
2. `rule-based-picks` against `rule-based`, mirrored, 4000 games, first seed
   600000. If the whole interval is above 0, repeat on first seed 700000; ships if
   it holds on both.
3. If it fails, **tuning set 2:** refit on 40000 games (seed 500000, then 540000
   added), judged the same way on fresh ranges 800000 and 900000. **Tuning set 3**
   (only if set 2 fails and a concrete reason says what to change, such as `K`)
   gets two further fresh ranges. Nothing else is tuned. A range used to judge is
   never used to fit.
4. Every run goes into `Results` below.

When it ships, the shipped bot is frozen as `rule-based-v2` (the table is empty
for it), `rule-based` takes the table, and the app and server need no changes.

Honest expectation: HP is already a decent proxy, so any gain is probably a few
points at most; nothing may ship. A fitted table can also overfit its range,
which is what the second fresh range is for.

## Testing

- `general-values.spec.ts`: `pairScore` ranks a higher-valued pair above a
  higher-HP pair; ties fall back to max HP, then to the first legal choice; an
  absent id counts 0.
- `rule-based.spec.ts`: with no table the selection is exactly today's; with a
  table the bot takes the highest-valued same-kingdom pair.
- `fitGenerals.spec.ts` (sim): on a small hand-made list of seat-game records,
  `value` is the shrunken lift, a General with no samples gets no entry, and the
  output is stable (sorted by id).
- `policies.spec.ts`: the new id is registered.
- Tournaments and the fit run are scripts, not unit tests.

## Acceptance

Either the variant ships under the experiment rule, or the results show it did
not and `rule-based` is unchanged.

## Results

All runs: 4 seats, mirrored pairs, 4000 games (2000 pairs).

**Tuning set 1:** `npm run sim -- fit-generals 20000 4 500000` (3.5 minutes; about 2500 samples per General).
Committed as `general-values.data.ts`.

| Run | First seed | Difference | 95% interval | Verdict |
|---|---|---|---|---|
| `rule-based-picks` vs `rule-based` | 600000 | +3.3 pp | +2.1 to +4.4 | challenger is better |
| `rule-based-picks` vs `rule-based` | 700000 | +4.6 pp | +3.4 to +5.8 | challenger is better |
| shipped `rule-based` vs frozen `rule-based-v2` (record) | 800000 | +2.5 pp | +1.3 to +3.7 | challenger is better |

**Shipped.** The whole interval is above 0 on both fresh ranges, and no range used to judge was used to
fit. Tuning sets 2 and 3 were not needed. `rule-based` now chooses with the table; the old bot is frozen
as `rule-based-v2` (`rule-based-v1` is the same bot). The third run is the post-merge record and shows
a smaller gain than the first two, so the real gain is probably 2 to 4 points. The tournament check that
two identical bots score exactly 0 now compares `rule-based` with `rule-based-picks`, which are the same bot
after shipping.
