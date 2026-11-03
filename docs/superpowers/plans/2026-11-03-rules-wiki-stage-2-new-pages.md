# Rules Wiki Stage 2: Response Windows, Damage and Dying, Chains, Glossary

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new rules pages (Response Windows, Damage and Dying, Chains, Glossary), each built from the real art and written in English and Vietnamese, and put all ten rules pages in the spec's navigation order.

**Architecture:** Reuse the Stage 1 scene components. Extend `SceneSeat` with a chained badge, a damage mark and a note line. Each page is a standalone component with its sentences in the i18n catalogs. Every rule a page states is first pinned by a characterization test in the engine or content package, so a picture cannot drift from the game.

**Tech Stack:** Angular (standalone components, signals), Jest with jest-preset-angular (`npx jest <path>`), the i18n catalogs (`en.ts`, `vi.ts`), the content and engine projects.

**Spec:** `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-design.md`. Reference drafts: `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-drafts/draft-en.html` and `draft-vi.html` (pages `#response`, `#damage`, `#chains`, `#glossary`). Where a draft and the engine disagree, the engine wins.

**Stacked on Stage 1** (`feat/rules-wiki-stage-1`, PR #39). Branch `feat/rules-wiki-stage-2` is cut from it. Open the PR against the Stage 1 branch (retarget to `main` once Stage 1 merges). Stage 3 (interactive Distance demo) is not part of this plan.

## Global Constraints

- All Stage 1 constraints still apply: `CLAUDE.md` layering (no game rules in components), UI text casing (Title Case labels and captions; sentence case sentences; keywords keep capitals: Seat names, card names, General names, Forces, phase names, HP), Vietnamese sentence case with keyword capitals, terms from `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` (Seat is "Người chơi N", via existing key `label.seat`; dying is "hấp hối"), art only through `content` helpers, no placeholders, light and dark themes, no sideways scroll at 400px.
- English card names come from the content display data through `{card:id}` tokens (Slash, Dodge, Peach, Wine, Wuxie ...), never typed literally. General names come from `generalDisplayData`.
- Turns go counter-clockwise on screen. The Qun example General is Zhang Jiao.
- New routes: `rules/response`, `rules/damage`, `rules/chains`, `rules/glossary`. Existing routes unchanged.
- Navigation order (spec): Overview, Setup, Turn Structure, Card Types, Distance / Range, Response Windows, Damage and Dying, Judgment, Chains, Glossary.
- Page titles: English "Response Windows", "Damage and Dying", "Chains", "Glossary"; Vietnamese "Cửa sổ phản hồi", "Sát thương và hấp hối", "Xích", "Thuật ngữ". Nav keys `nav.rules.response|damage|chains|glossary`.
- New Vietnamese keys are not added to `review.json` (they count as draft).
- Branch work: commit per task; never merge or push to `main`; do not push the branch until the user chooses to.
- The engine facts below were read from the code on 2026-11-03 and are the source for the pages; Task 2 pins each one in a test.

**Engine facts the pages state**
1. Dying round order: the seats in turn order starting from the seat whose turn it is (`turnOrderFrom(owner)` in `content/src/lib/modes/guozhan.ts`). The dying seat is always asked; any other seat is asked only while it holds a Peach.
2. Each Peach heals the dying seat 1 HP, then the same asker is asked again, until the seat is above 0 HP. A seat can fall below 0 HP (a 2-damage hit at 1 HP leaves it at -1), so it may need several Peaches, from different seats in turn order.
3. Any seat can rescue with a Peach, whatever its Force. Wine rescues only its own holder (`RESCUE_CARD_IDS = { any: ['peach'], self: ['wine'] }`).
4. When nobody is left to ask, the seat is eliminated: both Generals are revealed, the kill reward applies (see Setup page), and it discards its cards.
5. Wuxie check: the living seats in seat order starting from the Tool's user, only those holding a Wuxie. A Wuxie queues a counter-check starting at the seat after it (a seat is never asked about its own card). Passes are not announced. The last Wuxie decides. (`docs/architecture/event-chain.md`, "The Tool lifecycle".)
6. A Tool that hits many seats (Barbarians) runs its own Wuxie check for each target, in order; a Wuxie spares only that target (`event-chain.md`, "Example: Barbarians").
7. Chains: a Tool on 1 or 2 living seats at any distance, the user included; each unchained target becomes chained, each chained target becomes unchained; or Recast (no target): discard it and draw 1.
8. Chain wave: only fire and thunder damage that actually lands on a chained seat travels. That seat is unchained. Each other living chained seat, in turn order starting after the damaged seat, takes the original amount (before its target's own modifiers), one at a time, and is unchained; a seat hit by a wave does not start a wave of its own. A damaged seat's dying round resolves before the next seat is hit. Plain damage never travels. (`event-chain.md`, "Damage natures and chains"; `chainWaveOrder` in `engine/src/lib/rules/chains.ts`.)
9. Wine: once per turn, the next proactive Slash deals 1 more damage (`content/src/lib/cards/wine.ts`, `sha.ts`).
10. Damage kinds: Slash is normal; Fire Attack and Blaze are fire; Lightning Attack and Lightning are thunder.

## Review Focus

- A rule on a new page that the engine does not follow (dying order, several Peaches, Wuxie scope, chain wave order and amount): each is pinned by a Task 2 test and cited in the PR table.
- A new page missing from the nav, the Overview list, the English snapshot, the Vietnamese link-label spec or the Stage 1 art/id guards (the Page checklist covers each, and Task 7 checks the sum).
- A chained or damaged seat whose badge covers the General's face or the seat name at 400px, in Vietnamese (checked by eye in Task 7).
- A Glossary entry whose picture has no art, or whose definition contradicts the page it summarises.
- A negative HP shown as a bare number ("-1") with no unit or label, for a reader.

---

## Page checklist (applies to Tasks 3 to 6; each page task lists only what is specific)

For a new page `<slug>` (component `Rules<Name>` in `projects/app/src/app/wiki/rules/<slug>.ts`, route `rules/<slug>`):
1. Failing tests first in `rules.vi.spec.ts` (Vietnamese page structure and wording) and the page added to `rules.en.spec.ts`'s page list, `rules-scenes.spec.ts`'s `PAGES`, and the `it.each([...title])` titles test.
2. Component with `styleUrls: ['./rules-page.css', './scene/scene.css']`, `<h2>` from `nav.rules.<key>`, a `lead` paragraph, scenes through the Stage 1 components. All sentences in `en.ts` and `vi.ts` under `rules.<key>.*`; English from the draft but card names as `{card:id}` tokens; Vietnamese from the draft, adjusted to the casing rules.
3. Route in `wiki.routes.ts`; nav item in `app.ts` `rulesPages` in the spec order; row in the `app.spec.ts` rules-menu expectation.
4. Overview "Where to read next" gains an entry `rules.overview.next.<key>` (`[[/wiki/rules/<slug>|<nav label>]]: <short description>.`) in both languages, in nav order; the `overview` Vietnamese link-list test and the NAV link-label map in `rules.vi.spec.ts` gain the page.
5. English snapshot for the page added (`npx jest ...rules.en.spec.ts -t <slug> -u`), the diff read, then committed.
6. `npx tsc -p projects/app/tsconfig.app.json --noEmit`, `npx eslint projects/app/src/app/wiki`, `npx jest projects/app/src/app/wiki projects/app/src/app/i18n projects/app/src/app/app.spec.ts` all green.

Typecheck specs too: `npx tsc -p projects/app/tsconfig.spec.json --noEmit` (Jest does not).

---

### Task 1: SceneSeat gains a chained badge, a damage mark and a note

**Files:**
- Modify: `projects/content/src/lib/assets.ts` (one constant), `projects/app/src/app/wiki/rules/scene/scene-seat.ts`, `scene/scene.spec.ts`, `rules-scenes.spec.ts`

**Interfaces:**
- Produces in `content` (`assets.ts`): `export const CHAIN_ICON_URL = '/card-art/misc/chain.png';` (the file the Game screen already uses; keep `seat-tile.ts` as it is).
- Produces on `SceneSeat`: `chained = input(false)`, `mark = input<'damage' | 'fire' | 'lightning'>()`, `note = input<string>()`.
  - `chained` renders `<img class="scene-chain" [src]="CHAIN_ICON_URL">` with alt from `seat.chained` ("Chained" / "Bị xích"), positioned on the **top right corner** of the portrait.
  - `mark` renders `<img class="scene-mark" aria-hidden alt="">` using `DAMAGE_IMAGE_URLS[mark]` from `projects/app/src/app/game-board/damage-effects.ts`, positioned at the **centre of the portrait**.
  - `note` renders a muted line under the Force name (for "Dying", "-1 HP", "4 HP"); callers pass already-translated text.

- [ ] **Step 1: Write the failing tests** in `scene/scene.spec.ts`:
  - `it('SceneSeat shows a chained badge with its art and name')`: `chained: true` gives `img.scene-chain` with `src` `CHAIN_ICON_URL` and alt `'Chained'` (vi: `'Bị xích'`); without it there is none.
  - `it('SceneSeat shows a damage mark over the portrait')`: `mark: 'fire'` gives `img.scene-mark` with `src` `DAMAGE_IMAGE_URLS.fire`; `mark` unset gives none.
  - `it('SceneSeat shows its note')`: `note: '4 HP'` puts `'4 HP'` in the text.
  - In `rules-scenes.spec.ts` extend the art guard's selector to `'img.scene-card, img.scene-avatar, img.scene-chain'` (the mark is decorative, so it is excluded from the alt rule; assert instead that every `img.scene-mark` has `src` starting `/card-art/`).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/scene/scene.spec.ts`. Expected: FAIL (inputs and constant missing).
- [ ] **Step 3: Implement** the constant, the three inputs and their template and styles in `scene-seat.ts` (absolute positioning inside the `.seat` box, `position: relative`; portrait size comes from `--seat-av`, so place the badge at `top: -6px; right: calc((var(--seat-w, 88px) - var(--seat-av, 60px)) / 2 - 8px)` and the mark centred at `top: calc(var(--seat-av, 60px) / 2)` with `translate(-50%, -50%)`).
- [ ] **Step 4: Run** the scene spec, then `npx jest projects/app/src/app/wiki projects/app/src/app/i18n`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: chained badge, damage mark and note on scene seats"`.

---

### Task 2: Pin the engine claims in characterization tests

**Files:**
- Create: `projects/content/src/lib/rules-wiki-claims.spec.ts`

**Interfaces:** Consumes the engine and content public APIs (`resolve`, `getLegalActions`, `advanceToDecision`, `buildContentRegistry`, the Guozhan mode) the way `projects/content/src/lib/cards/equipment-abilities.spec.ts` and the existing Guozhan specs do. Produces nothing the app uses. These tests describe behavior that already exists, so they should pass on first run; find the existing tests that already pin a claim first (grep `projects/engine` and `projects/content` for `dying`, `Wuxie`, `chain`, `Barbarians`) and cite those in the PR instead of duplicating them.

Claims to pin, each as one test with the engine's own state (build the smallest valid table; reuse an existing spec's helpers):
- `it('a dying seat at -1 needs two Peaches, asked in turn order from the turn owner')`: seat at 1 HP takes 2 damage; the seat whose turn it is holds one Peach and another seat holds one; assert the asking order, that one Peach leaves the seat at 0 HP and the window asks again, and the second Peach saves it at 1 HP (events include `SeatSavedEvent`).
- `it('any seat may rescue with a Peach, whatever its Force')`: the rescuer's Force equals no one's; it is asked and its Peach heals.
- `it('Wine rescues only its own holder')`: a Wine held by a seat other than the dying one is not an allowed card in that seat's dying window; the dying seat's own is.
- `it('a seat nobody can rescue is eliminated and both its Generals are revealed')`.
- `it('Barbarians runs one Wuxie check per target and a Wuxie spares only its own target')`: follow `docs/architecture/event-chain.md` "Example: Barbarians".
- `it('a chain wave goes in turn order after the damaged seat, deals the original amount, and unchains every seat it touches')`: three chained seats, 2 fire damage; also assert plain damage does not travel, and that a seat hit by a wave does not start a wave.
- `it('Wine boosts only the next Slash')`.

- [ ] **Step 1: Write the tests** above, citing any existing test you reuse instead.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/rules-wiki-claims.spec.ts`. Expected: PASS. For each test, make it fail once by mutating the engine behavior it pins (for example drop the "ask the same seat again" in `applyDying`), see it fail, and revert; record each as a ledger line (a test never seen failing proves nothing).
- [ ] **Step 3: If a claim does NOT hold** (the engine disagrees with the Engine facts list), stop and ask the user: the page text and the draft both change, and the engine is the authority.
- [ ] **Step 4: Run** `npx jest projects/content projects/engine`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "test: pin the rules the new wiki pages state"`.

---

### Task 3: Response Windows page

**Files:** Create `rules/response.ts`; modify the Page checklist files.

**Interfaces:** Consumes Task 1 seat inputs and Stage 1 scene components. Keys `rules.response.*`, `nav.rules.response`.

Scenes (draft `#response`, with the engine-confirmed additions):
1. "Slash and Dodge": two steps. Seat 1 plays `{card:sha}` on Seat 3 (seats with cards between); then a window for Seat 3 with a `.branch`: plays `{card:shan}` (no effect) or passes (`app-scene-hp` 4 of 4 to 3 of 4, "1 damage").
2. "Wuxie on a Tool": paragraph (fact 5, including that passes are not announced), then a scene "Example: Break With a Wuxie Chain": four steps (Break, first Wuxie cancels it, a Wuxie on that Wuxie, nobody answers so Break goes ahead; "the last Wuxie decides").
3. "Wuxie on a Tool That Hits Many Seats" (replaces the draft's pending note; fact 6): a scene "Example: Barbarians" with three targets from `docs/architecture/event-chain.md`: Seat 2 plays a Slash and is safe; Seat 3 holds a Wuxie, plays it and is spared; Seat 4 passes and takes 1 damage. Use `app-scene-seat` with `note`, cards `barbarians`, `wuxie`, `sha`.

- [ ] **Step 1: Write the failing tests** (Page checklist 1 plus): `it('response: Slash and Dodge show a play branch and a pass branch')` expects two `.branch > div`; `it('response: the Wuxie chain has four ordered steps and ends with the Tool taking effect')` expects four `ol.steps > li` in that scene and the last step to contain the Tool's card image; `it('response: Barbarians shows three targets and one spared')` expects three seats in that scene and exactly one note reading as spared (assert the Vietnamese note text); no `.note-pending` on the page.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/rules.vi.spec.ts -t response`. Expected: FAIL.
- [ ] **Step 3: Implement** the page per the Page checklist 2 to 4.
- [ ] **Step 4: Run** the checklist 6 commands. Expected: PASS. Then checklist 5 (snapshot).
- [ ] **Step 5: Commit** `git commit -m "feat: Response Windows rules page"`.

---

### Task 4: Damage and Dying page

**Files:** Create `rules/damage.ts`; modify the Page checklist files.

**Interfaces:** Consumes Task 1 seat inputs (`mark`, `note`), `SceneHp`, `SceneCard`. Keys `rules.damage.*`, `nav.rules.damage`.

Scenes (draft `#damage`, with the facts):
1. "HP and Damage": a row `SceneHp` 4 of 4, the damage mark image, `SceneHp` 3 of 4, and a sentence.
2. "Wine" (fact 9): `{card:wine}` + `{card:sha}` to 2 damage ("your next {card:sha}").
3. "Kinds of Damage" (fact 10): three figures: Slash (normal), Fire Attack (fire), Lightning Attack (thunder), with the other cards named in the sentence by tokens; link to the Chains page.
4. "Dying and Rescue" (facts 1 to 4): steps: (1) Seat 4 at 1 HP takes 2 damage and is at -1 HP, dying (seat with `note` "-1 HP"); (2) the round asks the seats in turn order from the turn owner, skipping seats with no `{card:peach}`, and always asks the dying seat; (3) each Peach heals 1 and the same seat is asked again, so two Peaches from two seats bring it from -1 to 1 HP; any seat may rescue, whatever its Force; `{card:wine}` rescues only its own holder; (4) a `.branch`: "Back Above 0 HP" (saved) or "Nobody Rescues" (eliminated, both Generals revealed, kill reward as under Setup, linked, discards cards).
Reader-facing negative HP: every "-1 HP" is shown through the note text with its unit, and the `SceneHp` is not used for negative values.

- [ ] **Step 1: Write the failing tests** (checklist 1 plus): `it('damage: the dying example needs two Peaches')` expects two Peach cards in the rescue scene and the notes `'-1 Sinh lực'` then `'1 Sinh lực'`; `it('damage: Wine and Slash show 2 damage')`; `it('damage: three kinds of damage with their cards')` expects three figures; `it('damage: both outcomes of a dying round are shown')` expects two `.branch > div`.
- [ ] **Step 2: Run** `-t damage`. Expected: FAIL.
- [ ] **Step 3: Implement** (checklist 2 to 4). The English note sentences use the existing `rules.scene.hpCount` format ("{n} HP"), so negative HP reads "-1 HP".
- [ ] **Step 4: Run** the checklist 6 commands; checklist 5.
- [ ] **Step 5: Commit** `git commit -m "feat: Damage and Dying rules page"`.

---

### Task 5: Chains page

**Files:** Create `rules/chains.ts`; modify the Page checklist files; the Judgment, Damage pages link to it where they already name Chains/fire damage (the Damage page already does, Task 4).

**Interfaces:** Consumes Task 1 (`chained`, `mark`, `note`). Keys `rules.chains.*`, `nav.rules.chains`.

Scenes (draft `#chains`, with the facts 7 and 8):
1. "Chaining and Unchaining": `{card:chains}` → a seat not chained → the same seat chained (`chained`). Sentence (fact 7, including "Recast").
2. "The Chain Wave": paragraph: only fire and thunder damage travels; plain damage never does. A scene "Example: 2 Fire Damage on Seat 2" with three steps: (1) Seats 2, 3 and 5 are chained; Seat 1 uses `{card:fire-attack}`; Seat 2 takes 2 fire damage (`mark: 'fire'` on Seat 2); (2) Seat 2 loses 2 HP and is unchained; (3) the other chained seats are hit in turn order after Seat 2 (3, then 5), each taking the original 2 damage and being unchained, one at a time; a hit that starts a dying round resolves before the next seat is hit; a seat hit by a wave does not start a wave of its own. The seat order in the rows follows turn order after Seat 2.
No pending note: the "why a chained hit does not start its own wave" sentence is a rule sentence (fact 8).

- [ ] **Step 1: Write the failing tests** (checklist 1 plus): `it('chains: the chain wave example hits two seats after the damaged one, in order')` expects, in step 3, the two hit seats' names in turn order (Seat 3 then Seat 5, as 'Người chơi 3', 'Người chơi 5'), each with a fire mark, and no chained badge left on them; `it('chains: chaining toggles a seat')` expects exactly one chained badge in the first scene; `it('chains: the page states that plain damage never travels')`.
- [ ] **Step 2: Run** `-t chains`. Expected: FAIL.
- [ ] **Step 3: Implement** (checklist 2 to 4).
- [ ] **Step 4: Run** the checklist 6 commands; checklist 5.
- [ ] **Step 5: Commit** `git commit -m "feat: Chains rules page"`.

---

### Task 6: Glossary page

**Files:** Create `rules/glossary.ts`; modify the Page checklist files.

**Interfaces:** Consumes Stage 1 scene components, `kingdomBannerUrl`, `hpIconUrls`. Keys `rules.glossary.*` (one `term` and one `definition` key per entry), `nav.rules.glossary`.

Twelve entries, each a term, a one-sentence definition and its real art (from the draft): Force (four banners), HP (HP icon), Main General, Deputy General, Hidden General, Chained (`CHAIN_ICON_URL`), Judgment Area (Capture card), Response (Wuxie card), Mount (Red Hare card), Attack Range (Crossbow card), Dying (damage image), Draw Pile (card back). Definitions agree with the pages they summarise (use the page sentences where they exist) and use the Vietnamese terms (Chủ tướng, Phó tướng, Tướng ẩn, Bị xích, Khu phán xét, Phản hồi, Tọa kỵ, Tầm tấn công, Hấp hối, Chồng bài rút). Entries are in a definition list; terms are Title Case in English, sentence case in Vietnamese.

- [ ] **Step 1: Write the failing tests** (checklist 1 plus): `it('glossary: twelve terms, each with a picture and a definition')` expects 12 `dt`, 12 `dd`, 12 pictures (images inside the entries); `it('glossary: the Vietnamese terms follow the agreed wording')` expects the terms list to equal `['Thế lực','Sinh lực','Chủ tướng','Phó tướng','Tướng ẩn','Bị xích','Khu phán xét','Phản hồi','Tọa kỵ','Tầm tấn công','Hấp hối','Chồng bài rút']`.
- [ ] **Step 2: Run** `-t glossary`. Expected: FAIL.
- [ ] **Step 3: Implement** (checklist 2 to 4). Pictures use the Stage 1 `img.scene-card` or a plain `<img>` with the content asset helpers and non-empty alt text; the Stage 1 art guard must cover them (give such images the class `scene-card`).
- [ ] **Step 4: Run** the checklist 6 commands; checklist 5.
- [ ] **Step 5: Commit** `git commit -m "feat: Glossary rules page"`.

---

### Task 7: Navigation order, cross-links and whole-stage verification

**Files:** Modify `app.ts` (final order), `app.spec.ts`, `rules.vi.spec.ts` (Overview link order), catalogs if an Overview entry is out of order; the Setup, Turn and Judgment pages gain "See ..." links to the new pages only where a sentence already names the topic and a link label equals the nav label.

**Interfaces:** Consumes everything above.

- [ ] **Step 1: Write the failing tests**: in `app.spec.ts` the Rules menu lists exactly `['Overview','Setup','Turn Structure','Card Types','Distance / Range','Response Windows','Damage and Dying','Judgment','Chains','Glossary']` with hrefs `/wiki/rules/overview|setup|turn|card-types|distance|response|damage|judgment|chains|glossary`; in `rules.vi.spec.ts` the Overview link list is, in order, Setup, Turn Structure, Card Types, Distance / Range, Response Windows, Damage and Dying, Judgment, Chains, Glossary, then Generals (`/wiki/generals`, as the existing test already ends), each labelled with its nav label.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/app.spec.ts projects/app/src/app/wiki/rules/rules.vi.spec.ts -t "Rules|overview"`. Expected: FAIL on order.
- [ ] **Step 3: Implement** the final `rulesPages` order and fix the Overview entries' order.
- [ ] **Step 4: Run** `npm run verify`, then `npm test`, then `npm run i18n:status`. Expected: verify exits 0; all suites pass; status runs and counts the new keys as draft.
- [ ] **Step 5: Manual browser check** (`npm run web`, headless Chrome or a browser): each new page and the Overview, in Vietnamese and English, light and dark, at desktop width and at a true 400px (a 400px iframe inside a wider page works when the browser's minimum window is wider). Check the chained badge and damage mark do not cover the portrait or name at 400px in Vietnamese. Record what was checked and what was not in the PR description.
- [ ] **Step 6: Commit** `git commit -m "feat: rules pages in the spec's navigation order"`. Do not push; hand the branch to the user.

---

## Self-Review

- **Spec coverage:** the four new pages and nav order (Tasks 3 to 7); the Open rules answered from the engine and pinned (Task 2: several Peaches, Peach from another Force, Wuxie against Barbarians, the chain-wave wording); Glossary (Task 6); Vietnamese drafts and casing (constraints); no placeholders and art through helpers (Task 1 guards extended, checklist 1); old routes and Stage 1 pages untouched. Not here by design: the interactive Distance demo (Stage 3), Compete and Ally Far Attack Near pages.
- **Type consistency:** `SceneSeat.chained/mark/note` and `CHAIN_ICON_URL` are defined in Task 1 and used with those names in Tasks 4 to 6; the nav keys and slugs match between the Global Constraints, the Page checklist and the tasks.
- **Proportion:** the plan states interfaces, facts, scenes and assertions; the drafts carry the example layouts and Vietnamese wording; the engine facts carry the rule content.
