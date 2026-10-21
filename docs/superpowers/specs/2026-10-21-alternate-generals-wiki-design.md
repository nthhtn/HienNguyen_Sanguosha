# Alternate Generals in the Wiki (Design)

Date: 2026-10-21. Status: draft for review. Builds on the deck Wiki
(`2026-10-21-deck-wiki-design.md`) and the Alternate General data
(`2026-10-21-alternate-generals-crawl-design.md`, branch
`feat/alternate-generals-crawl`, which this work is stacked on).

## Intent and why

The Wiki has an **Alternate** menu whose **Generals** item is greyed out, and
`/wiki/alternate/generals` redirects to Default Generals, because no Alternate
General data existed. The crawl now provides all 60 Kingdom War Generals with
Kingdom, HP, Gender, skills (English text), Synergistic Partners and a
"Difference from Normal SanGuoSha" note. A reader should be able to open the
Alternate Generals page, read each General, and see for every skill whether the
game can play it.

## What changes

### Navigation and address

- In the **Alternate** menu, **Generals** becomes a normal link to
  `/wiki/alternate/generals`.
- That address opens the new page. The redirect to Default Generals is removed.
  All other addresses and redirects stay as they are.

### The Alternate Generals page

Built in the content package (like `wikiGenerals`) and only rendered by the
Angular page (CLAUDE.md: no rules or status logic in components). It follows
Default's Generals page: a heading, the deck line, a summary line, and tabs
**Wei, Shu, Wu, Qun** with the count in each tab label (my call: same layout as
Default; within a Kingdom Generals sort by English name, since Alternate has no
Lords or packs).

Each General's entry shows:

- **Portrait.** The same art component Default uses. A General whose id has art
  (the two Zhuge Liangs reuse Default's) shows it; the nine Generals Default
  lacks show the component's plain placeholder (decided by the user: placeholders
  for now, no portrait crawl).
- English name and Chinese name, title, Kingdom tag, Gender tag, HP hearts.
  Kingdom, HP and Gender are the saved values (from Default or from
  `generals-manual.json`; nothing is guessed). No pack/expansion tag and no
  voice button (Alternate has neither concept).
- Every **skill**: English name, Chinese name when known, text, a skill tag (see
  below).
- The **Synergistic Partners**, as printed (name, Chinese name, relation).
- The **Difference note**. The blog compares to the standard Sanguosha game, not
  to this app's Default deck, so the label must not say "Default" (my call:
  wording like "Difference from the standard game", exact words to the builder
  within the UI text style).

Decided by the user: show Synergistic Partners and the Difference note on the
Alternate entries.

### Skill tag

Decided by the user: a **separate label** from Default's Working, because the
game plays Default's wording, not Alternate's. Two tags:

- **Works as Default** (my wording, builder may refine): the General has a
  Default counterpart and that counterpart has a skill that is not a Lord skill,
  that the game has code for, and that corresponds to this skill.
- **Not in game yet**: anything else, including every skill of a General with
  no Default counterpart. Alternate skills are never Lord skills, so "Not used
  in Kingdom War" does not occur here.

How a skill corresponds (my call, to be pinned by tests): the Default
counterpart is the Default General whose id the Alternate record carries (the
crawl sets the record id to Default's id when matched, including the two
Zhuge Liangs through `generals-manual.json`). Within it, match by Chinese skill
name first, then by normalised English name, using the same "has code" test as
Default (`GENERAL_SKILLS` through `skillStatus`). The tag says nothing about
whether the wording is the same; it only says what the game does.

A test must list, by General and skill name, every Alternate skill that is "Not
in game yet" and pin the expected set, so a data change cannot silently flip a
tag. The builder derives the expected set from the real data and shows it in the
test; the user reviews it.

Per-General badge: Default's entries have "skills in game". Alternate entries do
not get that badge (my call; it would read as "this General fully works" when
the wording differs). The page's summary line instead counts the Generals whose
skills are all "Works as Default" (my call on wording, so it cannot read as "fully
working": for example "N of 60 Generals have every skill running Default's
version"; the exact words are the builder's).

### Vietnamese

Decided by the user: translate **names and titles, skill names and texts,
Difference notes, and Synergistic Partners** (partner names and relation words).

- A new draft file `projects/content/data/locales/vi/alternate-generals.json`,
  keyed by the Alternate General's id, beside `alternate-cards.json`. The
  Alternate General's Vietnamese must come from this file even when Default has a
  Vietnamese entry for the same id: the wording differs, and Default's
  translation would describe different rules.
- Names and titles follow the existing Vietnamese glossary and conventions
  (`glossary.json`; General names capitalised word by word, skill names in
  sentence case). A General Default also has should reuse Default's Vietnamese
  name and title unless the Alternate title differs (some blog titles are not
  Default's).
- Skill translations are paired to skills in a way a rename cannot silently
  break (builder's choice of key; a test fails when a skill has no translation or
  an extra one exists, as for Default).
- Per CLAUDE.md: new Vietnamese text is a **draft**, `review.json` is not
  touched, and `npm run i18n:status` must report these as draft the way it does
  for the existing Alternate card translations (the builder checks how that
  script treats `alternate-cards.json` and does the same).
- New UI labels (the skill tag, the Difference label, the partners label, the
  summary line) get keys in both catalogs (an existing test checks the key sets
  match), English Title Case or sentence case per CLAUDE.md "UI text style",
  Vietnamese sentence case.
- English remains the fallback for any missing piece, as everywhere else.

## Calls made by the design author (not by the user; check these)

- **The tag is code-only.** "Works as Default" means the game has code for the
  Default counterpart skill, nothing more. It does not say the Alternate wording
  matches; many Difference notes show it does not, and the Difference note on
  each entry is where the reader sees that. There is no "wording differs"
  marker in this step.
- **Matching edge cases.** Each Alternate skill is matched on its own: two
  Alternate skills may share one Default counterpart. A match to a Default skill
  that is a Lord skill counts as no match ("Not in game yet"). A skill with no
  Chinese name is matched by normalised English name only.
- **Vietnamese keys.** A skill's Vietnamese entry is keyed by the skill id the
  game derives from the Alternate English name (`skillIdFromName`), which is
  unique inside a General; a test fails on a missing or extra skill entry, as for
  Default.
- **Vietnamese coverage.** Full coverage is part of this change: all 60 Generals,
  every field the user listed, written as drafts by the implementer. The
  coverage test requires it. English remains the runtime fallback for anything
  later added.
- **Partners in Vietnamese.** Each partner entry is translated as a whole
  string, in the same order as the English list; no parser is needed. A test
  checks the two lists have equal length.
- **Lookup key.** The page looks up art, the Default counterpart and the Default
  Vietnamese name by the Alternate record's `id`. The crawl already sets that id
  to Default's id when matched, including Elder and Younger Zhuge Liang through
  `generals-manual.json` (`zhuge-liang`, `fire-zhuge-liang`). The Alternate
  Vietnamese entry, keyed by the same id, always wins over Default's for the
  Alternate page.

## Goals, non-goals, anti-goals

Goals: a working Alternate Generals page with honest per-skill status; the
Wiki's nav and address enabled; Vietnamese drafts for everything the user
listed.

Non-goals: playing Alternate Generals in a game (the engine, setup and server
stay untouched); portraits for the nine new Generals; comparing Alternate and
Default skill effects; Chinese text for Alternate skills (the blog gives
English); changing the crawl, its data or `generals-manual.json`; changing
Default's Generals page or its tests.

Anti-goals: showing an Alternate skill as plain "Working"; any Wiki component
holding rules or status logic; inventing HP, Gender, Kingdom, titles or
translations the data or the user did not supply; Vietnamese text marked as
reviewed.

## Constraints

- CLAUDE.md applies: layering, "UI text style" (English Title Case for names and
  short labels, sentence case for sentences; Vietnamese sentence case), Angular
  signals and standalone components, ids never shown raw (show "Wei", not
  `wei`).
- The content package must load the 60 General files without a runtime
  directory scan, in a way that works under the app build and jest (how: the
  builder's call; Default's `data/generals/index.ts` shows one way).
- Default Wiki content and every existing test pass unchanged, except the one
  test that pins the `/wiki/alternate/generals` redirect and the nav tests that
  pin Generals as disabled; those change deliberately.
- Existing deep links and redirects are not broken.

## Left to the builder

The names of the new content functions and types (for example a
`wikiAlternateGenerals` beside `wikiGenerals`, and how the page and entry
components share or split with Default's); the visual design of the new tags and
sections; the Vietnamese key scheme for skills and partners; the exact English
and Vietnamese UI wording within the style rules; whether Alternate's partner
list is shown as raw strings or parsed.

## Open for later (not this step)

Portraits for the nine new Generals; whether Alternate gets its own General
rules in the engine; reviewing the Vietnamese drafts with a native speaker.
