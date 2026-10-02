# Navigation Menu and Wiki — Design Spec

Status: Draft for review
Date: 2026-10-02

## Purpose

1. **Navigation.** The app has no way to move between screens: the header
   only shows the title. Add a navigation menu in the header with **Play
   Game** and **Wiki**.
2. **Wiki.** A read-only reference of the game's content, split into four
   pages: **Generals**, **Basic Cards**, **Equipments**, and **Tools** (the
   source site's name for trick cards).

Decisions settled with the user:
- The Wiki lists **every crawled base-set card and general**, not only those
  in the game registry. Each entry is badged by whether it is in the game.
- The navigation is a **header menu**: buttons in the existing blue header,
  with Wiki opening a dropdown of the four pages. It is not a side panel.
- Wiki pages show **full entries**: art beside every known field, read by
  scrolling, with no detail dialogs.

## Navigation

The header (`projects/app/src/app/app.html`) keeps its castle icon and title
on the left. On the right it gains:

- **▶ Play Game** (`play_arrow` icon) goes to `/game` when a game is in
  progress (`GameService.state()` is non-null and has no result), otherwise
  to `/setup`. It is highlighted while the current route is `/setup` or
  `/game`.
- **📖 Wiki ▾** (`menu_book` icon, `arrow_drop_down`) opens a Material menu
  with four items: Generals, Basic Cards, Equipments, Tools. Each links to
  its page. The button is highlighted while the route starts with `/wiki`,
  and the current page's item is marked in the open menu.

At widths under 600px both buttons show their icons only, with
`aria-label`s "Play Game" and "Wiki", so the header fits at 360px. The menu
items always show their text.

`GameService` is provided in root, so a game in progress survives leaving
for the Wiki. Returning through Play Game resumes it. Bot moves that were
due keep running in the background, which is acceptable: the game state is
the same either way.

The menu is presentational. The only state it reads is whether a game is in
progress, from `GameService`.

## Routes

```ts
{ path: 'wiki', loadChildren: () => import('./wiki/wiki.routes').then((m) => m.WIKI_ROUTES) },
```

```ts
// projects/app/src/app/wiki/wiki.routes.ts
export const WIKI_ROUTES: Routes = [
  { path: 'generals', loadComponent: () => import('./wiki-generals').then((m) => m.WikiGenerals), title: 'Generals' },
  { path: 'basic', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'basic' }, title: 'Basic Cards' },
  { path: 'equipment', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'equipment' }, title: 'Equipments' },
  { path: 'tools', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'trick' }, title: 'Tools' },
  { path: '', redirectTo: 'generals', pathMatch: 'full' },
];
```

The three card pages share one component, which reads its category from the
route data. The existing `''` → `setup` redirect stays.

## Content: Wiki entries

The Wiki's data comes from `projects/content`, never from raw JSON in the
app. CLAUDE.md requires that "is it in the game" is decided by content
rather than the UI, so the badge is computed there too.

```ts
// projects/content/src/lib/wiki.ts (exported from public-api.ts)
export type Kingdom = 'Wei' | 'Shu' | 'Wu' | 'Qun';
export type Suit = 'spade' | 'heart' | 'club' | 'diamond';

export interface WikiSkill { name: string; nameZh: string | null; text: string }

export interface WikiGeneral {
  id: string;
  name: string;
  nameZh: string | null;
  title: string | null;
  titleZh: string | null;
  kingdom: Kingdom;
  maxHp: number | null;
  skills: WikiSkill[];
  skillsInGame: boolean; // hand-coded skill logic exists for this general
}

export interface WikiCard {
  id: string;
  name: string;
  nameZh: string | null;
  category: 'basic' | 'trick' | 'equipment';
  subtype: 'weapon' | 'armor' | 'horse' | 'treasure' | null;
  text: string | null;
  range: number | null;
  count: number | null;
  printings: { suit: Suit; rank: number }[]; // [] when unknown
  inGame: boolean; // the card is in the game registry (its rules are implemented)
}

export function wikiGenerals(): WikiGeneral[];
export function wikiCards(category: WikiCard['category']): WikiCard[];
```

- **Sources:** `generalsData` and `cardsData` (the data files), and
  `buildContentRegistry()` / `GENERAL_SKILLS` for the badges.
  - `inGame` = `registry.cards.has(id)`.
  - `skillsInGame` = `GENERAL_SKILLS.has(id)`.
- **Order:**
  - Generals by kingdom (Wei, Shu, Wu, Qun), then by name.
  - Basic and trick cards by name.
  - Equipment by subtype (weapon, armor, horse, treasure), then by name.
- **Silver Lion** is in the registry but has no data file, so it does not
  appear. The Wiki lists data files.
- Missing optional fields become `null` (or `[]` for printings). Nothing is
  guessed.

Today's counts, which the tests pin:
- 26 generals, of which 6 have `skillsInGame`;
- 3 basic cards, all `inGame`;
- 15 equipment cards, of which 1 is `inGame` (Green Dragon Blade);
- 12 tools, of which 2 are `inGame` (Duel, Wuxie).

The existing `generalDisplayData` / `cardDisplayData` stay as they are;
the game board uses them.

## App: Wiki pages

New folder `projects/app/src/app/wiki/`:

| File | Responsibility |
|---|---|
| `wiki.routes.ts` | The routes above. |
| `wiki-generals.ts` | Generals page: one section per kingdom, each a list of `WikiGeneralEntry`. |
| `wiki-cards.ts` | Basic / Equipments / Tools page: reads `category` from route data. Equipment is split into Weapons / Armor / Horses (/ Treasure if any) sections. Other categories are one list. |
| `wiki-general-entry.ts` | One general: art, name + Chinese name, title (+ Chinese), kingdom chip, HP hearts, skills, badge. |
| `wiki-card-entry.ts` | One card: art, name + Chinese name, rules text, range (weapons), copies and printings, badge. |
| `printing-label.ts` | A pure function: `{ suit: 'spade', rank: 1 }` → `♠A`. Ranks: 1 → A, 11 → J, 12 → Q, 13 → K. |

Each page has an `<h2>` heading (the page name) and a one-line summary such
as "26 generals · 6 with skills in the game". The pages are laid out like
this:

```
Equipments
15 cards · 1 in the game
── Weapons ──────────────────────────────────────────
┌──────┐  Axe 贯石斧                      [Not in the game yet]
│ art  │  Range 3
│      │  When the target of the player's attack escapes the attack,
└──────┘  the player can then discard two other cards to cause ...
```

- **Art:** reuse the existing `CardArt` component (`game-board/card-art.ts`)
  at `large` size on wide screens, and smaller under 600px. It already falls
  back to a labelled placeholder when there is no art.
- **Badges:**
  - Cards: "In the game" (filled) / "Not in the game yet" (outlined).
  - Generals: "Skills in game" / "Skills not in game yet".
- **Gaps** show as muted text, never blank:
  - "Rules text not available" for the horses;
  - "Printings not recorded" for equipment;
  - a missing Chinese name or title is left out.
- **Phone width:** at 360px, entries stack (art above the text). There is
  no horizontal scroll, and side gutters are 16px.

## Testing

Content (Jest, `projects/content`):
- `wikiGenerals()`: 26 entries in kingdom-then-name order. Exactly 6 have
  `skillsInGame`: xiahou-dun, sun-shangxiang, zhuge-liang, dong-zhuo,
  zhao-yun, huang-yueying (the ids in `GENERAL_SKILLS`). Cao Cao does not,
  but carries both skills with their Chinese names. Lu Meng has
  `nameZh: null`.
- `wikiCards('basic' | 'equipment' | 'trick')`: counts 3 / 15 / 12; equipment
  ordered by subtype; `inGame` matches the registry; a horse has
  `text: null`; Duel's printings are ♠A ♣A ♦A; Silver Lion appears nowhere.

App (Jest, `projects/app`):
- **Header menu:** Play Game links to `/setup` with no game, and to `/game`
  with a game in progress. Wiki opens a menu whose four items link to the
  four routes.
- **Routes:** `/wiki` redirects to `/wiki/generals`, and each card route
  renders its category.
- **Pages:** the Generals page renders 4 kingdom sections and 26 entries.
  The Equipments page renders Weapons / Armor / Horses sections. Badges and
  gap texts appear where the data says.
- **`printingLabel`:** A / J / Q / K and the number ranks, and all four
  suits.

Live check: open each page at 1400px and 360px wide, use the header menu
from Setup, the game and a Wiki page, and confirm a game in progress
resumes through Play Game.

## Out of scope

- Search, filters, and sorting controls.
- Editing content from the Wiki.
- Cards and generals outside the base set.
- Splitting Tools into instant and delayed (the data doesn't record it yet;
  see the content data pipeline spec's open items).
- Showing the game's skill or card logic.
