# Phone App, Touch Fixes, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the phone board a tap on a hand card only picks it and its Play and Info buttons appear full size at the top of the action column; the action buttons are 36 px tall on one line.

**Architecture:** Each card's buttons (Play with its menus or targets window, and Info) move out of `HandView`'s template into a small shared component, `HandCardActions`, and the view-model builder becomes a function. On tablets and computers `HandView` still shows them on the card. On the phone board (`fit="overlap"`) `HandView` shows no buttons: a tap picks the card, and `PhoneBoard` shows `HandCardActions` for the picked card in its action column.

**Tech Stack:** Angular, Material (menus, tooltips), Jest.

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, section "3c. Touch fixes from playing on the phone".

## Decisions

- **The developer (2026-11-23):** Tap picks, actions on the right; action buttons 36 px, 13 px, one line.
- **My calls:**
  - **No copies:** `HandCardActions` holds the button markup and the `pickTargets`/`openInfo` logic that `HandView` has today; `handCardViewModels(...)` is the builder `HandView`'s `cardViewModels` computes with. `HandView`'s existing tests must pass unchanged after Task 1 (a pure move).
  - **The pick is presentation state** kept by `PhoneBoard` (a card id signal); it is cleared when that card is no longer in the hand or when any action is chosen.
  - **Long labels:** `ActionList` gains an input `compact = input(false)`; when true, its buttons get a `matTooltip` with their label (shown on long press) and the class the phone CSS styles. Off by default, so tablets and computers see no tooltips.

## Global Constraints

- Presentation only. Tablets and computers (medium and large) do not change in any visible way.
- Rules stay in the engine: the buttons come from the same legal actions as today.
- Text on the phone board stays at 12 px or more (13 px here).
- Work on `feat/phone-app-touch`, branched from `feat/phone-app-install` (PR 80); the pull request goes into that branch.

## Review Focus

- **Playing the picked card through a menu or the targets window, then cancelling:** The pick stays; nothing is played. Pinned in Task 3.
- **The picked card leaves the hand without being played** (discarded by an opponent's card, stolen): The pick clears and no stale buttons remain. Pinned in Task 3.
- **A card with no legal action** (Peach at full HP): Picking it shows only Info. Pinned in Task 3.
- **The same card tapped twice quickly:** It is picked, then put back; nothing is played. Pinned in Task 2.

---

### Task 1: `HandCardActions`, moved out of `HandView`

**Files:** Create `projects/app/src/app/game-board/hand-card-actions.ts` (and its spec); modify `hand-view.ts`.

**Interfaces:**
- `export function handCardViewModels(cards: CardInstance[], actions: Action[], state: GameState, registry: ContentRegistry, tr: Translator): HandCardViewModel[]` (exported with `HandCardViewModel`).
- `HandCardActions` (selector `app-hand-card-actions`): Inputs `vm: HandCardViewModel` (required), `state: GameState` (required); output `played = output<Action>()`. Renders exactly today's Play variants and Info.

- [ ] **Step 1:** Move the code; `HandView` uses `<app-hand-card-actions>` inside its overlay.
- [ ] **Step 2:** `npx jest --selectProjects app -- hand-view -w 2` passes unchanged (the move is covered by the existing tests). Add `hand-card-actions.spec.ts` covering one Play variant and Info on their own.
- [ ] **Step 3: Commit** `refactor(app): a card's Play and Info buttons as their own component`.

### Task 2: On the phone board a tap picks a card

**Files:** Modify `hand-view.ts` and its spec.

**Interfaces:** `HandView.pickedId = input<string | null>(null)`; `HandView.picked = output<string | null>()`.

- [ ] **Step 1: Failing tests** (with `fit="overlap"`): No `.overlay` and no Play button on any card; a click on a card emits `picked` with its id; a click on the picked card emits `null`; the card with `pickedId` has the class `picked`. With `fit="row"`: the overlay and its buttons are as before, and clicks emit nothing.
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement.** The picked card lifts (`translateY(-10px)`), is outlined in the gold turn colour, and comes to the front.
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat(app): a tap picks a hand card on the phone board`.

### Task 3: The picked card's actions in the action column

**Files:** Modify `phone/phone-board.ts` and its spec.

- [ ] **Step 1: Failing tests:** Picking a card (the hand emits `picked`) shows `app-hand-card-actions` for it at the top of `.actions`, above the skills and the action list; a single-action card's Play emits `played` with that action and clears the pick; a card with no legal action shows only Info; when the state changes so the picked card is no longer in the hand, the pick clears; choosing an action from the action list also clears the pick.
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement** with `handCardViewModels` for the picked card. The Play and Info buttons are full column width, 36 px tall, Play filled and Info outlined.
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat(app): the picked card's Play and Info in the phone board's action column`.

### Task 4: 36 px action buttons, one line

**Files:** Modify `action-list.ts` (the `compact` input and tooltip), `phone/phone-board.ts` (passes `compact`, CSS: 36 px, 13 px, one line, ellipsis); tests in `action-list.spec.ts` and a source check in `phone-windows.spec.ts` or the board spec.

- [ ] **Step 1: Failing tests:** With `compact`, each action button has a `matTooltip` with its full label; without it, none (tablets and computers unchanged). The phone board's action column rule sets buttons to 36 px tall, 13 px, `white-space: nowrap` and `text-overflow: ellipsis`.
- [ ] **Step 2:** They fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5: Commit** `feat(app): slimmer one-line action buttons on the phone board`.

### Task 5: Check and open the pull request

- [ ] **Step 1:** `npm run verify && npx jest --selectProjects app -w 4` pass.
- [ ] **Step 2:** Browser at 800 × 366 (`/preview/phone-8?display=fullscreen`): tapping a card lifts it and shows Play and Info at the top of the column; playing a Sha through its menu works; tapping it again puts it back; the column shows about three actions without scrolling; 1133 × 744: the hand's overlay buttons and the action list look as before.
- [ ] **Step 3:** Update `docs/architecture/frontend.md` (phone board: picking a card; action buttons) and commit.
- [ ] **Step 4:** Push and open a pull request into `feat/phone-app-install`. Do not merge.
