# Kingdom Wars Generals in the Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open `/wiki/kingdom-wars/generals`: all 60 Kingdom Wars Generals with art or placeholder, skills tagged "Works as Dynasty Wars" or "Not in game yet", Synergistic Partners, the Difference note, and Vietnamese drafts of every piece of text.

**Architecture:** The crawler also writes one aggregate `generals.json`; the content package reads it and builds `WikiKingdomWarsGeneral` entries (status computed there, against Dynasty Wars' Generals and the game's skill code); a locale layer in `display.ts` reads a new `locales/vi/kingdom-wars-generals.json`; the Angular side gets one page and one entry component that only render, plus the nav link and route.

**Tech Stack:** TypeScript (content package, Angular standalone components, signals), Jest (`npx jest --selectProjects content app`), Python `unittest` for the crawler.

**Spec:** `docs/superpowers/specs/2026-10-21-kingdom-wars-generals-wiki-design.md` (also read `2026-10-21-kingdom-wars-generals-crawl-design.md` for the data).

## Global Constraints

- CLAUDE.md applies: no rules or status logic in Angular components; ids never shown raw; UI text style: English Title Case for names and short labels, sentence case for sentences/status lines, keywords (Wei, Shu, Wu, Qun, General(s), HP, Dynasty Wars) keep their capitals; Vietnamese is sentence case everywhere, keywords keep capitals (Tướng, Sinh lực, Ngụy, Thục, Ngô, Quần).
- New Vietnamese text is a **draft**: do not touch `projects/content/data/locales/vi/review.json`; `npm run i18n:status` must list the new entries as draft.
- Both UI catalogs (`en.ts`, `vi.ts`) get the same new keys (an existing catalogs test checks this).
- Skill tag values: **Works as Dynasty Wars** / **Not in game yet** only; Kingdom Wars skills are never Lord skills, so "Not used in Guozhan" never shows.
- The page looks up art, Dynasty Wars counterpart and Dynasty Wars Vietnamese by the Kingdom Wars record's `id` (the crawl sets it to Dynasty Wars' id when matched, including `zhuge-liang` and `fire-zhuge-liang`). The Kingdom Wars Vietnamese entry, keyed by the same id, always wins on the Kingdom Wars page.
- Placeholders (no portrait crawl) for the nine Generals Dynasty Wars lacks; no pack tag, no voice button, no "skills in game" badge on Kingdom Wars entries.
- Content must load the 60 Generals without a runtime directory scan.
- Dynasty Wars Wiki content and tests unchanged, except the test pinning the `/wiki/kingdom-wars/generals` redirect and the nav tests pinning Generals as disabled.
- Do not change the crawler's per-General files, `generals-manual.json` or Dynasty Wars' data.

## Review Focus

- A Kingdom Wars General with no Dynasty Wars counterpart: every skill "Not in game yet" (Task 2).
- A Dynasty Wars counterpart skill that is a Lord skill or has no code must not give "Works as Dynasty Wars" (Task 2).
- The aggregate `generals.json` drifting from the per-General files (Task 1).
- A skill or partner missing from, or extra in, the Vietnamese file; partner lists of unequal length (Task 3).
- Vietnamese falling back to English for a missing piece, and Dynasty Wars' Vietnamese never leaking into a Kingdom Wars entry whose wording differs (Task 3).
- `?tab=wu` and an unknown tab on the new page behave as on Dynasty Wars'; an empty tab shows the empty line (Task 5).
- A General with no art renders the placeholder, not a broken image (Task 4).

---

### Task 1: The crawler writes an aggregate `generals.json`

**Files:**
- Modify: `scripts/crawl-kingdom-wars-generals.py` (`main`, docstring)
- Modify: `scripts/test_crawl_kingdom_wars_generals.py`
- Create (generated): `projects/content/data/decks/kingdom-wars/generals.json`

**Interfaces:**
- Produces: `projects/content/data/decks/kingdom-wars/generals.json` shaped `{"generals": [<record>, ...]}`: the same records as the per-General files, in index (page) order, written with `ensure_ascii=False, indent=2` and a trailing newline. Each record has the shape the crawl design defines (`id`, `name`, `nameZh?`, `force`, `title?`, `maxHp`, `gender`, `hpFrom`, `skills[{name, nameZh?, text, tag?}]`, `synergisticPartners: string[]`, `differenceFromNormal: string|null`, `source`).

- [ ] **Step 1: Write the failing tests** in `Main`: `test_main_writes_an_aggregate_in_index_order` (after `run_main`, `generals.json` exists in `--out`; its `generals` ids equal `["liu-bei", "liu-shan", "sima-yi"]`; each equals the matching per-General file's JSON), and extend `test_rerun_is_byte_identical` to include `generals.json`.
- [ ] **Step 2: Run** `python3 -m unittest discover -s scripts -p 'test_*.py'`; expect the two tests to fail.
- [ ] **Step 3: Implement** the write in `main` after the per-General files (only when at least one record was written, as now); mention the file in the module docstring.
- [ ] **Step 4: Run the suite; expect pass.** Then run `python3 scripts/crawl-kingdom-wars-generals.py` (cache is populated; no network except the index) and confirm `git status` shows only `generals.json` new and no per-General file changed.
- [ ] **Step 5: Commit** `feat(content): aggregate Kingdom Wars Generals file for the content package`.

### Task 2: Content: the Kingdom Wars Generals for the Wiki, with skill status

**Files:**
- Create: `projects/content/src/lib/kingdomWarsGenerals.ts` (typed access to `generals.json`)
- Create: `projects/content/src/lib/wikiKingdomWarsGenerals.ts`
- Modify: `projects/content/src/lib/wiki.ts` (export `CODED_SKILL_IDS`)
- Modify: `projects/content/src/public-api.ts` (export both new files)
- Test: `projects/content/src/lib/wikiKingdomWarsGenerals.spec.ts`

**Interfaces:**
- Consumes: `generalsData` and `GeneralData` (`projects/content/data/generals`), `skillIdFromName`, `skillStatus`, `CODED_SKILL_IDS`, `WikiTab`, `splitIntoTabs`-style tabs (reuse `generalTabs` by mapping if its type allows, otherwise add an equivalent for the new type in the new file).
- Produces:
  - `kingdomWarsGeneralRecords(): KingdomWarsGeneralRecord[]` (typed as the record shape above), `kingdomWarsGeneralIds(): string[]`.
  - `export type KingdomWarsSkillStatus = 'worksAsDynastyWars' | 'missing'`.
  - `export interface WikiKingdomWarsSkill { name: string; nameZh: string | null; text: string; status: KingdomWarsSkillStatus }`.
  - `export interface WikiKingdomWarsGeneral { id: string; name: string; nameZh: string | null; title: string | null; kingdom: 'Wei' | 'Shu' | 'Wu' | 'Qun'; maxHp: number; gender: 'male' | 'female'; skills: WikiKingdomWarsSkill[]; partners: string[]; differenceNote: string | null; skillsRunAsDynastyWars: boolean }`.
  - `kingdomWarsSkillStatus(skill: { name: string; nameZh: string | null }, counterpart: GeneralData | undefined, coded: ReadonlySet<string> = CODED_SKILL_IDS): KingdomWarsSkillStatus`: `worksAsDynastyWars` iff `counterpart` has a non-Lord skill with the same `nameZh` (when both have one), else the same normalised English name, whose id (`skillIdFromName`) is in `coded`; otherwise `missing`.
  - `wikiKingdomWarsGenerals(): WikiKingdomWarsGeneral[]` sorted by Kingdom (Wei, Shu, Wu, Qun) then English name; `wikiKingdomWarsGeneralTabs(): WikiTab<WikiKingdomWarsGeneral>[]` with tabs `wei, shu, wu, qun` labelled as Dynasty Wars'.

- [ ] **Step 1: Write the failing tests** (names and assertions):
  - `kingdomWarsSkillStatus`: `test_no_counterpart_is_missing` (`undefined` → `missing`); `test_same_chinese_name_with_code_works_as_default` (counterpart skill `{name:'Kindness', nameZh:'仁德'}`, `coded = new Set(['kindness'])`, Kingdom Wars skill `{name:'Benevolence', nameZh:'仁德'}` → `worksAsDynastyWars`); `test_same_english_name_works_when_no_chinese_name`; `test_counterpart_skill_without_code_is_missing`; `test_a_lord_counterpart_skill_is_not_a_match` (`lord: true` with code → `missing`); `test_two_kingdom_wars_skills_may_share_one_counterpart`.
  - Real data: `test_sixty_generals_fifteen_per_kingdom`; `test_every_general_has_hp_gender_and_at_least_one_skill`; `test_the_two_zhuge_liangs_are_default_ids` (ids `zhuge-liang`, `fire-zhuge-liang` present, kingdom Shu, maxHp 3); `test_generals_with_no_default_counterpart_have_only_missing_skills` (the nine: `gan-fu-ren`, `yue-jin`, `ding-feng`, `ji-ling`, `kong-rong`, `ma-teng`, `pan-feng`, `tian-feng`, `zou-shi`); `test_expected_not_in_game_skills`: the sorted list of `"<id>/<skill name>"` for every skill with `missing` equals a literal array in the spec. Derive that literal from the real data on the first run, then read it critically (each entry must be a skill that genuinely has no Dynasty Wars counterpart code) and list in the commit message how many there are; `test_aggregate_matches_the_per_general_files` (read `data/decks/kingdom-wars/generals/*/*.json` with `fs` and compare to `kingdomWarsGeneralRecords()` by id; no differences); `test_tabs_are_the_four_kingdoms_in_order`.
- [ ] **Step 2: Run** `npx jest --selectProjects content wikiKingdomWarsGenerals`; expect failures (module missing).
- [ ] **Step 3: Implement** the files above. `differenceNote` and `partners` come straight from `differenceFromNormal` and `synergisticPartners`; kingdom capitalises `force` (`qun` → `Qun`); `skillsRunAsDynastyWars` is `skills.length > 0 && every worksAsDynastyWars`. The Dynasty Wars counterpart is `generalsData[record.id]`.
- [ ] **Step 4: Run** `npx jest --selectProjects content`; expect all pass.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Generals for the Wiki with skill status`.

### Task 3: Vietnamese drafts and their display data

**Files:**
- Create: `projects/content/data/locales/vi/kingdom-wars-generals.json`
- Modify: `projects/content/src/lib/display.ts`
- Modify: `scripts/i18n-status.ts`
- Test: `projects/content/src/lib/kingdomWarsGenerals.vi.spec.ts`; extend `projects/content/src/lib/glossary.vi.spec.ts`

**Interfaces:**
- Consumes: `kingdomWarsGeneralRecords`, `skillIdFromName`/`skillIdOf`, `generalTranslations` (to reuse Dynasty Wars' name and title where the Kingdom Wars title is the same).
- Produces (all exported from `display.ts`):
  - `export interface KingdomWarsGeneralTranslation { name: string; title?: string; skills?: Record<string, { name: string; text?: string }>; differenceNote?: string; partners?: string[] }`; `kingdomWarsGeneralTranslations(locale: string): Record<string, KingdomWarsGeneralTranslation>`.
  - `export interface KingdomWarsGeneralDisplayData { name: string; title: string | null; skills: { name: string; text: string }[]; differenceNote: string | null; partners: string[] }`; `kingdomWarsGeneralDisplayData(id: string, locale = 'en'): KingdomWarsGeneralDisplayData | null`: English from the record; a translated piece replaces its English one; a missing piece or a locale with no entry reads English; Dynasty Wars' Vietnamese is never consulted at run time (the file itself may reuse Dynasty Wars' wording).
  - The JSON file keyed by Kingdom Wars General id; `skills` keyed by `skillIdFromName(<Kingdom Wars English skill name>)`; `partners` the whole-string translation of each `synergisticPartners` entry in the same order.

- [ ] **Step 1: Write the failing tests** in `kingdomWarsGenerals.vi.spec.ts`: `test_every_general_has_a_vietnamese_entry_with_name_title_and_note`; `test_every_skill_has_a_name_and_text` (keys exactly `skillIdFromName` of the English skills; no extra keys, no missing, naming the General and skill on failure); `test_partners_have_the_same_length_as_the_english_list`; `test_english_locale_returns_the_english_data`; `test_a_missing_piece_falls_back_to_english` (build one case by calling the display function on a record whose translation is deleted from a cloned table, or assert the documented behaviour on an unknown locale `fr`); `test_kingdom_wars_text_wins_over_default_for_a_shared_id` (`cao-cao` Kingdom Wars Vietnamese skill text differs from Dynasty Wars' Vietnamese skill text, because the English differs); `test_names_use_capitals_like_default` (every `name` equals the Dynasty Wars Vietnamese name when Dynasty Wars has the General and the Chinese names are equal). In `glossary.vi.spec.ts` add `holds in every Kingdom Wars skill text` mirroring the existing check over `kingdomWarsGeneralRecords()`.
- [ ] **Step 2: Run** `npx jest --selectProjects content vi.spec glossary`; expect failures.
- [ ] **Step 3: Implement `display.ts`** additions (loader table `{ vi: viKingdomWarsGenerals }` beside the card ones).
- [ ] **Step 4: Write the draft Vietnamese file for all 60 Generals,** force by force (Wei, Shu, Wu, Qun), after reading `projects/content/data/locales/vi/glossary.json` and the first ten entries of `generals.json` for tone. Names and titles reuse Dynasty Wars' Vietnamese when the General and the Chinese name are the same; skill names sentence case (proper nouns keep capitals); texts use the glossary terms; the Difference note and each partner string (for example `"Guan Yu 关羽 (Sworn Brother)"` → name plus relation in Vietnamese) are translated whole. Run the spec after each force until all four pass.
- [ ] **Step 5: Extend `scripts/i18n-status.ts`** so the universe's `generals` list also holds one entry per Kingdom Wars General, written `kingdomWars:<id>` (ids overlap Dynasty Wars', so they are prefixed; `review.json` stays untouched, so they report as draft). Run `npm run i18n:status` and confirm the Generals line total grew by 60 and reviewed did not change; `unknown ids` stays empty.
- [ ] **Step 6: Run** `npx jest --selectProjects content` and `npx jest --selectProjects app i18n`; expect pass.
- [ ] **Step 7: Commit** `feat(content): Vietnamese drafts for the Kingdom Wars Generals`.

### Task 4: The entry component and the page

**Files:**
- Create: `projects/app/src/app/wiki/wiki-kingdom-wars-general-entry.ts`, `projects/app/src/app/wiki/wiki-kingdom-wars-generals.ts`
- Modify: `projects/app/src/app/wiki/wiki-labels.ts` (add `wikiKingdomWarsGeneralView`)
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts` (new keys)
- Test: `projects/app/src/app/wiki/wiki-entries.spec.ts` (new `describe`), `projects/app/src/app/wiki/wiki-labels` spec if one exists, `projects/app/src/app/wiki/wiki.vi.spec.ts`

**Interfaces:**
- Consumes: `WikiKingdomWarsGeneral`, `wikiKingdomWarsGenerals`, `wikiKingdomWarsGeneralTabs`, `kingdomWarsGeneralDisplayData` (from `content`); `CardArt`, `tabQueryParam`, `wikiTabLabel`, the existing keys `label.kingdom.*`, `wiki.male`, `wiki.female`, `wiki.noHp`, `wiki.hp`, `wiki.noSkills`, `wiki.notInGame`, `wiki.empty`, `lobby.deckSummary`, `setup.deck.kingdomWars`, `wiki.page.generals`.
- Produces:
  - `wikiKingdomWarsGeneralView(general: WikiKingdomWarsGeneral, locale: string): { name: string; title: string | null; skills: { name: string; text: string }[]; differenceNote: string | null; partners: string[] }` in `wiki-labels.ts` (English at `DEFAULT_LOCALE`, else `kingdomWarsGeneralDisplayData`, falling back per piece).
  - `WikiKingdomWarsGeneralEntry` (selector `app-wiki-kingdom-wars-general-entry`, input `general`), rendering `article.entry[data-id]` like Dynasty Wars': `app-card-art` with `[skin]="true"` and the General's id, names, title, Kingdom tag, Gender tag, HP hearts, skills each with name, Chinese name, text and a tag, a Partners section (hidden when the list is empty), a Difference section (hidden when null).
  - `WikiKingdomWarsGenerals` page: heading `wiki.page.generals`, deck line with `setup.deck.kingdomWars`, summary line, `mat-tab-group` of `wikiKingdomWarsGeneralTabs()` with `tabQueryParam`, empty line per empty tab.
  - New keys in both catalogs: `wiki.skillStatus.worksAsDynastyWars` ("Works as Dynasty Wars" / sentence-case Vietnamese), `wiki.partners` ("Synergistic Partners"), `wiki.differenceNote` ("Difference from the Standard Game"), `wiki.kingdomWarsGenerals.summary` (`'{count} Generals · {withDefault} with every skill running Dynasty Wars\'s version'`, params `count`, `withDefault`; Vietnamese equivalent with Tướng).

- [ ] **Step 1: Write the failing tests:** entry: `test_renders_names_title_kingdom_hp_and_gender` (fixture `WikiKingdomWarsGeneral` for Cao Cao, Wei, 4 HP: four `mat-icon` hearts, "Wei" tag, no pack tag, no voice button, no "Skills in game" badge); `test_skill_tags` (`worksAsDynastyWars` shows the `wiki.skillStatus.worksAsDynastyWars` text, `missing` shows `wiki.notInGame` text; never "Working"); `test_partners_and_difference_sections_show_and_hide` (present, then empty list and `null` note are absent); `test_a_general_with_no_art_shows_the_placeholder` (id `ding-feng`: element `.card-art-placeholder` exists, no `img`); `test_vietnamese_view` (locale `vi`: translated name and skill text appear). Page: `test_lists_sixty_generals_in_four_tabs` and `test_summary_line_counts_generals_running_default` (open `/wiki/kingdom-wars/generals` via the router test harness used in `wiki-pages.spec.ts`; tab labels `Wei (n)`, `Shu (n)`, `Wu (n)`, `Qun (n)` summing to 60; `entryIds` includes `ding-feng`); `test_tab_query_param` (`?tab=wu` selects Wu; an unknown tab falls back to the first).
- [ ] **Step 2: Run** `npx jest --selectProjects app wiki`; expect failures (components missing; the route does not exist yet, so land Task 5's route first if the page tests need it: do Step 3 for components, then the route edit of Task 5 Step 3, then run).
- [ ] **Step 3: Implement** the components and view helper, reusing Dynasty Wars' entry styles by copying only what is used. Components hold no status logic: they read `general.skills[i].status` and `skillsRunAsDynastyWars` from the content package.
- [ ] **Step 4: Add the catalog keys,** then run `npx jest --selectProjects app catalogs`; expect the key sets to match.
- [ ] **Step 5: Run** `npx jest --selectProjects app`; expect pass (after Task 5's route if needed).
- [ ] **Step 6: Commit** `feat(app): Kingdom Wars Generals entry and page`.

### Task 5: Enable the nav item and the address

**Files:**
- Modify: `projects/app/src/app/app.ts` (the Kingdom Wars menu's Generals item: remove `disabled: true`)
- Modify: `projects/app/src/app/wiki/wiki.routes.ts` (the `Kingdom Wars` children: `generals` loads the new page; remove the redirect and update the leading comment)
- Test: `projects/app/src/app/app.spec.ts`, `projects/app/src/app/app.vi.spec.ts` if it pins the disabled item, `projects/app/src/app/wiki/wiki-pages.spec.ts`

**Interfaces:**
- Consumes: `WikiKingdomWarsGenerals` (Task 4).

- [ ] **Step 1: Update the failing tests first:** in `wiki-pages.spec.ts` move `['/wiki/kingdom-wars/generals', ...]` out of the redirect table and add `/wiki/kingdom-wars/generals` to the "keeps %s where it is" list; in `app.spec.ts` change the nav expectation so the Kingdom Wars menu lists four enabled links `['/wiki/kingdom-wars/generals', '/wiki/kingdom-wars/basic', '/wiki/kingdom-wars/equipment', '/wiki/kingdom-wars/tools']` (find the existing disabled-item assertion and invert it); add the `wiki/kingdom-wars/:page` stub route already present stays.
- [ ] **Step 2: Run** `npx jest --selectProjects app app.spec wiki-pages`; expect failures.
- [ ] **Step 3: Implement** the two edits.
- [ ] **Step 4: Run** `npx jest --selectProjects app`; expect pass, including Task 4's page tests.
- [ ] **Step 5: Commit** `feat(app): enable Kingdom Wars Generals in the Wiki menu and routes`.

### Task 6: Whole-change verification

- [ ] **Step 1: Run** the full suites: `python3 -m unittest discover -s scripts -p 'test_*.py'` and `npm test`; expect all pass (skips as before).
- [ ] **Step 2: Run** the production app build (`npm run build`, or the build script `package.json` names) and `npx tsc -p tsconfig.json --noEmit` if the repo uses it; expect no errors.
- [ ] **Step 3: Check in a browser** when a browser tool is available: start the dev server, open `/wiki/kingdom-wars/generals`, switch tabs and language, confirm the nine placeholders and the two Zhuge Liangs' art, the tags, partners and note. If no browser is available, say "not browser-checked" in the final report.
- [ ] **Step 4: Run** `npm run i18n:status` and report the new draft counts; confirm `git diff` shows `review.json` untouched and Dynasty Wars' Wiki tests unchanged.
- [ ] **Step 5: Commit** any fixes found; report to the user: counts of "Not in game yet" skills (the pinned list), the nine placeholders, and the Vietnamese drafts awaiting native review.
