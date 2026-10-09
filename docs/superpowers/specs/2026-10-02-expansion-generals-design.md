# Expansion Generals (Wind, Fire, Forest, Mountain) — Design Spec

Status: Draft for review
Date: 2026-10-02
Extends: `2026-09-09-content-data-pipeline-design.md` (crawl process,
extraction discipline, data model), `2026-10-02-side-nav-and-wiki-tabs-design.md`
(Wiki tabs).

## Purpose

Crawl the generals of the four classic expansions (Wind, Fire, Forest and
Mountain) for the four kingdoms, and make them part of the game and the Wiki.
The user named the source pages:

- Wei: https://sites.google.com/site/englishsanguosha/generals/wei
- Shu: https://sites.google.com/site/englishsanguosha/generals/shu
- Wu: https://sites.google.com/site/englishsanguosha/generals/wu
- Qun: https://sites.google.com/site/englishsanguosha/generals/hero (the
  site's "Hero" faction)

Decisions settled with the user:
- **Playable right away.** Like the Base generals, every new general is dealt
  in games, skill-less until its skills are coded (the existing rule: a
  general with data but no hand-coded skills is a vanilla general).
- **The God faction is not touched.** Its 8 generals in these expansions are
  not crawled, and nothing about God generals changes.
- **Dong Zhuo:** the placeholder is replaced by the real Forest data, and the
  invented "Tyranny" skill code is removed.
- **Seat cap of 10:** `min(10, pool ÷ 5)`.
- **The Wiki's "Heroes" tab is renamed "Qun".**

## The 32 generals

These are the entries tagged (Wind), (Fire), (Forest) or (Mountain) on the
four faction pages. They are exactly the AllGenerals spreadsheet's
Wind/Fire/Forest/Mountain rows that are not in the God faction.

| Kingdom | Wind | Fire | Forest | Mountain |
|---|---|---|---|---|
| Wei (8) | Xiahou Yuan, Cao Ren | Dian Wei, Xun Yu | Xu Huang, Cao Pi | Zhang He, Deng Ai |
| Shu (8) | Huang Zhong, Wei Yan | Pang Tong, Zhuge Liang | Meng Huo, Zhu Rong | Jiang Wei, Liu Shan |
| Wu (7) | Xiao Qiao, Zhou Tai | Taishi Ci | Sun Jian, Lu Su | Sun Ce, Zhang Zhao and Zhang Hong |
| Qun (9) | Zhang Jiao, Yu Ji | Yuan Shao, Yan Liang and Wen Chou, Pang De | Dong Zhuo, Jia Xu | Zuo Ci, Cai Wenji |

Each general's page is
`https://sites.google.com/site/englishsanguosha/expansions/original/<expansion>/<expansion>-<slug>`,
for example `.../wind/wind-xiahou-yuan`, as linked from the faction pages.

## Crawl process

This follows the content data pipeline spec's extraction discipline: use the
spreadsheet first, then stripped page text, and never guess.

1. **Kingdom and HP** come from the AllGenerals spreadsheet (id
   `1TpJgrXqAixnPKwR9oWuEgY3FnMNCtVImLQ5rDpYmRYY`, CSV export): `Alignment`
   gives the kingdom (Hero → Qun) and `Health` gives the HP. All 32 rows have
   a Health value.
2. **Names, title and skills** come from each general's page, fetched and
   stripped to plain text. Every page has the same structure:
   - the general's name line;
   - `<Name> <中文名>`, which gives `name` and `nameZh`;
   - `<Title> <中文称号>`, which gives `title` and `titleZh`;
   - one block per skill: a heading line `<Skill name> <中文>` (an English
     name followed by Chinese characters), then its rules text;
   - the first `Clarification` line, which ends the skills.

   A skill's text is every line between its heading and the next heading or
   `Clarification`, joined with single spaces and kept verbatim (typos
   included). The lines after `Clarification` (strengths, weaknesses and so
   on) are not data.
3. **Anything a page doesn't show** (a missing Chinese name or title) is left
   out of the file, never filled in from memory. Any page whose text doesn't
   fit the structure above is reported and transcribed by hand from its
   stripped text, not guessed.
4. **Supervision:** the extraction is scripted. Every one of the 32 extracted
   records is then read against its stripped page text before it's written,
   and the check is recorded in the implementation ledger.
5. **Art** comes from `scripts/crawl-assets.py`, which picks up every new data
   file that has a `source.url`. A page with no single content image is
   skipped with a warning, as the script already does, and the general keeps
   the labelled placeholder.

## Data

- **Files:** one JSON file per general, at
  `projects/content/data/generals/<kingdom>/<id>.json` (`qun/` for the Hero
  faction), in the same `GeneralFileData` shape as the Base generals.
- **Expansion field:** `source` gains `expansion: 'Wind' | 'Fire' | 'Forest' |
  'Mountain'`. Base generals have no `expansion` field, and the Wiki reads a
  missing value as "Base". `GeneralFileData.source` gains
  `expansion?: string`, matching the card files (Wine).
- **Ids:** the kebab-cased name, for example `xiahou-yuan`, `cai-wenji`,
  `yan-liang-and-wen-chou` and `zhang-zhao-and-zhang-hong`. An id already
  taken by a Base general gets its expansion as a prefix. Today that is only
  `fire-zhuge-liang`, since Base `zhuge-liang` exists. Its `name` stays
  "Zhuge Liang"; its title ("Sleeping Dragon") and expansion tell the two
  apart.
- **Dong Zhuo:** `qun/dong-zhuo.json` keeps its id, but its contents are
  replaced by the Forest crawl (HP 8 from the spreadsheet, real skills,
  `expansion: 'Forest'`). This resolves the content data pipeline spec's open
  item about Dong Zhuo's arbitrary `maxHp: 4`, and that spec's open items are
  updated to say so.
- **`generals/index.ts`** imports all 31 new files plus the replaced Dong Zhuo
  file and assigns kingdoms by folder, as today.

## Game changes

- **Pool:** the registry builds every general with data, so the pool becomes
  **57**. That's 26 Base generals plus 32 new ones, less one, because the
  Forest Dong Zhuo replaces the placeholder.
- **Seat cap:** `kingdomWarMaxSeats` becomes
  `Math.min(MAX_KINGDOM_WAR_SEATS, Math.floor(pool / GENERALS_PER_SEAT))`,
  with `MAX_KINGDOM_WAR_SEATS = 10`. Today that gives 10, and Setup offers 2
  to 10 seats.
- **Dong Zhuo's Tyranny:**
  - The `dongZhuoGeneral` skill set in `projects/content/src/lib/generals/setTwo.ts`
    is removed, along with its entry in `HAND_CODED`
    (`generals/index.ts`) and its tests in `setTwo.spec.ts`.
  - `GENERAL_SKILLS` then holds 5 generals: xiahou-dun, sun-shangxiang,
    zhuge-liang, zhao-yun and huang-yueying.
  - Any other test that uses Dong Zhuo only as a carrier for Tyranny is
    updated or removed, and named in its commit.
- **The table at 10 seats:** seats are placed on an ellipse by count
  (`table-layout.ts`) and accept any number. The live check confirms that 10
  seat tiles fit at 1400, 1024 and 360px without overlapping each other or
  leaving the screen. If they don't, the round table scales tiles down
  further when there are more than 6 seats, using a seat-count class on the
  table. That fix belongs to this work.

- **The deck grows with the table** (added during implementation). Kingdom
  War deals 4 cards to every seat from a deck of 4 copies of each playable
  card, which is 28 cards today. A 10-seat table needs 40 at setup, so three
  seats were dealt nothing and the draw pile started empty. The deck now has
  `4 × ceil(seats ÷ 5)` copies of each card: 28 cards for 2–5 seats (exactly
  as before, suits and ranks included) and 56 for 6–10 seats.
  - Open item: replace this stopgap with the real per-card counts the card
    data already records (`count` / `printings`), once deck composition is
    designed.
- **Crowded tables** (more than 6 seats) shrink every seat tile further: by
  0.75, or 0.7 at phone width. The factor multiplies into each width step's
  own scale, so tiles stay centred on their rim points.

## Wiki changes

- **Generals tabs:** the keys and labels become `wei` Wei · `shu` Shu · `wu`
  Wu · `qun` **Qun** (the `heroes` key and the "Heroes" label are gone).
  Counts: Wei 15 · Shu 15 · Wu 15 · Qun 12.
- **`WikiGeneral` gains `expansion`:** `'Base' | 'Wind' | 'Fire' | 'Forest' |
  'Mountain'`, read from `source.expansion` and defaulting to `'Base'`.
- **`WikiGeneralEntry`** shows the expansion as a small chip beside the
  kingdom chip.
- **Summary:** "57 generals · 5 with skills in the game".

## Testing

Content (Jest):
- **`wikiGenerals()`:**
  - 57 entries; 5 with `skillsInGame` (the ids above);
  - the expansion counts are Base 25 (26 Base generals less the placeholder
    Dong Zhuo), Wind 8, Fire 8, Forest 8, Mountain 8;
  - `fire-zhuge-liang` is Shu, Fire, titled "Sleeping Dragon";
  - `dong-zhuo` is Qun, Forest, maxHp 8;
  - Xiahou Yuan carries the skill "Godspeed" / 神速.
- **`wikiGeneralTabs()`:** `wei` 15, `shu` 15, `wu` 15, `qun` 12.
- **The registry:** 57 generals, all with a numeric `maxHp`, and none from
  the God faction (no file outside the four kingdom folders).
- **`kingdomWarMaxSeats`:** 10. There's also a unit test showing it is
  `min(10, pool ÷ 5)` on a small synthetic registry.
- **Updated tests:** anything that hard-codes 26 generals, 6 coded generals,
  a 5-seat cap, the Heroes tab, or a deal that depends on the old pool (for
  example a fixed seed's all-Wu table) gets updated, and each is named in its
  commit.

Sim: the property test covers every table size from 2 to 10. It is checked
against its time budget, and the budget is raised if needed and noted.

App: the Setup seat options run 2 to 10, and the Generals page shows the Qun
tab and expansion chips.

Live check:
- a 10-seat vs-bots game at 1400, 1024 and 360px, with tiles that don't
  overlap and stay on screen;
- the Generals Wiki tabs with expansion chips and the new art.

## Out of scope

- The God faction, including its 8 generals in these expansions.
- Coding any new general's skills.
- Expansion cards beyond Wine, which already exists.
- Other expansions (EX, SP, OKF, and so on).
