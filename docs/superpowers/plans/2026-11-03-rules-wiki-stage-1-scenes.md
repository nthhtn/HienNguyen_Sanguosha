# Rules Wiki Stage 1: Scene Components and the Six Existing Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the six existing rules pages (Overview, Setup, Turn Structure, Card Types, Distance / Range, Judgment) worked scenes made from the game's real art, in English and Vietnamese, with the shared scene components the later stages reuse.

**Architecture:** Five small standalone presentation components (scene frame, card, General, seat, HP row) plus one shared stylesheet. Each page keeps its text in the i18n catalogs and gets scenes added or replaces its tables. Art comes only through the content project's helpers. No rules logic enters a component; the one number-bearing scene (Distance) has its figures pinned by a spec that calls the content project's `seatDistance`.

**Tech Stack:** Angular (standalone components, signals), Jest with jest-preset-angular (`npx jest <path>`), the existing i18n catalogs (`en.ts`, `vi.ts`), the content project's asset and display helpers.

**Spec:** `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-design.md`. Reference drafts (layout, examples, Vietnamese wording): `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-drafts/draft-en.html` and `draft-vi.html`. Open them in a browser; `<img data-k="…">` names the art.

This plan is Stage 1 of 3. Stage 2 (Response Windows, Damage and Dying, Chains, Glossary) and Stage 3 (interactive Distance demo) get their own plans. Do not build them here.

## Global Constraints

- Branch `feat/rules-wiki-stage-1` from `main`. Never merge or push to `main`. Commit per task.
- `CLAUDE.md` rules apply: presentation components hold no game rules; standalone components; signals; DI.
- UI text casing: Title Case for names and short labels (headings, captions, tags); sentence case for anything that reads as a sentence; keywords keep capitals (Seat names, card names, General names, Forces, card types, phase names, "General(s)", "Main General", "Deputy General", HP). Never show an id: "Seat 2", not `seat-2`.
- Vietnamese: sentence case everywhere, capitals only on the first word and keywords (card names word by word, Tướng, Chủ tướng, Phó tướng, Sinh lực, Forces Ngụy/Thục/Ngô/Quần). Terms per `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`. Seat is "Người chơi N" (existing key `label.seat`: `Seat {n}` / `Người chơi {n}`).
- Terminology: "Tool" not "Trick"; the Qun example General is **Zhang Jiao** (Trương Giác), not Lu Bu.
- Turns go **counter-clockwise** on screen.
- Art only through `content` helpers (`cardArtUrl`, `generalSkinUrl`, `kingdomBannerUrl`, `hpIconUrls`, `CARD_BACK_ART_URL`, `HIDDEN_GENERAL_ART_URL`). No hard-coded `/card-art/...` strings in components. No placeholders.
- Every catalog sentence goes through the existing rich-text mechanism where it names a card, a Force or links a page (`{card:sha}`, `{force:Wei}`, `[[/wiki/rules/setup|Setup]]`).
- Old routes and in-text links keep working. Page `<h2>` titles stay the existing nav labels.
- Light and dark theme and a 400px-wide screen must work. Use the app's `--mat-sys-*` tokens and the global `--force-*` Force colours (defined in `projects/app/src/styles.scss`).
- New Vietnamese keys are added without listing them in `review.json` (they count as draft).
- Scenes show fixed illustrative values. Any rule a sentence or scene states must be confirmed in the engine code, its tests or `docs/architecture/`; unconfirmed claims are cut or turned into a visible "not written yet" note. Record each page's confirmations as a table (claim, source) in the PR description.

## Review Focus

- A scene names a card or General with no art: the page must fail a test, not show a blank or a placeholder box (Task 1, Task 9).
- A Vietnamese string is much longer than the English: scenes must wrap, not clip or scroll the page sideways at 400px (manual check, Task 9).
- A scene or caption leaks an internal id (`seat-2`, `cao-cao`) into visible text or alt text (Task 1 adds the text-scan spec, reused in Task 9).
- A language switch while a page is open must update scene captions, alt text and seat labels, not only the prose (Task 1).
- A page keeps every old link target and the exact nav label as link text (existing snapshot and Vietnamese link specs, kept green in each page task).

---

## File Structure

New, under `projects/app/src/app/wiki/rules/scene/`:
- `scene.css`: shared classes for scenes (frame, rows, steps list, pass/fail branches, pills, arrows, Force colours on seats). Pages list it in `styleUrls` after `rules-page.css`.
- `scene-frame.ts`: `app-scene`, the framed container with a caption.
- `scene-card.ts`: `app-scene-card`, a deck card (and the card back).
- `scene-general.ts`: `app-scene-general`, a General card face (and the face-down General).
- `scene-seat.ts`: `app-scene-seat`, a seat token with portrait, name, Force border, out state.
- `scene-hp.ts`: `app-scene-hp`, a row of HP icons with lost ones dimmed.
- `scene.spec.ts`: specs for the five components.

Modified: the six page files in `projects/app/src/app/wiki/rules/` (`overview.ts`, `setup.ts`, `turn.ts`, `card-types.ts`, `distance.ts`, `judgment.ts`), `projects/app/src/app/i18n/en.ts` and `vi.ts`, `rules.en.spec.ts` and its snapshot, `rules.vi.spec.ts`, `projects/content/src/public-api.ts` (one export).
New spec: `rules-scenes.spec.ts` beside the page specs (art and text guards, Task 9) and `distance-example.spec.ts` (Task 7).

---

### Task 1: Scene components and shared stylesheet

**Files:**
- Create: `scene/scene-frame.ts`, `scene/scene-card.ts`, `scene/scene-general.ts`, `scene/scene-seat.ts`, `scene/scene-hp.ts`, `scene/scene.css`, `scene/scene.spec.ts`
- Modify: `rules.en.spec.ts` (snapshot selector, see Step 6)

**Interfaces:**
- Produces (all standalone, selector prefix `app-scene`):
  - `SceneFrame`: `<app-scene [caption]="MessageKey | undefined">` projects content in a framed box; caption rendered as `<p class="cap">` through `TPipe`.
  - `SceneCard`: `id = input.required<string>()` (a deck card id such as `'sha'`, or `'back'` for the card back), `size = input<'tiny' | 'small' | 'normal' | 'large'>('normal')`, `dim = input(false)`. Renders `<img class="scene-card" [src] [alt]>`; alt is the card's name in the current locale (`cardDisplayData(id, locale).name`), or the existing key for the card back's label if one exists, else a new key `rules.scene.cardBack` ("Card Back" / "Mặt sau lá bài").
  - `SceneGeneral`: `id = input.required<string>()` (a General id such as `'cao-cao'`, or `'hidden'` for the face-down General), `size` as above. Renders `<img class="scene-card" [src] [alt]>`. Alt is the General's name (`generalDisplayData(id, locale).name`), or a new key `rules.scene.hiddenGeneral` ("Hidden General" / "Tướng ẩn").
  - `SceneSeat`: `general = input.required<string>()` (General id), `n = input.required<number>()` (seat number), `force = input<'Wei' | 'Shu' | 'Wu' | 'Qun'>()`, `out = input(false)`, `label = input<string>()` (replaces "Seat N" when given, e.g. a Killer label). Shows the General's skin portrait (`generalSkinUrl`) as `<img class="scene-avatar">` in a circle with a border in the Force colour, the name line `label.seat` with `{ n }`, and the Force name under it when `force` is set.
  - `SceneHp`: `hp = input.required<number>()`, `max = input<number>()`. Renders `hpIconUrls(max ?? hp)` icons; the last `(max ?? hp) - hp` are dimmed and have alt "Lost HP" / "Sinh lực đã mất" (new key `rules.scene.lostHp`); the rest have alt `HP` text from key `rules.scene.hp` ("HP" / "Sinh lực"). Host `aria-label` reads "{hp} HP".
- Shared CSS classes in `scene.css` (pages use them in templates): `.scene-row` (wrapping flex), `.scene-row.top`, `.arrow` (muted large `→`/`+`, `aria-hidden`), `.pill`, `.pill.ok`, `.pill.bad`, `ol.steps` (numbered circles; order is the rule), `.branch` (grid of pass/fail boxes with an `<h5>` each), `.note-pending` (left-bar muted paragraph for "not written yet").

- [ ] **Step 1: Write the failing component specs** in `scene/scene.spec.ts`. Each renders through `TestBed` with `provideRouter([])` and the real `I18n`:
  - `it('SceneCard shows a card by name with its art')`: id `'sha'`, expect an `img` with `src` equal to `cardArtUrl('sha')` and alt `'Sha'`; after `TestBed.inject(I18n).setLocale('vi')` + `detectChanges()`, alt is `'Sát'`.
  - `it('SceneCard shows the card back')`: id `'back'`, `src` equals `CARD_BACK_ART_URL`.
  - `it('SceneGeneral shows a General and the face-down card')`: `'cao-cao'` has `src` `cardArtUrl('cao-cao')` and alt `'Cao Cao'` (vi: `'Tào Tháo'`); `'hidden'` has `HIDDEN_GENERAL_ART_URL`.
  - `it('SceneSeat names the seat, never an id')`: `general='cao-cao'`, `n=2`, `force='Wei'`; text content contains `'Seat 2'` and `'Wei'`, not `'seat-'` or `'cao-cao'`; vi shows `'Người chơi 2'` and `'Ngụy'`; `out=true` adds class `out`.
  - `it('SceneHp dims lost HP')`: `hp=3, max=4` renders 4 images, the last has class `lost`; `hp=4` renders 4 and none lost.
  - `it('SceneFrame shows a translated caption')`: caption key `'rules.scene.hp'` renders `'HP'`.
  - `it('every art url a scene component builds is a real asset path')`: for ids `sha, shan, peach, wine, wuxie, capture, cao-cao, guo-jia, zhang-jiao` the `src` starts with `/card-art/` and is non-null.

- [ ] **Step 2: Run to verify it fails**
Run: `npx jest projects/app/src/app/wiki/rules/scene/scene.spec.ts`
Expected: FAIL, "Cannot find module" for the scene components.

- [ ] **Step 3: Implement the five components and `scene.css`** with the signatures above. Add the new `rules.scene.*` keys to both `en.ts` and `vi.ts` (`rules.scene.hp`, `rules.scene.lostHp`, `rules.scene.cardBack`, `rules.scene.hiddenGeneral`). Card and General sizes follow the existing `CardArt` dimensions (tiny 26×36, small 44×60, normal 70×96, large 160×220) set in `scene.css` with `aspect-ratio`, `object-fit: cover`, rounded corners and a soft shadow. Seat Force border colours come from the global `--force-wei|shu|wu|qun` variables. Scene frame uses `--mat-sys-surface-container`, `--mat-sys-outline-variant`, text `--mat-sys-on-surface-variant` for captions. The component renders an `img` even if a url is null only if the url is non-null; with a null url it renders nothing (the Task 9 spec fails a page that does this).

- [ ] **Step 4: Run to verify it passes**
Run: `npx jest projects/app/src/app/wiki/rules/scene/scene.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the catalog specs**
Run: `npx jest projects/app/src/app/i18n projects/app/src/app/wiki/rules/rules.vi.spec.ts`
Expected: PASS (the English-Vietnamese key parity spec accepts the new keys).

- [ ] **Step 6: Widen the English snapshot selector** in `rules.en.spec.ts` from `'h2, h3, p, li, th, td'` to `'h2, h3, p, li, th, td, .cap, figcaption'` so scene captions and labels are pinned. Do not update snapshots yet (they will change page by page).

- [ ] **Step 7: Commit**
```bash
git add projects/app/src/app/wiki/rules projects/app/src/app/i18n
git commit -m "feat: scene components for the rules wiki"
```

---

### Task 2: Counter-clockwise wording fix

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts` (`rules.turn.end`), `projects/app/src/app/i18n/vi.ts` (`rules.turn.end`), `rules.vi.spec.ts`

**Interfaces:** Consumes the existing key `rules.turn.end`. Produces nothing new.

- [ ] **Step 1: Write the failing test** in `rules.vi.spec.ts`: `it('turn: turns pass counter-clockwise')` opens `/wiki/rules/turn` in Vietnamese and expects the text to contain `'ngược chiều kim đồng hồ'` and not match `/theo chiều kim đồng hồ/`.
- [ ] **Step 2: Run to verify it fails**
Run: `npx jest projects/app/src/app/wiki/rules/rules.vi.spec.ts -t "counter-clockwise"`
Expected: FAIL.
- [ ] **Step 3: Edit the two strings.** English: "...Then the next living seat counter-clockwise begins its turn." Vietnamese: "...Sau đó người chơi còn sống kế tiếp ngược chiều kim đồng hồ bắt đầu lượt của mình."
- [ ] **Step 4: Run** the same command. Expected: PASS. The English snapshot test for `turn` now fails; it is updated in Task 5, so leave it for now.
- [ ] **Step 5: Commit** `git commit -m "fix: turns pass counter-clockwise in the rules text"`.

---

### Task 3: Overview page scenes

**Files:**
- Modify: `overview.ts`, `en.ts`, `vi.ts`, `rules.vi.spec.ts`, `__snapshots__/rules.en.spec.ts.snap`

**Interfaces:** Consumes Task 1 components and `kingdomBannerUrl`. Keeps every existing `rules.overview.*` key and the six `<a>` link targets and labels.

Scenes (from the draft's Overview page):
1. "The Four Forces" (`app-scene`, caption key `rules.overview.forcesCap`, "The Four Forces" / "Bốn thế lực"): four cells, each a Force banner (`kingdomBannerUrl`), the Force name in its colour, and a General card: Cao Cao (Wei), Liu Bei (Shu), Sun Quan (Wu), **Zhang Jiao (Qun)**.
2. "A Game in Four Beats": new `<h3>` (`rules.overview.beats`) and an `ol.steps` of four sentences (new keys `rules.overview.beat1..4`; text from the draft; the Turns beat says counter-clockwise).
3. A "Who Wins" scene after the Winning list: seats 1 and 3 Wei, seats 2 and 4 out (`SceneSeat` `out`), with a sentence (`rules.overview.winExample`, text from the draft).

Where it already exists, reuse the catalog sentences unchanged. Keep "Where to read next" as the existing list of links so link labels equal nav labels.

- [ ] **Step 1: Write the failing tests.** In `rules.vi.spec.ts`: `it('overview: the Forces scene names Zhang Jiao for Qun')` expects the scene text to contain `'Trương Giác'` and `'Quần'`; `it('overview: the four beats and the example')` expects four `ol.steps > li` and a scene with two `.out` seats. Existing `overview: the Forces, the link labels and the paths` must still pass unchanged.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/rules.vi.spec.ts -t overview`. Expected: FAIL.
- [ ] **Step 3: Implement** the template and add the new keys in both catalogs (English from `draft-en.html`, Vietnamese from `draft-vi.html`, applying the casing rules above).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Update the English snapshot for this page only**: `npx jest projects/app/src/app/wiki/rules/rules.en.spec.ts -t overview -u`, then read the diff: only the added lines should differ (the links list must be unchanged).
- [ ] **Step 6: Commit** `git commit -m "feat: scenes on the rules Overview page"`.

---

### Task 4: Setup page scenes

**Files:** Modify `setup.ts`, `en.ts`, `vi.ts`, `rules.vi.spec.ts`, snapshot.

**Interfaces:** Consumes Task 1 components. Keeps `rules.setup.*` keys; adds captions and one sentence per scene as needed.

Scenes (draft Setup page):
1. The four setup steps stay an `ol.steps`; under step 1 a row of seven General cards (Cao Cao, Zhang Liao, Liu Bei, Guan Yu, Sun Quan, Gan Ning, Zhang Jiao) each with its Force name; under step 2 Cao Cao (Main General) and Guo Jia (Deputy General) → two face-down General cards (`'hidden'`); under step 3 the worked sum "Cao Cao 4 + Guo Jia 3 = 7, half is 3.5, rounded down" with `app-scene-hp hp=3`; under step 4 four card backs.
2. "Example: The Reveal Bonus": Cao Cao revealed + hidden Deputy → Cao Cao + Guo Jia both revealed → card back "Draw 1", with the draft's explanatory sentence.
3. "Killing a Seat": two side-by-side scenes, "Different Force" (Wei killer → Shu seat out) and "Same Force" (Wei killer → Wei seat out), each with its existing sentence (`rules.setup.kill2`, `rules.setup.kill3`) shown under the seats. The seats use `SceneSeat` with `label` for the killer.

- [ ] **Step 1: Write the failing tests** in `rules.vi.spec.ts`: `it('setup: the deal shows seven Generals, including a Qun one')` expects at least 7 `img.scene-card` General images inside the first step (assert count and that one alt is `'Trương Giác'`); `it('setup: the HP example')` expects the HP scene to have 3 non-lost icons and the text `'3,5'`; `it('setup: both kill cases are shown')` expects two scenes captioned `'Khác thế lực'` and `'Cùng thế lực'`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/rules.vi.spec.ts -t setup`. Expected: FAIL.
- [ ] **Step 3: Implement** template and keys (text from the drafts).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Update the `setup` English snapshot** (`-t setup -u`) and read the diff for unintended changes.
- [ ] **Step 6: Commit** `git commit -m "feat: scenes on the rules Setup page"`.

---

### Task 5: Turn Structure page scenes

**Files:** Modify `turn.ts`, `en.ts`, `vi.ts`, `rules.vi.spec.ts`, snapshot.

**Interfaces:** Consumes Task 1 components. Replaces the phase `<table>` with a six-tile strip (tile: phase name from the existing `phase.indicator`/`history.phase.*` keys, a few real cards or icons, the existing `rules.turn.*` sentence). Keeps `rules.turn.lead`, `rules.turn.note`.

Scenes (draft Turn page):
1. Six phase tiles in one row (grid, two columns at 400px). Tile art: Start → hidden General; Judgment → Capture and Lightning; Draw → two card backs; Play → Sha, Peach, Steal, tile marked as the one that waits; Discard → HP icons; End → an arrow. The Play tile carries a `waits` visual state and an accessible label.
2. "Play Phase" `<h3>` and a scene "Example: One Play Phase at 3 HP": three `ol.steps` (heal with Peach, one Sha, end the phase) with `app-scene-hp` 3 of 4 → 4 of 4.
3. "Discard Phase" `<h3>` and a scene "Example: 6 Cards, 4 HP": six cards (Sha, Shan, Peach, Wuxie kept; Steal, Break dimmed with a "Discard" pill) and a sentence with 4 HP icons.

- [ ] **Step 1: Write the failing tests** in `rules.vi.spec.ts` (replace the old `turn: the six phases…` test, whose `th` assertions no longer apply): `it('turn: six phases in order, the Play phase marked as waiting')` expects six `.phase` tiles whose headings are `['Bắt đầu','Phán xét','Rút bài','Ra bài','Bỏ bài','Kết thúc']` and only the fourth has class `waits`; `it('turn: the cards named in the text')` keeps the two `toContain` checks (`'một Sát mỗi lượt'`, `'Lạc Bất Tư Thục hoặc Binh Lương Thốn Đoạn'`); `it('turn: discard example keeps 4 and discards 2')` expects 6 card images, 2 with class `dim`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/rules.vi.spec.ts -t turn`. Expected: FAIL.
- [ ] **Step 3: Implement** template and new keys.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Update the `turn` English snapshot** (`-t turn -u`); confirm the diff shows "counter-clockwise" from Task 2.
- [ ] **Step 6: Commit** `git commit -m "feat: scenes on the rules Turn Structure page"`.

---

### Task 6: Card Types page scenes

**Files:** Modify `card-types.ts`, `en.ts`, `vi.ts`, `rules.vi.spec.ts`, snapshot.

**Interfaces:** Consumes Task 1 components. Replaces the table with sections: General Cards, Basic Cards, Tools, Equipment. Each section heading is a link to its existing wiki page (`/wiki/generals`, `/wiki/basic`, `/wiki/tools`, `/wiki/equipment`) with the existing label keys (`rules.cardTypes.general|basic|tools|equipment`); each keeps its existing text key (`rules.cardTypes.generalText`, …). Keep `rules.cardTypes.lead` and `.see`.

Scenes (draft Card Types page):
1. General Cards: Cao Cao (Wei, 4 HP), Guan Yu (Shu, 4 HP), face-down General ("What others see").
2. Basic Cards: Sha, Shan, Peach, Wine, each with a one-line role (new keys `rules.cardTypes.role.sha|shan|peach|wine`, short fragments, Title Case not needed because they are sentences).
3. Tools: two scenes, "Instant Tools" (Steal, Break, Duel, Barbarians, Hail of Arrows, Peach Garden, Wuxie) and "Delayed Tools" (Capture, Starvation, Lightning) with a link to the Judgment page (`[[/wiki/rules/judgment|Judgment]]`).
4. Equipment: "One Seat's Equipment Slots": Crossbow (Weapon, range 1), Eight Trigrams (Armor), Red Hare (Minus Mount), Shadow Runner (Plus Mount), tag and one-line role each (confirm roles against the card data and engine: Red Hare is the offensive mount, Shadow Runner the defensive one).

- [ ] **Step 1: Write the failing tests** in `rules.vi.spec.ts` (replace the old `card types: the links keep their place in the headings…` test): `it('card types: the section headings link to the wiki pages with Vietnamese labels')` expects the heading links, in order, `['/wiki/generals Bài Tướng','/wiki/basic Bài cơ bản','/wiki/tools Cẩm nang','/wiki/equipment Trang bị']`; keep the three `toContain` checks (`'Sát, Thiểm, Đào và Tửu'`, `'Vô Giải Khả Kích có thể hủy một Cẩm nang'`, `'một Chủ tướng và một Phó tướng'`); add `it('card types: the equipment scene shows the four slots')` expecting four cards with the tags `['Vũ khí','Giáp','Tọa kỵ công -1','Tọa kỵ thủ +1']`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/rules.vi.spec.ts -t "card types"`. Expected: FAIL.
- [ ] **Step 3: Implement** template and new keys (Vietnamese slot tags reuse `slot.defensiveMount`/`slot.offensiveMount`/`card.subtype.weapon|armor` where they match exactly; otherwise new keys).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Update the `card-types` English snapshot** and read the diff.
- [ ] **Step 6: Commit** `git commit -m "feat: scenes on the rules Card Types page"`.

---

### Task 7: Distance / Range page: static scene, numbers pinned to the engine

**Files:**
- Modify: `distance.ts`, `en.ts`, `vi.ts`, `rules.vi.spec.ts`, snapshot, `projects/content/src/public-api.ts`
- Create: `distance-example.ts` (the example's data, exported const), `distance-example.spec.ts`

**Interfaces:**
- Produces from content: `export { seatDistance, attackRange } from './lib/shared/queries';` in `public-api.ts` (an export only; no behavior change).
- Produces: `DISTANCE_EXAMPLE` in `distance-example.ts`: a six-seat table (seat numbers 1..6, attacker Seat 1, Seat 4 out, Shadow Runner on Seat 3, no weapon) with each seat's expected distance from Seat 1. The page renders from it.

Scene (static version of the draft's "Try It"): a ring of six `SceneSeat`s, Seat 1 marked as the attacker, Seat 4 out, Shadow Runner (small card) beside Seat 3, and each other seat showing its distance badge, highlighted when within attack range 1. A caption states the example. Keep all existing `rules.distance.*` sentences and the Range list. Do not add any sentence promising an interactive version; the page makes no promises about later stages.

- [ ] **Step 1: Write the failing spec** `distance-example.spec.ts`: build a minimal `GameState` (adapt the `table()` helper and `registry` from `projects/content/src/lib/cards/equipment-abilities.spec.ts`, lines 9-40, to six seats; equip Shadow Runner on seat 3 using `horseCards`; mark seat 4 `eliminated: true`). For each seat in `DISTANCE_EXAMPLE`, assert `seatDistance(state, 'seat-1', 'seat-N', registry)` equals the listed distance. Also assert `attackRange(state, 'seat-1', registry)` equals the example's range (1).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/distance-example.spec.ts`. Expected: FAIL ("distance-example" missing / export missing).
- [ ] **Step 3: Add the content export, create `distance-example.ts` with the data, and make the spec pass.** Compute the expected figures by hand first from the rules text (seats 1,2,3,5,6 alive around the ring; Shadow Runner adds 1 to Seat 3), then confirm they match `seatDistance`; if the engine disagrees, the engine wins and the scene data changes.
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Write the failing page test** in `rules.vi.spec.ts`: `it('distance: the table scene shows the distances from the example')` expects five distance badges whose texts equal the `DISTANCE_EXAMPLE` values in seat order, and one `.out` seat.
- [ ] **Step 6: Run** `-t distance`. Expected: FAIL.
- [ ] **Step 7: Implement the page template and keys** (draft text; Seat captions use `label.seat`).
- [ ] **Step 8: Run** `-t distance`. Expected: PASS. Update the `distance` English snapshot and read the diff.
- [ ] **Step 9: Commit** `git commit -m "feat: static distance scene on the rules Distance page, pinned to the engine"`.

---

### Task 8: Judgment page scenes

**Files:** Modify `judgment.ts`, `en.ts`, `vi.ts`, `rules.vi.spec.ts`, snapshot.

**Interfaces:** Consumes Task 1 components. Keeps `rules.judgment.*` keys; the four judgment steps become an `ol.steps` (step 1 shows a card back); the card table becomes three scenes (Capture, Starvation, Lightning), each: the card, its existing rule sentence (`rules.judgment.capture|starvation|lightning`), and a `.branch` of two outcomes with a suit/rank pill (hearts/clubs/spades/diamonds symbols; "Judgment Shows a Heart" / "Anything Else", etc.; new keys `rules.judgment.out.*`). Confirm the suit and rank outcomes against `judgmentOutcome` in the content project; the example pills (9♥, K♠, 4♣, Q♦, 5♠, J♠) are illustrative and must be consistent with the stated rule.

- [ ] **Step 1: Write the failing tests** in `rules.vi.spec.ts` (replace `judgment: the card names in the table headings`): `it('judgment: one scene per Delayed Tool, with its card')` expects three scenes captioned `['Lạc Bất Tư Thục','Binh Lương Thốn Đoạn','Thiểm Điện']`, each with a card image, and two outcome boxes; `it('judgment: the four steps are ordered')` expects four `ol.steps > li`.
- [ ] **Step 2: Run** `-t judgment`. Expected: FAIL.
- [ ] **Step 3: Implement** template and keys; keep the pending note about a judgment-changing skill example as visible catalog text (`rules.judgment.pending`, `.note-pending`).
- [ ] **Step 4: Run** `-t judgment`. Expected: PASS. Update the `judgment` English snapshot and read the diff.
- [ ] **Step 5: Commit** `git commit -m "feat: scenes on the rules Judgment page"`.

---

### Task 9: Whole-stage guards and verification

**Files:** Create `rules-scenes.spec.ts` (in `wiki/rules/`). Modify nothing else unless a guard fails.

**Interfaces:** Consumes all pages.

- [ ] **Step 1: Write the guard spec** `rules-scenes.spec.ts`, over the six pages × two languages:
  - `it('every scene image has art and an alt')`: every `img.scene-card` (used by `SceneCard` and `SceneGeneral`) and `img.scene-avatar` (used by `SceneSeat`) has a `src` beginning `/card-art/` and a non-empty `alt`; no element with class `card-art-placeholder` exists.
  - `it('no id or placeholder text is shown')`: the page's visible text and all `alt` texts match none of `/seat-\d/`, `/\b(cao-cao|zhang-jiao|guo-jia|liu-bei|sun-quan)\b/`, `/undefined|null|\[object/`.
  - `it('a language switch updates scenes')`: open `setup` in English, `setLocale('vi')`, `detectChanges()`; a scene caption and a seat label are Vietnamese.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules`. Expected: PASS (fix any real failure found, in the owning page).
- [ ] **Step 3: Run the full checks**
Run: `npm run verify` then `npm test`
Expected: lint, typecheck and build succeed; all test suites pass, no obsolete snapshots.
- [ ] **Step 4: Report i18n state**
Run: `npm run i18n:status`
Expected: runs; the new Vietnamese keys show as draft.
- [ ] **Step 5: Manual browser check** (`npm start`, open `/wiki/rules/overview` through each of the six pages, in English and Vietnamese, light and dark, and at about 400px wide): scenes wrap with no sideways page scroll, no clipped text, Force colours legible, nothing blank. Record what was checked, and anything that could not be, in the PR description.
- [ ] **Step 6: Commit** `git commit -m "test: guards for scene art and text on the rules pages"`. Do not push or merge; hand the branch to the user for review.

---

## Self-Review

- **Spec coverage:** scene components (Task 1); six pages with scenes (Tasks 3 to 8); Zhang Jiao for Qun (Task 3, Setup General row); counter-clockwise (Task 2 and the Overview beat); static Distance pinned to engine (Task 7, content export allowed by the spec); old routes and links kept (existing specs kept green; Task 9); English and Vietnamese together with draft state (all page tasks, review.json untouched); no placeholders (Task 9); engine verification table in the PR (Global Constraints). Not in this plan by design: new pages, Chains marks, interactive demo (Stages 2 and 3).
- **Type consistency:** `SceneFrame.caption`, `SceneCard.id/size/dim`, `SceneGeneral.id/size`, `SceneSeat.general/n/force/out/label`, `SceneHp.hp/max` are defined in Task 1 and used with those names in Tasks 3 to 8; `DISTANCE_EXAMPLE` is defined and consumed in Task 7 only.
- **Proportion:** the plan describes interfaces, scenes and assertions; the drafts carry the example data and the Vietnamese wording.
