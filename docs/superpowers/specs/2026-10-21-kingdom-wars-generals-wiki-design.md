# Kingdom Wars Generals in the Wiki (Design)

Date: 2026-10-21. Status: draft for review. Builds on the deck Wiki
(`2026-10-21-deck-wiki-design.md`) and the Kingdom Wars General data
(`2026-10-21-kingdom-wars-generals-crawl-design.md`, branch
`feat/kingdom-wars-generals-crawl`, which this work is stacked on).

## Intent and why

The Wiki has an **Kingdom Wars** menu whose **Generals** item is greyed out, and
`/wiki/kingdom-wars/generals` redirects to Identity Generals, because no Kingdom Wars
General data existed. The crawl now provides all 60 Guozhan Generals with
Kingdom, HP, Gender, skills (English text), Synergistic Partners and a
"Difference from Normal SanGuoSha" note. A reader should be able to open the
Kingdom Wars Generals page, read each General, and see for every skill whether the
game can play it.

## What changes

### Navigation and address

- In the **Kingdom Wars** menu, **Generals** becomes a normal link to
  `/wiki/kingdom-wars/generals`.
- That address opens the new page. The redirect to Identity Generals is removed.
  All other addresses and redirects stay as they are.

### The Kingdom Wars Generals page

Built in the content package (like `wikiGenerals`) and only rendered by the
Angular page (CLAUDE.md: no rules or status logic in components). It follows
Identity's Generals page: a heading, the deck line, a summary line, and tabs
**Wei, Shu, Wu, Qun** with the count in each tab label (my call: same layout as
Identity; within a Kingdom Generals sort by English name, since Kingdom Wars has no
Lords or packs).

Each General's entry shows:

- **Portrait.** The same art component Identity uses. A General whose id has art
  (the two Zhuge Liangs reuse Identity's) shows it; the nine Generals Identity
  lacks show the component's plain placeholder (decided by the user: placeholders
  for now, no portrait crawl).
- English name and Chinese name, title, Kingdom tag, Gender tag, HP hearts.
  Kingdom, HP and Gender are the saved values (from Identity or from
  `generals-manual.json`; nothing is guessed). No pack/expansion tag and no
  voice button (Kingdom Wars has neither concept).
- Every **skill**: English name, Chinese name when known, text, a skill tag (see
  below).
- The **Synergistic Partners**, as printed (name, Chinese name, relation).
- The **Difference note**. The blog compares to the standard Sanguosha game, not
  to this app's Identity deck, so the label must not say "Identity" (my call:
  wording like "Difference from the standard game", exact words to the builder
  within the UI text style).

Decided by the user: show Synergistic Partners and the Difference note on the
Kingdom Wars entries.

### Skill tag

Decided by the user: a **separate label** from Identity's Working, because the
game plays Identity's wording, not Kingdom Wars'. Two tags:

- **Works as Identity** (my wording, builder may refine): the General has a
  Identity counterpart and that counterpart has a skill that is not a Lord skill,
  that the game has code for, and that corresponds to this skill.
- **Not in game yet**: anything else, including every skill of a General with
  no Identity counterpart. Kingdom Wars skills are never Lord skills, so "Not used
  in Guozhan" does not occur here.

How a skill corresponds (my call, to be pinned by tests): the Identity
counterpart is the Identity General whose id the Kingdom Wars record carries (the
crawl sets the record id to Identity's id when matched, including the two
Zhuge Liangs through `generals-manual.json`). Within it, match by Chinese skill
name first, then by normalised English name, using the same "has code" test as
Identity (`GENERAL_SKILLS` through `skillStatus`). The tag says nothing about
whether the wording is the same; it only says what the game does.

A test must list, by General and skill name, every Kingdom Wars skill that is "Not
in game yet" and pin the expected set, so a data change cannot silently flip a
tag. The builder derives the expected set from the real data and shows it in the
test; the user reviews it.

Per-General badge: Identity's entries have "skills in game". Kingdom Wars entries do
not get that badge (my call; it would read as "this General fully works" when
the wording differs). The page's summary line instead counts the Generals whose
skills are all "Works as Identity" (my call on wording, so it cannot read as "fully
working": for example "N of 60 Generals have every skill running Identity's
version"; the exact words are the builder's).

### Vietnamese

Decided by the user: translate **names and titles, skill names and texts,
Difference notes, and Synergistic Partners** (partner names and relation words).

- A new draft file `projects/content/data/locales/vi/kingdom-wars-generals.json`,
  keyed by the Kingdom Wars General's id, beside `kingdom-wars-cards.json`. The
  Kingdom Wars General's Vietnamese must come from this file even when Identity has a
  Vietnamese entry for the same id: the wording differs, and Identity's
  translation would describe different rules.
- Names and titles follow the existing Vietnamese glossary and conventions
  (`glossary.json`; General names capitalised word by word, skill names in
  sentence case). A General Identity also has should reuse Identity's Vietnamese
  name and title unless the Kingdom Wars title differs (some blog titles are not
  Identity's).
- Skill translations are paired to skills in a way a rename cannot silently
  break (builder's choice of key; a test fails when a skill has no translation or
  an extra one exists, as for Identity).
- Per CLAUDE.md: new Vietnamese text is a **draft**, `review.json` is not
  touched, and `npm run i18n:status` must report these as draft the way it does
  for the existing Kingdom Wars card translations (the builder checks how that
  script treats `kingdom-wars-cards.json` and does the same).
- New UI labels (the skill tag, the Difference label, the partners label, the
  summary line) get keys in both catalogs (an existing test checks the key sets
  match), English Title Case or sentence case per CLAUDE.md "UI text style",
  Vietnamese sentence case.
- English remains the fallback for any missing piece, as everywhere else.

## Calls made by the design author (not by the user; check these)

- **The tag is code-only.** "Works as Identity" means the game has code for the
  Identity counterpart skill, nothing more. It does not say the Kingdom Wars wording
  matches; many Difference notes show it does not, and the Difference note on
  each entry is where the reader sees that. There is no "wording differs"
  marker in this step.
- **Matching edge cases.** Each Kingdom Wars skill is matched on its own: two
  Kingdom Wars skills may share one Identity counterpart. A match to an Identity skill
  that is a Lord skill counts as no match ("Not in game yet"). A skill with no
  Chinese name is matched by normalised English name only.
- **Vietnamese keys.** A skill's Vietnamese entry is keyed by the skill id the
  game derives from the Kingdom Wars English name (`skillIdFromName`), which is
  unique inside a General; a test fails on a missing or extra skill entry, as for
  Identity.
- **Vietnamese coverage.** Full coverage is part of this change: all 60 Generals,
  every field the user listed, written as drafts by the implementer. The
  coverage test requires it. English remains the runtime fallback for anything
  later added.
- **Partners in Vietnamese.** Each partner entry is translated as a whole
  string, in the same order as the English list; no parser is needed. A test
  checks the two lists have equal length.
- **Lookup key.** The page looks up art, the Identity counterpart and the Identity
  Vietnamese name by the Kingdom Wars record's `id`. The crawl already sets that id
  to Identity's id when matched, including Elder and Younger Zhuge Liang through
  `generals-manual.json` (`zhuge-liang`, `fire-zhuge-liang`). The Kingdom Wars
  Vietnamese entry, keyed by the same id, always wins over Identity's for the
  Kingdom Wars page.

## Goals, non-goals, anti-goals

Goals: a working Kingdom Wars Generals page with honest per-skill status; the
Wiki's nav and address enabled; Vietnamese drafts for everything the user
listed.

Non-goals: playing Kingdom Wars Generals in a game (the engine, setup and server
stay untouched); portraits for the nine new Generals; comparing Kingdom Wars and
Identity skill effects; Chinese text for Kingdom Wars skills (the blog gives
English); changing the crawl, its data or `generals-manual.json`; changing
Identity's Generals page or its tests.

Anti-goals: showing a Kingdom Wars skill as plain "Working"; any Wiki component
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
  builder's call; Identity's `data/generals/index.ts` shows one way).
- Identity Wiki content and every existing test pass unchanged, except the one
  test that pins the `/wiki/kingdom-wars/generals` redirect and the nav tests that
  pin Generals as disabled; those change deliberately.
- Existing deep links and redirects are not broken.

## Left to the builder

The names of the new content functions and types (for example a
`wikiKingdomWarsGenerals` beside `wikiGenerals`, and how the page and entry
components share or split with Identity's); the visual design of the new tags and
sections; the Vietnamese key scheme for skills and partners; the exact English
and Vietnamese UI wording within the style rules; whether Kingdom Wars' partner
list is shown as raw strings or parsed.

## Open for later (not this step)

Portraits for the nine new Generals; whether Kingdom Wars gets its own General
rules in the engine; reviewing the Vietnamese drafts with a native speaker.
