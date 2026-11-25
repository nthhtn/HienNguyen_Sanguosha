# Art Sets reference page: Browse the art before choosing it

## Intent

Give players a reference page where they can look at every art set, then choose one.

- **Why:** The picker (see `2026-11-25-art-sets-design.md`) changes portraits live but shows only a few thumbnails per set. A player cannot judge a whole set, or compare one General's portraits across sets, from a dropdown.
- **Who:** Every player, on the desktop and the phone.
- **Success:** A player opens the page, sees each set's full artwork or each General's portraits side by side, and picks a set (or one General's set) without leaving the page.

## Vocabulary

- **Art set, skin, face, card art:** As in the art sets design. This page shows portraits (skins) only.
- **Reference page:** A page in the Rules Wiki style: read-only content with a few controls.

## Goals

1. **One page,** `/wiki/art-sets`, called "Art Sets", reachable from the toolbar and the phone drawer, and from the picker.
2. **Two views behind tabs:**
   - **By Set:** One section per set, with its name, coverage, provenance and every General it covers grouped by Force.
   - **By General:** One row per General that more than one set covers, with a tile for each set that has art for it.
3. **Choosing from the page:**
   - **By Set:** A "Use This Set" button sets the global set.
   - **By General:** Choosing a tile sets that General's override, and a "Follow Global Set" control clears it.
4. **Shows the current choice.** The set in use is marked on both views, and the page updates at once when the choice changes (here or in the picker).
5. **Linkable.** The active tab is in the `tab` query parameter (`sets` or `generals`), using the Wiki's `tabQueryParam`.
6. **Always available,** even while only `classic` ships (see "My calls").
7. **From a General's Wiki entry.** An entry shows the portrait of the set in use. Where the General has alternate artwork, a button opens a popup listing every set's artwork for that General, with the same choose controls as the By General view.

## Non-goals

- **Bigger previews.** No lightbox or zoom. Tiles are the size of the game's portraits.
- **Card art.** Unchanged. The Wiki's General entries keep following the chosen set for their main portrait.
- **Search or filters.** The lists are short (66 Generals, a handful of sets).
- **Per-deck pages.** The page is not under a deck menu. A General is one portrait whichever deck it is in.
- **New data.** The page reads the same catalog and choice the picker uses. No pipeline or content changes.

## Anti-goals (a failure even if it technically works)

- A tile shows a different picture from what the board shows for the same choice.
- The page offers a set for a General that set has no art for.
- The page and the picker disagree about the current choice.
- The page loads the content package into the first load (the root bundle must not grow).
- A tile is too small to tap on a phone.

## Constraints

- **Layering (CLAUDE.md).** Presentation only: the page reads `ArtSets` and the `content` lookups, and implements no rules.
- **Reuse.** Resolution comes from `resolveArtSet`, `setsCovering`, `generalSkinUrl` and `artSetName` (`content`). The choice comes from `ArtSets` (`art-sets.service.ts`). Do not copy their logic.
- **Lazy loading.** The page is a lazy route in `wiki.routes.ts`, as the other Wiki pages are. The toolbar and drawer entries are plain links, so they pull in nothing.
- **UI text (CLAUDE.md).** English labels are Title Case, hints and status lines are sentence case, and Vietnamese is sentence case. New Vietnamese text is a draft.
- **Docs style (CLAUDE.md).** Bullets, bold key terms, capitalised list items.

## Approaches considered

### Views

- **Tabs on one page (chosen):** `mat-tab-group` with `tabQueryParam`, like the Wiki's General pages. It is consistent, deep-linkable, and the "switch" the developer asked for.
- **Toggle buttons:** A segmented control switching two views. It reads more like a switch but needs its own query-parameter handling.
- **Two routes** (`/wiki/art-sets/sets` and `/generals`): Cleaner URLs, but two pages to keep in step and a heavier menu.

### Choosing on the page

- **Buttons on the page (chosen):** The page is where the decision is made, so it carries the controls.
- **View-only with a link back to the picker:** Simpler, but a player must remember what they saw.

## Design

### Navigation

- **Toolbar:** A link "Art Sets" (icon `collections`) beside Rules, with the same active-state treatment, visible always.
- **Drawer:** The same link in the phone drawer, beside Rules.
- **Picker:** A "Browse All Art Sets" button in the picker dialog's actions. It closes the dialog and opens the page. It navigates like the toolbar's Rules link does, even during a game: the app has no leave-the-game guard anywhere, so this adds no new way to lose a game.
- **Naming:** The picker's toolbar button (icon `palette`) is renamed "Choose Art Set" (Vietnamese "Chọn bộ tranh"), so the two entries do not share a label. The picker dialog keeps the title "Art Sets".

### The tiles, shared (`GeneralArtChoices`, `wiki/general-art-choices.ts`)

- **One component** for "all the artwork one General has": a tile per set that covers the General, each labelled with the set name, marked "In Use" and "Pinned" as above, pressing one setting that General's override, and "Follow Global Set" clearing it.
- **Used twice:** In each By General row and in the popup below, so the two cannot drift apart.
- **Input:** The base General id. Everything else comes from `ArtSets` and the `content` lookups.

### General entries in the Wiki

- **Entries:** `WikiGeneralEntry` and `WikiKingdomWarsGeneralEntry` both draw the portrait with `app-card-art [skin]="true"`, so it already follows the choice.
- **Button:** Under that portrait, a button "Art Sets ({count})" (`count` is the number of sets covering the General). It appears only when the General has alternates, so today nothing shows and a second set makes it appear.
- **Popup (`GeneralArtDialog`):** A dialog titled with the General's name, listing `GeneralArtChoices` for it. Tiles here are larger than on the page, and a "Close" button ends it. Choosing a tile changes the portrait behind the dialog at once.
- **Opening:** `MatDialog`, as the other Wiki dialogs do. The dialog is a lazy import, so the Wiki's General pages do not grow.
- **Base id:** A Kingdom Wars General opens the popup for its base General.

### The page (`WikiArtSets`, `wiki/wiki-art-sets.ts`)

- **Header:** Title, and a sentence saying what the page is for.
- **Tabs:** "By Set" and "By General", each with its own component so they can be tested alone.
- **By Set (`ArtSetsBySet`):**
  - **Section per set,** in catalog order: name, "{count} of {total} Generals", provenance, and a "Use This Set" button (shown as "In Use" and disabled for the global set).
  - **Grid:** The General tiles grouped under Wei, Shu, Wu and Qun, each tile a portrait and the General's name. The Force of a General comes from the content display data.
  - **Missing Generals** are simply absent from a partial set. A note says how many Generals fall back to Classic.
- **By General (`ArtSetsByGeneral`):**
  - **Row per General** that more than one set covers, in classic order: name and Force, then that General's `GeneralArtChoices`.
  - **Tile as choice:** A tile is a button. Pressing it sets that General's override to that set, always (as the picker's per General list does, so "Classic" can be pinned while the global set is Classic). The tile for the set that currently shows is marked "In Use", and a tile that is an override is also marked "Pinned".
  - **Follow Global Set:** A control on the row that clears the override. It is disabled when the General has none, and enabled whenever one is stored, so a pin is always visible and reversible.
  - **Empty state:** When no General has more than one set, a sentence says so ("No General has more than one art set yet"). This is the state today.
- **Everything reads signals** (`ArtSets.choice()`), so the page and the picker stay in step.

### Messages

- **New keys,** English and Vietnamese draft: `wiki.artSets` ("Art Sets ({count})", the entry button), `artSets.alternates` (the popup's sentence-case hint), `nav.artSetsPage` ("Art Sets"), `artSetsPage.title`, `artSetsPage.intro`, `artSetsPage.tab.sets` ("By Set"), `artSetsPage.tab.generals` ("By General"), `artSetsPage.use` ("Use This Set"), `artSetsPage.inUse` ("In Use"), `artSetsPage.followGlobal` ("Follow Global Set"), `artSetsPage.fallbackNote` (sentence case, with `{count}`), `artSetsPage.noChoices`, `artSets.browse` ("Browse All Art Sets").
- **Renamed key:** `nav.artSets` becomes "Choose Art Set".

### Tests

- **Tiles match the board:** Each tile's `src` equals `generalSkinUrl(id, { global: setId, overrides: {}, catalog })`.
- **By Set:** One section per set, the coverage line, the Force grouping, a partial set omitting missing Generals with its fallback note, and "Use This Set" calling `selectGlobal` and then showing "In Use".
- **By General:** Only Generals more than one set covers are listed, only covering sets get a tile, pressing a tile sets the override, "Follow Global Set" clears it and is disabled with none, and the empty state shows with the real one-set catalog.
- **Entries:** The button is absent for a General only `classic` covers and present, with the right count, for one two sets cover. It opens the popup, and the popup lists the covering sets. A Kingdom Wars entry opens its base General's. Choosing a tile in the popup changes the entry's portrait.
- **Shared tiles:** `GeneralArtChoices` has its own tests, and the By General row and the popup render the same component.
- **Page:** The tab follows `?tab=`, an unknown value falls back to By Set, and the page follows a change made through the picker.
- **Navigation:** The toolbar and drawer links exist with one set and with two, and the picker's "Browse All Art Sets" button navigates and closes the dialog.
- **Bundle:** `npm run build` keeps the initial total near its current size (the page loads lazily).

## Settled during review

- **Pressing a tile** always stores an override (see By General above); "Pinned" and "Follow Global Set" keep that visible.
- **Browse from the picker** navigates away like the Rules link; no guard exists in the app.
- **Provenance** (the set's description) was first one English string. It is now `{ en, vi }` in the registry and the catalog, shown in the language in use, and the build refuses a registry entry missing either language.

## What is left to the builder

- **Layout details:** Tile sizes (at least 44 px tap targets on a phone), grid breakpoints, and how a row wraps on a narrow screen.
- **Force colours:** Reuse the Wiki entry styles for Force tags.
- **Section anchors** for each set on By Set, if useful.

## My calls (not yet confirmed)

- **Always available.** The page exists while only `classic` ships, so a player can browse Classic's portraits and finds the feature. The picker's toolbar button still appears only when more than one set ships. The developer's "Yes" to "should the page exist?" was read this way, and the other reading (hide it like the picker) is a one-line change.
- **A button, not a tap on the portrait,** opens the popup: it is discoverable on a phone, and the count says how many alternates exist. It shows only when there are alternates.
- **The popup can also choose,** not only view, since it is the same tiles as the page.
- **Tabs, not a toggle,** for consistency with the Wiki.
- **Renaming the picker button** to "Choose Art Set" so two toolbar entries are not both "Art Sets".
- **By General lists only Generals more than one set covers,** so its empty state is real today.
- **Force order** on By Set follows the Wiki: Wei, Shu, Wu, Qun.
- **A crowded toolbar.** The permanent "Art Sets" link adds one entry to the wide toolbar, which already collapses its labels below 1360 px. The developer has not confirmed the extra entry.
