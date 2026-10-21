# Alternate Deck — Card Data Crawl (Design)

Date: 2026-10-20. Status: draft for review.

## Intent and why

The game will offer a second card set, **Alternate**, next to the current one,
**Default**. It is a different set of cards to play with, chosen later in game
setup (setup will gain more modes over time, so "deck" is one choice among
several). Alternate's cards are dealt differently from Default's: a card with
the same name can have different suits, ranks and copies. A few cards may also
have different effects, and some Generals will later get alternate skill
effects.

This first step only gathers Alternate's card data from one source page and
stores it in the repo. It does not make the game use it.

Source: https://zhangshenxing.github.io/LTKGeneralList (Chinese, static HTML,
"last updated 2020/10/21"; the plain URL answers with a 301 redirect, so the
crawler must follow redirects). The page lists every card once, with a
separate distribution (suit and rank list) per edition, plus effect text and,
for equipment, the attack range.

## What Alternate contains in this step

The **Kingdom War base set (国战)**: the page says 108 cards, made of Basic,
Tool and Equipment cards (Weapon, Armor, Mount). That is the whole scope.

Seen on the page (names are Default's English names where Default has the
card; `*` = Default does not have it yet, name is a working translation):

- Basic (6): Slash, Fire Attack (火杀), Lightning Attack (雷杀), Dodge, Peach, Wine
- Tool (19): Lightning, Capture (乐不思蜀), Starvation, Break, Steal, Duel,
  Coerce, Draw Two, Wuxie, Wuxie 国\*, Hail of Arrows, Barbarians, Peach
  Garden, Harvest, Chains, Blaze (火攻), Amass\* (以逸待劳), Ascertain\* (知己知彼), Ally Far Attack Near\* (远交近攻)
- Equipment (20): Crossbow, Black Pommel, Gender Swords, Ice Sword, Axe,
  Serpent Spear, Fire Fan, Longbow, Wu Six Swords\*, Trident Glaive\*,
  Eight Trigrams, Black Shield, Silver Lion, Wood Armor, and six Mounts
  (Shadow Runner, Storm Runner, Di Lu, Da Yuan, Red Hare, Zi Xing)

Edition tags on the page that are **out of scope** and must not leak into the
Alternate data: 标准 (Standard), EX, 军争 (Military Contest), 势备, 君临天下,
阵, 势, 权, 变, 界限突破, 逐鹿天下, 用间, and the 4 Ambitious special cards
(野心家), which the page mentions but does not tabulate. Generals are also out
of scope. The user decided to leave the 势备 and 君临天下 expansions alone for
now; the crawler should be written so another edition can be added later by
naming it, not by rewriting the parser.

Fire Attack, Lightning Attack, Wine, Chains and Blaze are crawled like any
other card. Default currently keeps elemental cards out of play (the
all-cards-and-skills roadmap decision); whether Alternate plays them is a
later decision. The crawl records them without judging.

## Deliverables

1. A reusable crawl script in `scripts/` (Python, standard library only,
   matching the style of `scripts/crawl-assets.py`) that fetches the page,
   parses the card table and writes the Alternate card data.
2. The crawled data, committed, in a new per-deck location under
   `projects/content/data/` that sits beside the existing `cards/` data and
   does not touch it. Default's data and every existing test are unchanged.
3. A **difference report** comparing Alternate against Default. It lists, and
   does not resolve: cards only in one deck; copies, suits or ranks that
   differ; effect or range text that differs. The user will decide what to do
   about differences later.
4. Tests for the parser against a small saved excerpt of the page.

## Data shape (what each card record must carry)

- the Chinese name (`nameZh`) exactly as printed, and the category (Basic,
  Tool, Equipment) and for equipment the subtype (Weapon, Armor, Mount)
- the printings: one entry per physical card, `{suit, rank}`, with suits
  `spade | heart | club | diamond` and ranks 1–13 as Default already stores
  them (A = 1, J = 11, Q = 12, K = 13); `count` equals the number of
  printings
- the effect text as printed (Chinese)
- for equipment, the range or distance (a number for weapon attack range;
  how mounts are expressed is for the builder)
- the Default card id it corresponds to, matched through `nameZh`, or null
  when Default has no such card
- a source block (url, crawl date), like Default's cards carry

Each deck is identified by a name (`default`, `alternate`) so the structure
can hold more decks and later per-deck General skill variants. Default's
existing data stays where it is; it is not migrated in this step.

English names and English effect text are not part of this step. Cards that
Default does not have are identified by `nameZh` until someone names them.

## Parsing facts the builder must handle

These come from reading the page's HTML:

- One table (`#cardtable`). Rows are grouped under category header rows
  (基本牌 / 锦囊牌 / 装备牌).
- A card's name cell uses `rowspan`; one card spans several rows, one per
  edition, each ending with an edition tag cell (`国战`, `标准`, …).
- Effect text sits either in its own full-width row or inside the
  distribution cell after a line break, and in equipment rows some
  distribution cells are shared across editions through `rowspan`. A naive
  row-by-row parse picked up wrong suits for these, so they need care.
- Distribution strings look like `黑桃5/7/8/8/9/10/J，梅花2/3/…`: a suit
  name followed by `/`-separated ranks, `，` or `、` between suits; red suits
  sit inside `<span class="red">`. Ranks are digits or A, J, Q, K. A repeated
  rank means that many copies.
- Some strings carry a `(连)` marker, and some give only totals such as
  `4黑2红` (those are the 逐鹿天下 edition, out of scope). Do not guess a
  suit or rank the page does not give.
- The equipment section abbreviates some edition tags (for example 军 for
  军争), so edition must be matched by what the tag means, not only by its
  exact text.
- Two Wuxie cards exist in 国战: 无懈可击 and 无懈可击•国.

## Checks the crawl must pass

- The total number of Alternate printings is 108, matching the page's own
  statement. If it differs, the crawl reports the mismatch and does not
  silently continue.
- Every card has at least one printing; every printing has a valid suit and
  rank.
- Never guess: a card whose row cannot be parsed is reported by name and
  skipped, as `crawl-assets.py` does.

## Goals, non-goals, anti-goals

Goals: Alternate's Kingdom War base data is in the repo, reproducible by
running one script; the differences from Default are visible.

Non-goals (all later steps): making Alternate cards playable, a deck choice in
game setup, new card behaviours (each needs its rule text written first, per
CLAUDE.md), Generals and their alternate skills, English text and Vietnamese
text, resolving any difference, the expansions listed above.

Anti-goals: changing Default's data, ids, deck or tests; the game quietly
reading Alternate data; guessing values the page does not state.

## Constraints

CLAUDE.md applies: the data lives in the content layer, not the engine; the
engine knows nothing of Alternate yet.

## Decided by the user

- Alternate is a separate playable card set, selected in game setup later.
- Source is the page above; start with playing cards, equipment and tools.
- Edition: the Kingdom War base set only (108 cards); the 势备 and 君临天下
  expansions (阵, 势, 权, 变) are left alone for now.
- Distribution differences between decks are expected; effect differences are
  only listed now and decided later.

## My calls (not yet agreed, please check)

- Chinese text only in this step; English names for new cards come later.
- Default's observed distribution: its Slash has 30 copies, which matches the
  page's 标准 list, not 国战 (about 21). So the report will show many
  distribution differences by design. Only Slash was checked.
- The raw page is not committed (313 KB, can change); the parser is tested on
  a small excerpt, and the data records the crawl date.
- Python script with standard library only, to match existing scripts.

## Answers from the project and the page (reviewer questions)

- **Default's data format:** JSON, one file per card under
  `projects/content/data/cards/{basic,tool,equipment/<subtype>}/<id>.json`,
  pulled in by `data/cards/index.ts`. Fields: `name`, `nameZh` (absent on
  Slash, Dodge and Peach), `count`, `printings[{rank, suit}]`, `range` (a
  number, on equipment), `text` (English), `source`. Alternate data is JSON in
  the same field conventions (`range` as a number, same suit and rank
  encoding), in its own folder, and is **not** added to `index.ts` or loaded
  by anything. A Python script can read Default's JSON directly, so the
  difference report is generated by the same script.
- **Match key:** `nameZh`. Default has Fire Attack (火杀) and Lightning Attack
  (雷杀) as their own cards, and one Wuxie (无懈可击). Default's Slash, Dodge
  and Peach have no `nameZh`, so the script carries a small hand-kept table
  for just those three (杀, 闪, 桃); Default's data is not edited. Alternate's
  second Wuxie (无懈可击•国) has no Default match (null) and is listed as
  only in Alternate.
- **Shared distribution cells:** when one distribution cell spans several
  edition rows (for example Black Pommel: `rowspan=2` covering 标准 and
  国战), each of those editions has exactly those printings. They are not a
  combined list.
- **Effect text in the report:** Default's text is English and Alternate's is
  Chinese, so they cannot be compared. The report lists effect text as
  "not compared yet" for matched cards and only compares copies, suits, ranks
  and range.

## More calls of mine

- **Failure behaviour:** the script always writes the parsed data and a list
  of skipped cards, then exits non-zero if any card was skipped or the total
  is not 108. The 108 is the sum of 国战 printings over all cards, both Wuxie
  cards included. A card that appears in several editions counts only once
  per edition, and only its 国战 printings are used.
- **Offline use:** the script takes an optional `--file` so tests and reruns
  need no network.
- **Reruns:** the data records the crawl date; rerunning on the same page
  must change nothing but that date.
- **Adding an edition later:** a command-line option naming the edition. The
  exact flag is the builder's choice. `source` is recorded per card, as
  Default does.

## As built (2026-10-21)

- Crawler: `scripts/crawl-alternate-deck.py` (`--file` for a saved copy,
  `--edition <css class>` for another edition). Tests:
  `scripts/test_crawl_alternate_deck.py` against
  `scripts/fixtures/ltk-cards-excerpt.html`
  (`python3 -m unittest discover -s scripts -p 'test_*.py'`).
- Data, in `projects/content/data/decks/alternate/`, kept apart from the
  crawler and from each other: `cards.json` (identity, category, printings,
  range or mount, Default match), `texts.zh.json` (printed effect text by
  Chinese name) and `diff-vs-default.md`.
- The page prints no effect text for Slash, Fire Attack and Lightning
  Attack, so those have no entry in `texts.zh.json`; the script notes it and
  does not guess.
- Mounts use Default's field: `"mount": "offensive" | "defensive"`.

## Deck structure (engine reuse)

A card is its behaviour (a definition in the content registry, by id) plus its
data (name, text, range, mount). A **deck** is only a distribution:
`{ id, entries: [{ cardId, printings: [{ suit, rank }] }] }`. It holds no text,
range or behaviour.

- Default's deck is built from the existing card data; nothing is migrated.
- Alternate's deck is `data/decks/alternate/deck.json`, written by the crawler.
- `data/decks/alternate/ids.json` is the one hand-kept file: the id and English
  name for each card Default does not have (`{ "<nameZh>": { "id", "name" } }`).
  The crawler fails on a card that has neither a Default match nor an entry.
- The game picks a deck with `GameRules.deck` (absent means Default). An entry
  whose card has no definition yet is left out of the deal.
- A card whose effect differs between decks gets its own id and behaviour (for
  example `wuxie-guo`); no behaviour ever checks which deck it is in.
- Adding a card to Alternate: (1) an `ids.json` line, (2) the card's data file,
  (3) its behaviour file plus one registry line.

## Left to the builder

File and folder names, the exact JSON shape beyond the fields above, how
mount distance is expressed, the report format, how the script is invoked.
