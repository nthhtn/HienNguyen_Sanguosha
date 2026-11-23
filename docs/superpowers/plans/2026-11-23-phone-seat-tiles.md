# Phone Seat Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone seat tile draws only the Judgment and Equipment cards a seat has, and marks a bot with the robot icon instead of the "[Bot] " text.

**Architecture:** All changes are inside `PhoneSeatTile` (one component, one spec). The tile strips `BOT_NAME_PREFIX` from the shown name itself, so `PhoneBoard`, `labels.ts` and the web tile stay untouched.

**Tech Stack:** Angular signals, Jest, `protocol` (`BOT_NAME_PREFIX`).

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, section 3d.

## Global Constraints

- No text under 12 px; the robot icon stays 16 px.
- The web board, Action History and Seat Details keep the "[Bot] " prefix and their empty-slot strings (`seat.slotEmpty`, `seat.judgmentEmpty` stay in the message files; the web tile uses them).
- The Equipment row keeps its height with no filled slot, and a filled box keeps its fixed slot position.

## Review Focus

- A bot with an old stored name ("Bot 1", no prefix): shown as it is, with the icon.
- A human whose name merely contains "Bot" (not the prefix): shown unchanged, no icon.
- A tile with no Equipment: the row is still in the layout (same height), nothing visible in it.
- The tile's accessible name (`aria-label`) still carries the full name, prefix included.

---

### Task 1: Judgment and Equipment draw only what is there

**Files:**
- Modify: `projects/app/src/app/game-board/phone/phone-seat-tile.ts` (template name row and equipment row, `judgmentBoxes`, `slots`, `JUDGMENT_BOXES`, styles)
- Test: `projects/app/src/app/game-board/phone/phone-seat-tile.spec.ts`

**Interfaces:**
- Produces: `.judgment-box` is rendered once per Judgment card (all `.filled`); `.equip-box` once per filled slot, in `EQUIP_SLOTS` order; `.equipment` is always rendered.

- [ ] **Step 1: Update the tests.** Rewrite the first test (`shows the name, HP, …`) and add one:
  - Name it `shows the name, HP, hand count, both Generals and only the Judgment and Equipment cards the seat has`; with one `lightning` Judgment card and a `serpent-spear` weapon, expect `.judgment-box` length 1 and `.equip-box` length 1 with `data-slot="weapon"`.
  - Add `draws no boxes for a seat with no Judgment or Equipment cards, but keeps the Equipment row`: expect `.judgment-box` and `.equip-box` length 0 and `.equipment` still present.
  - In the slim test nothing changes (already filled only).
- [ ] **Step 2: Run** `npx jest --selectProjects app -w 4 phone-seat-tile` — the two tests fail.
- [ ] **Step 3: Implement.** Judgment: iterate `judgment()` for every tile (delete `JUDGMENT_BOXES` and `judgmentBoxes`; drop the empty-box branch and `seat.judgmentEmpty` use). Equipment: `slots` returns only slots that have a card (`filter`), each with `card` non-null; keep `.equipment` always rendered with `min-height: 18px` (the `.equip-box` height) and `padding: 0 5px 4px` so the height is unchanged. For a filled box to keep its slot position with blanks around it, render `.equipment` as a 4-column grid (`display: grid; grid-template-columns: repeat(4, 1fr)`) and give each box `grid-column: <index in EQUIP_SLOTS + 1>`. Remove the dashed outline styles that only empty boxes used.
- [ ] **Step 4: Run** the same command — passes.
- [ ] **Step 5: Commit** `feat(app): phone seat tile draws only filled Judgment and Equipment`.

### Task 2: Robot icon replaces the "[Bot] " prefix

**Files:**
- Modify: `projects/app/src/app/game-board/phone/phone-seat-tile.ts`
- Test: `projects/app/src/app/game-board/phone/phone-seat-tile.spec.ts`

**Interfaces:**
- Consumes: `BOT_NAME_PREFIX` from `protocol`.
- Produces: `protected readonly shownName = computed(() => string)`: `name()` without a leading `BOT_NAME_PREFIX` when `isBot()`, else `name()`.

- [ ] **Step 1: Write the tests.**
  - `shows a bot's name without the prefix and the robot icon on a full tile`: `name` `'[Bot] Zhou Cang'`, `isBot` true → `.name` text is `Zhou Cang`, `.bot` present.
  - `shows the robot icon on a slim tile too`: replace the slim test's `expect(el.querySelector('.bot')).toBeNull()` with `not.toBeNull()` and rename it to drop "no bot icon".
  - `leaves an old bot name and a human's name as they are`: `'Bot 1'` with `isBot` → `.name` is `Bot 1`, `.bot` present; `'Bob [Bot] x'` with `isBot` false → unchanged, `.bot` null.
  - `keeps the full name as the accessible name`: `button.tile` `aria-label` is `'[Bot] Zhou Cang'`.
- [ ] **Step 2: Run** `npx jest --selectProjects app -w 4 phone-seat-tile` — fails.
- [ ] **Step 3: Implement.** Add `shownName`; bind `.name` text and its `title` to `shownName()`; leave the button's `aria-label` on `name()`; render `.bot` for `isBot()` regardless of `slim()`.
- [ ] **Step 4: Run** the same command — passes. Then run `npx jest --selectProjects app -w 4 phone`, `npm run lint`, `npx tsc -p projects/app/tsconfig.app.json --noEmit` (or the repo's `npm run verify`).
- [ ] **Step 5: Look at it** in the browser pane (`phone-8` and `phone-12` preview scenarios at 800 × 366): a bot tile shows the icon and the bare name; an empty-handed seat has a blank bottom row. Report what was seen.
- [ ] **Step 6: Commit** `feat(app): robot icon replaces the Bot prefix on phone seat tiles`.

## Self-review

- **Spec coverage:** Judgment (Task 1), Equipment with kept height and fixed positions (Task 1), bot icon on every tile and prefix removal with old-name fallback (Task 2), web board unchanged (no file outside the tile touched).
- **Left to the implementer:** the grid-column mechanics in Task 1 and the exact CSS.
