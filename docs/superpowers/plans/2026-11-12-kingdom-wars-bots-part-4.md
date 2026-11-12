# Kingdom Wars Bots, Part 4 (The General Value Table) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bots pick Generals from a table refitted on Kingdom Wars games (full ids, 4–8 seats) plus measured bonuses for candidate synergy pairs, and win more for it.

**Architecture:** Content gets a reviewed data file of candidate combo pairs. The simulator's `fit-generals` learns a deck and seat range, normalises win rates per seat count, and measures each candidate pair's lift; its output is a generated per-deck table file in `bots`. The bot detects the deck from its own candidate Generals' ids and reads that deck's table for picks and Impetus for Conflicts; the danger rating keeps today's table. Tournaments report survival and synergy counts. Today's bot is frozen as `rule-based-v6`.

**Tech Stack:** TypeScript, Jest (`npx jest --selectProjects bots content sim`), `npm run sim`.

**Spec:** `docs/superpowers/specs/2026-11-12-kingdom-wars-bots-part-4-design.md` (rules R1–R5, the bar). Parent: `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-design.md`.

## Decisions made for the plan (my calls)

- `createRuleBasedPolicy`'s `generalValues` parameter accepts either today's plain record (meaning: Identity table, base-id lookup for every id, exactly today's behaviour) or a `PickTables` object. Frozen policies keep passing `GENERAL_VALUES`, so they cannot change.
- Impetus for Conflicts gets its value through a new `BotRuleContext.generalValue(id)`, built in `decide` from the policy's tables, instead of importing `GENERAL_VALUES`.
- Survival counts: per side, **deaths per game** (seats of that side eliminated) and **turns survived per seat** (`TurnAdvancedEvent`s in the log before the seat's `SeatEliminatedEvent`, or all of them if it lived). Differences are per mirrored pair, like seat share.
- The fit weights seat counts equally by giving each sample weight `1 / samples at its seat count`, and each seat count's "overall" is its own win rate.

## Global Constraints

- Bots decide only from the redacted view and the engine's legal actions; no `Math.random`, no clock. Leak specs keep passing.
- `bots` may import `engine` and `content`; `content` must not import `bots`; no engine changes.
- No switch over General ids in `bots`; candidate pairs are data in `content`; values and bonuses are a generated table.
- `rule-based-v6` must decide exactly as `rule-based` does at the start of this plan (`cca52e4d`, plus docs). Existing specs stay green unchanged until Task 7.
- The danger rating (`danger.ts`) keeps reading today's `GENERAL_VALUES` by base id (spec R5).
- Identity games keep today's table and base-id lookup (spec G3).
- App and server keep using `rule-based`.
- Each rule gets a one-line comment naming its spec rule (R1–R5).
- 8-seat game time within 3x of `rule-based-v3` (parent anti-goal).
- The developer reviews the drafted candidate list before the fit runs (Task 2 ends with that stop).
- The bar (spec "How it is judged"): 6-seat mirrored seat share wholly above 0 on both ranges; 8-seat seat share not wholly below 0 on both; own deaths per game not wholly above 0; synergy share and force spread reported; time ≤ 3x. If the bar fails, nothing ships.

## Review Focus

- **An Identity game** (candidates without the `kingdomWars:` prefix): the bot uses today's table by base id, decisions unchanged. Test in Task 5.
- **A candidate pair whose Generals were never dealt together in the fit:** no bonus, no crash. Test in Task 3.
- **A General absent from the Kingdom Wars table** (new General added later): counts 0, picking still works. Test in Task 5.
- **A seat count with no finished games** in the fit (e.g. all unfinished): it contributes nothing, no division by zero. Test in Task 3.
- **A pair listed in both `synergistic-pairs.json` and `combo-pairs.json`:** counted once as a candidate. Test in Task 2.

---

### Task 1: Freeze `rule-based-v6`, register the challenger

**Files:** Modify `projects/bots/src/lib/rule-based.ts`, `policies.ts`, `testing.ts`; test `policies.spec.ts`.

**Interfaces — produces:**
- `ruleBasedV6Policy` (id `rule-based-v6`): today's `rule-based` arguments exactly.
- `ruleBasedPicksKwPolicy` (id `rule-based-picks-kw`): same arguments for now; Task 5 gives it the Kingdom Wars table.
- `decidePicksKw(s)` in `testing.ts`.

- [ ] Step 1: tests — `policyIds()` contains both ids; v6 pinned by expected decisions on the five fixtures the v5 pin uses (General selection, dying response, Discard Phase, Play Phase with Sha + Steal, Wuxie window), written as expected values, not as a comparison with live `rule-based`.
- [ ] Step 2: `npx jest --selectProjects bots -t policies` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npx jest --selectProjects bots` → PASS.
- [ ] Step 5: commit `feat(bots): freeze rule-based-v6 and register rule-based-picks-kw`.

### Task 2: Candidate combo pairs (rule R3)

**Files:** Create `projects/content/data/decks/kingdom-wars/combo-pairs.json`, `projects/content/src/lib/comboPairs.ts`, `comboPairs.spec.ts`; modify `projects/content/src/public-api.ts`.

**Interfaces — produces:**
- `combo-pairs.json`: an array of `{ "pair": [string, string], "reason": string }`, ids unprefixed (as `synergistic-pairs.json`).
- `candidatePairs(): readonly (readonly [string, string])[]` — the union of `synergisticPairs()` and combo pairs, as full `kingdomWars:` ids, each pair once, sorted inside the pair.
- `isCandidatePair(a: string, b: string): boolean` — order-free, takes full or unprefixed ids.
- `pairKey(a: string, b: string): string` — `'<id>|<id>'` of the two full ids sorted; used by the fit and the bot.

- [ ] Step 1: draft the list. It must contain the developer's examples: guo-jia + cao-cao; zhang-fei, zhao-yun and guan-yu each with ma-chao and with huang-zhong; yuan-shao + tian-feng; sima-yi + zhen-ji; lu-xun + sun-shangxiang; lu-su + zhou-tai; lu-meng + zhou-tai. Add candidates for every force, including Kingdom Wars-only Generals (ding-feng, ji-ling, kong-rong, pan-feng, tian-feng, zou-shi, …), each with a one-line reason grounded in the two Generals' Kingdom Wars skill text (`projects/content/data/decks/kingdom-wars/texts.en.json`). Aim for 30–50 entries.
- [ ] Step 2: tests — every id maps to a General in `buildContentRegistry()` under `kingdomWars:<id>`; both Generals of each pair share a Kingdom; no pair repeats; the developer's 13 example pairs are present; `candidatePairs()` holds `kingdomWars:liu-bei|kingdomWars:guan-yu` (a partner pair) once even if also listed as a combo; `isCandidatePair('guo-jia', 'kingdomWars:cao-cao')` is true.
- [ ] Step 3: run → FAIL. Step 4: implement. Step 5: `npx jest --selectProjects content` → PASS.
- [ ] Step 6: commit `feat(content): candidate combo pairs for Kingdom Wars General picks`.
- [ ] Step 7: **stop for the developer's review** of `combo-pairs.json` (spec R3). Apply their changes, re-run the content tests, commit `chore(content): combo pairs as reviewed`.

### Task 3: The fit learns decks, seat ranges and pair lifts (rules R1, R2, R4)

**Files:** Modify `projects/sim/src/fitGenerals.ts`, `fitGenerals.spec.ts`, `cli.ts`.

**Interfaces:**
- Consumes: `candidatePairs`, `pairKey` (Task 2).
- Produces:
  - `PickSample { generalIds: [string, string]; won: boolean; seats: number }`.
  - `collectSamples(games: number, seats: number, firstSeed: number, deck: 'identity' | 'kingdomWars'): PickSample[]` (deck passed to `createGame`'s options).
  - `fitValues(samples: PickSample[], k?: number): Fit` — R2: weighted as in "Decisions"; per seat count `overall`; value = `(n / (n + k)) * weighted lift`; `counts` are raw sample counts.
  - `K_PAIR = 200`; `fitPairs(samples: PickSample[], values: Record<string, number>, candidates: readonly (readonly [string, string])[], k?: number): { bonuses: Record<string, number>; counts: Record<string, number> }` — R4: for each candidate seen, mean of `(won − overall(seats) − valueA − valueB)` with the same weights, shrunk by `n / (n + k)`; only bonuses > 0 kept; `counts` holds every candidate's sample count, 0 when unseen.
  - `formatDeckTable(fit: Fit, pairs: ReturnType<typeof fitPairs>, command: string): string` — the text of `projects/bots/src/lib/general-values.kingdom-wars.data.ts`, exporting `KINGDOM_WARS_VALUES: Readonly<Record<string, number>>` and `KINGDOM_WARS_PAIR_BONUSES: Readonly<Record<string, number>>` (keys from `pairKey`), with sample counts as comments and a GENERATED header like today's.
  - CLI: `sim fit-generals <games-per-seat-count> <minSeats>-<maxSeats> <firstSeed> [identity|kingdomWars]`; `kingdomWars` prints `formatDeckTable`, `identity` prints today's `formatTable` (single seat count allowed, `4-4`). Seat counts use consecutive seed blocks: seat count `s` starts at `firstSeed + (s − minSeats) × games`.

- [ ] Step 1: tests on synthetic samples:
  - two seat counts with different base win rates: a General that wins at each count's own rate scores ~0 (not biased by count);
  - weights: 10 samples at 4 seats and 1000 at 8 contribute equally;
  - `fitPairs`: a pair whose seats win 0.2 above `overall + vA + vB` over 200 samples gets `0.2 × 200/400 = 0.1`; a pair at or below expectation gets no bonus; an unseen candidate has count 0 and no bonus;
  - a seat count with no samples: no throw, no NaN;
  - `formatDeckTable` output parses as TypeScript exporting both constants (string checks on the export lines).
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `npx jest --selectProjects sim` → PASS.
- [ ] Step 5: smoke: `npm run sim -- fit-generals 20 4-5 2000000 kingdomWars` prints a table with `kingdomWars:` ids.
- [ ] Step 6: commit `feat(sim): fit General values per deck and seat range, with pair lifts`.

### Task 4: Run the fit, generate the Kingdom Wars table

**Files:** Create `projects/bots/src/lib/general-values.kingdom-wars.data.ts` (generated).

- [ ] Step 1: run in the background: `npm run sim -- fit-generals 8000 4-8 2000000 kingdomWars > projects/bots/src/lib/general-values.kingdom-wars.data.ts` (40,000 games).
- [ ] Step 2: check the comments: every one of the 60 Kingdom Wars Generals has a value; list each candidate pair's sample count. If the median candidate count is below 200, re-run with 20000 games per seat count (100,000 games, spec R4) and note why in the commit message.
- [ ] Step 3: `npx jest --selectProjects bots` → PASS (the file only adds exports).
- [ ] Step 4: commit `feat(bots): Kingdom Wars General value table, fitted (generated)` with the command in the message.

### Task 5: Per-deck picks and Impetus for Conflicts (rule R5)

**Files:** Modify `projects/bots/src/lib/general-values.ts`, `rule-based.ts`, `rules/registry.ts`, `rules/skills.ts`, `policies.ts`; tests `general-values.spec.ts`, `rules/skills.spec.ts`, `policies.spec.ts`.

**Interfaces:**
- Consumes: Task 3/4 constants; `pairKey` (Task 2).
- Produces in `general-values.ts`:
  - `interface DeckTable { values: Readonly<Record<string, number>>; pairBonuses: Readonly<Record<string, number>> }`.
  - `interface PickTables { identity: Readonly<Record<string, number>>; kingdomWars: DeckTable | null }`.
  - `KINGDOM_WARS_TABLE: DeckTable` from the generated file.
  - `pickTablesOf(v: Readonly<Record<string, number>> | PickTables): PickTables` — a plain record becomes `{ identity: v, kingdomWars: null }`.
  - `generalValueIn(tables: PickTables, generalId: string): number` — `kingdomWars:` id with a KW table: `values[id] ?? 0`; otherwise `identity[baseGeneralId(id)] ?? 0`.
  - `pairScore(tables, registry, choice)` = `generalValueIn(main) + generalValueIn(deputy) + bonus + HP_TIEBREAK × (hp + hp)`; bonus = `kingdomWars.pairBonuses[pairKey(main, deputy)] ?? 0` only when both ids are `kingdomWars:` and a KW table exists. `bestPair(tables, registry, choices)` unchanged in shape.
- `BotRuleContext.generalValue: (generalId: string) => number`, built in `decide` from the policy's tables (`generalValueIn`); Impetus for Conflicts uses it instead of `GENERAL_VALUES`.
- `createRuleBasedPolicy(..., generalValues?: Readonly<Record<string, number>> | PickTables, ...)`.
- `ruleBasedPicksKwPolicy` passes `{ identity: GENERAL_VALUES, kingdomWars: KINGDOM_WARS_TABLE }`; every other policy keeps `GENERAL_VALUES`.

- [ ] Step 1: tests:
  - `pairScore` with a plain record equals today's value on a Kingdom Wars choice (base-id lookup) — frozen behaviour;
  - with `PickTables`, a Kingdom Wars choice uses full-id values and adds the pair bonus; an Identity choice (unprefixed ids) ignores the KW table;
  - a `kingdomWars:` id absent from the table counts 0;
  - `decidePicksKw` on a General-selection fixture picks the pair the KW table plus bonus rates highest; `rule-based-v6` still picks today's pair (pin from Task 1 stays green);
  - Impetus for Conflicts under `decidePicksKw` chooses by the KW value; under v6 by the old value.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `npx jest --selectProjects bots` → PASS; `danger.spec.ts` unchanged and green.
- [ ] Step 5: commit `feat(bots): per-deck General tables with pair bonuses for picks`.

### Task 6: Survival and synergy counts in tournaments

**Files:** Modify `projects/sim/src/tournament.ts`, `tournament.spec.ts`, `cli.ts` output.

**Interfaces — produces:**
- `GameScore` gains `deaths: Record<Side, number>`, `turnsSurvived: Record<Side, number>` (summed over the side's seats), `synergySeats: Record<Side, number>` (seats whose two General ids form `isCandidatePair`).
- `TournamentReport` gains `deathsDiff: Interval` (challenger minus baseline deaths per game, per mirrored pair as `difference` is), `turnsSurvivedDiff: Interval` (per seat), and `synergyShare: Record<Side, number>`.
- `formatReport` prints `Own deaths per game, challenger minus baseline`, `Turns survived per seat, …`, and `Synergy share, challenger / baseline`.

- [ ] Step 1: tests on hand-built final states: a seat eliminated after 3 `TurnAdvancedEvent`s survives 3; a living seat survives the total; deaths counted per side; a seat with Guan Yu + Liu Bei counts as a synergy seat; an unfinished game scores none of these.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `npx jest --selectProjects sim` → PASS.
- [ ] Step 5: commit `feat(sim): survival and synergy counts in tournament reports`.

### Task 7: Judge, ship, record

**Files:** Modify the Part 4 spec (Results), parent spec (Part 4 summary), `rule-based.ts`, `general-values.ts` (tuning), `policies.spec.ts`.

- [ ] Step 1: write the bar and seeds into the spec before running: judging ranges `2300000` and `2400000` (not used by the fit or earlier parts).
- [ ] Step 2: run, in the background, one at a time: `npm run sim -- tournament 4000 6 rule-based-picks-kw rule-based-v6 <seed> mirrored` and `npm run sim -- tournament 4000 8 rule-based-picks-kw rule-based-v6 <seed> mirrored`, both seeds.
- [ ] Step 3: if gate 1 fails on the first range: up to three tuning sets of `SHRINK_K` and `K_PAIR` (re-run Task 4's fit with each, commit each generated table), first range only, each recorded. Also report one run with pair bonuses off (`pairBonuses: {}`); the better variant is the candidate. The second range runs once with the final set.
- [ ] Step 4: time: `/usr/bin/time -p npm run sim -- balance 400 8 rule-based-picks-kw rule-based-picks-kw 1400000`; ratio against `rule-based-v3`'s 49.12 s ≤ 3.
- [ ] Step 5: Results tables (seat share, deaths, turns survived, synergy share, wins by force, time) and the verdict.
- [ ] Step 6: if it passes, `rule-based` gets `{ identity: GENERAL_VALUES, kingdomWars: KINGDOM_WARS_TABLE }`; update specs whose expectations change, one-line reason each in the commit. If it fails, `rule-based` stays and the Results say why and which variant came closest.
- [ ] Step 7: `npm run verify` and `npx jest` → green.
- [ ] Step 8: commit `feat(bots): ship Part 4 (Kingdom Wars General table)` (or `…: judge Part 4; not shipped`) and stop for the developer.
