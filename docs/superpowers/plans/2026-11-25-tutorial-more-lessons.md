# Tutorial: More Lessons and Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five more Tutorial lessons (Equipment, Tools, Wuxie, Delayed Tools and Judgment, Chains) and tabs that group all ten lessons.

**Architecture:** Lessons stay data (a state recipe plus ordered steps) played by `TutorialService` on the real board. Each lesson gets a `group`, and the Tutorial page renders one Material tab per group. New anchors mark the equipment area, the judgment area, the chain badge and the judgment popup. Engine and content are untouched.

**Tech Stack:** Angular (standalone components, signals), Angular Material, Jest, the existing `engine`, `content` and `bots` projects.

**Spec:** `docs/superpowers/specs/2026-11-25-tutorial-more-lessons-design.md` (builds on `2026-11-25-tutorial-design.md`)

## Global Constraints

- **Layering:** Nothing changes in `projects/engine` or `projects/content`. The UI never decides legality: A scripted bot picks only from `getLegalActions`, and the action gate only refuses.
- **No dev code in production:** Lessons use `scenario-kit/recipe`, never `dev/`.
- **No luck:** Every draw and judgment a lesson depends on is fixed by its recipe (`stackDrawPile`, `give`, `setGenerals`).
- **UI text style (CLAUDE.md):** Tab labels are Title Case ("Basics", "Cards", "Special Effects"). Instructions are sentences in sentence case with keywords capitalised ("Play Steal on Seat 1"). Vietnamese is sentence case everywhere and starts as a draft. Ids are never shown.
- **Catalog keys:** Every visible string is a `tutorial.*` key in both `i18n/en.ts` and `i18n/vi.ts`. Each step text key has a comment naming the Rules key it condenses.
- **Card ids:** Use the content ids (`peach`, `sha`, `shan`, `steal`, `break`, `wuxie`, `starvation`, `chains`, `fire-attack`); confirm each in `projects/content` before using it.
- **Docs style (CLAUDE.md):** Bullets over long paragraphs, bold key terms, every sentence, heading, list item and table cell starts with a capital letter, including after a colon.
- **Git:** Branch `feature/tutorial-more-lessons`, one commit per task, never merge. End every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Commands:** One spec file: `npx jest <path>`. Before finishing: `npm run verify`, `npm test`, `npm run i18n:status`.

## Review Focus

- **Back to Lessons after a lesson in another tab:** The page returns to that lesson's tab, not the first one. Pinned in Task 1.
- **Stored progress holds an id that is no lesson:** The counts and the default tab ignore it. Pinned in Task 1.
- **Many tabs on a phone:** The tab row scrolls and every tab stays reachable. Pinned in Task 1.
- **Beginner plays the wrong card in a Wuxie window:** Nothing happens and the window stays. Pinned in Task 5.
- **Judgment result is not what the step says:** The recipe fixes the pile so it cannot differ. Pinned in Task 6.
- **Chained seat is not on screen on a phone:** The step falls back to its text card. Pinned in Task 7.

---

### Task 1: Lesson groups and the tabbed page

**Files:**
- Modify: `projects/app/src/app/tutorial/tutorial-types.ts` (add `LessonGroupId`, `group` on `Lesson`)
- Create: `projects/app/src/app/tutorial/lesson-groups.ts`
- Modify: `projects/app/src/app/tutorial/lessons/*.ts` (the five lessons get `group: 'basics'`)
- Modify: `projects/app/src/app/tutorial/tutorial-page.ts`, `tutorial.service.ts` (the tab to return to)
- Modify: `projects/app/src/app/i18n/en.ts`, `vi.ts`
- Test: `projects/app/src/app/tutorial/lesson-groups.spec.ts`, `tutorial-page.spec.ts`

**Interfaces:**
- Produces, in `tutorial-types.ts`: `type LessonGroupId = 'basics' | 'cards' | 'effects'` and `group: LessonGroupId` on `Lesson`.
- Produces, in `lesson-groups.ts`:
  - `interface LessonGroup { id: LessonGroupId; titleKey: MessageKey }` and `const LESSON_GROUPS: LessonGroup[]` in the order Basics, Cards, Special Effects.
  - `groupedLessons(lessons: Lesson[]): { group: LessonGroup; lessons: Lesson[] }[]`: Every group in `LESSON_GROUPS` order, with its lessons in list order; a group with no lessons is left out.
  - `doneCount(lessons: Lesson[], completed: ReadonlySet<string>): number`: How many of `lessons` are in `completed`; ids that are no lesson do not count.
  - `defaultGroupIndex(groups: { lessons: Lesson[] }[], completed: ReadonlySet<string>): number`: The index of the first group with an unfinished lesson, or `0` when all are done.
- Keys: `tutorial.group.basics` ("Basics"), `tutorial.group.cards` ("Cards"), `tutorial.group.effects` ("Special Effects"), `tutorial.group.progress` ("{name} ({done} of {total})").
- Produces, on `TutorialService`: a signal `lastGroup: Signal<LessonGroupId | null>` set by `start`, so the page can reopen the tab of the lesson that just ended.

- [ ] **Step 1: Write the failing helper tests** in `lesson-groups.spec.ts`, with hand-built `Lesson` fixtures (`group` and `id` only matter):
  - `groupedLessons` returns the groups in `LESSON_GROUPS` order whatever the lesson order, and drops an empty group.
  - `doneCount` counts only ids that are lessons of the list, ignoring unknown ids.
  - `defaultGroupIndex` is `1` when every Basics lesson is done and Cards has one left, `0` when nothing is done, and `0` when everything is done.
- [ ] **Step 2: Write the failing page tests** in `tutorial-page.spec.ts`:
  - One tab per group, labelled "Basics (0 of 5)" style from the progress key.
  - The tab count follows `completed()`.
  - The page opens on `defaultGroupIndex`.
  - After `start` on a lesson of the Cards group and `exit`, the page shows the Cards tab.
  - Next Lesson still goes to the next lesson in list order across tabs.
- [ ] **Step 3: Run, expect FAIL.** Run: `npx jest projects/app/src/app/tutorial/lesson-groups.spec.ts projects/app/src/app/tutorial/tutorial-page.spec.ts`. Expected: FAIL (module and members missing).
- [ ] **Step 4: Implement.** Add the types, `lesson-groups.ts`, `group: 'basics'` on the five lessons, `lastGroup` on `TutorialService`, and Material tabs (`MatTabsModule`) in the page with scrollable header (`mat-tab-nav` pagination); add the keys in English and Vietnamese (draft, sentence case).
- [ ] **Step 5: Run, expect PASS.** Also `npx jest projects/app/src/app/tutorial projects/app/src/app/i18n`.
- [ ] **Step 6: Commit.** `git commit -m "feat(app): group Tutorial lessons into tabs"`.

### Task 2: Anchors for equipment, judgment and chains

**Files:**
- Modify: `projects/app/src/app/tutorial/anchors.ts`, `anchors.spec.ts`
- Modify: `projects/app/src/app/game-board/seat-tile.ts`, `phone/phone-seat-tile.ts`, `judgment-dialog.ts`
- Test: `projects/app/src/app/game-board/game-board.spec.ts`, `phone/phone-board.spec.ts` (add to their `describe('tutorial anchors')`), `judgment-dialog.spec.ts`

**Interfaces:**
- Produces, in `anchors.ts`: `equipment(seatId)` gives `equipment:<id>`, `judgmentArea(seatId)` gives `judgment-area:<id>`, `chainBadge(seatId)` gives `chain-badge:<id>`, `judgmentDialog()` gives `judgment-dialog`. `isAnchorId` accepts all four.
- Placement: `equipment` and `judgmentArea` on the seat tile's Equipment and Judgment panels (desktop) and on the phone tile's equipment row and judgment boxes; `chainBadge` on the chained badge of both tiles; `judgmentDialog` on the judgment popup's root.

- [ ] **Step 1: Write the failing tests.** `anchors.spec.ts`: each new builder gives the string above and `isAnchorId` accepts it (and rejects the bare prefix). Board specs: render a state with seat-1 wearing a Weapon, holding Starvation in its judgment area and chained, and assert one element each for `equipment:seat-1`, `judgment-area:seat-1`, `chain-badge:seat-1` on the large and the phone board. `judgment-dialog.spec.ts`: the popup carries `judgment-dialog`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the builders and the `appTutorialAnchor` bindings. The attributes are inert; no layout or behaviour changes.
- [ ] **Step 4: Run, expect PASS.** Then `npx jest projects/app/src/app/game-board projects/app/src/app/tutorial`.
- [ ] **Step 5: Commit.** `git commit -m "feat(app): tutorial anchors for equipment, judgment and chains"`.

### Task 3: Lesson 6, Equipment

**Files:**
- Create: `projects/app/src/app/tutorial/lessons/equipment.ts`
- Modify: `lessons/index.ts`, `lessons/lessons.spec.ts` (`REGISTERED`), `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- Consumes: Task 1 `group`, Task 2 `anchor.equipment`, `lesson-kit` helpers, `scenario-kit/recipe` helpers.
- Produces: `EQUIPMENT_LESSON: Lesson` with `id: 'equipment'`, `group: 'cards'`, 4 seats, the beginner at `seat-0`.

- [ ] **Step 1: Register and watch it fail.** Add `'equipment'` to `REGISTERED` and to the expected order after `'damage'`. Run: `npx jest projects/app/src/app/tutorial/lessons/lessons.spec.ts`. Expected: FAIL (lesson missing).
- [ ] **Step 2: Write the lesson test** `equipment.spec.ts` (model: `sha-shan.spec.ts`): After the three wear steps the beginner's equipment zones hold a Weapon, an Armor and a Mount, and in the final state a Sha from the beginner is legal on a seat that was out of range before the Mount (`getLegalActions` on the state before and after).
- [ ] **Step 3: Implement.** Recipe: Play Phase, the beginner holds one Weapon, one Armor, one Minus Mount and one Sha, bots hold nothing. Steps: `next` (what Equipment is, `anchor.hand()`; condenses `rules.cardTypes.equipmentText`); `action` play the Weapon (`handCard`, `playButton`, then `equipment('seat-0')`); `next` (range, condenses `rules.distance.range2`); `action` play the Armor; `action` play the Mount; `next` (a Minus Mount brings others closer, condenses `rules.cardTypes.equipmentText`); `action` Sha at the seat now in reach (`targetSeat`); `next` (a bot answers or not, `anchor.actionHistory()`). Choose the Weapon, Armor, Mount and seed against the engine so each step completes.
- [ ] **Step 4: Add the keys** `tutorial.equipment.title`, `.summary`, `.s1` to `.sN` (English, then Vietnamese drafts with the glossary in `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`), with phone variants where Task 8 of the first plan's pattern needs them.
- [ ] **Step 5: Run, expect PASS.** `npx jest projects/app/src/app/tutorial projects/app/src/app/i18n`.
- [ ] **Step 6: Commit.** `git commit -m "feat(app): Equipment lesson"`.

### Task 4: Lesson 7, Tools

**Files:**
- Create: `projects/app/src/app/tutorial/lessons/tools.ts`
- Modify: `lessons/index.ts`, `lessons/lessons.spec.ts`, `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- Produces: `TOOLS_LESSON: Lesson` with `id: 'tools'`, `group: 'cards'`.

- [ ] **Step 1: Register and watch it fail** (add `'tools'` after `'equipment'`). Expected: FAIL.
- [ ] **Step 2: Write `tools.spec.ts`:** After the Steal step the beginner's hand holds one card more and the target one less; after the Break step the target's hand or equipment holds one card less and the discard pile one more.
- [ ] **Step 3: Implement.** Recipe: Play Phase, the beginner holds Steal and Break, two bots hold known cards, nobody holds a Wuxie (so no response window opens). Steps: `next` (a Tool is a one-use card, condenses `rules.cardTypes`); `action` Steal on the neighbour; `state` the card arrives (scripted pick of the offered choice from `legal`, if the engine asks one); `next` on the hand; `action` Break on the other seat; `state`; `next` (a Tool can be answered with Wuxie, covered next lesson). Confirm the engine's Steal and Break target and choice flow before writing the steps.
- [ ] **Step 4: Add the keys** (`tutorial.tools.*`, English then Vietnamese drafts).
- [ ] **Step 5: Run, expect PASS.** `npx jest projects/app/src/app/tutorial projects/app/src/app/i18n`.
- [ ] **Step 6: Commit.** `git commit -m "feat(app): Tools lesson"`.

### Task 5: Lesson 8, Wuxie

**Files:**
- Create: `projects/app/src/app/tutorial/lessons/wuxie.ts`
- Modify: `lessons/index.ts`, `lessons/lessons.spec.ts`, `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- Produces: `WUXIE_LESSON: Lesson` with `id: 'wuxie'`, `group: 'cards'`.

- [ ] **Step 1: Register and watch it fail** (add `'wuxie'` after `'tools'`). Expected: FAIL.
- [ ] **Step 2: Write `wuxie.spec.ts`:** (a) The last state has the Break cancelled (the target's card is still where it was). (b) A Wuxie window where the beginner tries a non-Wuxie card is refused by the step's `allows` (the state is unchanged). (c) Wuxie played twice by the beginner and once by the scripted bot in that order.
- [ ] **Step 3: Implement.** Recipe: Start in the neighbour's Play Phase, the neighbour holds Break, one other bot holds a Wuxie, the beginner holds two Wuxie and one other card. Steps: `next`; `state` the neighbour's Break opens the Wuxie window on the beginner; `next` explaining the window (`anchor.responseDialog()`; condenses `rules.response.wuxieIntro`); `action` the beginner plays Wuxie (`responseCard('wuxie')`, `responseConfirm()`); `state` the scripted bot answers with its Wuxie (`respondWith('wuxie')`); `next` (a Wuxie can be cancelled by another); `action` the second Wuxie; `next` (the Break is cancelled, `anchor.actionHistory()`; condenses `rules.response.breakCancelled`). Check the engine's Wuxie ask order (`rules.response.wuxieIntro`) so the scripted seat is asked at the right time.
- [ ] **Step 4: Add the keys** (`tutorial.wuxie.*`).
- [ ] **Step 5: Run, expect PASS.** `npx jest projects/app/src/app/tutorial projects/app/src/app/i18n`.
- [ ] **Step 6: Commit.** `git commit -m "feat(app): Wuxie lesson"`.

### Task 6: Lesson 9, Delayed Tools and Judgment

**Files:**
- Create: `projects/app/src/app/tutorial/lessons/judgment.ts`
- Modify: `lessons/index.ts`, `lessons/lessons.spec.ts`, `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- Consumes: Task 2 `anchor.judgmentArea`, `anchor.judgmentDialog`.
- Produces: `JUDGMENT_LESSON: Lesson` with `id: 'judgment'`, `group: 'effects'`.

- [ ] **Step 1: Register and watch it fail** (add `'judgment'` after `'wuxie'`). Expected: FAIL.
- [ ] **Step 2: Write `judgment.spec.ts`:** After the Starvation step it sits in the target's judgment area; after the target's Judgment Phase with a club on top the target keeps its Draw Phase, and the pile order proves the recipe fixed it (`stackDrawPile` with the chosen suit first).
- [ ] **Step 3: Implement.** Recipe: the beginner holds Starvation (and nothing else useful), the draw pile is stacked, the lesson ends after the target's judgment. Steps: `next` (a Delayed Tool waits, condenses `rules.judgment.delayedText`); `action` Starvation on a seat at distance 1 (`handCard`, `playButton`, `targetSeat`); `next` on the judgment area (`anchor.judgmentArea(target)`); `action` End Phase; `state` through the turns to the target's Judgment Phase with scripted End Phase picks for the other seats; `next` on the judgment popup (`anchor.judgmentDialog()`; condenses `rules.judgment.starvation`); `next` the outcome. Choose the suit so the target skips or keeps its Draw Phase as the text says; read the Judgment popup flow (`awaitsAcknowledgement`) to close it with the right action.
- [ ] **Step 4: Add the keys** (`tutorial.judgment.*`).
- [ ] **Step 5: Run, expect PASS.** `npx jest projects/app/src/app/tutorial projects/app/src/app/i18n`.
- [ ] **Step 6: Commit.** `git commit -m "feat(app): Delayed Tools and Judgment lesson"`.

### Task 7: Lesson 10, Chains

**Files:**
- Create: `projects/app/src/app/tutorial/lessons/chains.ts`
- Modify: `lessons/index.ts`, `lessons/lessons.spec.ts`, `i18n/en.ts`, `i18n/vi.ts`

**Interfaces:**
- Consumes: Task 2 `anchor.chainBadge`.
- Produces: `CHAINS_LESSON: Lesson` with `id: 'chains'`, `group: 'effects'`.

- [ ] **Step 1: Register and watch it fail** (add `'chains'` after `'judgment'`). Expected: FAIL.
- [ ] **Step 2: Write `chains.spec.ts`:** After the Chains step both targets are chained; after the Fire Attack with no Shan, both lose 1 HP and neither is chained (`rules.chains.waveText`).
- [ ] **Step 3: Implement.** Recipe: Play Phase, the beginner holds Chains and Fire Attack, two bots hold nothing (no Shan). Steps: `next` (condenses `rules.chains.lead`); `action` Chains on two seats (`handCard('chains')`, `targetSeat`); `next` on the badges (`chainBadge`; condenses `rules.chains.chainText`); `action` Fire Attack on one chained seat; `state` the damage resolves; `next` on both HP rows (`anchor.hp`; condenses `rules.chains.waveText`). Check the engine's two-target flow for Chains to match the selection UI.
- [ ] **Step 4: Add the keys** (`tutorial.chains.*`).
- [ ] **Step 5: Run, expect PASS.** `npx jest projects/app/src/app/tutorial projects/app/src/app/i18n`.
- [ ] **Step 6: Commit.** `git commit -m "feat(app): Chains lesson"`.

### Task 8: Docs, verification and a look in the browser

**Files:**
- Modify: `docs/architecture/frontend.md` (Tutorial section: groups, the ten lessons, how to add a lesson to a group)
- Modify: `docs/deferrals.md` if anything was left

- [ ] **Step 1: Update the frontend doc** in the docs style (bullets, bold labels, capitalised).
- [ ] **Step 2: Run the static checks and tests.** Run: `npm run verify`, `npm test`, `npm run i18n:status`. Expected: all pass; the new Vietnamese keys show as draft.
- [ ] **Step 3: Look at it.** Open `/tutorial` in the dev server at desktop width and at the 800 × 366 phone size with `?display=standalone`. Check the tabs and their counts, then play each new lesson: The spotlight sits on its target, a click outside is ignored, Next and Exit work, and a dialog never covers the card.
- [ ] **Step 4: Fix what the look found**, each fix with a test where it can have one.
- [ ] **Step 5: Commit.** `git commit -m "docs: Tutorial groups and the five new lessons"`.
