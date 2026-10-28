# Kingdom Wars Generals Crawl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crawl the 60 Guozhan Generals from the KW Characters blog into per-General JSON files beside the Kingdom Wars card data, plus a Generals section in the Kingdom Wars-vs-Identity difference report.

**Architecture:** One new standard-library Python script, `scripts/crawl-kingdom-wars-generals.py`, shaped like `crawl-kingdom-wars-deck.py` (module docstring, `--file`/`--out` flags, pure parse functions, `main(argv)` returning an exit code). It fetches the index, follows each General link (cached, sequential, polite), parses the post body, joins against Identity's General files, writes records, and splices a Generals block into the existing `diff-vs-identity.md`.

**Tech Stack:** Python 3 stdlib (`html.parser`, `urllib`, `unittest`); tests run with `python3 -m unittest discover -s scripts -p 'test_*.py'`.

**Spec:** `docs/superpowers/specs/2026-10-21-kingdom-wars-generals-crawl-design.md`

## Global Constraints

- Python, standard library only, in `scripts/`; test style as `scripts/test_crawl_kingdom_wars_deck.py` (load the hyphenated script with `importlib`, fixtures in `scripts/fixtures/`).
- Source: `https://sanguoshaenglish.blogspot.com/2010/02/kw-characters.html`; 60 Generals, 15 under each anchor `shu`, `wei`, `wu`, `heroes`; `heroes` is force `qun`.
- Follow redirects; sequential fetches with a pause; a User-Agent; a page cache outside tracked files (`tmp/generals-cache/`, `/tmp` is already git-ignored at the repo root, so use `ROOT / "tmp"`).
- Only `div.post-body.entry-content` is parsed; blog comments never enter the data.
- `maxHp` and `gender` are never crawled: copied from Identity when matched (`"hpFrom": "identity"`), absent otherwise. Never guess a value.
- Identity's data, the card crawl's outputs and every existing test stay unchanged; the card sections of `diff-vs-identity.md` come out byte-identical.
- Output under `projects/content/data/decks/kingdom-wars/generals/<force>/<id>.json`, force folders `wei`, `shu`, `wu`, `qun`; deterministic (same pages in, same bytes out; no timestamps except `source.crawledAt`).
- Matching: `nameZh` match is trusted; English-name fallback copies HP and gender only for exactly one candidate; every fallback match is listed in the report. Id = matched Identity id, else page slug minus `.html` with a trailing `-lady-xxx` suffix dropped. Unmatched `nameZh` stays absent.
- Skill comparison normalisation: collapse whitespace, unify straight/curly quotes and dashes, trim; keep case and wording.
- An unreadable page: no record, listed with its reason in the report, printed as a warning, excluded from comparisons; exit code 0.
- No engine, setup, server or bot changes.

## Review Focus

- A General page with the ability label missing or worded differently: listed as unparsed with a reason, never a crash or an empty-skill record (Task 2).
- A page with two skills: both kept, in order (Task 2).
- Comment text containing words like "Character ability" must not be read as data (Task 2).
- A network error or non-200 on one General page: that General is unparsed, the other 59 still written (Task 4).
- English-name fallback with two candidates: copies nothing and reports unmatched (Task 3).
- Re-running with the same pages: identical bytes, and the card sections of the report unchanged (Tasks 4 and 5).

---

### Task 1: Index parser and fixtures

**Files:**
- Create: `scripts/crawl-kingdom-wars-generals.py` (docstring, constants, `parse_index`)
- Create: `scripts/fixtures/kw-index-excerpt.html`
- Create: `scripts/test_crawl_kingdom_wars_generals.py`

**Interfaces:**
- Produces: `parse_index(html: str) -> list[dict]`, each `{"force": "shu"|"wei"|"wu"|"qun", "url": str, "slug": str}` in page order, where `url` is the link as printed and `slug` is the last path segment without `.html`. Constants `URL`, `ROOT`, `OUT_DIR`, `IDENTITY_GENERALS`, `CACHE_DIR`, `ANCHOR_FORCE = {"shu": "shu", "wei": "wei", "wu": "wu", "heroes": "qun"}`, `class GeneralError(Exception)`.

- [ ] **Step 1: Save the fixture.** Fetch the index with `curl -sL`, keep the `post-body` opening, the four `<a name="…"></a>` sections trimmed to 3 links each (keep the real markup and one image link per General), and a trailing comment block containing one link to `.../2099/01/not-a-general.html` to prove comments are ignored.
- [ ] **Step 2: Write the failing tests** in `ParseIndex`: `test_links_grouped_by_force` (12 entries: 3 per force, `heroes` entries have `force == "qun"`), `test_page_order_and_slug` (first shu entry slug `liu-bei`), `test_links_outside_the_post_body_are_ignored` (no `not-a-general`).
- [ ] **Step 3: Run** `python3 -m unittest scripts/test_crawl_kingdom_wars_generals.py` and see it fail (no module).
- [ ] **Step 4: Implement** `parse_index` with `html.parser.HTMLParser`: enter at `div.post-body`, track the current `<a name=…>` anchor, collect `<a href>` that wrap an `<img>`, stop at the end of the post body (the `Email This` footer marker is a safe cut, as in the survey).
- [ ] **Step 5: Run the tests; expect pass.**
- [ ] **Step 6: Commit** `feat(content): parse the KW Characters index`.

### Task 2: General page parser

**Files:**
- Modify: `scripts/crawl-kingdom-wars-generals.py` (add `parse_general`)
- Create: `scripts/fixtures/kw-general-liu-bei.html`, `kw-general-multi-skill.html`, `kw-general-odd.html`
- Modify: `scripts/test_crawl_kingdom_wars_generals.py`

**Interfaces:**
- Consumes: `GeneralError`.
- Produces: `parse_general(html: str) -> dict` with keys `name`, `title`, `skills` (list of `{"name", "nameZh"?, "text"}`), `synergisticPartners` (list of str), `differenceFromNormal` (str or `None`), `nameZh` (str or `None`). Raises `GeneralError(reason)` when no skill can be read.

- [ ] **Step 1: Survey.** Fetch all 60 pages once into `tmp/generals-cache/<slug>.html` and print, per page, the label lines found (lines ending in `:` and `Character ability`-style lines). From that pick the three fixtures: Liu Bei (single skill), a General with two skills, and the page with the most unusual label layout; trim each to its post body plus one fake comment that repeats "Character ability:". Write down in the test file's docstring which pages the fixtures are.
- [ ] **Step 2: Write the failing tests** in `ParseGeneral`: `test_liu_bei` (skill name `Benevolence`, `nameZh` `仁德`, text starts `During your action phase, you can give`, partners `["Guan Yu 关羽 (Sworn Brother)", "Zhang Fei 张飞 (Sworn Brother)", "Gan Fu Ren (Lady Gan) 甘夫人 (Wife)"]`, `differenceFromNormal` starts `"Benevolence" is weakened`), `test_title_is_the_translated_description_without_quotes` (the title is the quoted "Translated Description" line, minus quotes and its Chinese/pinyin tail; Liu Bei's page prints `The Ambitious Leader in Tumultuous Times`, which is really Cao Cao's epithet, so assert it as printed and never correct the blog), `test_two_skills_keep_order`, `test_comment_text_is_not_data`, `test_odd_layout_page`, `test_no_ability_label_raises_general_error`.
- [ ] **Step 3: Run; expect failures.**
- [ ] **Step 4: Implement** `parse_general`: reduce the post body to lines (`<br>`, block ends), then walk labelled sections ("Translated Description", "Character ability", "Synergistic Partners", "Difference from Normal SanGuoSha"), tolerating label wording variants found in the survey. Skill label line `Character ability: "Benevolence 仁德 (rén dé) "` yields name `Benevolence`, `nameZh` `仁德`; the following line(s) until the next label are the text. `name` comes from the post's own title element; if the page has none, raise `GeneralError` (the slug is never used as a name).
- [ ] **Step 5: Run; expect pass.** Then run the parser over all 60 cached pages and list the ones that raise; each must be explainable (genuinely unreadable) or fixed in the parser.
- [ ] **Step 6: Commit** `feat(content): parse a KW General page`.

### Task 3: Identity join

**Files:**
- Modify: `scripts/crawl-kingdom-wars-generals.py` (add `load_default_generals`, `match_default`, `general_id`)
- Modify: `scripts/test_crawl_kingdom_wars_generals.py`

**Interfaces:**
- Consumes: `parse_general` output.
- Produces: `load_default_generals(root: Path = IDENTITY_GENERALS) -> dict[str, dict]` keyed by id (file stem), each the file's JSON plus `"force"` (its folder name). `match_default(parsed: dict, default: dict) -> tuple[str|None, str|None]` returning `(default_id, how)` with `how` in `"nameZh" | "name" | None`. `general_id(slug: str, default_id: str|None) -> str`.

- [ ] **Step 1: Write the failing tests** (using a small in-memory `default` dict, not the real files): `test_nameZh_match_is_trusted`, `test_name_fallback_with_one_candidate_matches`, `test_name_fallback_with_two_candidates_matches_nothing`, `test_unmatched_returns_none`, `test_id_is_default_id_when_matched`, `test_id_from_slug_drops_lady_suffix` (`gan-fu-ren-lady-gan` → `gan-fu-ren`), `test_id_from_slug_keeps_other_slugs` (`yan-liang-wen-chou` unchanged). Plus `test_real_default_loads_57_generals`.
- [ ] **Step 2: Run; expect failures.**
- [ ] **Step 3: Implement.** English normalisation for the fallback: lowercase, strip parentheticals like `(Lady Gan)` only when that leaves no candidate, drop non-letters.
- [ ] **Step 4: Run; expect pass.**
- [ ] **Step 5: Run the matcher against the 60 cached pages** and look at the fallback and unmatched lists: any wrong fallback match means the normaliser needs tightening, not an exception list. Record the three expected unmatched Generals in the commit message.
- [ ] **Step 6: Commit** `feat(content): match Kingdom Wars Generals to Identity`.

### Task 4: Records, fetching and main

**Files:**
- Modify: `scripts/crawl-kingdom-wars-generals.py` (add `build_record`, `fetch_page`, `main`)
- Modify: `scripts/test_crawl_kingdom_wars_generals.py`

**Interfaces:**
- Consumes: `parse_index`, `parse_general`, `load_default_generals`, `match_default`, `general_id`.
- Produces: `build_record(entry: dict, parsed: dict, default: dict, today: str) -> dict` giving the JSON shape in the spec (`id`, `name`, `nameZh` if known, `force`, `title`, `maxHp`/`gender`/`hpFrom` only when matched, `skills`, `synergisticPartners`, `differenceFromNormal`, `source: {url, listedUnder, crawledAt}`); `fetch_page(url: str, cache: Path, pause: float = 1.0) -> str`; `main(argv=None) -> int` with flags `--file` (saved index; General pages still come from cache/network), `--pages DIR` (read General pages from a folder, no network), `--out`, `--no-cache`.

- [ ] **Step 1: Write the failing tests:** `test_record_copies_hp_and_gender_from_default` (`hpFrom == "identity"`), `test_unmatched_record_has_no_hp_or_gender_keys`, `test_record_key_order_is_stable`, `test_main_writes_files_by_force_from_saved_pages` (temp `--out`, `--file` fixture index, `--pages` folder of fixtures; expects `generals/shu/liu-bei.json`), `test_one_unreadable_page_is_skipped_and_run_exits_zero`, `test_rerun_is_byte_identical`.
- [ ] **Step 2: Run; expect failures.**
- [ ] **Step 3: Implement.** `fetch_page` reads the cache first and sleeps `pause` only after a real download; on any `urllib` error or non-200 it raises `GeneralError`. `main` records unparsed pages, prints `SKIPPED slug: reason` to stderr, prints a one-line summary like the card crawl, writes JSON with `ensure_ascii=False, indent=2` plus trailing newline.
- [ ] **Step 4: Run the whole suite** (`python3 -m unittest discover -s scripts -p 'test_*.py'`); expect pass, including the card crawl's tests.
- [ ] **Step 5: Commit** `feat(content): write Kingdom Wars General records`.

### Task 5: Difference report section

**Files:**
- Modify: `scripts/crawl-kingdom-wars-generals.py` (add `normalise_text`, `generals_report`, `splice_report`)
- Modify: `scripts/crawl-kingdom-wars-deck.py` (preserve an existing generals block when it rewrites the report)
- Modify: `scripts/test_crawl_kingdom_wars_generals.py`, `scripts/test_crawl_kingdom_wars_deck.py`

**Interfaces:**
- Produces: `normalise_text(s: str) -> str`; `generals_report(records: list[dict], matches: dict[str, tuple[str|None, str|None]], default: dict, unparsed: list[dict]) -> str` returning a block that starts `<!-- generals:start -->` and ends `<!-- generals:end -->`, with the sections: Only in Kingdom Wars, Only in Identity, Force differs, Skills differ (skill present on one side only, or name/text differs after normalisation), Matched by English name (for checking), Missing HP and gender, Unparsed pages. `splice_report(existing: str, block: str) -> str` replaces the marked block or appends it after a blank line.

- [ ] **Step 1: Write the failing tests:** `test_normalise_unifies_quotes_dashes_and_space`, `test_report_lists_only_in_each_side`, `test_report_force_differs`, `test_report_skill_text_difference_after_normalisation_only` (a curly-quote-only difference is not reported, a real wording difference is), `test_report_lists_fallback_matches`, `test_report_lists_missing_hp`, `test_report_lists_unparsed_with_reason`, `test_splice_replaces_block_and_keeps_the_rest`, and in the card test file `test_card_report_rewrite_preserves_generals_block`.
- [ ] **Step 2: Run; expect failures.**
- [ ] **Step 3: Implement** the report builders; in `crawl-kingdom-wars-deck.py` `main`, read the existing `diff-vs-identity.md`, and when it holds a generals block, append that block unchanged after the freshly built card report.
- [ ] **Step 4: Wire `main` in the generals script** to write the block into `diff-vs-identity.md` via `splice_report` (create the file only if missing).
- [ ] **Step 5: Run the whole suite; expect pass.** Check with `git diff` that, after splicing into the real file, only the appended block is new.
- [ ] **Step 6: Commit** `feat(content): Generals section in the Kingdom Wars difference report`.

### Task 6: Live run and handover

**Files:**
- Create: `projects/content/data/decks/kingdom-wars/generals/**` (60 JSON files expected, minus any unparsed)
- Modify: `projects/content/data/decks/kingdom-wars/diff-vs-identity.md`

- [ ] **Step 1: Run** `python3 scripts/crawl-kingdom-wars-generals.py` against the live blog; expect a summary of 60 Generals (or a named list of unparsed pages, each explained).
- [ ] **Step 2: Check the data.** 15 Generals per force folder; every record has at least one skill and a source URL; exactly the unmatched Generals lack `maxHp`; `git diff` shows the card sections of the report unchanged.
- [ ] **Step 3: Re-run** and confirm `git status` shows no changes (determinism; `crawledAt` is the only field that may move, so run it the same day).
- [ ] **Step 4: Run** `python3 -m unittest discover -s scripts -p 'test_*.py'` and the repo's usual content tests (`npm test` for the content project, if present in `package.json`) to confirm nothing reads the new folder by accident.
- [ ] **Step 5: Commit** `feat(content): crawl the Kingdom Wars Generals` and report to the user: counts, the unmatched and fallback-matched lists, any unparsed pages, and the headline differences.
