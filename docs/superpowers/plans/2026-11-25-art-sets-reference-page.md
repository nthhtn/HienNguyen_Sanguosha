# Art Sets Reference Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Art Sets" Wiki page (By Set and By General tabs) and an "Art Sets (n)" popup on each General's Wiki entry, so players can browse every art set and choose from there.

**Architecture:** One shared component draws "all the artwork one General has" with choose controls. It sits in each By General row and in a popup opened from the General entries. A By Set component draws each set's gallery. All of it reads the existing `ArtSets` service and `content` lookups, so nothing new touches the engine, server or asset pipeline.

**Tech Stack:** Angular standalone components with signals, `MatDialog`, `MatTabs`, Jest (`app` and `content` projects).

**Spec:** `docs/superpowers/specs/2026-11-25-art-sets-reference-page-design.md` (read it first; it builds on `2026-11-25-art-sets-design.md`, already implemented in this checkout).

## Global Constraints

- **Branch.** Continue on `feat/art-sets` in the worktree `.worktrees/feat-art-sets`. Never push or merge.
- **Commits.** Every commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Stage files by name: the worktree holds an uncommitted throwaway Demo Set (`assets-src/.../demo-set`, `assets/.../demo-set`, `sets.json`, `art-sets.json`, `asset-lock.json`) that must never be committed.
- **Untouched layers.** Engine, server, `protocol` and the asset pipeline do not change.
- **Reuse.** Use `resolveArtSet`, `setsCovering`, `generalSkinUrl`, `artSetName` and `ArtSets` (`art-sets.service.ts`). Do not copy their logic.
- **Page rules.** The page always exists (even with one set). By General lists only Generals more than one set covers. A tile press always stores an override. Tiles are marked "In Use" and "Pinned". "Follow Global Set" clears the override.
- **Entry button.** It shows only for a General with alternates, and only the Wiki's General entries carry it. A Kingdom Wars General uses its base General.
- **Picker button.** It keeps its rule (shown only when more than one set ships) and is renamed "Choose Art Set".
- **Lazy loading.** The page and the popup load on demand. The root bundle must not grow: `npm run build` initial total stays within about 1 kB of its value before this plan.
- **UI text (CLAUDE.md).** English labels are Title Case, sentences are sentence case. Vietnamese is sentence case and a draft.
- **Docs style (CLAUDE.md).** Bullets, bold key terms, capitalised list items and table cells.
- **Tests.** Run Jest as `npx jest --selectProjects <project> --testPathPatterns "<pattern>"` (plural flag).

## Review Focus

- **Tile equals board.** A tile's picture is the file the board shows for the same choice (`generalSkinUrl` with that set). Pinned in Tasks 1 and 3.
- **Stale pin.** An override naming a set that no longer covers the General is not shown as "Pinned" and is not offered. Pinned in Task 1.
- **Kingdom Wars entries.** A `kingdomWars:` id opens the base General's popup and shares its pin. Pinned in Task 2.
- **Live updates.** The page, the popup and the picker agree at once when the choice changes through any of them. Pinned in Tasks 2 and 3.
- **Bad tab.** `?tab=bogus` shows By Set. Pinned in Task 3.

---

## File Structure

- **Content:** `projects/content/src/lib/artSets.ts` (a base-id helper), `projects/content/src/lib/assets.ts` (a Force helper) and their specs.
- **Wiki:** `wiki/general-art-choices.ts` (shared tiles), `wiki/general-art-dialog.ts`, `wiki/general-art-button.ts`, `wiki/wiki-art-sets.ts` (the page), `wiki/art-sets-by-set.ts`, `wiki/art-sets-by-general.ts`, `wiki/wiki.routes.ts`, and the two entries `wiki-general-entry.ts` and `wiki-kingdom-wars-general-entry.ts`.
- **App shell:** `app.ts`, `app.html`, `app.css` (toolbar and drawer links), `art-sets-dialog.ts` (a Browse button).
- **Messages:** `i18n/en.ts`, `i18n/vi.ts`.
- **Docs:** `docs/architecture/frontend.md`, `docs/deferrals.md`.

(All Wiki and app paths are under `projects/app/src/app/`.)

---

### Task 1: Shared tiles and two content helpers

**Files:**
- Modify: `projects/content/src/lib/artSets.ts`, `projects/content/src/lib/artSets.spec.ts`, `projects/content/src/lib/assets.ts`, `projects/content/src/lib/assets.spec.ts`
- Create: `wiki/general-art-choices.ts`, `wiki/general-art-choices.spec.ts`
- Modify: `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- **Plan deviation from the spec:** The spec says a General's Force comes from the content display data, but `GeneralDisplayData` has no Force. `generalSkinForce` reads the force folder of the General's skin instead (the same force the death voices are filed under), which needs no new data. The By Set grouping therefore follows the Kingdom Wars force of a skin.
- Produces, in `content`:

```ts
export function artSetGeneralId(id: string): string; // the base General id for a plain or kingdomWars: id
export function generalSkinForce(id: string): 'Wei' | 'Shu' | 'Wu' | 'Qun' | null; // the force folder of the General's skin, null with no skin
```

- Produces, in `wiki/general-art-choices.ts`:

```ts
@Component({ selector: 'app-general-art-choices' })
export class GeneralArtChoices {
  readonly general = input.required<string>(); // any General id; mapped with artSetGeneralId
  readonly size = input<'normal' | 'large'>('normal');
}
```

- **Markup hooks the specs rely on:** `ul.choices`; one `li` per covering set holding `button.tile[data-set="<set id>"]` with an `img`, a `.set-name`, and `.in-use` and `.pinned` marks when they apply (the in-use tile has `aria-pressed="true"`); and `button.follow`.
- **Messages (English, Vietnamese draft):** `artSetsPage.inUse` ("In Use"), `artSetsPage.pinned` ("Pinned"), `artSetsPage.followGlobal` ("Follow Global Set").

- [ ] **Step 1: Write the failing content tests.**
  - `artSets.spec.ts`: `artSetGeneralId('kingdomWars:guan-yu')` is `'guan-yu'` and `artSetGeneralId('guan-yu')` is `'guan-yu'`.
  - `assets.spec.ts`: `generalSkinForce('cao-cao')` is `'Wei'`, `'guan-yu'` is `'Shu'`, `'kingdomWars:diao-chan'` is `'Qun'`, `'nobody'` is `null`.
- [ ] **Step 2: Write the failing component spec** (`provideFakeArtSets()`; ink covers `cao-cao` and `guan-yu`):
  - **Tiles:** For `guan-yu` there is one tile per covering set, labelled `Classic` and `Ink Wash`, and each `img` `src` equals `generalSkinUrl('guan-yu', { global: <set>, overrides: {}, catalog })`.
  - **Marks:** With the global set `classic`, the Classic tile is "In Use" (and `aria-pressed`) and no tile is "Pinned". After `setOverride('guan-yu', 'ink')` the Ink tile is "In Use" and "Pinned", and the Classic tile has neither.
  - **Press:** Pressing the Ink tile calls `setOverride('guan-yu', 'ink')`. Pressing the Classic tile while the global set is Classic still stores `{ 'guan-yu': 'classic' }`.
  - **Follow:** `button.follow` is disabled with no override, enabled with one, and clears it when pressed.
  - **Stale pin:** A stored override naming `gone` (written to `localStorage` before the service is created) gives no "Pinned" tile and `follow` disabled.
  - **Base id:** `general` set to `kingdomWars:guan-yu` shows the same tiles and shares the pin.
  - **Locale:** With Vietnamese active the tile labels use the Vietnamese set names.
- [ ] **Step 3: Run to verify they fail:** `npx jest --selectProjects content app --testPathPatterns "(artSets|assets.spec|general-art-choices)"`. Expected: missing exports and a missing module.
- [ ] **Step 4: Implement `artSetGeneralId`** (`artSets.ts`, using `isKingdomWarsGeneralId` and `baseGeneralId` from `generalIds.ts`) **and `generalSkinForce`** (`assets.ts`, capitalising the folder before the slash in the General's `skins.json` path, `null` when there is none).
- [ ] **Step 5: Implement `GeneralArtChoices`** and the three messages in `en.ts` and `vi.ts`. It reads `ArtSets.choice()`, `setsCovering` and `artSetName`, and the "In Use" set is `resolveArtSet(base, choice)`. Tiles are at least 44 px square to tap, and the large size is for the popup.
- [ ] **Step 6: Run the specs from Step 3.** Expected: pass.
- [ ] **Step 7: Commit** the named files: `git add projects/content/src/lib projects/app/src/app/wiki/general-art-choices* projects/app/src/app/i18n && git commit -m "feat: shared art tiles and two art set helpers"`.

---

### Task 2: "Art Sets (n)" button and popup on the General entries

**Files (under `projects/app/src/app/wiki/`):**
- Create: `general-art-dialog.ts`, `general-art-dialog.spec.ts`, `general-art-button.ts`, `general-art-button.spec.ts`
- Modify: `wiki-general-entry.ts`, `wiki-kingdom-wars-general-entry.ts`, `wiki-entries.spec.ts`, `wiki-kingdom-wars-general-entry.spec.ts`, and `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- Consumes: `GeneralArtChoices`, `artSetGeneralId`, `setsCovering`, `ArtSets`.
- Produces:

```ts
export interface GeneralArtDialogData { generalId: string }
export class GeneralArtDialog {} // MAT_DIALOG_DATA: GeneralArtDialogData
export function openGeneralArtDialog(injector: Injector, generalId: string): void;
@Component({ selector: 'app-general-art-button' })
export class GeneralArtButton { readonly general = input.required<string>(); }
```

- **Messages:** `wiki.artSets` ("Art Sets ({count})"), `artSets.alternates` (a sentence-case hint such as "Pick the artwork this General shows. It follows the global set unless you pick one here.").
- **Markup hooks:** `button.art-sets-button` (absent when the General has fewer than two covering sets), and the dialog's `app-general-art-choices` with `size="large"`.

- [ ] **Step 1: Write the failing specs** (`provideFakeArtSets()`):
  - **Button:** Absent for `zhao-yun` (only classic covers it). Present for `guan-yu` with the text "Art Sets (2)". For `kingdomWars:guan-yu` it is present with the same count.
  - **Opening:** Pressing it (after the lazy import settles) opens `app-general-art-dialog` whose title is the General's name and which contains `app-general-art-choices` for the base id.
  - **Live:** Choosing the Ink tile in the dialog changes `ArtSets.overrides()` and the entry's portrait `src` behind it to the ink path.
  - **Entries:** `wiki-entries.spec.ts` and the Kingdom Wars entry spec each render an entry for a General two sets cover and find the button, and find none for a General only classic covers.
  - **Dialog:** `GeneralArtDialog` has a Close button, and its hint text shows.
- [ ] **Step 2: Run to verify they fail:** `npx jest --selectProjects app --testPathPatterns "(general-art-dialog|general-art-button|wiki-entries|wiki-kingdom-wars-general-entry)"`. Expected: missing modules and a missing button.
- [ ] **Step 3: Implement `GeneralArtDialog`** (follow `art-sets-dialog.ts` for the `MatDialog` pattern, with `generalDisplayData(id, locale)` for the title and a Close button using `ui.close`) **and `openGeneralArtDialog`**.
- [ ] **Step 4: Implement `GeneralArtButton`.** It renders nothing for fewer than two covering sets. Pressing it runs `const { openGeneralArtDialog } = await import('./general-art-dialog')` and opens the dialog with the base id, so the dialog code loads only on demand.
- [ ] **Step 5: Place `<app-general-art-button [general]="general().id" />` under the portrait** in both entry components, wrapping the `app-card-art` and the button in one element if the entry's layout needs it, so the portrait column keeps its width.
- [ ] **Step 6: Add the two messages** to `en.ts` and `vi.ts`.
- [ ] **Step 7: Run the specs from Step 2 and the Wiki specs:** `npx jest --selectProjects app --testPathPatterns "wiki"`. Expected: pass.
- [ ] **Step 8: Commit** the named files with `git commit -m "feat(wiki): Art Sets popup on General entries"`.

---

### Task 3: The Art Sets page

**Files (under `projects/app/src/app/wiki/`):**
- Create: `wiki-art-sets.ts`, `art-sets-by-set.ts`, `art-sets-by-general.ts`, and a spec beside each
- Modify: `wiki.routes.ts`, `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- Consumes: `GeneralArtChoices`, `generalSkinForce`, `generalSkinUrl`, `setsCovering`, `artSetName`, `ArtSets`, `tabQueryParam` (`wiki/tab-param.ts`).
- Produces: route `{ path: 'art-sets', loadComponent }` in `WIKI_ROUTES`, and the components `WikiArtSets` (page, tabs `sets` and `generals`), `ArtSetsBySet` and `ArtSetsByGeneral` (selectors `app-art-sets-by-set`, `app-art-sets-by-general`).
- **Markup hooks:**
  - **By Set:** `section.set[data-set]` with `.coverage`, `.provenance`, `button.use`, optionally `.fallback-note`, and `section.force[data-force="Wei|Shu|Wu|Qun"]` holding `figure.tile[data-general]` with an `img` and a `figcaption`.
  - **By General:** `li.row[data-general]` holding `app-general-art-choices`, and `p.empty` when there are none.
- **Messages:** `artSetsPage.title`, `artSetsPage.intro`, `artSetsPage.tab.sets` ("By Set"), `artSetsPage.tab.generals` ("By General"), `artSetsPage.use` ("Use This Set"), `artSetsPage.fallbackNote` ("{count} Generals show their Classic portrait in this set." as a sentence), `artSetsPage.noChoices` ("No General has more than one art set yet."). Force names reuse `label.kingdom.<Force>`.

- [ ] **Step 1: Write the failing specs** (`provideFakeArtSets()` unless stated):
  - **By Set:** One `section.set` per set in catalog order. Each shows its coverage ("4 of 4 Generals" and "2 of 4 Generals", from `artSets.coverage`), and its provenance. Tiles are grouped by Force in the order Wei, Shu, Wu, Qun, and a set's section holds only the Generals it covers. The Ink section has a fallback note counting the Generals it lacks (2) and Classic has none. Each tile's `src` equals `generalSkinUrl(id, { global: <set>, overrides: {}, catalog })`.
  - **Use This Set:** `button.use` for Ink calls `selectGlobal('ink')`, after which Ink's button reads "In Use" and is disabled, and Classic's reads "Use This Set".
  - **By General:** Rows exist only for Generals more than one set covers (`cao-cao`, `guan-yu`), in classic order, each with its choices. With the real one-set catalog (no provider) the list is empty and `p.empty` shows.
  - **Page:** The default tab is By Set, `?tab=generals` selects By General, and `?tab=bogus` selects By Set.
  - **Live:** Changing the choice through `ArtSets` (as the picker does) updates both tabs without reopening.
- [ ] **Step 2: Run to verify they fail:** `npx jest --selectProjects app --testPathPatterns "(wiki-art-sets|art-sets-by)"`. Expected: missing modules.
- [ ] **Step 3: Implement `ArtSetsBySet`, `ArtSetsByGeneral` and `WikiArtSets`.** The page is a `mat-tab-group` driven by `tabQueryParam(['sets', 'generals'])` as `wiki-generals.ts` does, with a title and the intro sentence above it. Grouping Generals by Force uses `generalSkinForce`, and Generals with `null` are left out.
- [ ] **Step 4: Add the route** `{ path: 'art-sets', loadComponent: () => import('./wiki-art-sets').then((m) => m.WikiArtSets) }` to `WIKI_ROUTES` beside the others.
- [ ] **Step 5: Add the messages** to `en.ts` and `vi.ts`.
- [ ] **Step 6: Run the specs from Step 2.** Expected: pass.
- [ ] **Step 7: Commit** with `git commit -m "feat(wiki): Art Sets reference page"`.

---

### Task 4: Navigation entries and the picker's Browse button

**Files (under `projects/app/src/app/`):**
- Modify: `app.ts`, `app.html`, `app.css`, `app.spec.ts`, `art-sets-dialog.ts`, `art-sets-dialog.spec.ts`, `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- Consumes: the route from Task 3.
- Produces: toolbar link `a.nav-art-page` and drawer link `a.drawer-art-page` (both to `/wiki/art-sets`, active on that route), and `a.browse` in the picker dialog's actions.
- **Messages:** `nav.artSetsPage` ("Art Sets"), `artSets.browse` ("Browse All Art Sets"). `nav.artSets` is renamed "Choose Art Set" (Vietnamese "Chọn bộ tranh").

- [ ] **Step 1: Write the failing specs.**
  - **Toolbar:** `a.nav-art-page` exists with one set and with two (`provideFakeArtSets()`), points at `/wiki/art-sets`, has `aria-current="page"` when on that route, and sits beside the Rules link.
  - **Drawer:** On a phone `a.drawer-art-page` exists and is `active` on the route.
  - **Picker button:** `button.nav-art-sets` now has the aria-label "Choose Art Set" (the existing test's expectation changes).
  - **Browse:** In the picker dialog, `a.browse` has `routerLink` `/wiki/art-sets` and closes the dialog when pressed.
- [ ] **Step 2: Run to verify they fail:** `npx jest --selectProjects app --testPathPatterns "(app.spec|art-sets-dialog)"`. Expected: missing links and the old aria-label.
- [ ] **Step 3: Add the links** to `app.html` (toolbar beside `nav-rules`, drawer beside Rules, icon `collections`), an `artPageActive` computed in `app.ts` like `rulesActive`, and styling in `app.css` by adding `.nav-art-page` wherever `.nav-rules` is listed (including the narrow-screen label hiding).
- [ ] **Step 4: Add `<a mat-button class="browse" routerLink="/wiki/art-sets" mat-dialog-close>`** to the picker dialog's actions (import `RouterLink`).
- [ ] **Step 5: Add and rename the messages** in `en.ts` and `vi.ts`.
- [ ] **Step 6: Run the specs from Step 2** and the whole app project: `npx jest --selectProjects app`. Expected: pass.
- [ ] **Step 7: Commit** with `git commit -m "feat(app): Art Sets links and a Browse button in the picker"`.

---

### Task 5: Docs, full verification and a manual check

**Files:**
- Modify: `docs/architecture/frontend.md` (Wiki section and the Art sets section), `docs/deferrals.md`

**Interfaces:** Consumes everything above; produces documentation only.

- [ ] **Step 1: Document the page and the popup** in `frontend.md`: the two tabs, `GeneralArtChoices` shared by the By General rows and the popup, the entry button, and the navigation. Remove the Art sets deferral line "Wiki card art" only if untrue, and add to `deferrals.md`: bigger previews (a lightbox) and translated provenance.
- [ ] **Step 2: Run the full check:** `npm run verify && npm test && npm run test:assets`. Expected: all pass, and the `npm run build` initial total is within about 1 kB of its value before this plan (record the before value first with a build on the Task 4 base).
- [ ] **Step 3: Manual browser check with the Demo Set** already in the worktree (rebuild with `npm run assets:build` if it is gone), served by `npm run web -- --port 4210`, opened with `preview_start` using `url`: the Art Sets link and page, By Set and By General, choosing from both, the popup from a General entry on `/wiki/kingdom-wars/generals` and `/wiki/identity/generals`, the picker's Browse button, a phone-width window (tiles tappable, no sideways scroll) and English as well as Vietnamese. Report what was and was not checked.
- [ ] **Step 4: Remove the Demo Set:** `rm -rf projects/content/assets-src/generals/skins/demo-set && git checkout -- projects/content/assets-src/generals/skins/sets.json projects/content/assets && npm run assets:build`, then confirm `git status` is clean and stop the dev server.
- [ ] **Step 5: Commit** the docs with `git commit -m "docs: Art Sets page and popup"`.
