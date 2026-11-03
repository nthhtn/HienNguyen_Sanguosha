# Rules Wiki: the Allegiance Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rules page that explains allegiance and Ambitionists (Guozhan), in English and Vietnamese, with scenes made from the real art, and link it from the Overview.

**Architecture:** One standalone page component built from the existing scene components. `SceneSeat` gains an Ambitionist mark. Each rule the page states is first confirmed by a characterization test in the content package (most already exist; the one the page's example needs is added). Static scenes, no new rules logic in the app.

**Tech Stack:** Angular (standalone, signals), Jest (`npx jest <path>`), the i18n catalogs, the content and engine projects.

**Spec:** `docs/superpowers/specs/2026-11-03-rules-wiki-allegiance-page-design.md` (rule text, scenes, scope). Wiki context: `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-design.md`.

**Stacked on Stage 3** (`feat/rules-wiki-stage-3`, PR #41). Branch `feat/rules-wiki-allegiance` is cut from it. Open the PR against the Stage 3 branch (retarget as the earlier PRs merge).

## Global Constraints

- All earlier wiki constraints apply: `CLAUDE.md` layering (no game rules in components), UI text casing (Title Case labels and captions; sentence case sentences; keywords keep capitals: Seat names, card names, General names, Forces, HP, Ambitionist), Vietnamese sentence case with keyword capitals and the agreed terms (Seat is "Người chơi N" via `label.seat`; Ambitionist is "Dã tâm gia" via `label.kingdom.Ambitionist`; Forces Ngụy, Thục, Ngô, Quần; "Tướng", "Sinh lực"), art only through `content` helpers, no placeholders, no sideways scroll at 400px.
- Card names only through `{card:id}` tokens, Force names through `{force:Wei}` tokens, General names from `generalDisplayData`.
- The page title: English "Allegiance"; Vietnamese "Phe phái" (a new, draft term for native review; not in `review.json`). Nav key `nav.rules.allegiance`, route `rules/allegiance`, component `RulesAllegiance`.
- Menu order: Overview, Setup, **Allegiance**, Turn Structure, Card Types, Distance / Range, Response Windows, Damage and Dying, Judgment, Chains, Glossary. The Overview's "Where to read next" list gets the page after Setup.
- Qun is a Force like the others (user ruling, applies to every sentence).
- Guozhan only. Do not describe Identity mode.
- Branch work: commit per task; never merge or push to `main`; do not push the branch until the user chooses to.

**The rule text** is in the spec ("Rule text (Guozhan)", points 1 to 6). Use its wording; do not add rules it does not state.

## Review Focus

- A sentence on the page that the engine does not follow (the cap and its rounding, dead seats counting, death-reveal allegiance, the kill reward of 3, an Ambitionist killer never discarding, who wins). Each is pinned by an existing or new test and cited in the PR table.
- The new page missing from the nav, the Overview list, the Rules-menu specs in both languages, the English snapshot, the Vietnamese link-label map or the art/id/language-switch guards.
- An Ambitionist seat shown with a Force banner or Force colour, so it looks like a Kingdom seat.
- A hidden seat shown as if its General were known (the page must not reveal a face-down General's name).
- At 400px in Vietnamese the scenes fit without overlap or sideways scroll.

---

### Task 1: `SceneSeat` shows an Ambitionist

**Files:** Modify `projects/app/src/app/wiki/rules/scene/scene-seat.ts`, `scene/scene.spec.ts`, `rules-scenes.spec.ts`.

**Interfaces:**
- Produces on `SceneSeat`: `ambitionist = input(false)`. When set: the seat's border uses `--force-ambitionist` (via `data-force="Ambitionist"`, already defined in `projects/app/src/styles.scss`), the game's Ambitionist mark (`AMBITIONIST_ICON_URL` from `content`) shows as `<img class="scene-ambitionist" [alt]="'label.kingdom.Ambitionist' | t">` at the **bottom right of the portrait**, and the line under the name reads "Ambitionist" ("Dã tâm gia") in place of a Force name. `force` is ignored when `ambitionist` is set.

- [ ] **Step 1: Write the failing tests** in `scene/scene.spec.ts`: `it('shows an Ambitionist with its mark, its label and no Force')`: `{ general: 'zhang-liao', n: 4, force: 'Wei', ambitionist: true }` renders `img.scene-ambitionist` with `src` `AMBITIONIST_ICON_URL` and alt `'Ambitionist'` (vi `'Dã tâm gia'`), the text contains `'Ambitionist'` and not `'Wei'`, and `.seat` has `data-force="Ambitionist"`; without `ambitionist` there is no mark. In `rules-scenes.spec.ts` add `img.scene-ambitionist` to the art guard's selector.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/scene/scene.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the input, template and styles.
- [ ] **Step 4: Run** `npx jest projects/app/src/app/wiki` and `npx tsc -p projects/app/tsconfig.spec.json --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: an Ambitionist mark on scene seats"`.

---

### Task 2: Pin the rules the page states

**Files:** Modify `projects/content/src/lib/modes/guozhan.spec.ts` only if a claim is not already pinned.

**Interfaces:** none produced.

Already pinned (cite them in the PR table, do not duplicate): the cap-th seat is a Kingdom seat and the next an Ambitionist, a hidden seat revealed by death in a full Kingdom becomes an Ambitionist, killing an Ambitionist draws 3, an Ambitionist killer is rewarded and never discards, an Ambitionist wins as sole survivor with no winning Kingdom, a Kingdom and an Ambitionist alive gives no result, small tables (2, 3 and 4 seats), `kingdomCap` is half the table rounded down (`shared/kingdom.spec.ts`).

- [ ] **Step 1: Find the gaps.** The page's example is a 6-seat table (cap 3). Check whether a test pins "6 seats: three Wei seats are Kingdom seats and the fourth is an Ambitionist" and "dead seats still count toward the cap". Add whichever is missing to the "small tables" section as `it('6 seats (cap 3): the fourth Wei is an Ambitionist')` and `it('a dead seat still holds its Force's slot')` (reveal three Wei seats, eliminate one, reveal a fourth: it is an Ambitionist), reusing the section's `allWei`/`reveal` helpers (extend the seat ids if the helper stops at four seats).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/modes/guozhan.spec.ts`. Expected: PASS (these describe existing behavior). For each new test make it fail once by mutating `kingdomCap` or `seatsInKingdom` in `shared/kingdom.ts`, see it fail, and revert; record each in the ledger.
- [ ] **Step 3: If a claim does NOT hold**, stop and ask the user: the page text changes, and the engine is the authority.
- [ ] **Step 4: Run** `npx jest projects/content projects/engine`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "test: pin the cap and the dead-seat rule the Allegiance page states"` (skip the commit if nothing was added).

---

### Task 3: The Allegiance page, nav and Overview

**Files:**
- Create: `projects/app/src/app/wiki/rules/allegiance.ts`
- Modify: `wiki.routes.ts`, `app.ts` (`rulesPages`), `app.spec.ts`, `app.vi.spec.ts`, `overview.ts`, `en.ts`, `vi.ts`, `rules.vi.spec.ts`, `rules.en.spec.ts` (page list), `rules-scenes.spec.ts` (`PAGES`), the English snapshot.

**Interfaces:** Consumes `SceneSeat` (`ambitionist`, `note`, `out`), `SceneFrame`, `SceneCard`, `SceneGeneral`. Keys `rules.allegiance.*`, `nav.rules.allegiance`, `rules.overview.next.allegiance`, `rules.overview.win4`.

Page content (English from the spec's rule text; Vietnamese in sentence case with the agreed terms; sentences use `{force:…}` and `{card:…}` tokens):
1. `<h2>` from `nav.rules.allegiance`, a lead paragraph: a seat's allegiance says whom it plays for.
2. **Two Kinds of Allegiance** (`<h3>`): rules 1 and 2 as paragraphs, and a scene: a Kingdom seat (Seat 1, Cao Cao, Wei, note "Plays for Wei") beside an Ambitionist seat (Seat 4, Zhang Liao, `ambitionist`, note "Plays alone"). Zhang Liao is printed Wei, which shows that the printed Force does not decide it.
3. **The Cap** (`<h3>`): rule 3 and rule 4 as paragraphs, and a scene captioned "Example: 6 Seats, Cap 3" with `ol.steps`: (1) three seats (Seat 1 Cao Cao, Seat 2 Xiahou Dun, Seat 3 Guo Jia) reveal Wei Generals and are Kingdom seats (Wei Force shown); (2) Seat 4 reveals a Wei General, Wei is full, so it is an Ambitionist (`ambitionist`); (3) a sentence that Seat 2 may later be knocked out and Wei still holds its slot (shown with Seat 2 `out` and the other Wei seats unchanged).
4. **Killing an Ambitionist** (`<h3>`): rule 5 as a paragraph, and a scene: killer (Sun Quan, Wu, labelled "Killer") → arrow → Ambitionist seat `out` → `app-scene-card id="back"` × 3 with the pill "Draws 3". A second sentence says an Ambitionist killer never discards its hand.
5. **Winning** (`<h3>`): rule 6 as a paragraph, and a `.branch` of three boxes: "A Force Wins" (Seat 1 and Seat 3 Wei Kingdom seats, the others out), "The Game Goes On" (a Wei Kingdom seat and an Ambitionist alive), "The Last Survivor Wins Alone" (one Ambitionist seat, no Force named).
6. Sentences link to nothing except `[[/wiki/rules/setup|Setup]]` where the death reveal is mentioned (label equals the nav label).

Overview: `rules.overview.win4` — "A seat that reveals into a Force that is already full becomes an Ambitionist and plays alone. See [[/wiki/rules/allegiance|Allegiance]]." (Vietnamese equivalent) as a fourth bullet of the Winning list; `rules.overview.next.allegiance` — `[[/wiki/rules/allegiance|Allegiance]]: whom a seat plays for, and Ambitionists.` after Setup in "Where to read next".

- [ ] **Step 1: Write the failing tests** in `rules.vi.spec.ts` (and update the lists):
  - add `['allegiance', 'Phe phái']` to the titles test, `'/wiki/rules/allegiance': 'nav.rules.allegiance'` to the NAV link-label map, the page to the "no English card name" page list; the Overview link-list test now reads, in order, Setup, Allegiance, Turn, Card Types, Distance, Response, Damage, Judgment, Chains, Glossary, Generals with `'/wiki/rules/allegiance Phe phái'` after Setup; the Overview Winning list has four bullets and the fourth links to the page.
  - `it('allegiance: an Ambitionist seat has its mark, its own label and no Force')`: in the first scene, one `img.scene-ambitionist` and the seat text contains `'Dã tâm gia'`; the Kingdom seat shows `'Ngụy'`.
  - `it('allegiance: the cap example turns the fourth Wei seat into an Ambitionist')`: in the scene captioned `'Ví dụ: 6 người chơi, mức trần 3'`, the first step has three Wei seats and no Ambitionist mark, the second step has one `img.scene-ambitionist`.
  - `it('allegiance: killing an Ambitionist shows three drawn cards')`: three card backs in that scene.
  - `it('allegiance: the three outcomes are shown')`: `.branch > div h5` texts equal `['Một thế lực thắng', 'Ván tiếp tục', 'Người sống sót cuối cùng thắng một mình']`.
  - In `app.spec.ts` the Rules menu gets `['Allegiance', '/wiki/rules/allegiance']` after Setup; in `app.vi.spec.ts` `'Phe phái'` after `'Chuẩn bị'`; `rules.en.spec.ts` and `rules-scenes.spec.ts` list the page.
- [ ] **Step 2: Run** `npx jest projects/app/src/app`. Expected: FAIL.
- [ ] **Step 3: Implement** the page, catalog keys (both languages), route, nav item, Overview changes, per the content above. A negative: do not show any face-down General's name.
- [ ] **Step 4: Run** `npx tsc -p projects/app/tsconfig.app.json --noEmit`, `npx tsc -p projects/app/tsconfig.spec.json --noEmit`, `npx eslint projects/app/src/app`, `npx jest projects/app/src/app`. Expected: PASS except the English snapshots; update `overview` and the new `allegiance` snapshots (`-u`) and read the diff.
- [ ] **Step 5: Commit** `git commit -m "feat: Allegiance rules page"`.

---

### Task 4: Verification and browser check

**Files:** none (ledger notes only).

- [ ] **Step 1: Run** `npm run verify`, `npm test`, `npm run i18n:status`. Expected: verify exits 0; all suites pass; new keys count as draft.
- [ ] **Step 2: Browser check** (`npm run web`; headless Chrome over the DevTools protocol works, with a mobile viewport override for a true 400px): the Allegiance page and the Overview in Vietnamese and English at desktop width and at 400px; check the Ambitionist mark sits at the portrait's bottom right and does not cover the name, no scene overflows sideways, and no seat is shown with a Force banner when it is an Ambitionist. Record what was checked and what was not in the PR description.
- [ ] **Step 3: Commit** any fix found (test first), then stop. Do not push; hand the branch to the user.

---

## Self-Review

- **Spec coverage:** the page and its four scenes (Task 3); the six rule points, each cited to a test (Task 2 and the PR table); Overview sentence and link (Task 3); menu position after Setup (Task 3); English and Vietnamese together, draft term flagged (Global Constraints); Guozhan only (Global Constraints); no engine change (Task 2 adds tests only). Not here by design: Glossary entries, interactivity.
- **Type consistency:** `SceneSeat.ambitionist` and class `scene-ambitionist` are defined in Task 1 and used in Tasks 3 and 4.
- **Proportion:** the plan states interfaces, content and assertions; the spec carries the rule text.
