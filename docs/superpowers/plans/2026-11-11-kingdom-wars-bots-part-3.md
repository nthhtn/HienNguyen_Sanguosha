# Kingdom Wars Bots, Part 3 (No Wasted Plays) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bots stop spending cards where they buy nothing: no plays into a visible stop, costly targets only when worth it, answer-or-take-the-hit by exposure, no reveal for nothing, and legacy skill picks that respect the truce.

**Architecture:** Content declares two facts on the triggers that stop or tax a card (`stops`, `extraCost` on `SkillTrigger`, read only by bots). A bots module `waste.ts` reads them through `activeAbilities` on the redacted view and filters the decision's `legal` list once, at the top of `decide`, so every ladder step and registry rule sees only plays that can work. A second module `exposure.ts` estimates duel outlook and danger until the bot's next turn and drives a new response rule. The legacy per-skill pickers get the table ranker threaded in. All of it sits behind a `noWaste` feature switch; the shipped bot is frozen as `rule-based-v5`.

**Tech Stack:** TypeScript, Jest (`npx jest --selectProjects bots content sim engine`), `npm run sim`.

**Spec:** `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-part-3-design.md` (rules A–E, the bar). Parent: `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-design.md`.

## Decisions made for the plan (my calls)

- The facts live on `SkillTrigger` (engine type, optional fields the engine never reads, like `AbilityModifiers`' "content reads them; the engine never does"). A trigger that stops a card is the one place that knows when it does, so `stopsSha`, `cancelsCardsOnOwner` and Pleasure set the fact where they build the trigger.
- Waste filtering happens once on `legal` in `decide`, not at each call site. Registry rules already read `ctx.legal`, so they inherit it; `ctx.offered` stays raw.
- Opponent Sha "shown publicly and not used since" (spec C1) = hand cards of that seat whose face the redacted view shows (`definitionId` is not masked). Redaction already decides what the bot may see; no log reading.
- A wasted answer, for the count: a `CardPlayedEvent` by seat X with `inResponseTo.cardInstanceId === C`, followed later in the log by a `DamageDealtEvent` on X with `damage.cause.cardInstanceId === C`. Each such answer counts 1.
- First values of the tunables are fixed below (rule C2) so the first run is reproducible.

## Global Constraints

- Bots decide only from the redacted view and the engine's legal actions; no `Math.random`, no clock. The sim leak specs keep passing.
- `bots` may import `engine` and `content`; `content` must not import `bots`; the engine's behaviour is unchanged (type-only additions).
- No new switch over card or skill ids in `bots`. Stop and cost facts are declared in `content` next to the trigger.
- `rule-based-v5` must decide exactly as `rule-based` does at the start of this plan (`89c65de6`). Existing specs stay green unchanged until Task 9.
- App and server keep using `rule-based`.
- Each rule gets a one-line comment naming its spec rule (A1, C3, …) where it is implemented.
- 8-seat game time within 3x of `rule-based-v3` (parent anti-goal).
- The bar (spec "How it is judged"): at 6 seats on both seed ranges, `balance` paired differences: wasted plays per game wholly below 0; HP lost per game not wholly above 0; leader-won not wholly above 0; mirrored tournament seat share not wholly below 0. Up to three tuning sets between ranges, recorded.

## Review Focus

- **A hidden General with a stopping skill** (Lu Xun hidden): the bot does not assume Humility; the play is allowed. Test in Task 3.
- **Black Pommel against Black Shield:** the stop is turned off, the black Sha is allowed. Test in Task 2.
- **Every target of a play is stopped:** the play is dropped from `legal`; if nothing is left the ladder ends the phase, never throws. Test in Task 3.
- **A Duel where the bot holds 0 Sha:** it passes without counting anything (no divide-by-zero in the outlook). Test in Task 5.
- **Exposure with no other living seats acting before the bot** (two seats left): exposure is 0 and C3's first point still answers a lethal hit. Test in Task 5.

---

### Task 1: Freeze `rule-based-v5`, add the `noWaste` switch

**Files:** Modify `projects/bots/src/lib/rules/registry.ts` (`BotFeatures`), `rule-based.ts`, `policies.ts`, `testing.ts`; test `policies.spec.ts`.

**Interfaces — produces:**
- `BotFeatures { rules; tableReading: boolean; noWaste: boolean }`; `NO_FEATURES` gets `noWaste: false`; every existing literal gets `noWaste: false`.
- `ruleBasedV5Policy` (id `rule-based-v5`): today's `rule-based` arguments (`tableRank`, `NO_CARD_PLAY_RULES`, `NO_RESPONSE_RULES`, `GENERAL_VALUES`, `{ rules: KINGDOM_WARS_RULES, tableReading: true, noWaste: false }`).
- `ruleBasedWastePolicy` (id `rule-based-waste`): same with `noWaste: true`.
- `decideWaste(s)` in `testing.ts` = `decideWith(ruleBasedWastePolicy, s)`.

- [ ] Step 1: tests — `policyIds()` contains `rule-based-v5` and `rule-based-waste`; on the five fixtures Part 2's pin uses, `decideWith(ruleBasedV5Policy, s)` equals `decideWith(ruleBasedPolicy, s)`.
- [ ] Step 2: `npx jest --selectProjects bots -t policies` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npx jest --selectProjects bots` → PASS.
- [ ] Step 5: commit `feat(bots): freeze rule-based-v5 and add the no-waste switch`.

### Task 2: Stop and cost facts in content (rules A2, B1)

**Files:** Modify `projects/engine/src/lib/registry/types.ts` (`SkillTrigger`), `projects/content/src/lib/shared/armor.ts`, `shared/cancel.ts`, `generals/mountain.ts` (Pleasure), `projects/content/src/public-api.ts`. Create `projects/content/src/lib/shared/stops.ts`, `stops.spec.ts`.

**Interfaces — produces:**
- In engine types:
  ```ts
  // A use of a card on a seat, as a bot sees it before playing (read by bots only; the engine never does).
  export interface CardUse { card: UsedCard; userSeatId: string; targetSeatId: string }
  export interface SkillTrigger { …; stops?(state: GameState, use: CardUse, ownerSeatId: string, registry: ContentRegistry): boolean;
    extraCost?(state: GameState, use: CardUse, ownerSeatId: string, registry: ContentRegistry): { basicCards: number } | null }
  ```
- In `content/shared/stops.ts`, exported from `public-api.ts`:
  - `wouldStop(state, use: CardUse, registry): boolean` — any trigger of `activeAbilities(state, use.targetSeatId, registry)` whose `stops` returns true.
  - `extraCostOf(state, use: CardUse, registry): { basicCards: number } | null` — first non-null `extraCost`.
  - Also export `activeAbilities` and `answersNeededAgainst` from `public-api.ts` (Task 5 uses the second).
- `stopsSha(id, applies)` sets `stops`: `use.card.as === 'sha'`, target is the owner, `applies` holds for the card, and the user does not ignore armor (same test as `shaIgnoresArmor`, from the user's abilities). `applies` takes a `UsedCard`-shaped argument now; the two callers pass `(card) => card.colour === 'black'` and `(card) => !card.nature`.
- `cancelsCardsOnOwner(cancels)` sets `stops` on its triggers: target is the owner, the user is not the owner, `cancels(state, use.card, use.userSeatId, ownerSeatId, registry)`.
- Pleasure sets `stops` when the user holds no Basic hand card other than the Sha's own physical cards, and `extraCost` `{ basicCards: 1 }` otherwise (both only for a Sha by another seat on the owner).

- [ ] Step 1: tests in `stops.spec.ts`, each building a table with the content test helpers:
  - `wouldStop` is true for a black Sha on a seat wearing Black Shield; false for a red Sha; false when the user wears Black Pommel.
  - true for a Sha with no nature on Wood Armor; false for a fire Sha.
  - true for Steal and for Capture on a revealed `kingdomWars:lu-xun`; false for Duel on him; false while his General is hidden.
  - Pleasure (revealed Liu Shan): user holding only the Sha → `wouldStop` true; user holding a Sha and a Peach → false and `extraCostOf` is `{ basicCards: 1 }`.
  - A source scan: every file under `projects/content/src/lib` (not specs) containing `'no-effect'` is one of `shared/armor.ts`, `shared/cancel.ts`, `generals/mountain.ts`; the message on failure says to declare `stops` on the new trigger and add the file here.
- [ ] Step 2: `npx jest --selectProjects content -t stops` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npx jest --selectProjects content engine` → PASS (existing armor, Humility and Pleasure specs unchanged).
- [ ] Step 5: commit `feat(content): declare which triggers stop or tax a card`.

### Task 3: Drop stopped and unaffordable plays (rules A1, A3, B2)

**Files:** Create `projects/bots/src/lib/waste.ts`, `waste.spec.ts`; modify `rule-based.ts` (the `legal` computation in `decide`).

**Interfaces:**
- Consumes: `wouldStop`, `extraCostOf`, `CardUse` (Task 2); `TargetRanker`, `HOLD_FIRE` (`helpers.ts`).
- Produces: `targetWasted(view: GameState, me: Seat, card: UsedCard | null, target: Seat, registry: ContentRegistry): boolean` (A1 for one target: `wouldStop`, or an `extraCost` the bot cannot pay; `card` null → false), and `withoutWaste(view: GameState, me: Seat, legal: Action[], registry: ContentRegistry, rank: TargetRanker): Action[]` built on it.
  - For a `PlayCardAction` or `UseConversionAction` with seat targets: build the `UsedCard` (engine `usedCardOf` / `usedCardFrom` for conversions) and drop each stopped target. A single-target play left with no target is dropped. A multi-target play keeps its other targets. An untargeted mass card (no seat targets in the action) is kept (A3).
  - B2: a target with an `extraCost` stays only when (a) its rank is above every cost-free target's rank among this card's other legal plays, or it is the only target, and (b) after paying `basicCards` (the least useful Basics by `keepRank`, not the card being played), the bot still holds a Shan or Peach, or the target's `combinedHp` ≤ 1.
- In `decide`: when `features.noWaste`, `legal = withoutWaste(view, mine, legal, registry, rank)` right after the template fill. If that empties `legal` while `offered` had an `EndPhaseAction` or `PassAction`, those are never removed (they have no targets), so `legal` cannot become empty.

- [ ] Step 1: tests in `waste.spec.ts` (table helpers from `testing.ts`):
  - a black Sha's play on a Black Shield wearer is dropped; the same Sha's play on another seat is kept.
  - Steal on revealed `kingdomWars:lu-xun` dropped; on hidden Lu Xun kept.
  - a Sha on revealed Liu Shan with only the Sha in hand: dropped. With Sha + Sha + Shan and another foe ranked higher: dropped (B2a). With Sha + Sha + Shan and Liu Shan the only foe: kept. With Sha + Shan only (paying would spend the last Shan) and Liu Shan at 2 HP: dropped; at 1 HP: kept.
  - a Play Phase where the only targeted play is stopped: `decideWaste` returns `EndPhaseAction`.
  - `decideWith(ruleBasedV5Policy, …)` on the Black Shield fixture still plays the Sha (switch off).
- [ ] Step 2: `npx jest --selectProjects bots -t waste` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npx jest --selectProjects bots` → PASS.
- [ ] Step 5: commit `feat(bots): skip plays a visible stop would cancel, and costly targets not worth it`.

### Task 4: Wasted plays in the balance report

**Files:** Modify `projects/sim/src/balance.ts`, `balance.spec.ts`, `cli.ts` output.

**Interfaces — produces:**
- `BalanceGame.wasted: number` = count of `AbilityUsedEvent` with `outcome === 'no-effect'` in `finalState.log`, plus wasted answers (the definition in "Decisions" above).
- `BalanceComparison.wastedDiff: Interval`, paired by seed like `hpLostDiff`; printed by `formatComparison` as `Wasted plays per game`.
- `wastedIn(state: GameState): number` exported for the spec.

- [ ] Step 1: tests — `wastedIn` on a hand-built log: one `no-effect` event → 1; a Shan `CardPlayedEvent` in response to card `c1` followed by `DamageDealtEvent` with cause `c1` on the same seat → 1; the same without the damage → 0; damage from `c2` → 0. `compareBalance` returns `wastedDiff`.
- [ ] Step 2: `npx jest --selectProjects sim -t balance` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npx jest --selectProjects sim` → PASS. Smoke: `npm run sim -- balance 20 6 rule-based-waste rule-based-v5 1` prints the new line.
- [ ] Step 5: commit `feat(sim): count wasted plays per game in balance runs`.

### Task 5: Duel outlook and exposure (rules C1, C2)

**Files:** Create `projects/bots/src/lib/exposure.ts`, `exposure.spec.ts`.

**Interfaces — produces (all pure, from the redacted view):**
- `EXPOSURE_WEIGHTS` (first values, tunable):
  `{ shaPerHandCard: 0.3, reachHandSize: 3, threatBase: 0.25, threatPerCard: 0.15, threatCap: 1, weaponBonus: 0.25, dangerousBonus: 0.5, truceFactor: 0.3, peach: 1, spareShan: 0.7, armor: 0.3, allyWithCards: 0.3, allyCardsNeeded: 2 }`.
- `playableSha(view, me, registry): number` — Sha in hand plus cards a revealed conversion can turn into Sha (one per card).
- `expectedSha(view, seat): number` — visible Sha in its hand + `shaPerHandCard` × its other (hidden) hand cards.
- `duelOutlook(view, me, opponent, registry): 'outlast' | 'lose'` — rounds the bot can pay = `floor(playableSha(me) / answersNeededAgainst(view, opponent.id, registry))`; the opponent's = `floor(expectedSha(opponent) / answersNeededAgainst(view, me.id, registry))`; `'outlast'` when the bot's rounds exceed the opponent's (the opponent answers first in a Duel the bot was dealt, so ties lose).
- `exposure(view, me, registry, danger: (generalId: string) => number, after: { shanUsed: number }): { threat: number; protection: number; exposed: boolean }`:
  - Seats counted: living, not `self`/`ally` (`relationOf`), acting before the bot's next turn (`livingSeatOrderFrom(view, <current turn seat>)` up to the bot), and reaching it (`seatDistance` ≤ its `attackRange`, or hand size ≥ `reachHandSize`).
  - Each adds `min(threatCap, threatBase + threatPerCard × hand)` + `weaponBonus` if it wears a weapon + `dangerousBonus` if `isDangerous(seatDanger(...))`; × `truceFactor` for a truce partner.
  - Protection: `peach` per Peach in hand; `spareShan` per Shan left after `after.shanUsed`; `armor` if it wears armor; `allyWithCards` per revealed ally holding ≥ `allyCardsNeeded` cards.
  - `exposed` when `threat − protection ≥ hpAfter`, where `hpAfter` is `me.combinedHp` minus the pending hit (0 when none is pending).

- [ ] Step 1: tests:
  - `duelOutlook`: 2 Sha vs opponent with 3 hidden cards → `'outlast'` (2 > 0); 1 Sha vs 4 hidden cards (expected 1.2, 1 round) → `'lose'`; 2 Sha vs revealed Lu Bu with 0 cards → `'outlast'` (1 > 0); 2 Sha vs Lu Bu with 4 hidden cards → `'lose'` (1 vs 1, tie loses); 0 Sha → `'lose'`, no throw.
  - visible Sha: opponent with one face-shown Sha and 0 hidden cards counts 1.
  - `exposure`: two seats left (bot and one enemy after it) → the enemy still counts when it acts before the bot; with the bot to act next and no seat between → `threat` 0.
  - 2 HP, one Shan, two enemy seats with 5 cards each acting next → `exposed` true when the hit is taken (`hpAfter` 1); the same seats as allies → false.
- [ ] Step 2: `npx jest --selectProjects bots -t exposure` → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: PASS.
- [ ] Step 5: commit `feat(bots): duel outlook and exposure until the next turn`.

### Task 6: Answer or take the hit (rules C3, C3a, C4)

**Files:** Create `projects/bots/src/lib/answer.ts`, `answer.spec.ts`; modify `rule-based.ts` (response step 2 and the Duel play in step 5).

**Interfaces:**
- Consumes: Task 5; `relationOf` (`table.ts`); `dangerOf` (`danger.ts`); `answersNeededAgainst`.
- Produces: `shouldAnswer(view, me, registry, danger): boolean` for a `card-effect` window whose source card is a Sha, Duel, Hail of Arrows or Barbarians (or a skill window whose answer is a Shan or Sha against damage aimed at the bot):
  1. the pending hit would leave `combinedHp` ≤ 0 → true;
  2. the attacker (the source card's user) is a truce partner → `exposed`;
  3. a Duel against a non-truce seat → `duelOutlook === 'outlast' || exposed`;
  4. a Sha, Hail of Arrows or Barbarians: if the bot cannot give all `answersNeededAgainst` answers → false (never a partial answer); otherwise `exposed || spare`, where `spare` is: Shan in hand > the number of seats counted as threats in Task 5.
  For a Duel, (1) uses the 1 damage the bot would take on losing.
- `duelWorthStarting(view, me, target, registry): boolean` = `duelOutlook(view, me, target, registry) === 'outlast'` with roles swapped (the target answers first, so a tie wins for the bot).
- In `decide` (only with `features.noWaste`): in step 2, `worthAnswering` for those windows is `shouldAnswer(...)` instead of `true`; in step 5, Duel plays (`targetedPlays(... 'duel' ...)` and the Dueling Heroes conversion) keep only targets where `duelWorthStarting` holds.

- [ ] Step 1: tests:
  - Sha on the bot at 1 HP with one Shan → answers (lethal).
  - Sha on the bot at 3 HP, one Shan, no threats before its next turn → passes; two 5-card foes acting next at 2 HP → answers.
  - Sha from revealed Lu Bu, one Shan, 1 HP → `PassAction`. One Shan cannot stop a Matchless Sha, so the hit lands either way; the bot keeps the Shan and the dying round follows.
  - Sha from Lu Bu, two Shan, exposed → answers.
  - Duel from a truce partner, bot at 3 HP, not exposed → passes. Duel from a foe with 1 card while the bot has 2 Sha → answers. Duel from a foe with 6 cards while the bot has 1 Sha at 3 HP, not exposed → passes.
  - Hail of Arrows at 4 HP, one Shan, not exposed → passes.
  - Play Phase: a Duel on a 6-card foe with the bot holding 1 Sha is not played; on a 0-card foe it is.
  - `rule-based-v5` on the 3-HP Sha fixture still answers (switch off).
- [ ] Step 2: `npx jest --selectProjects bots -t answer` → FAIL.
- [ ] Step 3: implement. Rule 1 is checked before rule 4, but rule 4's "cannot answer fully" makes the pass unconditional: write it so the partial-answer check comes first, and say so in the comment.
- [ ] Step 4: `npx jest --selectProjects bots` → PASS.
- [ ] Step 5: commit `feat(bots): answer or take the hit by exposure and duel outlook`.

### Task 7: Use surplus cards, no reveal for nothing (rules D1, D2)

**Files:** Modify `projects/bots/src/lib/rules/registry.ts` (`BotRuleContext`), `rules/tools.ts`, `rule-based.ts`; tests `rules/tools.spec.ts`, `rule-based.spec.ts`.

**Interfaces — produces:**
- `BotRuleContext.surplus: number` = max(0, hand size − engine `handLimit(view, me.id)`), 0 when `noWaste` is off.
- D1: the Part 1 Tool rules with a "worth it" threshold (Amass, Ascertain, Chains, Harvest, Ally Far Attack Near, Blaze) play whenever any legal target is attackable and `surplus > 0`, ignoring their usual threshold. Each rule reads `ctx.surplus`; no list in the ladder.
- D2: for an ability ask (`verb === 'use'`) on a skill of a hidden General that is not compulsory: decline when the `use` option's effects contain only the reveal effect and `AbilityUsedEffect` (look the reveal effect's `kind` up in the engine `Effect` union) and no option gives a draw, heal, damage, card move or a following step. Compulsory asks keep today's "Use" (spec 2026-10-20).

- [ ] Step 1: tests — with surplus 2 and an Amass the threshold would hold back, `decideWaste` plays it; with surplus 0 it does not. An optional hidden-General ask whose `use` effects are only reveal + log is declined by `decideWaste`, accepted by `rule-based-v5`; a compulsory one is accepted by both.
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: `npx jest --selectProjects bots` → PASS.
- [ ] Step 5: commit `feat(bots): spend surplus cards and skip reveal-only skill uses`.

### Task 8: Legacy skill picks on the ranker (rules E1–E3)

**Files:** Modify `projects/bots/src/lib/skills.ts`, `wind.ts`, `fire.ts`, `forest.ts`, `mountain.ts`, `rule-based.ts`; tests in each file's spec.

**Interfaces:**
- Consumes: `TargetRanker`, `attackable` (`helpers.ts`); `targetWasted` (Task 3) for picks that use a card on the seat.
- Produces: `rankHarmTargets(view: GameState, me: Seat, ids: readonly string[], rank: TargetRanker | undefined, fallback: (a: Seat, b: Seat) => number): Seat[]` in `helpers.ts` — with `rank`, attackable seats best first; without, today's fallback order (so frozen policies are unchanged).
- The entry points `skillSelection`, `fireSelection`, `skillChoice`, `wantsSkill`, `pickActiveSkill` get a last parameter `rank?: TargetRanker`. `decide` passes `rank` only when `features.noWaste`.

- [ ] Step 1: audit. List every `case` in the five files that picks a seat to harm (damage, discard, take a card, a harmful Judgment, forced Sha). Write the list as a comment above `rankHarmTargets`, one id per line. Help picks (heal, give, draw for a seat) are not on it (E2).
- [ ] Step 2: tests — for three representative picks (one damage skill, one card-taking skill, one forced-Sha skill from the audit), with a leading force and a low-HP truce partner on the table: `decideWaste` picks the leading-force seat; `rule-based-v5` picks the lowest-HP seat as today.
- [ ] Step 3: run → FAIL.
- [ ] Step 4: route each listed pick through `rankHarmTargets` (and `targetWasted` for picks that use a card on the seat).
- [ ] Step 5: `npx jest --selectProjects bots` → PASS; the Part 2 pin of `rule-based-v5` stays green.
- [ ] Step 6: commit `feat(bots): legacy skill picks rank targets and respect the truce`.

### Task 9: Judge, ship, record

**Files:** Modify `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-part-3-design.md` (Results), parent spec (Part 3 summary), `rule-based.ts`, `policies.ts`.

- [ ] Step 1: write the seeds in the spec before running: ranges `1500000` and `1600000` (not used before).
- [ ] Step 2: run, at 6 seats: `npm run sim -- balance 2000 6 rule-based-waste rule-based-v5 1500000` and `… 1600000`; `npm run sim -- tournament 4000 6 rule-based-waste rule-based-v5 <seed> mirrored` for both. Run in the background; each takes minutes.
- [ ] Step 3: if a gate fails on the first range, up to three tuning sets of `EXPOSURE_WEIGHTS` on the first range only, each recorded with its numbers; the second range is run once with the final set.
- [ ] Step 4: time: `/usr/bin/time -p npm run sim -- balance 400 8 <bot> <bot> 1400000` for `rule-based-waste` and `rule-based-v3`; ratio ≤ 3.
- [ ] Step 5: write Results (tables like Part 2's: wasted, HP lost, deaths, leader-won, per force, seat share, time) and the verdict.
- [ ] Step 6: if it passes: `rule-based` becomes `noWaste: true`; `rule-based-waste` stays registered as an alias for the record. Update the specs whose expectations change because the shipped bot now takes hits and skips stopped plays; each changed expectation gets a one-line reason in the commit message. If it fails, `rule-based` stays as is and the Results say why.
- [ ] Step 7: `npm run verify` and `npx jest` → green.
- [ ] Step 8: commit `feat(bots): ship Part 3 (no wasted plays)` and stop for the developer to review and open the PR.
