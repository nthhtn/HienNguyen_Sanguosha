# Kingdom Wars Generals Slice 1: Plumbing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Choosing the Kingdom Wars deck deals the 60 Kingdom Wars Generals, each with only the skills that are ready for the Kingdom Wars deck; Dynasty Wars games are unchanged.

**Architecture:** Kingdom Wars Generals live in the one shared `ContentRegistry` under prefixed ids (`kingdomWars:liu-bei`), so no registry plumbing changes anywhere. The deck chooses which ids are dealt. A skill is "ready" when it matches a Dynasty Wars skill whose rules are the same; its `SkillDefinition` is Dynasty Wars' own object. A skill that is not ready is absent (a General with none plays vanilla). Lord skills are never matched, so Kingdom Wars Generals carry none. Content display, art and bot lookups map a prefixed id back to its record through one helper.

**Tech Stack:** TypeScript, Jest (`npm test`), Angular app (labels only), plain-Node engine and sim.

**Spec:** `docs/superpowers/specs/2026-10-22-kingdom-wars-generals-engine-design.md` (slice 1 only; slices 2, 3, 4 are separate plans).

## Global Constraints

- Dynasty Wars games must not change: same Dynasty Wars pool, same seeded deal, same skills.
- The engine stays framework-free; no rule logic in Angular components.
- "Lord" is the official term, never "Ruler". Never delete Lord skills, flags or crawl notes.
- UI text follows `CLAUDE.md` casing rules; ids are never shown (show "Liu Bei", not `kingdomWars:liu-bei`).
- Ready skills only: a skill that is not ready is absent, never approximated.
- New Generals (no art) use a placeholder portrait.
- Prefix is exactly `kingdomWars:`; the existing Vietnamese review ids already use it.

## Review Focus

- A General with no ready skills (the 9 new ones, Liu Bei) plays a whole game without error (Task 7).
- A "Nil" General whose skill name does not match Dynasty Wars' (Zhang Zhao and Zhang Hong, Stabilization) gets no wrong Dynasty Wars skill (Task 2).
- `filler-*` test ids and prefixed ids never leak into the wrong deck's pool (Task 4).
- An unknown or malformed prefixed id (`kingdomWars:nobody`) in display, art and bot helpers returns null or a safe fallback, never throws (Tasks 5, 6).
- A Dynasty Wars game's seeded deal is identical before and after the change (Task 4).

---

### Task 1: Kingdom Wars General id helpers

**Files:**
- Create: `projects/content/src/lib/generalIds.ts`
- Test: `projects/content/src/lib/generalIds.spec.ts`
- Modify: `projects/content/src/public-api.ts` (export it), `projects/content/src/lib/display.ts` (`reviewGeneralIds` uses the helper)

**Interfaces:**
- Produces: `KINGDOM_WARS_GENERAL_PREFIX = 'kingdomWars:'`, `kingdomWarsGeneralId(id: string): string`, `isKingdomWarsGeneralId(id: string): boolean`, `baseGeneralId(id: string): string` (the id without the prefix; any other id unchanged).

- [ ] **Step 1: Write the failing test** `generalIds.spec.ts`: `kingdomWarsGeneralId('liu-bei') === 'kingdomWars:liu-bei'`; `isKingdomWarsGeneralId` true for it, false for `liu-bei` and `filler-liu-bei`; `baseGeneralId('kingdomWars:liu-bei') === 'liu-bei'`; `baseGeneralId('liu-bei') === 'liu-bei'`; `baseGeneralId('kingdomWars:kingdomWars:x') === 'kingdomWars:x'` (strips once).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generalIds.spec.ts`; expect FAIL (module missing).
- [ ] **Step 3: Implement** the four exports in `generalIds.ts`; export from `public-api.ts`; change `reviewGeneralIds` in `display.ts` to build `kingdomWars:<id>` with `kingdomWarsGeneralId`.
- [ ] **Step 4: Run** the new spec plus `projects/content/src/lib/display.spec.ts`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): id helpers for Kingdom Wars Generals`.

### Task 2: Which Kingdom Wars skills are ready

**Files:**
- Create: `projects/content/src/lib/kingdomWarsSkills.ts`
- Test: `projects/content/src/lib/kingdomWarsSkills.spec.ts`

**Interfaces:**
- Consumes: `KingdomWarsGeneralRecord`, `KingdomWarsGeneralSkillRecord` (`kingdomWarsGenerals.ts`), `generalsData` (`data/generals`), `GENERAL_SKILLS` (`./generals`), `skillIdOf` (`display.ts`).
- Produces:
  - `isNilNote(note: string | null): boolean`: true when the trimmed, lowercased note without a trailing full stop is `nil`.
  - `CLEARED_WORDING: Readonly<Record<string, readonly string[]>>`: General id to Kingdom Wars skill Chinese names that slice 4 clears as wording-only. Empty now.
  - `dynastyWarsSkillFor(record: KingdomWarsGeneralRecord, skill: KingdomWarsGeneralSkillRecord): SkillDefinition | undefined`: the Dynasty Wars `SkillDefinition` this Kingdom Wars skill runs as, or undefined when not ready.
  - `readyKingdomWarsSkills(record: KingdomWarsGeneralRecord): SkillDefinition[]`: the ready skills in the record's order.

Rule for `dynastyWarsSkillFor`: ready only when the record's note is Nil, or the skill's `nameZh` is in `CLEARED_WORDING[record.id]`; and the Kingdom Wars skill has a `nameZh` equal to a non-`lord` skill's `nameZh` in `generalsData[record.id]`; and `GENERAL_SKILLS.get(record.id)` has a definition whose `id` is `skillIdOf` of that Dynasty Wars skill's name. Match by Chinese name only (English names differ between the two sources).

- [ ] **Step 1: Write the failing tests** `kingdomWarsSkills.spec.ts` with these assertions (ids from `readyKingdomWarsSkills(record).map(s => s.id)`, records via `kingdomWarsGeneralRecords()`):
  - Zhang Fei (Nil): `['roar']`, and the object is the very `SkillDefinition` in `GENERAL_SKILLS.get('zhang-fei')` (`toBe`).
  - Liu Bei (changed note): `[]`.
  - Zhang Zhao and Zhang Hong (note Nil, but Stabilization shares no Chinese name with Stubborn): the ready ids contain Dynasty Wars' Direct Instruction skill id (read it from `data/generals/wu/zhang-zhao-and-zhang-hong.json`, skill `直谏`) and do not contain Dynasty Wars' Stubborn id.
  - Gan Fu Ren and the other 8 General ids missing from `generalsData`: `[]`, no throw.
  - `isNilNote('Nil.')`, `isNilNote(' nil ')` true; `isNilNote(null)`, `isNilNote('Nil, but weaker')` false.
  - For every record, no ready skill has `lord: true`.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/kingdomWarsSkills.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** the four exports as described above.
- [ ] **Step 4: Run** the spec; expect PASS.
- [ ] **Step 5: Commit** `feat(content): decide which Kingdom Wars skills run as Dynasty Wars'`.

### Task 3: Kingdom Wars Generals in the registry

**Files:**
- Modify: `projects/content/src/lib/registry.ts` (`buildGenerals`)
- Test: `projects/content/src/lib/registry.spec.ts`

**Interfaces:**
- Consumes: `kingdomWarsGeneralRecords()`, `kingdomWarsGeneralId`, `readyKingdomWarsSkills`.
- Produces: for each of the 60 records, a `GeneralDefinition` with `id: kingdomWarsGeneralId(rec.id)`, `kingdom` the capitalised `force` (`'Wei' | 'Shu' | 'Wu' | 'Qun'`), `maxHp: rec.maxHp`, `gender: rec.gender`, `skills: readyKingdomWarsSkills(rec)`.

- [ ] **Step 1: Write the failing tests** in `registry.spec.ts`: the registry has 60 `kingdomWars:` ids and the same non-prefixed ids as before (57); `kingdomWars:zhang-fei` has kingdom `Shu`, maxHp 4, skills `['roar']`; `kingdomWars:liu-bei` has skills `[]`; every `kingdomWars:` General's skills are all in `readyKingdomWarsSkills`; Dynasty Wars `liu-bei` still has `kindness` and the Lord skill (`fierce-general`); no `kingdomWars:` General has a skill with `lord: true`; `lookupGeneral(registry, 'kingdomWars:zou-shi')` returns a vanilla General (skills `[]`).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/registry.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** by adding the Kingdom Wars loop to `buildGenerals` after the Dynasty Wars loop. The "skill logic with no data file" check stays Dynasty Wars-only.
- [ ] **Step 4: Run** `npx jest projects/content`; expect PASS (other specs that count `registry.generals.size` or iterate all Generals may need to filter to non-prefixed ids; fix those specs, not the registry).
- [ ] **Step 5: Commit** `feat(content): register the Kingdom Wars Generals`.

### Task 4: The deck chooses the General pool

**Files:**
- Modify: `projects/content/src/lib/modes/guozhan.ts` (`guozhanMaxSeats`, `dealCandidates`, `setup`)
- Test: `projects/content/src/lib/modes/guozhan.spec.ts`

**Interfaces:**
- Consumes: `isKingdomWarsGeneralId`, `deckFor`, `DeckId`.
- Produces: `generalPool(registry: ContentRegistry, deck: DeckId): string[]` (exported; the sorted ids: `kingdomWars:` ids for `'kingdomWars'`, every other id for `'dynastyWars'`, so `filler-*` stays Dynasty Wars-side as it is today); `guozhanMaxSeats(registry: ContentRegistry, deck: DeckId = 'dynastyWars'): number` computed from `generalPool(...).length`. `setup` resolves the deck once (`deckFor(rules?.deck)`) and uses its id for the pool, the seat limit and the deck deal.

- [ ] **Step 1: Characterization test first.** Before any change, run a one-off to print `createGame(guozhanMode, registry, ['seat-a','seat-b','seat-c','seat-d'], 42).generalSelection.candidates` with `registry = withFillers(buildContentRegistry())` on the current code; paste the result as a literal expected value in a new test "Dynasty Wars deal for seed 42 is unchanged". Run it; expect PASS (it must pass on unchanged code).
- [ ] **Step 2: Write the failing tests:** with `{ deck: 'kingdomWars' }`, every dealt candidate and every spare General starts with `kingdomWars:`; with no deck and with `{ deck: 'dynastyWars' }`, none does; `generalPool(registry, 'kingdomWars').length === 60`; `guozhanMaxSeats(registry, 'kingdomWars') === 10`; an unknown deck still throws the existing `Unknown deck` error.
- [ ] **Step 3: Run** `npx jest projects/content/src/lib/modes/guozhan.spec.ts`; expect the new tests FAIL, the characterization test PASS.
- [ ] **Step 4: Implement** `generalPool`; make `dealCandidates` take the pool ids and shuffle `generalPool(...)` instead of `[...registry.generals.keys()].sort()`; pass the deck through `setup`'s limit check and error message. Keep the shuffle input order identical for Dynasty Wars.
- [ ] **Step 5: Run** `npx jest projects/content projects/sim`; expect PASS, including the characterization test.
- [ ] **Step 6: Commit** `feat(content): deal Generals from the chosen deck's pool`.

### Task 5: Names, titles and art for Kingdom Wars ids

**Files:**
- Modify: `projects/content/src/lib/display.ts` (`generalDisplayData`), `projects/content/src/lib/assets.ts` (`generalSkinUrl`, `generalDeathVoiceUrl`, new `GENERAL_PLACEHOLDER_ART_URL`)
- Create: `projects/content/assets/generals/placeholder.svg`
- Test: `projects/content/src/lib/display.spec.ts`, `projects/content/src/lib/assets.spec.ts`

**Interfaces:**
- Produces:
  - `generalDisplayData('kingdomWars:<id>', locale)` returns `{ name, title, skills }` built from `kingdomWarsGeneralDisplayData(baseGeneralId(id), locale)` (its skills are the record's own, with the Kingdom Wars names), and `null` for an unknown base id.
  - `generalSkinUrl('kingdomWars:<id>')`: the base General's skin, else its crawled card art, else `GENERAL_PLACEHOLDER_ART_URL`.
  - `generalDeathVoiceUrl('kingdomWars:<id>')`: the base General's voice, else null.
  - `GENERAL_PLACEHOLDER_ART_URL = '/card-art/generals/placeholder.svg'`.

- [ ] **Step 1: Write the failing tests:** `generalDisplayData('kingdomWars:guan-yu')?.skills[0].name === 'Warrior Saint'` while Dynasty Wars `guan-yu` still reads `Fighting Saint`; `generalDisplayData('kingdomWars:guan-yu', 'vi')?.name` equals the Vietnamese entry in `kingdom-wars-generals.json`; `generalDisplayData('kingdomWars:nobody') === null`; `generalSkinUrl('kingdomWars:zhang-fei') === generalSkinUrl('zhang-fei')`; `generalSkinUrl('kingdomWars:zou-shi') === GENERAL_PLACEHOLDER_ART_URL` and the same for all 9 new Generals; `generalSkinUrl('kingdomWars:nobody')` returns the placeholder, no throw; `generalDeathVoiceUrl('kingdomWars:zhang-fei') === generalDeathVoiceUrl('zhang-fei')`.
- [ ] **Step 2: Run** both specs; expect FAIL.
- [ ] **Step 3: Implement** the three functions and the constant; add `placeholder.svg` (a plain neutral silhouette, under 5 KB, no text).
- [ ] **Step 4: Run** `npx jest projects/content/src/lib/display.spec.ts projects/content/src/lib/assets.spec.ts`; expect PASS. If `assets.spec.ts` lists shipped files, add the placeholder there.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars names and placeholder art`.

### Task 6: App label and bot value lookups

**Files:**
- Modify: `projects/app/src/app/labels.ts` (`generalDisplayName`), `projects/bots/src/lib/general-values.ts` (`pairScore`)
- Test: `projects/app/src/app/labels.spec.ts` (or the existing labels spec), `projects/bots/src/lib/general-values.spec.ts`

**Interfaces:**
- Consumes: `isKingdomWarsGeneralId`, `baseGeneralId` from `content`.

- [ ] **Step 1: Write the failing tests:** `generalDisplayName('kingdomWars:liu-bei')` is `Liu Bei` in English (not a Title Case of the id) and the Vietnamese name in `vi`; `generalDisplayName('kingdomWars:nobody')` does not throw and shows no `kingdomWars:` text; `pairScore(values, registry, { mainId: 'kingdomWars:cao-cao', deputyId: 'kingdomWars:zhang-liao', ... })` equals the score of the same pair with the Dynasty Wars ids, except for the HP tiebreak from the registry.
- [ ] **Step 2: Run** the two specs; expect FAIL.
- [ ] **Step 3: Implement:** in `generalDisplayName`, the English shortcut applies only to non-Kingdom Wars ids (a Kingdom Wars id always goes through `generalDisplayData`, falling back to a Title Case of `baseGeneralId`). In `pairScore`, look the value up by `baseGeneralId(id)`.
- [ ] **Step 4: Run** `npx jest projects/app projects/bots`; expect PASS.
- [ ] **Step 5: Commit** `feat(app,bots): read Kingdom Wars General ids`.

### Task 7: Wiki status and a full Kingdom Wars simulation

**Files:**
- Modify: `projects/content/src/lib/wikiKingdomWarsGenerals.ts` (`kingdomWarsSkillStatus`, `wikiKingdomWarsGenerals`), `projects/sim/src/kingdomWars.spec.ts`
- Test: `projects/content/src/lib/wikiKingdomWarsGenerals.spec.ts`

**Interfaces:**
- Consumes: `dynastyWarsSkillFor`.
- Changes: `kingdomWarsSkillStatus(record: KingdomWarsGeneralRecord, skill: KingdomWarsGeneralSkillRecord): KingdomWarsSkillStatus` is `'worksAsDynastyWars'` exactly when `dynastyWarsSkillFor(record, skill)` is defined, else `'missing'`. This makes the Wiki say what the game does.

- [ ] **Step 1: Write the failing tests:** Zhang Fei's Berserk is `worksAsDynastyWars`; Liu Bei's Benevolence is `missing`; Zhang Zhao's Stabilization is `missing`; for every record, a skill is `worksAsDynastyWars` iff the matching `kingdomWars:` General's registry skills contain a skill with the same id as `dynastyWarsSkillFor`. Update the existing assertions that relied on the old rule (a changed-note skill reading `worksAsDynastyWars`).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/wikiKingdomWarsGenerals.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** the new `kingdomWarsSkillStatus` and update its call in `wikiKingdomWarsGenerals()`.
- [ ] **Step 4: Extend `projects/sim/src/kingdomWars.spec.ts`:** after the existing run, assert every seated General id in each game's log starts with `kingdomWars:` and that games in which a seat holds a vanilla `kingdomWars:` General (a General with no skills) still reach a result with no engine error. Add a Dynasty Wars check: a seeded Dynasty Wars game still seats no `kingdomWars:` ids.
- [ ] **Step 5: Run the whole suite** `npm test`; expect PASS. Also `npm run typecheck:server`; expect no errors. Run `npm run i18n:status` and confirm it reports no new missing keys.
- [ ] **Step 6: Commit** `feat(content): Wiki status follows the registry; Kingdom Wars simulation`.

---

## Self-review notes

- Spec coverage: pool by deck (Task 4), ready skills only and variants hook (Tasks 2, 3), no Lord skills (Tasks 2, 3 tests), Wiki "In game" follows the registry (Task 7), names and placeholder art (Task 5), Dynasty Wars unchanged (Task 4 characterization, Task 7 Dynasty Wars check).
- Not in this slice: wording-only clearing (slice 4 fills `CLEARED_WORDING`), real variants (slice 2), new skills and Generals (slice 3). Variant skills later get ids `kingdomWars:<skillIdOf(Kingdom Wars English name)>`; slices 2 and 3 settle how their names reach `abilityName`.
- Known limit: a skill shared with Dynasty Wars shows Dynasty Wars' English name in action text and buttons (`abilityName` has only a skill id); the General info and selection screens show Kingdom Wars names. Reported to the user.
