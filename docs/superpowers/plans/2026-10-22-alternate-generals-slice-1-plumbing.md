# Alternate Generals Slice 1: Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Choosing the Alternate deck deals the 60 Alternate Generals, each with only the skills that are ready for the Alternate deck; Default games are unchanged.

**Architecture:** Alternate Generals live in the one shared `ContentRegistry` under prefixed ids (`alternate:liu-bei`), so no registry plumbing changes anywhere. The deck chooses which ids are dealt. A skill is "ready" when it matches a Default skill whose rules are the same; its `SkillDefinition` is Default's own object. A skill that is not ready is absent (a General with none plays vanilla). Lord skills are never matched, so Alternate Generals carry none. Content display, art and bot lookups map a prefixed id back to its record through one helper.

**Tech Stack:** TypeScript, Jest (`npm test`), Angular app (labels only), plain-Node engine and sim.

**Spec:** `docs/superpowers/specs/2026-10-22-alternate-generals-engine-design.md` (slice 1 only; slices 2, 3, 4 are separate plans).

## Global Constraints

- Default games must not change: same Default pool, same seeded deal, same skills.
- The engine stays framework-free; no rule logic in Angular components.
- "Lord" is the official term, never "Ruler". Never delete Lord skills, flags or crawl notes.
- UI text follows `CLAUDE.md` casing rules; ids are never shown (show "Liu Bei", not `alternate:liu-bei`).
- Ready skills only: a skill that is not ready is absent, never approximated.
- New Generals (no art) use a placeholder portrait.
- Prefix is exactly `alternate:`; the existing Vietnamese review ids already use it.

## Review Focus

- A General with no ready skills (the 9 new ones, Liu Bei) plays a whole game without error (Task 7).
- A "Nil" General whose skill name does not match Default's (Zhang Zhao and Zhang Hong, Stabilization) gets no wrong Default skill (Task 2).
- `filler-*` test ids and prefixed ids never leak into the wrong deck's pool (Task 4).
- An unknown or malformed prefixed id (`alternate:nobody`) in display, art and bot helpers returns null or a safe fallback, never throws (Tasks 5, 6).
- A Default game's seeded deal is identical before and after the change (Task 4).

---

### Task 1: Alternate General id helpers

**Files:**
- Create: `projects/content/src/lib/generalIds.ts`
- Test: `projects/content/src/lib/generalIds.spec.ts`
- Modify: `projects/content/src/public-api.ts` (export it), `projects/content/src/lib/display.ts` (`reviewGeneralIds` uses the helper)

**Interfaces:**
- Produces: `ALTERNATE_GENERAL_PREFIX = 'alternate:'`, `alternateGeneralId(id: string): string`, `isAlternateGeneralId(id: string): boolean`, `baseGeneralId(id: string): string` (the id without the prefix; any other id unchanged).

- [ ] **Step 1: Write the failing test** `generalIds.spec.ts`: `alternateGeneralId('liu-bei') === 'alternate:liu-bei'`; `isAlternateGeneralId` true for it, false for `liu-bei` and `filler-liu-bei`; `baseGeneralId('alternate:liu-bei') === 'liu-bei'`; `baseGeneralId('liu-bei') === 'liu-bei'`; `baseGeneralId('alternate:alternate:x') === 'alternate:x'` (strips once).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generalIds.spec.ts`; expect FAIL (module missing).
- [ ] **Step 3: Implement** the four exports in `generalIds.ts`; export from `public-api.ts`; change `reviewGeneralIds` in `display.ts` to build `alternate:<id>` with `alternateGeneralId`.
- [ ] **Step 4: Run** the new spec plus `projects/content/src/lib/display.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): id helpers for Alternate Generals`.

### Task 2: Which Alternate skills are ready

**Files:**
- Create: `projects/content/src/lib/alternateSkills.ts`
- Test: `projects/content/src/lib/alternateSkills.spec.ts`

**Interfaces:**
- Consumes: `AlternateGeneralRecord`, `AlternateGeneralSkillRecord` (`alternateGenerals.ts`), `generalsData` (`data/generals`), `GENERAL_SKILLS` (`./generals`), `skillIdOf` (`display.ts`).
- Produces:
  - `isNilNote(note: string | null): boolean`: true when the trimmed, lowercased note without a trailing full stop is `nil`.
  - `CLEARED_WORDING: Readonly<Record<string, readonly string[]>>`: General id to Alternate skill Chinese names that slice 4 clears as wording-only. Empty now.
  - `defaultSkillFor(record: AlternateGeneralRecord, skill: AlternateGeneralSkillRecord): SkillDefinition | undefined`: the Default `SkillDefinition` this Alternate skill runs as, or undefined when not ready.
  - `readyAlternateSkills(record: AlternateGeneralRecord): SkillDefinition[]`: the ready skills in the record's order.

Rule for `defaultSkillFor`: ready only when the record's note is Nil, or the skill's `nameZh` is in `CLEARED_WORDING[record.id]`; and the Alternate skill has a `nameZh` equal to a non-`lord` skill's `nameZh` in `generalsData[record.id]`; and `GENERAL_SKILLS.get(record.id)` has a definition whose `id` is `skillIdOf` of that Default skill's name. Match by Chinese name only (English names differ between the two sources).

- [ ] **Step 1: Write the failing tests** `alternateSkills.spec.ts` with these assertions (ids from `readyAlternateSkills(record).map(s => s.id)`, records via `alternateGeneralRecords()`):
  - Zhang Fei (Nil): `['roar']`, and the object is the very `SkillDefinition` in `GENERAL_SKILLS.get('zhang-fei')` (`toBe`).
  - Liu Bei (changed note): `[]`.
  - Zhang Zhao and Zhang Hong (note Nil, but Stabilization shares no Chinese name with Stubborn): the ready ids contain Default's Direct Instruction skill id (read it from `data/generals/wu/zhang-zhao-and-zhang-hong.json`, skill `直谏`) and do not contain Default's Stubborn id.
  - Gan Fu Ren and the other 8 General ids missing from `generalsData`: `[]`, no throw.
  - `isNilNote('Nil.')`, `isNilNote(' nil ')` true; `isNilNote(null)`, `isNilNote('Nil, but weaker')` false.
  - For every record, no ready skill has `lord: true`.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/alternateSkills.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** the four exports as described above.
- [ ] **Step 4: Run** the spec; expect PASS.
- [ ] **Step 5: Commit** `feat(content): decide which Alternate skills run as Default's`.

### Task 3: Alternate Generals in the registry

**Files:**
- Modify: `projects/content/src/lib/registry.ts` (`buildGenerals`)
- Test: `projects/content/src/lib/registry.spec.ts`

**Interfaces:**
- Consumes: `alternateGeneralRecords()`, `alternateGeneralId`, `readyAlternateSkills`.
- Produces: for each of the 60 records, a `GeneralDefinition` with `id: alternateGeneralId(rec.id)`, `kingdom` the capitalised `force` (`'Wei' | 'Shu' | 'Wu' | 'Qun'`), `maxHp: rec.maxHp`, `gender: rec.gender`, `skills: readyAlternateSkills(rec)`.

- [ ] **Step 1: Write the failing tests** in `registry.spec.ts`: the registry has 60 `alternate:` ids and the same non-prefixed ids as before (57); `alternate:zhang-fei` has kingdom `Shu`, maxHp 4, skills `['roar']`; `alternate:liu-bei` has skills `[]`; every `alternate:` General's skills are all in `readyAlternateSkills`; Default `liu-bei` still has `kindness` and the Lord skill (`fierce-general`); no `alternate:` General has a skill with `lord: true`; `lookupGeneral(registry, 'alternate:zou-shi')` returns a vanilla General (skills `[]`).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/registry.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** by adding the Alternate loop to `buildGenerals` after the Default loop. The "skill logic with no data file" check stays Default-only.
- [ ] **Step 4: Run** `npx jest projects/content`; expect PASS (other specs that count `registry.generals.size` or iterate all Generals may need to filter to non-prefixed ids; fix those specs, not the registry).
- [ ] **Step 5: Commit** `feat(content): register the Alternate Generals`.

### Task 4: The deck chooses the General pool

**Files:**
- Modify: `projects/content/src/lib/modes/kingdomWar.ts` (`kingdomWarMaxSeats`, `dealCandidates`, `setup`)
- Test: `projects/content/src/lib/modes/kingdomWar.spec.ts`

**Interfaces:**
- Consumes: `isAlternateGeneralId`, `deckFor`, `DeckId`.
- Produces: `generalPool(registry: ContentRegistry, deck: DeckId): string[]` (exported; the sorted ids: `alternate:` ids for `'alternate'`, every other id for `'default'`, so `filler-*` stays Default-side as it is today); `kingdomWarMaxSeats(registry: ContentRegistry, deck: DeckId = 'default'): number` computed from `generalPool(...).length`. `setup` resolves the deck once (`deckFor(rules?.deck)`) and uses its id for the pool, the seat limit and the deck deal.

- [ ] **Step 1: Characterization test first.** Before any change, run a one-off to print `createGame(kingdomWarMode, registry, ['seat-a','seat-b','seat-c','seat-d'], 42).generalSelection.candidates` with `registry = withFillers(buildContentRegistry())` on the current code; paste the result as a literal expected value in a new test "Default deal for seed 42 is unchanged". Run it; expect PASS (it must pass on unchanged code).
- [ ] **Step 2: Write the failing tests:** with `{ deck: 'alternate' }`, every dealt candidate and every spare General starts with `alternate:`; with no deck and with `{ deck: 'default' }`, none does; `generalPool(registry, 'alternate').length === 60`; `kingdomWarMaxSeats(registry, 'alternate') === 10`; an unknown deck still throws the existing `Unknown deck` error.
- [ ] **Step 3: Run** `npx jest projects/content/src/lib/modes/kingdomWar.spec.ts`; expect the new tests FAIL, the characterization test PASS.
- [ ] **Step 4: Implement** `generalPool`; make `dealCandidates` take the pool ids and shuffle `generalPool(...)` instead of `[...registry.generals.keys()].sort()`; pass the deck through `setup`'s limit check and error message. Keep the shuffle input order identical for Default.
- [ ] **Step 5: Run** `npx jest projects/content projects/sim`; expect PASS, including the characterization test.
- [ ] **Step 6: Commit** `feat(content): deal Generals from the chosen deck's pool`.

### Task 5: Names, titles and art for Alternate ids

**Files:**
- Modify: `projects/content/src/lib/display.ts` (`generalDisplayData`), `projects/content/src/lib/assets.ts` (`generalSkinUrl`, `generalDeathVoiceUrl`, new `GENERAL_PLACEHOLDER_ART_URL`)
- Create: `projects/content/assets/generals/placeholder.svg`
- Test: `projects/content/src/lib/display.spec.ts`, `projects/content/src/lib/assets.spec.ts`

**Interfaces:**
- Produces:
  - `generalDisplayData('alternate:<id>', locale)` returns `{ name, title, skills }` built from `alternateGeneralDisplayData(baseGeneralId(id), locale)` (its skills are the record's own, with the Alternate names), and `null` for an unknown base id.
  - `generalSkinUrl('alternate:<id>')`: the base General's skin, else its crawled card art, else `GENERAL_PLACEHOLDER_ART_URL`.
  - `generalDeathVoiceUrl('alternate:<id>')`: the base General's voice, else null.
  - `GENERAL_PLACEHOLDER_ART_URL = '/card-art/generals/placeholder.svg'`.

- [ ] **Step 1: Write the failing tests:** `generalDisplayData('alternate:guan-yu')?.skills[0].name === 'Warrior Saint'` while Default `guan-yu` still reads `Fighting Saint`; `generalDisplayData('alternate:guan-yu', 'vi')?.name` equals the Vietnamese entry in `alternate-generals.json`; `generalDisplayData('alternate:nobody') === null`; `generalSkinUrl('alternate:zhang-fei') === generalSkinUrl('zhang-fei')`; `generalSkinUrl('alternate:zou-shi') === GENERAL_PLACEHOLDER_ART_URL` and the same for all 9 new Generals; `generalSkinUrl('alternate:nobody')` returns the placeholder, no throw; `generalDeathVoiceUrl('alternate:zhang-fei') === generalDeathVoiceUrl('zhang-fei')`.
- [ ] **Step 2: Run** both specs; expect FAIL.
- [ ] **Step 3: Implement** the three functions and the constant; add `placeholder.svg` (a plain neutral silhouette, under 5 KB, no text).
- [ ] **Step 4: Run** `npx jest projects/content/src/lib/display.spec.ts projects/content/src/lib/assets.spec.ts`; expect PASS. If `assets.spec.ts` lists shipped files, add the placeholder there.
- [ ] **Step 5: Commit** `feat(content): Alternate names and placeholder art`.

### Task 6: App label and bot value lookups

**Files:**
- Modify: `projects/app/src/app/labels.ts` (`generalDisplayName`), `projects/bots/src/lib/general-values.ts` (`pairScore`)
- Test: `projects/app/src/app/labels.spec.ts` (or the existing labels spec), `projects/bots/src/lib/general-values.spec.ts`

**Interfaces:**
- Consumes: `isAlternateGeneralId`, `baseGeneralId` from `content`.

- [ ] **Step 1: Write the failing tests:** `generalDisplayName('alternate:liu-bei')` is `Liu Bei` in English (not a Title Case of the id) and the Vietnamese name in `vi`; `generalDisplayName('alternate:nobody')` does not throw and shows no `alternate:` text; `pairScore(values, registry, { mainId: 'alternate:cao-cao', deputyId: 'alternate:zhang-liao', ... })` equals the score of the same pair with the Default ids, except for the HP tiebreak from the registry.
- [ ] **Step 2: Run** the two specs; expect FAIL.
- [ ] **Step 3: Implement:** in `generalDisplayName`, the English shortcut applies only to non-Alternate ids (an Alternate id always goes through `generalDisplayData`, falling back to a Title Case of `baseGeneralId`). In `pairScore`, look the value up by `baseGeneralId(id)`.
- [ ] **Step 4: Run** `npx jest projects/app projects/bots`; expect PASS.
- [ ] **Step 5: Commit** `feat(app,bots): read Alternate General ids`.

### Task 7: Wiki status and a full Alternate simulation

**Files:**
- Modify: `projects/content/src/lib/wikiAlternateGenerals.ts` (`alternateSkillStatus`, `wikiAlternateGenerals`), `projects/sim/src/alternate.spec.ts`
- Test: `projects/content/src/lib/wikiAlternateGenerals.spec.ts`

**Interfaces:**
- Consumes: `defaultSkillFor`.
- Changes: `alternateSkillStatus(record: AlternateGeneralRecord, skill: AlternateGeneralSkillRecord): AlternateSkillStatus` is `'worksAsDefault'` exactly when `defaultSkillFor(record, skill)` is defined, else `'missing'`. This makes the Wiki say what the game does.

- [ ] **Step 1: Write the failing tests:** Zhang Fei's Berserk is `worksAsDefault`; Liu Bei's Benevolence is `missing`; Zhang Zhao's Stabilization is `missing`; for every record, a skill is `worksAsDefault` iff the matching `alternate:` General's registry skills contain a skill with the same id as `defaultSkillFor`. Update the existing assertions that relied on the old rule (a changed-note skill reading `worksAsDefault`).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/wikiAlternateGenerals.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** the new `alternateSkillStatus` and update its call in `wikiAlternateGenerals()`.
- [ ] **Step 4: Extend `projects/sim/src/alternate.spec.ts`:** after the existing run, assert every seated General id in each game's log starts with `alternate:` and that games in which a seat holds a vanilla `alternate:` General (a General with no skills) still reach a result with no engine error. Add a Default check: a seeded Default game still seats no `alternate:` ids.
- [ ] **Step 5: Run the whole suite** `npm test`; expect PASS. Also `npm run typecheck:server`; expect no errors. Run `npm run i18n:status` and confirm it reports no new missing keys.
- [ ] **Step 6: Commit** `feat(content): Wiki status follows the registry; Alternate simulation`.

---

## Self-review notes

- Spec coverage: pool by deck (Task 4), ready skills only and variants hook (Tasks 2, 3), no Lord skills (Tasks 2, 3 tests), Wiki "In game" follows the registry (Task 7), names and placeholder art (Task 5), Default unchanged (Task 4 characterization, Task 7 Default check).
- Not in this slice: wording-only clearing (slice 4 fills `CLEARED_WORDING`), real variants (slice 2), new skills and Generals (slice 3). Variant skills later get ids `alternate:<skillIdOf(Alternate English name)>`; slices 2 and 3 settle how their names reach `abilityName`.
- Known limit: a skill shared with Default shows Default's English name in action text and buttons (`abilityName` has only a skill id); the General info and selection screens show Alternate names. Reported to the user.
