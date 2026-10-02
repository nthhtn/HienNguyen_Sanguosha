# Side Navigation and Wiki Tabs — Design Spec

Status: Draft for review
Date: 2026-10-02
Revises: `2026-10-02-navigation-and-wiki-design.md`. The header menu
becomes a left side panel, and each Wiki page gains tabs. Everything in that
spec not changed here still holds: the routes, the `/play` guard, entries
built in content, badges, gap texts, and full entries.

## Purpose

1. **Left-side navigation.** Move Play Game and the Wiki links out of the
   header into a panel on the left.
2. **Tabs on every Wiki page**, one per category:
   - **Generals:** Wei · Shu · Wu · Heroes
   - **Basic Cards:** Sha · Shan · Wine · Peach
   - **Equipments:** Weapons · Armors · Plus Mount · Minus Mount
   - **Tools:** Instant · Delayed

Decisions settled with the user:
- **Wine is crawled.** It isn't a Base-set card (it comes from the *Army*
  expansion), so it becomes the first non-Base card in the data, badged "Not
  in the game yet".
- **"Heroes"** is the tab label for the Qun kingdom, matching the source
  site's faction name. Data and engine keep `'Qun'`.
- **"Instant" and "Delayed"** are the two Tools tabs (the user's "normal" and
  "timed").

## Navigation: left side panel

The app shell (`app.html`) becomes a Material `mat-sidenav-container`, with
the header toolbar above it:

```
┌──────────────────────────────────────────────┐
│ [☰]  🏰 Kingdom War                          │   ☰ only below 1024px
├──────────────┬───────────────────────────────┤
│ ▶ Play Game  │                               │
│ 📖 Wiki    ▾ │     (current page)            │
│    Generals  │                               │
│    Basic     │                               │
│    Equipments│                               │
│    Tools     │                               │
└──────────────┴───────────────────────────────┘
```

- **Wide screens (≥ 1024px):** the panel is `mode="side"`, always open, and
  240px wide. The page content sits to its right. There is no ☰ button.
- **Narrow screens (< 1024px):** the panel is `mode="over"` and closed by
  default. A ☰ button (`aria-label="Open navigation"`) at the left of the
  header opens it over the page. Choosing any link, or pressing Escape or
  the backdrop, closes it.
- **Breakpoint detection:** use the CDK `BreakpointObserver` with
  `(min-width: 1024px)`, exposed as a signal.
- **Contents:** a `mat-nav-list`.
  - **▶ Play Game** links to `/play`. As before, the guard sends you to
    `/game` when a game is in progress, otherwise to `/setup`.
  - **📖 Wiki** is a group header that expands to four indented links:
    Generals, Basic Cards, Equipments, Tools. It starts expanded, and
    toggling it is presentation state only.
  - **Current page:** the current link is highlighted and carries
    `aria-current="page"`. Play Game counts as current on `/setup` and
    `/game`.
- **Header:** keeps the castle and the "Kingdom War" title. The header menu
  buttons and their dropdown are removed.
- **The game board:** on wide screens it loses 240px of width. The table and
  seat tiles already scale between phone and desktop widths, and the live
  check confirms the board still fits at 1024px.
- **Indicator offset:** the phase indicator's sticky offset (it sits just
  below the header) is unchanged.

## Wiki tabs

Each Wiki page renders a Material `mat-tab-group` under its heading and
summary. Each tab holds that category's entries, using the existing
`WikiGeneralEntry` and `WikiCardEntry`.

| Page | Tabs (label → entries) |
|---|---|
| Generals | Wei → kingdom Wei · Shu → Shu · Wu → Wu · **Heroes** → kingdom Qun |
| Basic Cards | Sha → `sha` · Shan → `shan` · Wine → `wine` · Peach → `peach` |
| Equipments | Weapons → subtype weapon · Armors → subtype armor · Plus Mount → horses with `mount: 'plus'` · Minus Mount → horses with `mount: 'minus'` |
| Tools | Instant → tools without `delayed` · Delayed → tools with `delayed: true` |

- **Tab labels** show a count, for example "Weapons (8)". A tab with no
  entries still shows, with the text "Nothing here yet".
- **The tab is kept in the URL** as a query parameter, so Back, refresh and
  shared links land on the same tab:
  - Generals: `?tab=wei|shu|wu|heroes`
  - Basic: `?tab=sha|shan|wine|peach`
  - Equipments: `?tab=weapons|armors|plus-mount|minus-mount`
  - Tools: `?tab=instant|delayed`

  A missing or unknown value selects the first tab. Changing tabs updates
  the query parameter with `replaceUrl`, so the history doesn't fill with
  tab changes.
- **Which tab each entry belongs to is decided in content, not the app.**
  Each page asks content for its tabs, already split, and the app only
  renders them (see Content changes).
- **The page summary** stays as is ("15 cards · 1 in the game").
- **The kingdom section headings** on the Generals page are dropped, because
  tabs replace them. So are the subtype section headings on Equipments.

## Data changes

All new facts are recorded from a named source, never from memory, following
the content data pipeline spec's extraction discipline.

1. **Horses gain a mount direction.** Each of the 6 horse JSON files gets
   `"mount": "plus"` or `"mount": "minus"`. The source is the printed "+1" or
   "−1" on the card's own art, which the source site's Distance rules page
   says is where "the type of Horse is indicated". The values were read from
   the crawled images:
   - **plus:** di-lu, shadow-runner, storm-runner
   - **minus:** red-hare, da-yuan, zi-xing

   Each file's `source` gains `"mountFrom": "card art"`.
2. **Delayed Tools are marked.** `capture.json` and `lightning.json` gain
   `"delayed": true`. The source is the AllCards spreadsheet's `Type` column,
   "Delay Tool". Every other Tool's Type is "Tool", and gets no field.
3. **Wine** (`data/cards/basic/wine.json`):
   - `name`, `nameZh` and the main rules `text` come verbatim from the
     stripped text of
     `https://sites.google.com/site/englishsanguosha/expansions/original/army/wine`.
   - `printings` and `count` come from the AllCards spreadsheet's Wine row
     (Expansion "Army", Number 5: ♠3 ♠9 ♣3 ♣9 ♦9).
   - `source.url` is the page above, and `source` gains `"expansion": "Army"`.
   - Its art is fetched with `scripts/crawl-assets.py --only wine`.
   - Wine has no play logic, so the registry leaves it out, as for every
     data-only card.
4. **The data model** (`data/cards/index.ts`, `CardFileData`) gains three
   optional fields:
   - `mount?: 'plus' | 'minus'` (horses only);
   - `delayed?: true` (tools only);
   - `source.expansion?: string`.

   `cards/index.ts` imports `wine.json` as a basic card. This resolves the
   content data pipeline spec's open item 6 (delayed tricks are not
   distinguished) with a field rather than a folder, so no file moves and no
   asset path changes. That spec's open-items section is updated to say so.

## Content changes

`projects/content/src/lib/wiki.ts`:

```ts
export interface WikiCard {
  // ...unchanged fields...
  mount: 'plus' | 'minus' | null; // horses only
  delayed: boolean;               // tools only; false elsewhere
}

export interface WikiTab<T> { key: string; label: string; entries: T[] }

export function wikiGeneralTabs(): WikiTab<WikiGeneral>[];
export function wikiCardTabs(category: WikiCard['category']): WikiTab<WikiCard>[];
```

- `wikiGeneralTabs()` returns 4 tabs in the order Wei, Shu, Wu, Heroes, with
  keys `wei`, `shu`, `wu` and `heroes`. Entries come from `wikiGenerals()`,
  sorted by name.
- `wikiCardTabs('basic')` returns 4 tabs in the order Sha, Shan, Wine, Peach,
  with keys `sha`, `shan`, `wine` and `peach`. Each holds the card of that id.
  A basic card with no tab of its own (none today) goes in a trailing
  "Other" tab, so nothing is silently dropped.
- `wikiCardTabs('equipment')` returns the 4 tabs Weapons, Armors, Plus Mount
  and Minus Mount, keyed `weapons`, `armors`, `plus-mount` and `minus-mount`.
  - A horse with no `mount` goes in a trailing "Other mounts" tab.
  - A treasure goes in a trailing "Treasures" tab.
  - These trailing tabs appear only when they have entries.
- `wikiCardTabs('trick')` returns Instant and Delayed, keyed `instant` and
  `delayed`.
- `wikiGenerals()` and `wikiCards()` stay. The tab functions are built on
  them.

Counts the tests pin after this change:

| Page | Tab counts | In the game |
|---|---|---|
| Generals | Wei 7 · Shu 7 · Wu 8 · Heroes 4 | — |
| Basic | Sha 1 · Shan 1 · Wine 1 · Peach 1 (4 cards) | 3 (Wine is not) |
| Equipment | Weapons 8 · Armors 1 · Plus Mount 3 · Minus Mount 3 | — |
| Tools | Instant 10 · Delayed 2 | — |

## Testing

Content (Jest):
- **`wikiGeneralTabs()`:** keys, labels and counts as above. The Heroes tab
  holds kingdom-Qun generals only.
- **`wikiCardTabs()`:**
  - Basic: keys in order sha, shan, wine, peach; Wine is not in the game, and
    its printings are ♠3 ♠9 ♣3 ♣9 ♦9.
  - Equipment: Plus Mount holds di-lu, shadow-runner and storm-runner, and
    Minus Mount holds red-hare, da-yuan and zi-xing.
  - Tools: Delayed holds capture and lightning.
  - A synthetic horse with no `mount` lands in "Other mounts". Test this by
    exporting the pure tab-splitting helper and calling it directly, without
    adding fake data files.
- **`wikiCards()`:** `mount` and `delayed` are populated as in the data.

App (Jest):
- **Side panel:**
  - It renders Play Game (linking to `/play`) and the four Wiki links.
  - The current link has `aria-current="page"`.
  - Below 1024px, with a stubbed `BreakpointObserver`, the ☰ button exists,
    opens the panel, and choosing a link closes it.
  - At 1024px and above, there is no ☰ and the panel is open in side mode.
- **Wiki pages:** each page renders its tab labels with counts.
  - `?tab=minus-mount` opens on Minus Mount, showing 3 entries.
  - An unknown `?tab=` value opens the first tab.
  - Clicking a tab updates `tab` in the URL.
- **Existing tests:** the header-menu tests in `app.spec.ts` are replaced by
  the side-panel tests. The `/play` guard tests and the scroll-reset test
  stay unchanged.

Live check, at 1400px, 1024px, 800px and 360px:
- the panel's behaviour at each width;
- every tab of every page;
- a deep link to `?tab=delayed`;
- the game board still fitting beside the panel at 1024px;
- Play Game resuming a game in progress.

## Out of scope

- Fire Attack and Lightning Attack (Army's fire and thunder Sha), which
  would naturally join the Sha tab later.
- The horses' suit and rank, which are visible on their art but not
  recorded yet.
- Making Wine, horses or delayed Tools playable.
- Remembering whether the Wiki group is collapsed across reloads.
