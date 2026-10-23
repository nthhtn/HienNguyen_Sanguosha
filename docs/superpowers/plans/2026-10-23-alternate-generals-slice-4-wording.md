# Alternate Generals Slice 4: Wording-Only Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every skill of all 60 Alternate Generals resolves for the Alternate deck: 30 wording-only skills are cleared as Default's, and the two real differences found (Zhang Jiao's Lightning Strike, Pang Tong's Resurrection) become variants. Descend into Chaos also changes (for Default and Alternate) as the user ruled.

**Architecture:** Slice 1's `CLEARED_WORDING` table in `alternateSkills.ts` is the ledger of cleared skills; slice 2's `ALTERNATE_VARIANTS` holds variants. The audit adds entries to the first, two variants to the second (each Default skill refactored into a small factory so both share code), and one Default rule change.

**Tech Stack:** TypeScript, Jest (`npm test`), `projects/content/src/lib` (`alternateSkills.ts`, `generals/*.ts`, `alternateVariants.ts`), test harness `generals/skills.testing.ts`.

**Spec:** `docs/superpowers/specs/2026-10-22-alternate-generals-engine-design.md` (slice 4). The binding rulings and the full audit result are in `docs/superpowers/specs/2026-10-23-alternate-generals-slice-4-rules.md`.

**Branch:** `feat/alternate-generals-wording` from `main` (slices 1 to 3 merged).

## Global Constraints

- Default games change in exactly one place: Descend into Chaos (Task 2, the user's ruling). Every other Default skill keeps its id, behavior and specs.
- Variant ids are `alternate:<skillIdOf(Alternate English name)>`: `alternate:lightning-strike`, `alternate:resurrection`; no branching on the deck inside a skill; variants are registered in data.
- "Lord", never "Ruler"; Lord skills stay inactive.
- Anything optional stays a "may" skill, asked each time.
- UI text follows the casing rules in `CLAUDE.md`; any new Vietnamese text starts as draft (`npm run i18n:status`).
- Each task carries its own tests and a check that the Default counterpart is unchanged (except Task 2).

## Review Focus

- Descend into Chaos with ties for nearest, with the only nearest seat unable to be targeted by Sha, and with exactly one legal target (popup still opens) (Task 2).
- Alternate Zhang Jiao is never offered himself, by a human or a bot; a Default Zhang Jiao at another seat still is (Task 3).
- Alternate Pang Tong's Resurrection while Chained: face up, not Chained, 3 HP, no dying round; and only once per game (Task 4).
- A cleared skill resolves to the Default skill of the same General, including Sudden Strike (Chinese name differs from Raid's) (Task 1).
- Every Alternate skill of every General resolves, and the Wiki shows all 60 as "In game" (Task 5).

---

### Task 1: Clear the wording-only skills

**Files:**
- Modify: `projects/content/src/lib/alternateSkills.ts` (`CLEARED_WORDING`, `defaultSkillFor`)
- Test: `projects/content/src/lib/alternateSkills.spec.ts`, new `projects/content/src/lib/alternateAudit.spec.ts`

**Interfaces:**
- Consumes: `CLEARED_WORDING: Record<string, readonly string[]>` (General id to Alternate skill Chinese names), `defaultSkillFor(record, skill)` (slice 1).
- Produces:
  - `CLEARED_WORDING` gains every skill in the "Cleared as the Default skill" list of the rules file, keyed by General id. Descend into Chaos (`jia-xu`, 乱武) is added in Task 2, not here.
  - `DEFAULT_SKILL_ZH: Readonly<Record<string, Readonly<Record<string, string>>>>`: General id, then Alternate Chinese name, to the Default Chinese name when they differ. Only `{ 'zhang-liao': { '突击': '突袭' } }`. `defaultSkillFor` looks the Default skill up by `DEFAULT_SKILL_ZH[id]?.[skill.nameZh] ?? skill.nameZh`.

- [ ] **Step 1: Write the failing tests.** `alternateAudit.spec.ts`:
  - For each (General id, Chinese name) in `CLEARED_WORDING`: the record exists, has a skill with that `nameZh`, and `alternateSkillFor` returns a skill whose id is not prefixed `alternate:` and belongs to `GENERAL_SKILLS.get(id)`.
  - `alternateSkillFor` for Zhang Liao's 突击 returns the skill with id `raid`.
  - Every one of the 22 Nil Generals: the Alternate skill Chinese names equal the Default General's non-Lord skill names, same count, and `maxHp` equals Default's (the `hpFrom: 'default'` Generals: Guan Yu and Lu Bu included).
  - No Alternate record skill is a Lord skill.
  `alternateSkills.spec.ts`: `readyAlternateSkills` for `zhang-liao`, `guan-yu` and `ma-chao` return `['raid']`, `['warrior-saint']` (the Default id) and the two Default Ma Chao skill ids; use the ids from the Default sets in `generals/shu.ts` and `wei.ts`.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/alternateAudit.spec.ts projects/content/src/lib/alternateSkills.spec.ts`; confirm FAIL.
- [ ] **Step 3: Implement** the table entries and `DEFAULT_SKILL_ZH`; keep the comment style of the existing entries (one line saying what was checked, e.g. "Unchanged from Default's Strong Bow; the action-phase wording is the same rule").
- [ ] **Step 4: Run** `npm test`; expect PASS. The Wiki's "In game" specs may need their expected counts updated; update them to the new registry.
- [ ] **Step 5: Commit** `feat(content): clear the wording-only Alternate skills`.

### Task 2: Descend into Chaos targets the nearest seat (Default and Alternate)

**Files:**
- Modify: `projects/content/src/lib/generals/forest.ts` (`shaReach` is used by `upheaval` only; replace it), `alternateSkills.ts` (`CLEARED_WORDING` adds `'jia-xu': ['乱武']`)
- Test: `projects/content/src/lib/generals/forest-qun.spec.ts` (where Upheaval's specs live; check with `grep -n upheaval`), `alternateAudit.spec.ts`

**Interfaces:**
- Consumes: `seatDistance`, `untargetableBy` (already imported in `forest.ts`).
- Produces: `nearestShaTargets(state: GameState, seatId: string, registry: ContentRegistry): string[]`, exported from `forest.ts`: the other living seats a Sha may target (not `untargetableBy` for 'sha') whose `seatDistance` from `seatId` equals the minimum among those; attack range is ignored.

- [ ] **Step 1: Write the failing tests** (rules: nearest seat, ties legal, popup always, Pass loses 1 HP). Table of specs: (a) three other seats at distances 1, 2, 2 from a seat: its pick options are only the distance-1 seat plus Pass; (b) a tie at distance 1: both are offered; (c) exactly one nearest: the choice request still opens (not auto-resolved); (d) the nearest seat cannot be targeted by Sha (Default Zhuge Liang with no hand): the next nearest targetable seat is offered; (e) a seat with a nearest seat outside its attack range may still pick it. Update any existing Upheaval spec that picks a seat that is in range but not nearest. Add to `alternateAudit.spec.ts`: Alternate Jia Xu's 乱武 resolves to `upheaval`.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generals/forest-qun.spec.ts`; confirm FAIL.
- [ ] **Step 3: Implement** `nearestShaTargets` and use it in the `'next'` step in place of `shaReach`; the no-target case still loses 1 HP as today. Update the comment above `upheaval` to the new rule text.
- [ ] **Step 4: Run** `npm test` and the simulation specs in `projects/sim`; expect PASS (bots read legal choices, so they follow). Fix any simulation seed that fails only because a Default Jia Xu game now plays differently.
- [ ] **Step 5: Commit** `feat(content): Descend into Chaos targets the nearest seat`.

### Task 3: Alternate Lightning Strike (another player only)

**Files:**
- Modify: `projects/content/src/lib/generals/wind.ts` (`lightningStrike` becomes a factory), `projects/content/src/lib/generals/alternate-qun.ts` (register the variant)
- Test: `projects/content/src/lib/generals/alternate-qun.spec.ts`, `wind-qun.spec.ts` (Default guard)

**Interfaces:**
- Produces: `makeLightningStrike(allowSelf: boolean): SkillDefinition` in `wind.ts`; `lightningStrike = makeLightningStrike(true)` (id unchanged, `lightning-strike`); the variant is `{ ...makeLightningStrike(false), id: 'alternate:lightning-strike' }` registered under `zhang-jiao`, 雷击, in `alternate-qun.ts` and merged into `ALTERNATE_VARIANTS`.

- [ ] **Step 1: Write the failing tests** (`table` harness): Alternate Zhang Jiao plays a Shan: the pick lists every living seat except his own; a spade on the picked seat deals 2 thunder damage with no source; a non-spade does nothing. `alternateSkills.spec.ts`: `readyAlternateSkills(zhang-jiao)` contains `alternate:lightning-strike` and still `dark-magic` (鬼道). Default guard: the existing Default spec that picks himself stays green.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generals/alternate-qun.spec.ts`; confirm FAIL.
- [ ] **Step 3: Implement** the factory: only the list of seats in the `'pick'` step differs (`living` filtered to exclude the owner when `allowSelf` is false); everything else is shared.
- [ ] **Step 4: Run** `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Alternate Lightning Strike excludes Zhang Jiao himself`.

### Task 4: Alternate Resurrection (also clears Chained)

**Files:**
- Modify: `projects/content/src/lib/generals/fire.ts` (`nirvana` becomes a factory), `projects/content/src/lib/generals/alternate-shu.ts` (register the variant; Pang Tong is a Shu General in the Alternate record, check `forceOf`)
- Test: `projects/content/src/lib/generals/alternate-shu.spec.ts`, `fire-shu.spec.ts` (Default guard)

**Interfaces:**
- Consumes: the engine's way of clearing a seat's Chained state (find the effect `ChainEffect`/`UnchainEffect` in `projects/engine/src/lib/effects` with `grep -rn "chained" projects/engine/src`; if none exists as a standalone effect, add `SetChainedEffect { seatId, chained: boolean }` to the engine and its resolver, with a spec).
- Produces: `makeNirvana(clearChained: boolean): SkillDefinition` in `fire.ts`; `nirvana = makeNirvana(false)` (id `nirvana` unchanged); the variant is `{ ...makeNirvana(true), id: 'alternate:resurrection' }`, registered under `pang-tong`, 涅槃.

- [ ] **Step 1: Write the failing tests:** a Chained, face-down Alternate Pang Tong at 0 HP with hand, equipment and judgment cards, uses Resurrection: all cards discarded, 3 cards drawn, 3 HP (at most max), face up, not Chained, no dying round, mark set; a second brush with death does not offer it again. A Default Pang Tong in the same state stays Chained (existing Default specs must stay green). `readyAlternateSkills(pang-tong)` is `['shackle', 'alternate:resurrection']` (Default's Shackle id from `fire.ts`).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generals/alternate-shu.spec.ts`; confirm FAIL.
- [ ] **Step 3: Implement** the factory: when `clearChained`, the `'reborn'` step also emits the unchain effect.
- [ ] **Step 4: Run** `npm test`; expect PASS, including the sim leak checks.
- [ ] **Step 5: Commit** `feat(content): Alternate Resurrection also clears Chained`.

### Task 5: Whole-registry check, Wiki and docs

**Files:**
- Test: `projects/content/src/lib/alternateAudit.spec.ts`, `wikiAlternateGenerals.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-22-alternate-generals-engine-design.md` (a one-line "Slice 4 done" note under Slice 4), memory index if the memory file for this work exists

- [ ] **Step 1: Write the failing tests:** for all 60 Alternate records, every skill has `alternateSkillFor(record, skill) !== undefined` (so `readyAlternateSkills(record).length === record.skills.length`); the Wiki marks every Alternate General's every skill `inGame`; `ALTERNATE_VARIANTS` has no variant whose Alternate skill is equal to Default's (none of the audited-as-wording skills is a variant).
- [ ] **Step 2: Run** `npx jest projects/content`; expect these to PASS already if Tasks 1 to 4 are complete; if any fail, the audit missed a skill: add it to `CLEARED_WORDING` only after reading its Default skill, or ask the user.
- [ ] **Step 3: Run** the full `npm test` and `npm run i18n:status`; expect PASS and no new draft strings beyond those in the variants' names (already in `alternate-generals.json`).
- [ ] **Step 4: Commit** `test(content): every Alternate skill resolves; slice 4 notes`.

## Self-Review

- Spec coverage: wording-only Generals and the "Nil" 22 (Task 1), "immediately removed" notes (Task 1, 30 skills cleared in the rules file), the 11 slice-2 skills with no note (Task 1 list: Star Gazing, Rouse the Tiger, Giant Elephant, Stunning Beauty, Unmitigated Murder, Envy of Heaven, Marriage, Heroic Demeanor, Sow Dissension, Sudden Strike; Descend into Chaos in Task 2), real differences found become variants (Tasks 3 and 4).
- Output required by the spec ("a list of what was checked and what it was decided as"): the audit result in the rules file.
- Not in this slice: bot intelligence, art, Lord skills.
