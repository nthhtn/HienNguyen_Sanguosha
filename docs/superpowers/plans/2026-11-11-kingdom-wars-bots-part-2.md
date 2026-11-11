# Kingdom Wars Bots, Part 2 (Reading the Table) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bots judge how dangerous each seat is and, when one force outnumbers the rest, form a temporary alliance against it until it is weakened.

**Architecture:** A pure `table.ts` module in `projects/bots` reads the bot's redacted view into a picture of the table: each force's strength, the leading force, each seat's danger and its relation to the bot (`ally`, `truce`, `foe`). A new target ranker `tableRank` uses it, with a `HOLD_FIRE` score for seats the bot should not attack. Two ladder decisions read it directly behind a feature switch: the dying-round Peach and the Barbarians / Hail of Arrows decision. Skill danger is a hand rating per skill in `content` (data), combined with the measured General value table in `bots`. The shipped bot is frozen as `rule-based-v4`.

**Tech Stack:** TypeScript, Jest (`npx jest --selectProjects bots content sim`), `npm run sim`.

**Spec:** `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-design.md` (Part 2, "How it is judged", Results of Part 1).

## Decisions from the developer (2026-11-11)

- A bot **saves a dying truce partner with a Peach** as it would an ally.
- **Attacking a truce partner**, and counting it in **Barbarians / Hail of Arrows**, depend on the partner's HP and on how dangerous its revealed Generals are (rules 4 and 6 below; the developer confirmed the guesses).
- **Danger is judged by both** a hand rating per skill and the measured General value table.

## The rules (plain words; the code follows them)

1. **Forces.** A force is a Kingdom's living seats whose allegiance is `kingdom` and whose Kingdom is revealed; each living Ambitionist is a force of one. A hidden seat belongs to no force. A force's *seats* is its count of such seats; its *HP* is their summed `combinedHp`.
2. **The leading force.** A force leads when it has at least 2 seats and strictly more seats than every other force. It is *weakened* (no longer leads) as soon as it no longer has strictly more seats than every other force, or its HP is not greater than the HP of the force with the next most seats. With no leading force there is no alliance.
3. **Relations, from the bot's side.** `self`; `ally` (as `isAlly` today); `truce` — a seat of a force that is neither the bot's own nor the leading force, while a force other than the bot's own leads; `foe` — everything else (the leading force's seats, hidden seats, and every non-ally when nobody leads). The bot's own force leading means no truce for it: its bots behave as today towards everyone.
4. **Danger.** A General's danger is its rating weight (the highest rating among its non-Lord skills: `high` 2, `medium` 1, `low` 0) plus 10 × its value in the General value table (by base id; absent counts 0). A seat's danger is the sum over its **revealed** Generals; a hidden General counts 0. A seat is *dangerous* when its danger is 2 or more.
5. **Rating criteria** (for the hand ratings):
   - `high`: on the owner's own initiative, at least once per turn, it deals damage, takes or discards other seats' cards, or forces them to; or it makes the owner very hard to damage.
   - `medium`: the same kinds of effect but conditional or reactive (needs the owner hurt, a judgment, a Sha hitting), or once per game; or strong extra card draw.
   - `low`: everything else (passive modifiers, self-only utility, reveal tricks).
6. **Choosing whom to attack** (`tableRank`, higher is better; `HOLD_FIRE` = never attack):
   - A truce partner is `HOLD_FIRE` unless it has 3 HP or more **and** is dangerous; then it ranks below every leading-force seat.
   - A leading-force seat gets +1000.
   - A hit that would take the target to 0 HP (`combinedHp` ≤ 1) gets +500.
   - + 20 × the seat's danger; + 30 per hostile act it made against the bot or its allies (`hostileActs` in `targeting.ts`), counting up to 3.
   - − 10 per HP, then − 0.01 × seat index (the tiebreak).
   - Allies and the bot itself are never ranked (they are filtered out as today).
7. **Dying round.** A bot spends a Peach on a dying truce partner as on an ally (existing ally rule, extended to `truce`).
8. **Barbarians and Hail of Arrows.** Weigh every other living seat: an ally counts 1 friend; a truce partner at 2 HP or less counts 1 friend; a healthy truce partner that is not dangerous counts 0.5 friend; a dangerous truce partner counts 1 enemy; a foe counts 1 enemy. Play the card (or Random Strike's conversion) when enemies are strictly more than friends.

**Not covered in Part 2 (recorded):** the per-skill targeting inside the legacy `skills.ts`, `wind.ts`, `fire.ts`, `forest.ts`, `mountain.ts` (they sort by HP, not by the ranker) keeps today's notion of foe. Moving them onto the ranker is follow-up work; the ladder's card plays, conversions, target templates and the registry rules all go through the ranker.

## Global Constraints

- Bots decide only from the redacted view and the engine's legal actions; never `Math.random`, never the clock. The sim leak specs keep passing.
- `bots` may import `engine` and `content`; `content` must not import `bots`; the engine is not changed.
- No new switch over card or skill ids; ratings are data keyed by skill id.
- `rule-based-v4` must decide exactly as `rule-based` does at the start of this plan (main 4db2cc9e). Existing specs stay green unchanged until Task 8.
- App and server keep using `rule-based`.
- Rules above are the spec for the code; each rule gets a one-line comment where it is implemented.
- Ship rule (spec): Part 2 ships when its goal counts clearly improve on both seed ranges, even without more seats won, unless win share is clearly worse (whole 95% interval below 0 on both).
- The developer reviews the drafted danger ratings before Part 2 ships (Task 8 stops for it).

## Review Focus

- **A seat changes force mid-game** (a hidden seat reveals, an Ambitionist appears): relations are recomputed each decision from the view; nothing is cached across decisions. Test in Task 3.
- **Two forces tie for the most seats:** nobody leads; no truce. Test in Task 3.
- **The bot's own force leads:** its bots see no truce partners and play as today. Test in Task 3.
- **Every legal target is `HOLD_FIRE`:** the play is skipped and the ladder moves on (ends the phase if nothing else), never throws. Test in Task 5.
- **A leading force drops to 1 seat or loses its HP edge mid-turn:** the next decision sees no alliance. Test in Task 3.

---

### Task 1: Freeze `rule-based-v4`, add the `tableReading` switch

**Files:** Modify `projects/bots/src/lib/rules/registry.ts` (`BotFeatures`), `rule-based.ts`, `policies.ts`, `testing.ts`; test `policies.spec.ts`.

**Interfaces — produces:**
- `BotFeatures { rules: BotRuleRegistry | null; tableReading: boolean }`; `NO_FEATURES = { rules: null, tableReading: false }`.
- `ruleBasedV4Policy` (id `rule-based-v4`): exactly today's `rule-based` arguments (`weakestFirst`, `NO_CARD_PLAY_RULES`, `NO_RESPONSE_RULES`, `GENERAL_VALUES`, `{ rules: KINGDOM_WARS_RULES, tableReading: false }`).
- `ruleBasedTablePolicy` (id `rule-based-table`): same, but ranker `tableRank` (Task 5) and `tableReading: true`. Until Task 5 exists, register it with `weakestFirst` and `tableReading: true`; Task 5 swaps the ranker.
- `decideWith` unchanged; add `decideTable(s)` = `decideWith(ruleBasedTablePolicy, s)` in `testing.ts`.

- [ ] Step 1: tests — `policyIds()` contains `rule-based-v4` and `rule-based-table`; on the 5 fixtures used by Part 1's old pin (General selection, dying response, Discard Phase, Play Phase with Sha + Steal, Wuxie window), `decideWith(ruleBasedV4Policy, s)` equals `decideWith(ruleBasedPolicy, s)`.
- [ ] Step 2: run `npx jest --selectProjects bots -t policies` → FAIL.
- [ ] Step 3: implement; every existing `BotFeatures` literal gets `tableReading: false`.
- [ ] Step 4: `npx jest --selectProjects bots` → PASS.
- [ ] Step 5: commit `feat(bots): freeze rule-based-v4 and add the table-reading switch`.

### Task 2: Balance runs in the simulator

**Files:** Create `projects/sim/src/balance.ts`, `balance.spec.ts`; modify `cli.ts`; reuse `interval` from `tournament.ts`.

**Interfaces — produces:**
- `leadingForce(state: GameState): string | null` — rule 2 on the **full** state (sim only; not a bot decision). Force key: the Kingdom name, or `Ambitionist:<seatId>`.
- `interface BalanceGame { seed: number; winners: string[] /* force keys */; everLed: string | null /* first force that led */; leaderWon: boolean; deaths: number; hpLost: number }` — `deaths`: seats eliminated in the game; `hpLost`: summed damage taken by all seats (from `DamageDealtEvent`s). With every seat on one bot, these are that bot's own-side losses.
- `runBalance(config: { games: number; seats: number; policy: string; firstSeed?: number }): BalanceReport` — every seat plays `policy`; per game it checks `leadingForce` after each step (via `runGame`'s `onStep`) and records the first leader.
- `BalanceReport { config; games: BalanceGame[]; perForce: Record<string, { seats: number; wins: number }>; leaderWonRate: Interval /* over games with a leader */ }`.
- `compareBalance(a: BalanceReport, b: BalanceReport): { leaderWonDiff: Interval /* paired by seed, over seeds where both had a leader */; deathsDiff: Interval; hpLostDiff: Interval }`.
- CLI: `npm run sim -- balance <games> <seats> <policyA> <policyB> <firstSeed>` prints both reports' per-force win rates, leader-won rates, and the three paired differences (A minus B).

- [ ] Step 1: tests — `leadingForce` on hand-built states: 3 Wei / 1 Shu / 1 Wu → `Wei`; 2 Wei / 2 Shu → null; 2 Wei / 1 Shu where Wei HP 3 and Shu HP 4 → null (HP edge, rule 2); hidden seats ignored. `runBalance` 4 games, 6 seats, `rule-based-v4`, seed 0 → 4 games, perForce keys present, deterministic on a second run.
- [ ] Step 2: run `npx jest --selectProjects sim -t balance` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npx jest --selectProjects sim` → PASS.
- [ ] Step 5: commit `feat(sim): balance runs with every seat on one bot (leader wins, deaths, HP lost)`.

### Task 3: The table picture

**Files:** Create `projects/bots/src/lib/table.ts`, `table.spec.ts`.

**Interfaces — produces** (all pure functions of the redacted view):
- `type Relation = 'self' | 'ally' | 'truce' | 'foe'`
- `interface Force { key: string; seatIds: string[]; hp: number }`
- `forcesOf(view: GameState): Force[]` (rule 1)
- `leadingForceOf(view: GameState): Force | null` (rule 2)
- `relationOf(view: GameState, me: Seat, other: Seat): Relation` (rule 3)
- `seatDanger(view: GameState, seat: Seat, registry: ContentRegistry, danger: (generalId: string) => number): number` (rule 4; the `danger` function is injected so Task 4 provides it)
- `isDangerous(score: number): boolean` (≥ 2)

- [ ] Step 1: tests (`table(...)` fixtures, 6 seats): forces with a hidden seat and an Ambitionist; leader 3 Wei vs 1 Shu vs 1 Wu → Wei; tie → null; HP edge → null; relation for a Shu bot: Wu seat `truce`, Wei seat `foe`, hidden seat `foe`, Shu seat `ally`; a Wei bot (own force leads): Shu and Wu both `foe`; after a Wei seat is eliminated so seats tie → no truce; `seatDanger` sums only revealed Generals.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `npx jest --selectProjects bots` → PASS.
- [ ] Step 5: commit `feat(bots): read forces, the leading force and relations from the view`.

### Task 4: Danger ratings (content) and General danger (bots)

**Files:** Create `projects/content/data/decks/kingdom-wars/skill-danger.json`, `projects/content/src/lib/skill-danger.ts` (+ export in `public-api.ts`), `skill-danger.spec.ts`; create `projects/bots/src/lib/danger.ts`, `danger.spec.ts`.

**Interfaces — produces:**
- JSON: `{ "<skillId>": "high" | "medium" | "low", ... }` — one entry per non-Lord skill of every Kingdom Wars General (ids as in the registry: base ids like `sow-revolt`, variant ids like `kingdomWars:benevolence`).
- `skillDanger(skillId: string): 'high' | 'medium' | 'low' | undefined` (content).
- `generalDanger(generalId: string, registry: ContentRegistry): number` (bots, rule 4: max rating weight over the General's non-Lord skills + 10 × `GENERAL_VALUES[baseGeneralId(id)] ?? 0`).

- [ ] Step 1: tests — content spec: every non-Lord skill on a `kingdomWars:` General has a rating, no rating names an unknown skill. Bots spec: a General whose skills include a `high` and a `low` gets 2 + 10 × its value; an unrated skill counts 0.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: draft the ratings by rule 5, reading each skill's definition and comment in `projects/content/src/lib/generals/*.ts`. Add a `"_note"`-free JSON (data only). In the report, list every rating with a one-line reason, grouped by rating, for the developer's review.
- [ ] Step 4: `npx jest --selectProjects content bots` → PASS.
- [ ] Step 5: commit `feat(content,bots): danger ratings for Kingdom Wars skills and General danger`.

### Task 5: `tableRank` and holding fire

**Files:** Modify `projects/bots/src/lib/helpers.ts` (`HOLD_FIRE`, `fillPick`), `rule-based.ts` (`targetedPlays`, the conversion filters at ~337 and ~374, Coerce), `rules/tools.ts`, `rules/equipment.ts`, `rules/skills.ts` (their foe filters); create `projects/bots/src/lib/table-rank.ts`, `table-rank.spec.ts`; `policies.ts` (`rule-based-table` gets `tableRank`).

**Interfaces — produces:**
- `export const HOLD_FIRE = Number.NEGATIVE_INFINITY` (helpers).
- `tableRank: TargetRanker` (rule 6), using `relationOf`, `seatDanger` with `generalDanger`, `hostileActs` (export it from `targeting.ts`).
- Every place that picks an attack target from non-allies drops seats whose rank is `HOLD_FIRE` (one helper `attackable(view, me, seat, rank): boolean` = `!isAlly(...) && rank(view, me, seat) !== HOLD_FIRE`). `weakestFirst` never returns `HOLD_FIRE`, so `rule-based-v4` is unchanged.

- [ ] Step 1: tests (`decideTable`): 6 seats, bot Shu, Wei leads with 3 seats: a Sha goes to a Wei seat even when the Wu seat has less HP; a Wu truce partner at 2 HP is never the Sha target, and with only it in range the bot plays no Sha; a dangerous Wu partner at 4 HP (danger ≥ 2) is targeted only when no Wei seat is in range; Steal/Break and a Chains pick skip a `HOLD_FIRE` seat; with no leader the Sha goes to the weakest foe as before; `rule-based-v4` on the same table still targets the weakest non-ally.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `npx jest --selectProjects bots` → PASS.
- [ ] Step 5: commit `feat(bots): rank targets by the table and hold fire on truce partners`.

### Task 6: Peach for a dying truce partner

**Files:** Modify `rule-based.ts` step 2 (`worthAnswering`, dying); test `table-decisions.spec.ts` (new).

- [ ] Step 1: tests — with `tableReading`, a Shu bot holding a Peach answers a dying Wu truce partner; a dying Wei (leading force) seat is not saved; `rule-based-v4` does not save the Wu seat.
- [ ] Step 2: FAIL. Step 3: when `features.tableReading`, the dying check also accepts `relationOf(...) === 'truce'` (rule 7). Step 4: PASS.
- [ ] Step 5: commit `feat(bots): save a dying truce partner`.

### Task 7: Barbarians and Hail of Arrows weigh the table

**Files:** Modify `rule-based.ts` (the mass-attack block at ~294); `table.ts` (export `massAttackWorthIt(view, me, registry, danger): boolean`); test in `table-decisions.spec.ts`.

- [ ] Step 1: tests — Shu bot, Wei leads (3 seats), one healthy non-dangerous Wu partner, one Shu ally: enemies 3 vs friends 1.5 → played; same with two Shu allies and a Wu partner at 2 HP → enemies 3 vs friends 3 → not played; a dangerous Wu partner counts as an enemy (played where it would not be otherwise); no leader → today's rule (`rule-based-v4` decision equals `rule-based-table`'s on a no-leader table).
- [ ] Step 2: FAIL. Step 3: implement rule 8 behind `features.tableReading`; the old rule stays for the switch off. Step 4: PASS.
- [ ] Step 5: commit `feat(bots): weigh truce partners before Barbarians and Hail of Arrows`.

### Task 8: Judge, record, (developer review), ship

**Files:** spec `Results` (Part 2), `docs/architecture/bots-and-simulation.md`, `policies.ts`/`rule-based.ts` on ship.

- [ ] Step 1: record the bar in the spec before running: Part 2 passes when, at 6 seats on both seed ranges, the **leader-won rate** paired difference (`rule-based-table` minus `rule-based-v4`, all seats one bot) has its whole 95% interval below 0; and the mirrored tournament's seat share (`rule-based-table` vs `rule-based-v4`) is not wholly below 0 on both ranges. Report deaths and HP lost and per-force win rates alongside (Goal 4 and balance), without gating on them.
- [ ] Step 2: runs (background):

```bash
npm run sim -- balance 2000 6 rule-based-table rule-based-v4 1200000
```
```bash
npm run sim -- balance 2000 6 rule-based-table rule-based-v4 1300000
```
```bash
npm run sim -- tournament 4000 6 rule-based-table rule-based-v4 1200000 mirrored
```
```bash
npm run sim -- tournament 4000 6 rule-based-table rule-based-v4 1300000 mirrored
```
Also one 8-seat balance run of 400 games for timing against the 3× bar.

- [ ] Step 3: record every run in `Results`. At most three recorded tuning sets of the rule-6/8 weights between the ranges.
- [ ] Step 4: **stop for the developer:** show the danger ratings (Task 4's list) and the results. Ship only after the developer accepts the ratings.
- [ ] Step 5: ship: `rule-based` gets `tableRank` and `tableReading: true`; `rule-based-table` removed; `rule-based-v4` stays frozen; `testing.ts` `decide` keeps pinning v3 or v4 as the specs need (report any spec that meant "the shipped bot"). Update `bots-and-simulation.md` (table picture, ratings, balance runs). Run `npx jest --selectProjects bots content sim` and `npm run verify`. Commit `feat(bots): ship Part 2 (reading the table) as rule-based; record the results`.
