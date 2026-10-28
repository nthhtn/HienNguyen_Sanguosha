# Kingdom Wars Generals Slice 4: Wording-Only Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every skill of all 60 Kingdom Wars Generals resolves for the Kingdom Wars deck: 29 wording-only skills are cleared as Identity's, and the three real differences found (Jia Xu's Descend into Chaos, Zhang Jiao's Lightning Strike, Pang Tong's Resurrection) become variants.

**Architecture:** Slice 1's `CLEARED_WORDING` table in `kingdomWarsSkills.ts` is the ledger of cleared skills; slice 2's `KINGDOM_WARS_VARIANTS` holds variants. The audit adds entries to the first, three variants to the second (each Identity skill refactored into a small factory so both share code), and 

**Tech Stack:** TypeScript, Jest (`npm test`), `projects/content/src/lib` (`kingdomWarsSkills.ts`, `generals/*.ts`, `kingdomWarsVariants.ts`), test harness `generals/skills.testing.ts`.

**Spec:** `docs/superpowers/specs/2026-10-22-kingdom-wars-generals-engine-design.md` (slice 4). The binding rulings and the full audit result are in `docs/superpowers/specs/2026-10-23-kingdom-wars-generals-slice-4-rules.md`.

**Branch:** `feat/kingdom-wars-generals-wording` from `main` (slices 1 to 3 merged).

## Global Constraints

- Identity games must not change: every Identity skill keeps its id, behavior and specs. A refactor into a factory must not alter an Identity skill's id or behavior.
- Variant ids are `kingdomWars:<skillIdOf(Kingdom Wars English name)>`: `kingdomWars:descend-into-chaos`, `kingdomWars:lightning-strike`, `kingdomWars:resurrection`; no branching on the deck inside a skill; variants are registered in data.
- "Lord", never "Ruler"; Lord skills stay inactive.
- Anything optional stays a "may" skill, asked each time.
- UI text follows the casing rules in `CLAUDE.md`; any new Vietnamese text starts as draft (`npm run i18n:status`).
- Each task carries its own tests and a check that the Identity counterpart is unchanged.
- Prompts and hints are keyed by skill id (`choicePromptText('upheaval')`, `abilityHint('kingdomWars:warrior-lady')` in `prose.vi.spec.ts`): every variant must show the same prompts and hints as its Identity skill, in English and Vietnamese (draft), with a spec each.

## Review Focus

- Kingdom Wars Descend into Chaos with ties for nearest, with the only nearest seat unable to be targeted by Sha, and with exactly one legal target (popup still opens); Identity's still lets a seat pick any seat in range (Task 2).
- Kingdom Wars Zhang Jiao is never offered himself, by a human or a bot; an Identity Zhang Jiao at another seat still is (Task 3).
- Kingdom Wars Pang Tong's Resurrection while Chained: face up, not Chained, 3 HP, no dying round; and only once per game (Task 4).
- A cleared skill resolves to the Identity skill of the same General, including Sudden Strike (Chinese name differs from Raid's) (Task 1).
- Every Kingdom Wars skill of every General resolves, and the Wiki shows all 60 as "In game" (Task 5).

---

### Task 1: Clear the wording-only skills

**Files:**
- Modify: `projects/content/src/lib/kingdomWarsSkills.ts` (`CLEARED_WORDING`, `identitySkillFor`)
- Test: `projects/content/src/lib/kingdomWarsSkills.spec.ts`, new `projects/content/src/lib/kingdomWarsAudit.spec.ts`

**Interfaces:**
- Consumes: `CLEARED_WORDING: Record<string, readonly string[]>` (General id to Kingdom Wars skill Chinese names), `identitySkillFor(record, skill)` (slice 1).
- Produces:
  - `CLEARED_WORDING` gains every skill in the "Cleared as the Identity skill" list of the rules file, keyed by General id. Descend into Chaos is a variant (Task 2), not cleared here.
  - `IDENTITY_SKILL_ZH: Readonly<Record<string, Readonly<Record<string, string>>>>`: General id, then Kingdom Wars Chinese name, to the Identity Chinese name when they differ. Only `{ 'zhang-liao': { '突击': '突袭' } }`. `identitySkillFor` looks the Identity skill up by `IDENTITY_SKILL_ZH[id]?.[skill.nameZh] ?? skill.nameZh`.

- [ ] **Step 1: Write the failing tests.** `kingdomWarsAudit.spec.ts`:
  - For each (General id, Chinese name) in `CLEARED_WORDING`: the record exists, has a skill with that `nameZh`, and `kingdomWarsSkillFor` returns a skill whose id is not prefixed `kingdomWars:` and belongs to `GENERAL_SKILLS.get(id)`.
  - `kingdomWarsSkillFor` for Zhang Liao's 突击 returns the skill with id `raid`.
  - Every one of the 22 Nil Generals: the Kingdom Wars skill Chinese names equal the Identity General's non-Lord skill names, same count, and `maxHp` equals Identity's (the `hpFrom: 'identity'` Generals: Guan Yu and Lu Bu included).
  - No Kingdom Wars record skill is a Lord skill.
  `kingdomWarsSkills.spec.ts`: `readyKingdomWarsSkills` for `zhang-liao`, `guan-yu` and `ma-chao` return `['raid']`, `['warrior-saint']` (the Identity id) and the two Identity Ma Chao skill ids; use the ids from the Identity sets in `generals/shu.ts` and `wei.ts`.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/kingdomWarsAudit.spec.ts projects/content/src/lib/kingdomWarsSkills.spec.ts`; confirm FAIL.
- [ ] **Step 3: Implement** the table entries and `IDENTITY_SKILL_ZH`; keep the comment style of the existing entries (one line saying what was checked, e.g. "Unchanged from Identity's Strong Bow; the action-phase wording is the same rule").
- [ ] **Step 4: Run** `npm test`; expect PASS. The Wiki's "In game" specs may need their expected counts updated; update them to the new registry.
- [ ] **Step 5: Commit** `feat(content): clear the wording-only Kingdom Wars skills`.

### Task 2: Kingdom Wars Descend into Chaos (nearest seat)

**Files:**
- Modify: `projects/content/src/lib/generals/forest.ts` (`upheaval` becomes a factory), `projects/content/src/lib/generals/kingdom-wars-qun.ts` (register the variant; Jia Xu is Qun)
- Test: `projects/content/src/lib/generals/kingdom-wars-qun.spec.ts`, `forest-qun.spec.ts` (the existing Upheaval specs, the Identity guard), `prose.vi.spec.ts`

**Interfaces:**
- Consumes: `shaReach`, `seatDistance`, `untargetableBy` (already in `forest.ts`).
- Produces: `makeUpheaval(nearestOnly: boolean): SkillDefinition` in `forest.ts`; `upheaval = makeUpheaval(false)` (id `upheaval` unchanged, behavior unchanged); the variant is `{ ...makeUpheaval(true), id: 'kingdomWars:descend-into-chaos' }` registered under `jia-xu`, 乱武. With `nearestOnly`, the seats offered are `nearestShaTargets(state, seatId, registry): string[]`: the other living seats a Sha may target whose `seatDistance` from `seatId` equals the minimum among those; attack range is ignored.

- [ ] **Step 1: Write the failing tests** (Kingdom Wars Jia Xu; rules: nearest seat, ties legal, popup always, Pass loses 1 HP): (a) other seats at distances 1, 2, 2 from a seat: its pick offers only the distance-1 seat plus Pass; (b) a tie at distance 1: both offered; (c) exactly one nearest: the choice request still opens (not auto-resolved); (d) the nearest seat cannot be targeted by Sha (Identity Zhuge Liang with no hand): the next nearest targetable seat is offered; (e) the nearest seat is outside the picker's attack range and may still be picked. `kingdomWarsSkills.spec.ts`: `readyKingdomWarsSkills(jia-xu)` contains `kingdomWars:descend-into-chaos`. `prose.vi.spec.ts`: `choicePromptText('kingdomWars:descend-into-chaos')` equals `choicePromptText('upheaval')` in `en` and `vi`. Identity guard: the existing Identity specs, unchanged, stay green; add one asserting an Identity Jia Xu still offers every seat in attack range.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generals/kingdom-wars-qun.spec.ts`; confirm FAIL.
- [ ] **Step 3: Implement** the factory: only the seat list in the `'next'` step differs; the no-target case still loses 1 HP.
- [ ] **Step 4: Run** `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Descend into Chaos targets the nearest seat`.

### Task 3: Kingdom Wars Lightning Strike (another player only)

**Files:**
- Modify: `projects/content/src/lib/generals/wind.ts` (`lightningStrike` becomes a factory), `projects/content/src/lib/generals/kingdom-wars-qun.ts` (register the variant)
- Test: `projects/content/src/lib/generals/kingdom-wars-qun.spec.ts`, `wind-qun.spec.ts` (Identity guard)

**Interfaces:**
- Produces: `makeLightningStrike(allowSelf: boolean): SkillDefinition` in `wind.ts`; `lightningStrike = makeLightningStrike(true)` (id unchanged, `lightning-strike`); the variant is `{ ...makeLightningStrike(false), id: 'kingdomWars:lightning-strike' }` registered under `zhang-jiao`, 雷击, in `kingdom-wars-qun.ts` and merged into `KINGDOM_WARS_VARIANTS`.

- [ ] **Step 1: Write the failing tests** (`table` harness): Kingdom Wars Zhang Jiao plays a Shan: the pick lists every living seat except his own; a spade on the picked seat deals 2 thunder damage with no source; a non-spade does nothing. `kingdomWarsSkills.spec.ts`: `readyKingdomWarsSkills(zhang-jiao)` contains `kingdomWars:lightning-strike` and still `dark-magic` (鬼道). `prose.vi.spec.ts`: the variant's hints and prompts equal `lightning-strike`'s in `en` and `vi`. Identity guard: the existing Identity spec that picks himself stays green.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generals/kingdom-wars-qun.spec.ts`; confirm FAIL.
- [ ] **Step 3: Implement** the factory: only the list of seats in the `'pick'` step differs (`living` filtered to exclude the owner when `allowSelf` is false); everything else is shared.
- [ ] **Step 4: Run** `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Lightning Strike excludes Zhang Jiao himself`.

### Task 4: Kingdom Wars Resurrection (also clears Chained)

**Files:**
- Modify: `projects/content/src/lib/generals/fire.ts` (`nirvana` becomes a factory), `projects/content/src/lib/generals/kingdom-wars-shu.ts` (register the variant; Pang Tong is Shu)
- Test: `projects/content/src/lib/generals/kingdom-wars-shu.spec.ts`, `fire-shu.spec.ts` (Identity guard)

**Interfaces:**
- Consumes: the engine's existing `{ kind: 'SetChainedEffect', seatId, chained: false }` (no engine change needed).
- Produces: `makeNirvana(clearChained: boolean): SkillDefinition` in `fire.ts`; `nirvana = makeNirvana(false)` (id `nirvana` unchanged); the variant is `{ ...makeNirvana(true), id: 'kingdomWars:resurrection' }`, registered under `pang-tong`, 涅槃.

- [ ] **Step 1: Write the failing tests:** a Chained, face-down Kingdom Wars Pang Tong at 0 HP with hand, equipment and judgment cards, uses Resurrection: all cards discarded, 3 cards drawn, 3 HP (at most max), face up, not Chained, no dying round, mark set; a second brush with death does not offer it again. An Identity Pang Tong in the same state stays Chained (existing Identity specs must stay green). `readyKingdomWarsSkills(pang-tong)` is `['shackle', 'kingdomWars:resurrection']` (Identity's Shackle id from `fire.ts`). `prose.vi.spec.ts`: the variant's hints and prompts equal `nirvana`'s in `en` and `vi`.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generals/kingdom-wars-shu.spec.ts`; confirm FAIL.
- [ ] **Step 3: Implement** the factory: when `clearChained`, the `'reborn'` step also emits the unchain effect.
- [ ] **Step 4: Run** `npm test`; expect PASS, including the sim leak checks.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Resurrection also clears Chained`.

### Task 5: Whole-registry check, Wiki and docs

**Files:**
- Test: `projects/content/src/lib/kingdomWarsAudit.spec.ts`, `wikiKingdomWarsGenerals.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-22-kingdom-wars-generals-engine-design.md` (a one-line "Slice 4 done" note under Slice 4), memory index if the memory file for this work exists

- [ ] **Step 1: Write the failing tests:** for all 60 Kingdom Wars records, every skill has `kingdomWarsSkillFor(record, skill) !== undefined` (so `readyKingdomWarsSkills(record).length === record.skills.length`); the Wiki marks every Kingdom Wars General's every skill `inGame`; `KINGDOM_WARS_VARIANTS` has no variant whose Kingdom Wars skill is equal to Identity's (none of the audited-as-wording skills is a variant).
- [ ] **Step 2: Run** `npx jest projects/content`; expect these to PASS already if Tasks 1 to 4 are complete; if any fail, the audit missed a skill: add it to `CLEARED_WORDING` only after reading its Identity skill, or ask the user.
- [ ] **Step 3: Run** the full `npm test` and `npm run i18n:status`; expect PASS and no new draft strings beyond those in the variants' names (already in `kingdom-wars-generals.json`).
- [ ] **Step 4: Commit** `test(content): every Kingdom Wars skill resolves; slice 4 notes`.

## Self-Review

- Spec coverage: wording-only Generals and the "Nil" 22 (Task 1), "immediately removed" notes (Task 1, 29 skills cleared in the rules file), the 11 slice-2 skills with no note (Task 1 list: Star Gazing, Rouse the Tiger, Giant Elephant, Stunning Beauty, Unmitigated Murder, Envy of Heaven, Marriage, Heroic Demeanor, Sow Dissension, Sudden Strike; , real differences found become variants (Tasks 2 to 4).
- Output required by the spec ("a list of what was checked and what it was decided as"): the audit result in the rules file.
- Not in this slice: bot intelligence, art, Lord skills.
