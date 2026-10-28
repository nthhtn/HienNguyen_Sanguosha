# Kingdom Wars Generals Slice 2: Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Kingdom Wars deck's rule-changing skills, and its new skills on known Generals, work as the user confirmed, for 15 skills on 13 Generals.

**Architecture:** A Kingdom Wars skill that differs from Identity is its own `SkillDefinition` (a variant) with id `kingdomWars:<skillIdOf(Kingdom Wars English name)>`, registered per General by the skill's Chinese name in a data-driven table. `readyKingdomWarsSkills` prefers a registered variant, else the Identity skill when the rules are the same (slice 1). Where a variant only changes a number or a condition, the Identity skill is refactored into a small factory so both share the code; a skill never branches on the deck.

**Tech Stack:** TypeScript, Jest (`npm test`), the engine's skill system (`projects/engine/src/lib/skills`), content skills in `projects/content/src/lib/generals`, test harness `generals/skills.testing.ts`.

**Spec:** `docs/superpowers/specs/2026-10-22-kingdom-wars-generals-engine-design.md` (slice 2) and the confirmed rule text in `docs/superpowers/specs/2026-10-22-kingdom-wars-generals-slice-2-rules.md`. The rules file is the binding text for every skill below.

**Branch:** starts from `feat/kingdom-wars-generals-engine` (slice 1, not yet merged) on a new branch `feat/kingdom-wars-generals-variants`.

## Global Constraints

- Identity games must not change: every Identity skill keeps its id and behavior; all existing specs stay green. A refactor into a factory must not alter an Identity skill's id, triggers or modifiers.
- Variant ids are `kingdomWars:<skillIdOf(English name in the Kingdom Wars record)>`, for example `kingdomWars:benevolence`; ids stay unique across the registry (`findSkill`).
- No branching on the deck inside a skill; no central switch over General or skill ids; variants are registered in data.
- "Lord", never "Ruler". Lord skills stay inactive and are never Kingdom Wars variants.
- Anything optional in the confirmed rules is asked each time (a "may" skill), including skills Identity makes compulsory.
- Hidden information stays hidden: Guo Jia's look and Cai Wenji's choice are shown only to the seat that makes them (see `domain/redact.ts`); the sim's leak checks must stay green.
- UI text follows the casing rules in `CLAUDE.md`; new Vietnamese text starts as draft.
- Each task carries its own tests and a check that the Identity counterpart still behaves as before.

## Review Focus

- A variant never leaks into Identity games (an Identity seat with the same General plays the Identity skill) (Tasks 1 to 8, 11 to 13).
- Cancelled-not-untargetable: a Slash or Duel aimed at an empty-handed Kingdom Wars Zhuge Liang is legal and wasted, yet still counts as used for the once-per-turn Slash limit (Task 8).
- Seed of Animosity's Duel cannot be answered by Wuxie or Wuxie Kingdom, but a Duel played normally still can (Task 7).
- A death during a multi-step skill (Zhen Ji mid-judgment, Guo Jia's second recipient dead, Cai Wenji's killer dying at the same time) leaves no card in limbo and no engine error (Tasks 9, 11 to 13).
- Cai Wenji's Sorrow with a killer whose Generals are both hidden does not reveal them, and silences exactly one slot (Task 13).

---

### Task 1: Variant plumbing and Liu Bei

**Files:**
- Create: `projects/content/src/lib/skillId.ts`, `projects/content/src/lib/kingdomWarsVariants.ts`, `projects/content/src/lib/generals/kingdom-wars-shu.ts` (Shu variants; later tasks add `kingdom-wars-wei.ts`, `kingdom-wars-wu.ts`, `kingdom-wars-qun.ts`)
- Modify: `projects/content/src/lib/display.ts` (`skillIdOf` moves to `skillId.ts` and is re-exported; `abilityName` understands `kingdomWars:` ids), `kingdomWarsSkills.ts`, `wikiKingdomWarsGenerals.ts`, `generals/shu.ts` (Kindness factory), the Wiki app label for the new skill status
- Test: `kingdomWarsVariants.spec.ts`, `kingdomWarsSkills.spec.ts`, `display.spec.ts`, `wikiKingdomWarsGenerals.spec.ts`, `generals/kingdom-wars-shu.spec.ts`

**Interfaces:**
- Produces:
  - `skillId.ts`: `skillIdOf(name: string): string` (moved unchanged; `display.ts` re-exports it so the public API is unchanged). This removes the import cycle `display.ts` ⇄ `kingdomWarsSkills.ts` ⇄ `generals/mountain.ts` that slice 1 parked.
  - `kingdomWarsVariants.ts`: `KINGDOM_WARS_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>>` (General id, then Kingdom Wars skill Chinese name, to the variant), assembled from the per-force files.
  - `kingdomWarsSkills.ts`: `kingdomWarsSkillFor(record, skill): SkillDefinition | undefined` (a registered variant, else `identitySkillFor`); `readyKingdomWarsSkills` uses it. `kingdomWarsVariantSkillFor` is not exported.
  - `wikiKingdomWarsGenerals.ts`: `KingdomWarsSkillStatus = 'worksAsIdentity' | 'worksAsKingdomWars' | 'missing'` (`worksAsKingdomWars` when a variant exists); `generalDisplayData(...).skills[i].inGame` (slice 1) reads `kingdomWarsSkillFor`.
  - `abilityName('kingdomWars:benevolence', locale)` returns the Kingdom Wars skill name in that language (from the Kingdom Wars records and `kingdom-wars-generals.json`).
  - `makeKindness(threshold: number): SkillDefinition` in `generals/shu.ts`; `kindness = makeKindness(2)` (unchanged id `kindness`); the variant is `{ ...makeKindness(3), id: 'kingdomWars:benevolence' }`.
- Registered: Liu Bei, 仁德 → `kingdomWars:benevolence`.

- [ ] **Step 1: Write the failing tests.** `kingdomWarsVariants.spec.ts`: every key General id and Chinese name in `KINGDOM_WARS_VARIANTS` exists in `kingdomWarsGeneralRecords()`; every variant id equals `kingdomWars:` + `skillIdOf` of that record skill's English name; no variant id equals any Identity skill id; variant ids are unique. `kingdom-wars-shu.spec.ts` (harness `table` from `skills.testing.ts`, same style as `shu.spec.ts`): Kingdom Wars Liu Bei giving 2 cards in one turn does not heal; giving the 3rd card heals 1; giving 5 cards total heals once only; Identity Liu Bei still heals at 2 (use the existing Kindness spec unchanged as the guard). `kingdomWarsSkills.spec.ts`: `readyKingdomWarsSkills(liu-bei)` ids are `['kingdomWars:benevolence']`. `display.spec.ts`: `abilityName('kingdomWars:benevolence')` is `Benevolence` and the `vi` value is the Vietnamese name; `abilityName('kindness')` is still `Kindness`. `wikiKingdomWarsGenerals.spec.ts`: Benevolence status is `worksAsKingdomWars`; update the registry-equivalence test to expect the variant id.
- [ ] **Step 2: Run** `npx jest projects/content` and confirm the new tests FAIL.
- [ ] **Step 3: Implement** the interfaces above. Keep the Wiki label for `worksAsKingdomWars` in sentence case ("Works as in Kingdom Wars"; Vietnamese draft). Check the app's Wiki components for the old two-value status and update their labels with the same i18n pattern as `worksAsIdentity`.
- [ ] **Step 4: Run** `npm test`; expect PASS, including every existing Kindness and Wiki spec.
- [ ] **Step 5: Commit** `feat(content): variant skills for Kingdom Wars Generals, starting with Liu Bei`.

### Task 2: Sun Quan, Balance of Power

**Files:** Modify `generals/wu.ts` (Reconsider factory), create `generals/kingdom-wars-wu.ts`; Test `generals/kingdom-wars-wu.spec.ts`.

**Interfaces:** Consumes `KINGDOM_WARS_VARIANTS`. Produces `makeReconsider(limit?: (state: GameState, seatId: string) => number): SkillDefinition` (`reconsider = makeReconsider()`, unchanged); variant `kingdomWars:balance-of-power` with the limit being the seat's combined max HP (`seat.maxCombinedHp`). Registered for Sun Quan 制衡.

- [ ] **Step 1: Failing tests:** a seat with combined max HP 4 may pick at most 4 cards to discard (a 5-card selection is not offered, `min 1 max 4`), draws the same number; a seat with combined max HP 3 is limited to 3; still once per turn; hand or equipment cards both count; Identity Sun Quan can still discard all.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generals/kingdom-wars-wu.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** the factory and the variant (the selection's `max` is `Math.min(cards.length, limit)`).
- [ ] **Step 4: Run** the spec and `generals/wu.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Sun Quan, Balance of Power`.

### Task 3: Xun Yu, Eternal Loyalty

**Files:** Modify `generals/fire.ts` (Eternal Loyalty factory), create `generals/kingdom-wars-wei.ts`; Test `generals/kingdom-wars-wei.spec.ts`.

**Interfaces:** Produces `makeEternalLoyalty(handCap?: number): SkillDefinition` (`eternalLoyalty = makeEternalLoyalty()`); variant `kingdomWars:eternal-loyalty` with cap 5: the picked seat draws until its hand equals `min(maxCombinedHp, 5)`; if its hand is already at or above that it draws nothing. Registered for Xun Yu 节命.

- [ ] **Step 1: Failing tests:** picked seat with max HP 4 and 1 card draws 3; a seat with max HP 6 (set `maxCombinedHp` in the harness) and 0 cards draws 5 (not 6); a seat with max HP 6 and 5 cards draws 0; per point of damage the ask repeats (2 damage, 2 asks) as in Identity; Identity Xun Yu draws to 6.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement** the factory and variant.
- [ ] **Step 4: Run** the spec and `generals/fire-wei.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Xun Yu, Eternal Loyalty`.

### Task 4: Zhu Rong, Fearsome Blade

**Files:** Modify `generals/forest.ts` (Intense Edge factory), `generals/kingdom-wars-shu.ts`; Test `generals/kingdom-wars-shu.spec.ts`.

**Interfaces:** Produces `makeIntenseEdge(requireTarget?: boolean): SkillDefinition` (`intenseEdge = makeIntenseEdge(false)`); variant `kingdomWars:fearsome-blade` with `true`: the compete is offered only when the damaged seat is among the Slash's targets (the engine records the Slash's targets on the damage `cause`; read the existing `isShaDamage` helper and the damage cause type to find where). Registered for Zhu Rong 烈刃.

- [ ] **Step 1: Failing tests:** her Slash damages its target: compete offered; her Slash is aimed at A and A is chained to B, B takes the chained damage: no compete for B; Identity Zhu Rong still competes with B.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `generals/forest-shu.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Zhu Rong, Fearsome Blade`.

### Task 5: Huang Yueying, Assembling Wisdom

**Files:** Modify `generals/shu.ts` (Gathering Wisdom factory), `generals/kingdom-wars-shu.ts`; Test `generals/kingdom-wars-shu.spec.ts`.

**Interfaces:** Produces `makeGatheringWisdom(allowConverted?: boolean): SkillDefinition` (`gatheringWisdom = makeGatheringWisdom(true)`); variant `kingdomWars:assembling-wisdom` with `false`: no draw when the played Tool was converted from other cards (the played `UsedCard` has `via` or its physical card's definition differs from `as`; read `UsedCard` in the engine types). A played Wuxie still draws; a Chains Recast still does not. Genius (奇才) is also registered: Kingdom Wars 奇才 resolves to Identity's `wondrous-talent` through the existing Nil/cleared rule, so add `CLEARED_WORDING['huang-yueying'] = ['奇才']` and update the slice-1 spec that asserts `CLEARED_WORDING` is empty to assert this entry.

- [ ] **Step 1: Failing tests:** playing a real Draw Two draws 1; playing Chains converted from a club by Pang Tong's Shackle draws 0; answering with a real Wuxie draws 1; Recast draws 0; Identity Huang Yueying still draws on the converted Chains; Genius still lets her use a Tool beyond distance.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec, `kingdomWarsSkills.spec.ts` and `generals/shu.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Huang Yueying, Assembling Wisdom`.

### Task 6: Sun Shangxiang, Warrior Lady

**Files:** Modify `generals/wu.ts` (Armed Consorts factory), `generals/kingdom-wars-wu.ts`; Test `generals/kingdom-wars-wu.spec.ts`.

**Interfaces:** Produces `makeArmedConsorts(mode: 'per-card-compulsory' | 'per-instance-may')`; `armedConsorts` keeps its id and Identity behavior; variant `kingdomWars:warrior-lady` is asked once per instance, where an instance is one effect resolution that moves one or more cards out of her equipment area (group `CardMovedEvent`s of one resolution; if the engine has no instance id, group by `state.log` position within one effect chain and document the rule in a comment). Registered for Sun Shangxiang 枭姬. Marriage (结姻) is cleared for Identity (`CLEARED_WORDING['sun-shangxiang'] = ['结姻']`) per the rules file, which defers its check to slice 4; do this clearing in slice 4, not here.

- [ ] **Step 1: Failing tests:** one equipped piece replaced: asked once, accepting draws 2, declining draws 0; two pieces leaving in one Rock Cleaving Axe discard: asked once, draws 2 in total; two separate losses in a turn: asked twice; Identity Sun Shangxiang still draws 2 per card with no ask.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `generals/wu.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Sun Shangxiang, Warrior Lady`.

### Task 7: Diao Chan, Seed of Animosity and Envious Moon

**Files:** Modify `generals/qun.ts` (Sow Discord and Eclipse the Moon factories), create `generals/kingdom-wars-qun.ts`; engine: the Wuxie check for a Tool use (`projects/engine/src/lib/**/toolLifecycle.ts`, `shared/tools.ts` in content); Test `generals/kingdom-wars-qun.spec.ts`.

**Interfaces:** Produces `UsedCard.noWuxie?: true` (a used card no Wuxie or Wuxie Kingdom check is made for; read at the per-target Wuxie check, `WuxieCheckEffect`); `makeSowDiscord(wuxieable: boolean)` (`sowDiscord = makeSowDiscord(true)`); variant `kingdomWars:seed-of-animosity` builds its Duel `UsedCard` with `noWuxie: true`; `makeEclipseTheMoon(optional: boolean)`; variant `kingdomWars:envious-moon` asks the owner "draw 1?" at the start of the End Phase. Registered for Diao Chan 离间 and 闭月.

- [ ] **Step 1: Failing tests:** with a Wuxie and a Wuxie Kingdom in the target's table, the Seed Duel is never offered a Wuxie answer and resolves; a Duel played normally still offers Wuxie; Seed still requires two other male seats and discards a card, once per turn; Envious Moon asks, accepting draws 1, declining draws 0; Identity Diao Chan unchanged (Wuxie offered, compulsory draw).
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.** The field is added to the engine's `UsedCard` type and read in one place only.
- [ ] **Step 4: Run** the spec, `generals/qun.spec.ts`, `cards/wuxie*.spec.ts` and the engine's tool specs; expect PASS.
- [ ] **Step 5: Commit** `feat: Kingdom Wars Diao Chan, Seed of Animosity and Envious Moon`.

### Task 8: Empty City, Humility and Behind the Curtain cancel instead of block

**Files:** Modify `generals/shu.ts`, `generals/wu.ts`, `generals/forest.ts` (the three skills; factories that choose between "untargetable" and "cancel"), the Slash targeting and Steal/Capture target lists as needed in `shared/abilities.ts`; create entries in `kingdom-wars-shu.ts`, `kingdom-wars-wu.ts`, `kingdom-wars-qun.ts`; Test the three Kingdom Wars specs.

**Interfaces:** Variants `kingdomWars:empty-city`, `kingdomWars:humility`, `kingdomWars:behind-the-curtain` (ids from the Kingdom Wars English names). Each drops its `untargetable…` modifier and instead cancels the card for the owner when it takes effect: Humility on Steal and Capture; Empty City on Slash and Duel while the owner has no hand cards; Behind the Curtain on the black Tools it covers today (its existing `before:ToolOnTargetEffect` trigger already cancels; the variant only removes the modifier). Cancelled means the card is used and wasted for that seat: Wuxie is not asked for, damage and effects do not happen, and a cancelled Slash still counts toward the user's once-per-turn Slash limit. Registered for Zhuge Liang 空城 (and Star Gazing is a slice-4 check), Lu Xun 谦逊, Jia Xu 帷幕.

- [ ] **Step 1: Failing tests:** an empty-handed Kingdom Wars Zhuge Liang can be chosen as a Slash target and the Slash does nothing, yet the attacker has used their Slash for the turn; a Duel against him is wasted; with a hand card he is hit normally; Kingdom Wars Lu Xun can be chosen by Steal and Capture and both are cancelled (no steal, no delayed Tool placed); Kingdom Wars Jia Xu can be chosen by a black Tool and it is cancelled; each Identity General still cannot be chosen (the existing specs).
- [ ] **Step 2: Run** the specs; expect FAIL.
- [ ] **Step 3: Implement.** Reuse one cancellation helper in `shared/` so the three variants share code.
- [ ] **Step 4: Run** the specs, `generals/shu.spec.ts`, `generals/wu.spec.ts`, `generals/forest-*.spec.ts` and `cards/*.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Empty City, Humility and Behind the Curtain cancel`.

### Task 9: Guo Jia, Bequeathed Strategy

**Files:** Modify `generals/wei.ts`, `generals/kingdom-wars-wei.ts`; Test `generals/kingdom-wars-wei.spec.ts`, `sim/src/leaks.spec.ts` if the leak checks need a case.

**Interfaces:** Variant `kingdomWars:bequeathed-strategy` (new skill, not a factory of Identity's): after each point of damage he may look at the top 2 cards of the draw pile (no draw), give one to any player (including himself), then the remaining one to any player. Only he sees them; the shared log shows only that he used it. If the pile has 1 card, he gives that one; if 0, nothing. Registered for Guo Jia 遗计. Heaven's Envy (天妒) is a slice-4 check.

- [ ] **Step 1: Failing tests:** damage 1: he is shown the top 2 cards, gives one to seat B and the other to himself; damage 2: asked twice with fresh top cards; the cards stay in the pile until given (a decline leaves the pile intact); a dead recipient is not offered; the leak check (`findStepLeaks`) finds no card ids in other seats' views; Identity Guo Jia still draws 2.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement** with the engine's private-choice pattern (the way Steal and Ascertain show hidden cards only to one seat, see `domain/redact.ts`).
- [ ] **Step 4: Run** the spec, the leak specs in `projects/sim`, and `generals/wei*.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Guo Jia, Bequeathed Strategy`.

### Task 10: Zhang Zhao and Zhang Hong, Stabilization

**Files:** Modify `generals/mountain.ts` (Stubborn factory), `generals/kingdom-wars-wu.ts`; Test `generals/kingdom-wars-wu.spec.ts`.

**Interfaces:** Produces `makeStubborn(minDiscarded: number): SkillDefinition` (`stubborn = makeStubborn(2)`); variant `kingdomWars:stabilization` with `1`. Registered for 固政. (Direct Instruction 直谏 is already ready from slice 1.)

- [ ] **Step 1: Failing tests:** another seat discards exactly 1 card in its Discard Phase: asked; accepting gives it back and takes nothing; discarding 3: gives 1 back and takes 2; discarding 0: not asked; Identity Zhang Zhao is not asked at 1 card.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `generals/mountain-wu.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Zhang Zhao and Zhang Hong, Stabilization`.

### Task 11: Lu Xun, Scrutinize

**Files:** Modify `generals/wu.ts` / `generals/kingdom-wars-wu.ts`; Test `generals/kingdom-wars-wu.spec.ts`.

**Interfaces:** Variant `kingdomWars:scrutinize` (conversion, like Dragon Courage in `shu.ts`): `conversions: [{ id: 'scrutinize-amass', as: 'amass', cards: 1, accepts: red hand card (colour as the seat's suits count, as `colourFor`), when: 'play' }]`, no per-turn limit. Registered for Lu Xun 度勢. Linked Camps is not a Kingdom Wars skill and is not registered for Kingdom Wars Lu Xun.

- [ ] **Step 1: Failing tests:** a red hand card can be played as Amass in the Play Phase and Amass then resolves as in `cards/amass.spec.ts` (Kingdom members draw 2 and discard 2); a black card cannot; it can be done twice in a turn; Identity Lu Xun has no such option and keeps Linked Camps.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec, `cards/amass.spec.ts`, `generals/wu.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Lu Xun, Scrutinize`.

### Task 12: Zhen Ji, Goddess Luo

**Files:** Modify `generals/wei.ts` (River Goddess is the Identity skill; the variant is a new skill), `generals/kingdom-wars-wei.ts`; Test `generals/kingdom-wars-wei.spec.ts`.

**Interfaces:** Variant `kingdomWars:goddess-luo`: at the start of her turn she may judge; after a black card she may judge again or stop; red ends it and is discarded; black cards remain in the `processing` zone (or another zone nothing can reach; read how judgments hold cards) until the process ends, then all move to her hand; if she dies mid-process the held cards go to the discard pile. Registered for Zhen Ji 洛神; Stunning Beauty 倾国 is a slice-4 check.

- [ ] **Step 1: Failing tests:** two black then a red: she acquires both blacks at the end, the red is discarded; stop after one black: acquires that one; decline at the first prompt: nothing; during the process the black cards are not in her hand (a Sima Yi partner's Demonic Talent cannot replace a judgment with them); she dies mid-process (a Judgment Lightning style effect is not needed: kill her between judgments) and the held cards end in the discard pile; Identity Zhen Ji still takes each black card at once.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec, `generals/wei-judgments.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Zhen Ji, Goddess Luo`.

### Task 13: Cai Wenji, Sorrow (per-General silencing)

**Files:** Modify engine `SilenceSeatEffect` handling and seat state (`projects/engine/src/lib/**`: `seat.silenced` becomes per slot) plus `shared/abilities.ts` readers; `generals/mountain.ts` (Heartbroken kept), `generals/kingdom-wars-qun.ts`; Test engine spec for the effect, `generals/kingdom-wars-qun.spec.ts`, `sim` leak spec.

**Interfaces:** Engine: `SilenceSeatEffect` gains an optional `slot?: 'main' | 'deputy'`; absent keeps today's whole-seat behavior (Identity Heartbroken unchanged); `Seat.silenced` accepts the whole-seat flag as now and a per-slot form (a `silencedSlots?: ('main' | 'deputy')[]` field is the suggested shape; keep the state plain serializable and make `skillsInPlay` ignore a silenced slot's skills only). Variant `kingdomWars:sorrow` (compulsory, `afterDeath`): when Cai Wenji dies with a living killer, her player chooses Main or Deputy of the killer, without revealing or showing which General it is; that slot's skills are lost for the rest of the game. Registered for Cai Wenji 断肠; Dirge 悲歌 is cleared (`CLEARED_WORDING['cai-wenji'] = ['悲歌']`, the rules file confirms it is unchanged).

- [ ] **Step 1: Failing tests:** engine: silencing the `deputy` slot leaves the Main's skills in play and the Deputy's out; whole-seat silencing is unchanged. Content: the killer is asked for nothing; Cai Wenji's side is offered Main or Deputy; picking Main removes the killer's Main skills, the Deputy's still work; both of the killer's Generals hidden: no General is revealed by the choice and the choice view does not name them (leak check); no killer or a dead killer: no choice; Identity Cai Wenji still silences the whole seat.
- [ ] **Step 2: Run** the specs; expect FAIL.
- [ ] **Step 3: Implement.** Update every reader of `seat.silenced` (grep for it in engine, content, app and bots) so a per-slot silence is honored wherever skills are listed.
- [ ] **Step 4: Run** the engine specs, the content spec, `generals/mountain-qun.spec.ts` and the sim leak specs; expect PASS.
- [ ] **Step 5: Commit** `feat: Kingdom Wars Cai Wenji, Sorrow silences one General`.

### Task 14: Wiki, simulation and completeness

**Files:** Modify `projects/sim/src/kingdomWars.spec.ts`; Test `wikiKingdomWarsGenerals.spec.ts`.

- [ ] **Step 1: Failing tests:** Wiki: every skill of the 13 Generals above reads `worksAsKingdomWars` or `worksAsIdentity`, none `missing`, except the skills still deferred to slice 4: Zhou Yu's two skills, Sun Shangxiang's Marriage, Zhang Liao's Sudden Strike, Zhuge Liang's Star Gazing, Guo Jia's Envy of Heaven, Zhen Ji's Stunning Beauty, Xun Yu's Rouse the Tiger, Zhu Rong's Giant Elephant; pin the exact list. Sim: a seeded Kingdom Wars game forces a table with each of these Generals as Main (use `forcedPairing.ts` helpers) and plays to a result with bots, no engine error and no leak.
- [ ] **Step 2: Run** `npx jest projects/sim/src/kingdomWars.spec.ts projects/content/src/lib/wikiKingdomWarsGenerals.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** the tests' fixtures only; fix any engine error the sim shows in the owning skill, with a test.
- [ ] **Step 4: Run** the whole suite `npm test`, `npm run typecheck:server`, `npm run build`, `npm run i18n:status`; expect all green and no new missing keys.
- [ ] **Step 5: Commit** `test: Kingdom Wars variants end to end`.

---

## Self-review notes

- Spec coverage (slice 2): all 15 confirmed skills have a task. Deferred to slice 4 by the user: Zhou Yu (both skills), Sun Shangxiang Marriage, Zhang Liao, and the unchanged sibling skills listed in Task 14.
- Open for slice 4: clearing sibling skills the rules file calls unchanged (Rouse the Tiger, Giant Elephant, Heaven's Envy, Stunning Beauty, Star Gazing, Marriage).
- Not in this slice: new Generals (slice 3), the optionality audit ("can" versus compulsory) for the unchanged Generals (slice 4).
