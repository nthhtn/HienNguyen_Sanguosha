# Phone App, Fixes from the First Real-Phone Test, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phone seat tiles show HP as icons (numbers on slim tiles) and each General as a readable face crop, and a phone browser tab gets the install hint even when Chrome's bars shrink it.

**Architecture:** The asset pipeline gains per-recipe crop box files, so a `generals/faces` recipe can cut square face crops from the portraits. `content` gets `generalFaceUrl`; `PhoneSeatTile` uses it and draws the HP ramp. `Layout` learns the screen's size for the install hint.

**Tech Stack:** Python asset pipeline (`npm run test:assets`, `npm run assets:build`, `npm run assets:check`, Pillow), Angular, Jest.

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, section "3b. Changes from the first real-phone test".

## Decisions

- **Developer (2026-11-22):** HP icons on full tiles and the viewer's tile, lost HP dark; "♥ 4/4" on slim tiles. Face crops on every phone tile; the developer approves them from the built folder `projects/content/assets/generals/faces/<force>/`.
- **My calls:**
  - **Where the work goes:** On `feat/phone-app-seat-details` (PR 83), the PR that turns the phone board on, so these ship with it.
  - **Box file:** Face boxes live in `projects/content/asset-crops-faces.json` as `[x, y, size, size]`, keyed like the portraits (`wei/caocao`). The card boxes stay in `asset-crops.json`. A crop recipe may name its box file with `"boxes"`; without it, `asset-crops.json` as today.
  - **Crop sources are images only:** A crop recipe skips non-image files in its `from` folder (`skins.json`).
  - **Size:** `maxWidth: 160` (a 45 CSS px box at pixel ratio 3.5), WebP quality 85.
  - **Dark HP:** The same ramp icon with `filter: brightness(0.35) saturate(0)`; no new art.
  - **Install hint by screen size:** `Layout.screenSize` reads `window.screen` once; `installWouldHelp` judges the screen (either way round) instead of the window.

## Global Constraints

- Presentation and assets only. No engine, content rules, bots, protocol or server changes.
- `projects/content/assets/` is build output: Only `npm run assets:build` writes it.
- The web board and Seat Details keep the full portraits; medium and large do not change.
- Phone tile sizes: No text under 12 px, nothing scaled down.

## Review Focus

- **A General with no face crop** (a new General, a Kingdom Wars id): The tile shows its portrait, never a broken image. Pinned in Task 3.
- **A hidden General:** Still the hidden art, not a face crop. Pinned in Task 3.
- **Max HP above 8:** The tile caps at the ramp's 8 icons and still shows the numbers. Pinned in Task 4.
- **A box outside its portrait or a portrait without a box:** The pipeline stops with a clear error. Pinned in Task 1.
- **A desktop browser or a screen with no `screen` object:** No hint, nothing throws. Pinned in Task 5.

---

### Task 1: Per-recipe crop boxes in the asset pipeline

**Files:** Modify `scripts/assetlib/plan.py` (and `recipes.py` if it validates recipe keys); test `scripts/assetlib/test_plan_check.py` or `test_crop.py`.

- [ ] **Step 1: Failing tests:** A crop recipe with `"boxes": "other.json"` reads that file and not `asset-crops.json`; a non-image file in the `from` folder is skipped; a missing box or a box key with no art still raises `PlanError` naming the recipe's box file.
- [ ] **Step 2:** `npm run test:assets` fails on them.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm run test:assets` passes.
- [ ] **Step 5: Commit** `feat(assets): crop recipes can name their own box file`.

### Task 2: Draft face crops for the developer to approve

**Files:** Create `projects/content/asset-crops-faces.json`; modify `projects/content/asset-recipes.json` (`"generals/faces": { "op": "crop", "from": "generals/skins", "boxes": "asset-crops-faces.json", "ext": "webp", "quality": 85, "maxWidth": 160 }`); build output under `projects/content/assets/generals/faces/`.

- [ ] **Step 1:** Write the 66 boxes (drafted by looking at each portrait).
- [ ] **Step 2:** `npm run assets:build && npm run assets:check`; 66 WebP files appear in `assets/generals/faces/<force>/`.
- [ ] **Step 3:** Make a contact sheet of all 66 (names under each) in the scratchpad for a quick look, and send the developer the folder path and the sheet.
- [ ] **Step 4: Wait for the developer's approval.** Fix the boxes they name, rebuild, repeat.
- [ ] **Step 5: Commit** `feat(assets): face crops of the Generals for phone tiles`.

### Task 3: Face avatars on the phone tile

**Files:** Modify `projects/content/src/lib/assets.ts` (`generalFaceUrl(id: string): string | null`, the face crop's URL or `null` when the General has no crop), its spec; `projects/app/src/app/game-board/phone/phone-seat-tile.ts` and its spec.

- [ ] **Step 1: Failing tests:** `generalFaceUrl('cao-cao')` is `/images/generals/faces/wei/caocao.webp`; a Kingdom Wars id maps through its base General; an id with no skin gives `null`. The tile uses the face URL for a revealed General, the hidden art for a hidden one, and the portrait when there is no face crop; an image that fails to load falls back to the portrait.
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement.** The face image fills the General's box (`object-fit: cover`, centred).
- [ ] **Step 4:** `npx jest --selectProjects app content -- assets phone-seat-tile` passes.
- [ ] **Step 5: Commit** `feat(app): face avatars on the phone seat tiles`.

### Task 4: HP icons on full phone tiles

**Files:** Modify `phone-seat-tile.ts` and its spec.

- [ ] **Step 1: Failing tests:** A full tile at 3 of 4 HP shows 4 `.hp-icon` images, the last one `.lost`, no word "HP" in its text, and the accessible label "HP 3/4"; max HP 10 shows 8 icons and the numbers; a slim tile shows "4/4" with a heart and no icons; the viewer's tile shows icons.
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement** with the ramp URLs (`/images/ui/hp-ramp/<n>.png`, as `hpIconUrls`), icons about 12 px tall.
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat(app): HP icons on the phone seat tiles`.

### Task 5: Install hint judged by the screen

**Files:** Modify `layout.service.ts`, `layout.testing.ts` (a screen size option), `layout.service.spec.ts`.

- [ ] **Step 1: Failing tests:** A browser tab whose window is 759 × 269 on an 800 × 366 screen (coarse pointer): `installWouldHelp` true. A 700 × 330 screen: false. No `window.screen`: false, nothing throws.
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npx jest --selectProjects app` passes.
- [ ] **Step 5: Commit** `fix(app): judge the install hint by the screen, not the tab`.

### Task 6: Check and push

- [ ] **Step 1:** `npm run verify && npx jest --selectProjects app server content` pass (lint ignoring `.claude/worktrees/` if another session's worktree trips it).
- [ ] **Step 2:** Rebuild the production app and restart the tunnel server; the developer checks the tiles on the Honor 400 Pro.
- [ ] **Step 3:** Update `docs/architecture/frontend.md` (face avatars, HP icons, hint by screen) and the PR 83 description; push `feat/phone-app-seat-details`.
