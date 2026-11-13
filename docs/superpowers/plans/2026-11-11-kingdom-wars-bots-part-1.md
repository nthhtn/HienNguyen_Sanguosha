# Kingdom Wars Bots, Part 1 (Kingdom Wars Rules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The rule-based bot plays every Kingdom Wars card and skill it currently ignores, by Kingdom Wars rules, and the simulator can show it.

**Architecture:** A new bot rule registry in `projects/bots` (one entry per card, equipment ability or skill id) that the rule-based ladder consults when a feature switch is on. The current bot is frozen as `rule-based-v3` with the switch off. The simulator records, per side, how often each card and skill was offered and used, so the ship rule in the spec can be applied.

**Tech Stack:** TypeScript, Jest (`npx jest --selectProjects bots` / `sim`), `npm run sim`.

**Spec:** `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-design.md` (Part 1, "How it is judged").

## What the audit found (narrows Part 1)

A scan of every non-Lord skill on a Kingdom Wars General (93 skills) against the bot code shows most already have a bot rule. Part 1's real gaps:

- **Cards never played from hand:** Amass, Ally Far Attack Near, Harvest, Ascertain, Chains, Blaze. (Blaze is only played through Fire Strategy.)
- **Wuxie Kingdom:** played as a plain Wuxie (the first answer offered); never preferred where it cancels for a whole Kingdom.
- **Equipment asks never accepted:** Fire Fan, Trident Glaive (the default in `wantsToUse` is "decline"). Trident Glaive's seat pick takes the first option, which may be an ally.
- **Skills:** Zou Shi's Femme Fatale and Impetus for Conflicts are never used. Benevolence (Liu Bei) uses Identity Kindness's threshold of 2 cards; it heals at 3.
- The other variant differences in `differences.json` either need no new decision (the engine enforces them: Lightning Strike, Balance of Power, Eternal Loyalty, Seed of Animosity) or belong to Part 3 (Empty City, Humility, Behind the Curtain are "targeted and wasted" cases).

## Proposed spec change (needs the developer's yes)

The spec puts per-card and per-skill bot knowledge "next to that card or skill in `projects/content`". That fits facts (Part 2's "how dangerous is this skill", Part 3's "what stops this card"). It does not fit play judgment ("is Amass worth playing now?"): that needs the bots' own helpers (`isAlly`, `keepRank`, the target ranker), and `content` may not import `bots`. This plan therefore keeps play judgment in a **data-driven registry inside `bots`**, one entry per id, with no new central switch. Facts for Parts 2 and 3 still go in `content`. If the developer agrees, the spec's "Where the knowledge lives" gets this sentence in Task 8.

## Global Constraints

- Bots decide only from the redacted view and the engine's legal actions; never `Math.random`, never the clock. The leak specs in `projects/sim` must keep passing.
- `bots` may import `engine` and `content`; `content` must not import `bots`; the engine learns nothing about bots.
- No new switch over card or skill ids. New knowledge is a registry entry keyed by id.
- `rule-based-v3` must behave exactly as `rule-based` does today (same decisions on the same view). Existing `rule-based` specs stay green unchanged until Task 8 ships.
- The app and server keep using the policy id `rule-based`; no app or server change.
- Rule text before code (CLAUDE.md): each rule below is written in plain words; the code follows it.
- Ship rule (spec): Part 1 ships when its counts clearly improve on both seed ranges, even without more seats won, unless win share is clearly worse (whole 95% interval below 0 on both).
- `npm run verify` and the tests green; the developer merges.

## Review Focus

- **A bot holding a Kingdom Wars card with no legal use** (Ally Far Attack Near with no exposed seat of another Kingdom, Amass while hidden): the rule must decline and the bot must still end its phase. Test in Task 3.
- **A hidden bot** (no Kingdom yet): `isAlly` says nobody is an ally, so every "allies" count is 0. Rules must still pick sane targets and never target the bot itself. Test in Task 3 (Chains, Blaze) and Task 4 (Trident Glaive).
- **The frozen baseline drifting:** a refactor of `decide` that changes `rule-based-v3`'s choices would void every comparison. Task 1's snapshot test pins it.
- **A registry entry for an id the engine never offers in this situation** (for example a Chains Recast while Chains is converted by Shackle, which offers no Recast): the rule must return `undefined`, not throw. Test in Task 3.
- **Ambitionist bots:** `isAlly` is always false for them, so Harvest and Amass must treat them as alone. Test in Task 3.

---

### Task 1: Feature switch, frozen `rule-based-v3`, challenger policy

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts:368-379`
- Modify: `projects/bots/src/lib/policies.ts`
- Modify: `projects/bots/src/lib/testing.ts` (add `decideWith`)
- Create: `projects/bots/src/lib/rules/registry.ts`
- Test: `projects/bots/src/lib/rules/registry.spec.ts`, `projects/bots/src/lib/policies.spec.ts`

**Interfaces:**
- Produces:
  - `interface BotRuleContext { view: GameState; me: Seat; legal: Action[]; offered: Action[]; registry: ContentRegistry; rank: TargetRanker }` (`legal`: the offers with target templates filled by `fillPick`; `offered`: the engine's offers as given, templates unfilled)
  - `interface BotRule { id: string; play?: { when: 'early' | 'late'; pick(ctx: BotRuleContext): Action | undefined }; wantsToUse?(ctx: BotRuleContext, choice: PendingChoice): boolean; select?(ctx: BotRuleContext, selection: PendingSelection): string[] | 'cancel' | undefined; choose?(ctx: BotRuleContext, choice: PendingChoice): string | undefined; answer?(ctx: BotRuleContext, answers: RespondAction[]): RespondAction | undefined }`
  - `type BotRuleRegistry = ReadonlyMap<string, BotRule>`; `function botRules(rules: BotRule[]): BotRuleRegistry` (throws `Duplicate bot rule "<id>"` on a repeated id)
  - `interface BotFeatures { rules: BotRuleRegistry | null }`, `const NO_FEATURES: BotFeatures = { rules: null }`
  - `createRuleBasedPolicy(id, rank, rules?, responseRules?, generalValues?, features: BotFeatures = NO_FEATURES)`
  - `ruleBasedV3Policy` (id `rule-based-v3`): today's `rule-based` arguments, `NO_FEATURES`
  - `KINGDOM_WARS_RULES: BotRuleRegistry` (empty in this task; filled by Tasks 3–5), exported from `rules/kingdom-wars.ts`
  - `ruleBasedKwPolicy`, registered as challenger `rule-based-kw`: today's `rule-based` arguments plus `{ rules: KINGDOM_WARS_RULES }`
  - `decideWith(policy: BotPolicy, s: GameState): Action` in `testing.ts`

- [ ] **Step 1: Write the failing tests**

`registry.spec.ts`: `botRules([{ id: 'x' }, { id: 'x' }])` throws `Duplicate bot rule "x"`; `botRules([{ id: 'a' }, { id: 'b' }])` keeps insertion order (`[...map.keys()]` equals `['a', 'b']`).

`policies.spec.ts`: `policyIds()` contains `'rule-based-v3'` and `'rule-based-kw'`. Then a pinning test: over the existing `rule-based.spec.ts` fixture tables (pick 5 representative ones: General selection, a dying response, a Discard Phase, a Play Phase with Sha + Steal, a Wuxie window), `decideWith(ruleBasedV3Policy, s)` equals `decideWith(ruleBasedPolicy, s)`.

- [ ] **Step 2: Run them, see them fail**

Run: `npx jest --selectProjects bots -t "bot rules|policies"`
Expected: FAIL (`botRules` / `rule-based-v3` not defined).

- [ ] **Step 3: Implement**

Types and `botRules` in `rules/registry.ts`. Thread `features` through `decide` (unused until Task 2). Register both policies in `policies.ts`. Export `rules/registry` and `rules/kingdom-wars` from `public-api.ts`.

- [ ] **Step 4: Run them, see them pass**

Run: `npx jest --selectProjects bots`
Expected: PASS, all existing bot specs included.

- [ ] **Step 5: Commit** — `feat(bots): rule registry switch, frozen rule-based-v3 and the rule-based-kw challenger`

---

### Task 2: Ladder hooks for the registry

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts` (`decide`, sections 1a, 1a', 2 and 5)
- Test: `projects/bots/src/lib/rules/hooks.spec.ts`

**Interfaces:**
- Consumes: Task 1's `BotRule`, `BotFeatures`.
- Produces: the lookup rules below, which Tasks 3–5 rely on.

Where `decide` consults `features.rules` (only when not `null`), and with which id:

| Ladder step | Id looked up | Hook | When it returns `undefined` |
|---|---|---|---|
| 1a selection | `reason.abilityId` (reason `ability`), else `reason.card.as` (reason `card-effect`) | `select` | The existing code runs |
| 1a' choice, verb `use` | `reason.abilityId` | `wantsToUse` (a compulsory skill still says Use) | The existing code runs |
| 1a' choice, verb `pick` / `give` | `reason.abilityId` | `choose` (must return one of the offered option ids) | The existing code runs |
| 2 responding | Each answer's card `definitionId` | `answer` of the first rule whose id matches an answer | The existing `best` is kept |
| 5 Play Phase, right after Peach Garden | Every rule in insertion order with `play.when === 'early'` | `play.pick` | Next rule, then the existing ladder |
| 5 Play Phase, right before the `late` active skills | Every rule with `play.when === 'late'` | `play.pick` | Next rule, then the existing ladder |

`ctx.legal` is the filled `legal` list `decide` already builds (target templates filled by `fillPick`). A hook's returned action must be in `ctx.legal` (or a `SelectAction` / option id built from the pending decision); `decide` does not re-check.

In step 2 the hook only picks *which* answer; whether to answer at all stays `worthAnswering`.

- [ ] **Step 1: Write the failing tests**

`hooks.spec.ts`, using `createRuleBasedPolicy('t', weakestFirst, NO_CARD_PLAY_RULES, NO_RESPONSE_RULES, undefined, { rules: botRules([...]) })` with test rules:
- `'play early: a rule's pick is taken before a Sha'`: hand `[sha]` with a foe in range; a rule `{ id: 'r', play: { when: 'early', pick: (c) => c.legal.find(a => a.kind === 'EndPhaseAction') } }` → the decision is `EndPhaseAction` (without the registry it is the Sha).
- `'use ask: wantsToUse overrides the default decline'`: `asking(table(), 'fire-fan', 'seat-b')` with rule `{ id: 'fire-fan', wantsToUse: () => true }` → `use`.
- `'a hook returning undefined falls through'`: same ask, `wantsToUse` absent → `decline`.
- `'answer: the rule picks among answers'`: a Wuxie window on seat-a holding `wuxie` and `wuxie-guo`, rule `{ id: 'wuxie-guo', answer: (c, as) => as.find(...wuxie-guo) }` → the `RespondAction` with the `wuxie-guo` card.
- `'features null: rule-based-v3 ignores the registry'` — covered by Task 1's pin.

- [ ] **Step 2: Run, see them fail**

Run: `npx jest --selectProjects bots -t hooks`
Expected: FAIL.

- [ ] **Step 3: Implement the lookups in `decide`** as the table says. One helper `ruleFor(features, id): BotRule | undefined`.

- [ ] **Step 4: Run all bot specs, see them pass**

Run: `npx jest --selectProjects bots`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(bots): the rule-based ladder consults the bot rule registry`

---

### Task 3: Kingdom Wars Tools from hand

**Files:**
- Create: `projects/bots/src/lib/rules/tools.ts` (the six rules), add them to `rules/kingdom-wars.ts`
- Test: `projects/bots/src/lib/rules/tools.spec.ts`

**Interfaces:**
- Consumes: `BotRule`, `BotRuleContext`; helpers `isAlly`, `handCards`, `keepRank`, `definitionIdOf` from `helpers.ts`; `ruleBasedKwPolicy` via `decideWith`.
- Produces: `amassRule`, `allyFarAttackNearRule`, `harvestRule`, `ascertainRule`, `chainsRule`, `blazeRule: BotRule`.

**Rules (plain words first).** "Allies" below means living seats `isAlly` with the bot, the bot itself not included. "Foes" means living seats other than the bot that are not allies.

1. **Amass** (`amass`, early): play it when at least one ally exists (they all draw 2 and discard 2 with the bot). Alone, keep it: it costs a card for a reshuffle of two.
2. **Ally Far Attack Near** (`ally-far-attack-near`, early): play it whenever a target is offered. Target: the offered seat the ranker likes *least* (lowest `rank`), so the 1 card goes where it hurts least. The bot draws 3.
3. **Harvest** (`harvest`, early): play it when allies + 1 (the bot) is greater than the number of foes. Each seat takes a card, so it only pays when the bot's side takes more than half.
4. **Ascertain** (`ascertain`, late): Recast it (the play with no target). The bot has no use for what it would see yet (hidden-kingdom inference is out of scope).
5. **Chains** (`chains`, late):
   - If the bot is chained, target itself plus one unchained foe if one is offered, else itself alone (unchaining before a fire or lightning hit).
   - Else, if two unchained foes are offered, target the two the ranker likes most.
   - Else Recast it.
   - Never target an ally, never toggle a chained foe off. With no Recast offered (a converted Chains) and no fitting target, return `undefined`.
6. **Blaze** (`blaze`, late): play it at the foe the ranker likes most that holds at least 1 hand card, only while the bot holds 3 or more *other* hand cards (it needs a card of the shown suit). Never at itself. Same threshold as Fire Strategy today.

A rule reads the offered `PlayCardAction`s for its card from `ctx.legal` by `definitionIdOf(view, a.cardInstanceId)`. For Chains and Blaze it builds the targets itself from the template's `pickTargets` in `ctx.offered` (not the `fillPick` result in `ctx.legal`, which drops allies and the bot itself), respecting `pickAllows`.

- [ ] **Step 1: Write the failing tests** (all with `decideWith(ruleBasedKwPolicy, s)` on `table(...)`)
- `amass: played with an ally at the table` — seat-a Wei, seat-e Wei (6 seats), hand `[amass]` → `PlayCardAction` for it.
- `amass: kept when alone` — 4 seats, no Wei ally → not the Amass play (`EndPhaseAction`).
- `amass: an Ambitionist is alone` — seat-a `allegiance: 'ambitionist'` with a Wei seat-e → not played.
- `ally far attack near: the least-liked seat gets the card` — seat-b at 1 HP, seat-c at 4 HP, both other Kingdoms → targets `seat-c` (weakest-first ranks seat-b highest).
- `ally far attack near: no exposed seat of another Kingdom → not played, phase ends`.
- `harvest: played when allies + 1 > foes` (6 seats, 3 Wei incl. seat-a… set kingdoms so 3 vs 2) and `not played at 1 vs 3`.
- `ascertain: Recast late` — hand `[ascertain]` → the play with `targets: []`.
- `chains: two unchained foes` → targets the two foes ranked highest; `chained bot: itself plus a foe`; `one foe only → Recast`; `converted Chains with no target fits → falls through to the ladder` (use Shackle's conversion offer if the fixture allows; else a hand-built offer with no `[]` play).
- `chains/blaze: a hidden bot never targets itself` — seat-a Generals hidden.
- `blaze: needs 3 other hand cards` (2 others → not played; 3 → played at the top-ranked foe with a hand card).

- [ ] **Step 2: Run, see them fail** — `npx jest --selectProjects bots -t "rules/tools"` (or the describe names). Expected: FAIL.

- [ ] **Step 3: Implement the six rules** in `tools.ts`; append them to `KINGDOM_WARS_RULES` in the order early ones first: Amass, Ally Far Attack Near, Harvest, then Ascertain, Chains, Blaze.

- [ ] **Step 4: Run all bot specs** — `npx jest --selectProjects bots`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(bots): play Amass, Ally Far Attack Near, Harvest, Ascertain, Chains and Blaze from hand`

---

### Task 4: Wuxie Kingdom, Fire Fan, Trident Glaive

**Files:**
- Create: `projects/bots/src/lib/rules/equipment.ts`, `projects/bots/src/lib/rules/wuxie-guo.ts`; add to `rules/kingdom-wars.ts`
- Test: `projects/bots/src/lib/rules/equipment.spec.ts`, `projects/bots/src/lib/rules/wuxie-guo.spec.ts`

**Interfaces:**
- Produces: `wuxieKingdomRule`, `fireFanRule`, `tridentGlaiveRule: BotRule`.

**Rules.**

1. **Wuxie Kingdom** (`answer`): when the bot answers a Wuxie window (the existing `worthAnswering` decides that) and holds both a Wuxie and a Wuxie Kingdom, it plays Wuxie Kingdom only when the Tool is Barbarians or Hail of Arrows and the target seat is the bot itself or an ally with an exposed General (the case where it cancels for every later target of that Kingdom). Otherwise it plays the plain Wuxie and keeps Wuxie Kingdom. With only one of them, that one.
2. **Fire Fan** (`wantsToUse`): use it when the Sha's target (`reason.targetSeatId`) is a foe, unless the target is chained and the bot or an ally is also chained (the fire would spread to its own side).
3. **Trident Glaive** (`wantsToUse`, `select`, `choose`):
   - Use it when at least one foe sits next to the damaged seat (the seats the glaive may hit) and the bot holds a hand card with `keepRank` 2 or less that is not its last Sha while it has a Sha play left this turn. (Keep it simple: any hand card with `keepRank` ≤ 2.)
   - `select`: the least useful such card (`leastUseful`).
   - `choose`: the foe among the options the ranker likes most; if no foe is offered (it changed since the ask), the option for the bot itself is never chosen; pick the first non-ally, else return `undefined` (the existing first-option fallback runs). The neighbours are the choice's option ids.

- [ ] **Step 1: Write the failing tests**
- `wuxie kingdom: kept for a single-target Tool` — Steal at seat-a; hand `[wuxie, wuxie-guo]` → answers with `wuxie`.
- `wuxie kingdom: played against Barbarians on an exposed bot` → answers with `wuxie-guo`.
- `wuxie kingdom: the only Wuxie held is played` — hand `[wuxie-guo]`, Steal → `wuxie-guo`.
- `fire fan: used at a foe` (`asking(table(), 'fire-fan', 'seat-b')` → `use`), `declined at an ally`, `declined when the foe and the bot are both chained`.
- `trident glaive: used with a foe next door and a spare card`, `declined with only Peach and Shan in hand`, `discards the least useful card`, `hits the foe, not the ally, among the neighbours`.

- [ ] **Step 2: Run, see them fail.** Expected: FAIL (Fire Fan and Trident are declined today; Wuxie Kingdom vs Barbarians answers with whichever is first).

- [ ] **Step 3: Implement** in the two files; append to `KINGDOM_WARS_RULES`.

- [ ] **Step 4: Run all bot specs.** Expected: PASS.

- [ ] **Step 5: Commit** — `feat(bots): Wuxie Kingdom where it covers a Kingdom, Fire Fan and Trident Glaive`

---

### Task 5: Zou Shi and Benevolence

**Files:**
- Create: `projects/bots/src/lib/rules/skills.ts`; add to `rules/kingdom-wars.ts`
- Test: `projects/bots/src/lib/rules/skills.spec.ts`

**Interfaces:**
- Produces: `femmeFataleRule`, `impetusForConflictsRule`, `benevolenceRule: BotRule`.
- Consumes: `GENERAL_VALUES` and `baseGeneralId` (Impetus's General pick), `isEquipUpgrade` from `card-play.ts`.

**Rules.**

1. **Femme Fatale** (`kingdomWars:femme-fatale`, `play.when: 'early'`): use it whenever it is offered (her General is hidden). Revealing early blocks other seats from revealing in her turn, and a bot has no reason to hide.
2. **Impetus for Conflicts** (`kingdomWars:impetus-for-conflicts`):
   - `play.when: 'late'`: use it when some foe has both Generals exposed and the bot holds an Equipment card **in hand** that it would not equip now (its slot is filled and `isEquipUpgrade` is false). Never discard a worn card.
   - `select` (cards): that hand card; (seats): the fully exposed foe the ranker likes most. If none is a foe, `'cancel'`.
   - `choose` (the General): the General with the higher `GENERAL_VALUES[baseGeneralId(id)]`, Main on a tie.
3. **Benevolence** (`kingdomWars:benevolence`, `play.when: 'late'` and `select`): Identity Kindness's rule with Kingdom Wars' threshold. Use it when an ally exists and either the bot holds more than 3 hand cards, or it is hurt, has given fewer than 3 cards this turn and holds enough to reach 3. When it selects cards to give while hurt and below 3 given, it gives exactly enough to reach 3 (the least useful first); otherwise it gives as the existing Kindness rule does. Identity's `kindness` is untouched.

  The existing `skills.ts` cases for `kindness` stay for Identity and for `rule-based-v3`; the registry entry is found first for the variant id when the switch is on.

- [ ] **Step 1: Write the failing tests**
- `femme fatale: used early while hidden` (Zou Shi hidden as seat-a's Main; the `UseSkillAction` is chosen before a Sha).
- `impetus: hides the higher-valued General of a fully exposed foe` (hand has a second weapon while one is worn; foe seat-b exposed with Generals of different table values) → the chain of decisions picks the hand weapon, seat-b, then the higher-valued slot.
- `impetus: never discards a worn card` (only worn equipment) → not used.
- `impetus: no fully exposed foe` → not used.
- `benevolence: hurt with 3 hand cards gives 3`; `hurt with 2 cards: not used` (cannot reach 3); `rule-based-v3 still gives 2` (pins the old behaviour).

- [ ] **Step 2: Run, see them fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** For the step names and reasons of Impetus's selections, read `kingdom-wars-qun.ts` (`discarded`, `chosen`, `hide`).
- [ ] **Step 4: Run all bot specs.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(bots): Zou Shi's skills and Benevolence's Kingdom Wars threshold`

---

### Task 6: Coverage spec for the Kingdom Wars deck

**Files:**
- Create: `projects/bots/src/lib/rules/coverage.spec.ts`
- Create: `projects/bots/src/lib/rules/coverage.ts` (the two explicit lists)

**Interfaces:**
- Produces: `LEGACY_HANDLED: readonly string[]` (ids the existing ladder and `skills.ts` handle; the audit's "Y" list) and `IGNORED: Readonly<Record<string, string>>` (id → one-line reason).

**Rule.** Every card in the Kingdom Wars deck (`deck.json` entries) and every skill on a Kingdom Wars General that is not `compulsory`, not `lord` and has an `active`, a conversion or a trigger, must be in exactly one of: `KINGDOM_WARS_RULES`, `LEGACY_HANDLED`, `IGNORED`. Passive equipment (no ability asks) and the basic cards the ladder plays (Sha, Shan, Peach, Wine) go in `LEGACY_HANDLED`. Wu Six Swords goes in `LEGACY_HANDLED` (the generic equip rule wears it; its effect is passive).

- [ ] **Step 1: Write the spec** — it builds the id list from `buildContentRegistry()` (Generals whose id starts with `kingdomWars:`) and `projects/content/data/decks/kingdom-wars/deck.json`, and fails listing every missing id and every id in two lists.
- [ ] **Step 2: Run it** — `npx jest --selectProjects bots -t coverage`. Fill `coverage.ts` until it passes; any id that needs a rule and has none is a finding: add it to `IGNORED` with the reason "no bot rule yet" and list it in the Task 8 report.
- [ ] **Step 3: Commit** — `test(bots): every Kingdom Wars card and skill has a bot rule or a stated reason`

---

### Task 7: Usage counts in the simulator

**Files:**
- Modify: `projects/sim/src/runGame.ts` (an `onDecision` callback)
- Create: `projects/sim/src/usage.ts`
- Modify: `projects/sim/src/tournament.ts` (`TournamentReport.usage`, `formatReport`)
- Modify: `projects/sim/src/cli.ts` (prints it; nothing new to pass)
- Test: `projects/sim/src/usage.spec.ts`, `projects/sim/src/tournament.spec.ts`

**Interfaces:**
- Produces:
  - `runGame(..., policyFor?, onDecision?: (d: { seatId: string; state: GameState; legal: Action[]; action: Action }) => void)` (8th positional parameter, after `policyFor`; called for policy and random seats alike, before `resolve`)
  - `type UsageKey = string` in the form `card:<definitionId>`, `skill:<skillId>`, `ability:<abilityId>`
  - `type UsageTally = Record<UsageKey, { offered: number; used: number }>`
  - `function recordDecision(tally: UsageTally, state: GameState, legal: Action[], action: Action): void`
  - `TournamentReport.usage: Record<Side, UsageTally>` and `TournamentReport.part1Uses: Interval` (per mirrored pair: challenger uses minus baseline uses of the keys in `PART_1_KEYS`, per game)
  - `export const PART_1_KEYS: readonly UsageKey[]` = the cards and abilities of Tasks 3–5: `card:amass`, `card:ally-far-attack-near`, `card:harvest`, `card:ascertain`, `card:chains`, `card:blaze`, `card:wuxie-guo`, `ability:fire-fan`, `ability:trident-glaive`, `skill:kingdomWars:femme-fatale`, `skill:kingdomWars:impetus-for-conflicts`, `skill:kingdomWars:benevolence`

**Counting rule.**
- *Card:* offered once per decision where `legal` holds a `PlayCardAction` or `RespondAction` of that card's definition (not per copy); used when the chosen action is one.
- *Skill:* offered when `legal` holds a `UseSkillAction` with that `owner.skillId`; used when chosen.
- *Ability ask:* offered when the pending choice has verb `use` and reason `ability`; used when the chosen option is `use`. Key by `reason.abilityId`.
- A random seat counts too, under its own side.

- [ ] **Step 1: Write the failing tests**
- `usage.spec.ts`: `recordDecision` on a hand-built state: two Sha copies offered and one played → `card:sha` `{ offered: 1, used: 1 }`; an ask declined → `ability:x` `{ offered: 1, used: 0 }`; a `UseSkillAction` taken → `skill:y` used 1.
- `tournament.spec.ts`: a 2-game mirrored run, 4 seats, `rule-based-kw` vs `rule-based-v3`, seed 0: `report.usage.challenger` and `.baseline` exist and `formatReport` contains the heading `Usage`.

- [ ] **Step 2: Run, see them fail.** `npx jest --selectProjects sim -t "usage|tournament"`. Expected: FAIL.
- [ ] **Step 3: Implement.** `formatReport` adds a `Usage` table: one row per key where either side has `offered > 0`, columns `offered / used` for each side, keys sorted; then `Part 1 uses per game: <mean> (<low> to <high>)`.
- [ ] **Step 4: Run all sim specs.** `npx jest --selectProjects sim`. Expected: PASS (the leak and invariant specs included).
- [ ] **Step 5: Commit** — `feat(sim): count how often each card and skill is offered and used, per side`

---

### Task 8: Judge, record, ship

**Files:**
- Modify: `docs/superpowers/specs/2026-11-11-kingdom-wars-bots-design.md` (`Results`; the knowledge-location sentence if the developer agreed)
- Modify: `projects/bots/src/lib/rule-based.ts` (`ruleBasedPolicy` gets `{ rules: KINGDOM_WARS_RULES }`) — only if the gate passes
- Modify: `docs/architecture/bots-and-simulation.md` (the registry, the frozen v3, the usage report)

- [ ] **Step 1: Record the "clearly improves" bar before any run** in the spec's `Results`: Part 1 passes when `part1Uses`' whole 95% interval is above 0 on both ranges, each of the 12 `PART_1_KEYS` is used at least once by the challenger over the run (any key at 0 is listed and explained), and the seat-share interval is not wholly below 0 on both ranges.

- [ ] **Step 2: Run the gate** (background; each takes minutes):

```bash
npm run sim -- tournament 4000 4 rule-based-kw rule-based-v3 900000 mirrored
```
```bash
npm run sim -- tournament 4000 6 rule-based-kw rule-based-v3 900000 mirrored
```
```bash
npm run sim -- tournament 4000 4 rule-based-kw rule-based-v3 1000000 mirrored
```
```bash
npm run sim -- tournament 4000 6 rule-based-kw rule-based-v3 1000000 mirrored
```
Expected: four reports with seat-share difference, `Part 1 uses per game`, and the usage table.

- [ ] **Step 3: Record every run** in `Results` (command, seat-share interval, Part 1 uses interval, keys at 0, per-force win rates). No tuning between ranges beyond the roadmap's three recorded sets.

- [ ] **Step 4: If it passes, ship:** `ruleBasedPolicy` gets the registry; keep `rule-based-kw` registered as an alias for this record or remove it (my call: remove, `rule-based` now equals it). Update `bots-and-simulation.md`. Run `npx jest --selectProjects bots sim` and `npm run verify`. If it fails, do not ship: record it and stop for the developer.

- [ ] **Step 5: Commit** — `feat(bots): ship Part 1 (Kingdom Wars rules) as rule-based; record the results`
