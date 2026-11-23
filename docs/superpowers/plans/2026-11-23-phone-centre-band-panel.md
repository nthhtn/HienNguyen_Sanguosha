# Phone Centre Band and Right-Hand Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the phone board the Chat button and the Draw Pile count leave the centre band, the band shows only the newest played card, and the right-hand panel gains a Chat tab and the Draw Pile line.

**Architecture:** `BoardChatState` becomes the shared source for "chat is on screen"; the board panel's Chat tab drives it, the old chat drawer and the band's Chat button step aside on the phone board. `PhaseIndicator` gets an input to hide the count.

**Tech Stack:** Angular signals, Angular Material tabs, Jest.

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, section 3e (Cancel is out of scope).

## Global Constraints

- Tablets and computers are unchanged: the floating Chat button and chat drawer, the phase indicator's Draw Pile count, and the panel's two tabs.
- The Menu drawer is untouched.
- No text under 12 px; buttons 44 px.
- Strings reuse existing keys: `lobby.chat` (tab), `phase.drawPile` (line), `board.panel.open`, `chat.unread`.

## Review Focus

- A solo game (no `BoardChatState` provider) or a lobby with no chat: the panel has no Chat tab and the History button has no badge.
- Unread messages while the panel is closed or on another tab: the History button badge counts them; opening the Chat tab clears it.
- The panel is open on the Chat tab and the phone board goes away (rotation, game end): the chat is no longer "open".
- A turn with nothing in the processing zone: no played card drawn; with several: only the last.

---

### Task 1: Chat state follows the panel

**Files:**
- Modify: `projects/app/src/app/online/board-chat-state.service.ts`, `projects/app/src/app/online/board-chat.ts`
- Test: `projects/app/src/app/online/board-chat.spec.ts` (and a new `board-chat-state.service.spec.ts` if none exists)

**Interfaces:**
- Produces on `BoardChatState`: `readonly you: Signal<string | null>` (read-only view of the existing signal), `readonly canSend: Signal<boolean>`, `setCanSend(on: boolean): void`, `setViewing(on: boolean): void` (sets `open` to `on` and marks every message so far as seen).

- [ ] **Step 1: Tests.** `setViewing(true)` makes `unread()` 0 and `open()` true; after `setViewing(false)` new messages count again; `canSend` follows `setCanSend`. In `board-chat.spec.ts`: with `Layout.toolbarHidden()` true, `BoardChat` renders no `.drawer` and no `.chat-toggle` even when `state.open()` is true.
- [ ] **Step 2: Run** `npx jest --selectProjects app -w 4 board-chat` — fails.
- [ ] **Step 3: Implement** the three members; `BoardChat` calls `state.setCanSend` from an effect on its `canSend` input, and renders nothing while `layout.toolbarHidden()`.
- [ ] **Step 4: Run** the same command — passes.
- [ ] **Step 5: Commit** `feat(app): board chat state follows the panel on the phone board`.

### Task 2: Panel gets the Chat tab and the Draw Pile line

**Files:**
- Modify: `projects/app/src/app/game-board/board-panel.ts`, `projects/app/src/app/game-board/game-board.ts` (the phone-board `<app-board-panel>` only, around line 182), `projects/app/src/app/layout.service.ts` only if a closing hook is needed
- Test: a new `projects/app/src/app/game-board/board-panel.spec.ts`

**Interfaces:**
- Consumes: Task 1's `BoardChatState` members.
- Produces: `BoardPanel` input `drawPileCount = input<number | null>(null)`; a Chat tab appears only when `BoardChatState` is provided, `available()` and `Layout.toolbarHidden()`.

- [ ] **Step 1: Tests.** (a) `drawPileCount` 54 shows a `.draw-pile` line "Draw Pile 54" above the tabs; `null` shows none. (b) With no `BoardChatState` provided: two tabs. With one provided, available and `toolbarHidden` true: three tabs, the third labelled "Chat" with an `app-chat-panel`. (c) Selecting the Chat tab while the panel is open calls `setViewing(true)` (`state.open()` true); selecting another tab or destroying the panel gives `open()` false.
- [ ] **Step 2: Run** `npx jest --selectProjects app -w 4 board-panel` — fails.
- [ ] **Step 3: Implement.** Inject `BoardChatState` optionally; track the selected tab index with `(selectedIndexChange)`; an effect sets viewing = chat tab selected; `DestroyRef.onDestroy` sets viewing false. `GameBoard` passes `[drawPileCount]` to the phone-board panel only, from a `drawPileCount` computed on the visible state (the same expression as `PhaseIndicator`'s).
- [ ] **Step 4: Run** the same command — passes.
- [ ] **Step 5: Commit** `feat(app): the right-hand panel holds Chat and the Draw Pile count on the phone`.

### Task 3: Lighter centre band

**Files:**
- Modify: `projects/app/src/app/game-board/phone/phone-centre-band.ts`, `projects/app/src/app/game-board/phase-indicator.ts`
- Test: `projects/app/src/app/game-board/phone/phone-centre-band.spec.ts`, the phase indicator's spec

**Interfaces:**
- Produces: `PhaseIndicator` input `showDrawPile = input(true)`.

- [ ] **Step 1: Tests.** Band: no `button.chat` even in an online room; no `.draw-pile`; with two cards in the processing zone only the last is drawn (`.turned-up app-playing-card` length 1, and it is the newest); with none, no `.turned-up`; the History button shows a `.unread` count when `BoardChatState.unread()` > 0 and none when 0 or with no provider. Phase indicator: `.draw-pile` absent when `showDrawPile` is false, present by default.
- [ ] **Step 2: Run** `npx jest --selectProjects app -w 4 phone-centre-band phase-indicator` — fails.
- [ ] **Step 3: Implement.** Band passes `[showDrawPile]="false"`; delete the chat button; `turnedUp` returns the last card only; the History button gets the `.unread` badge (reuse the band's existing badge style) and its label uses `chat.unread` when unread.
- [ ] **Step 4: Run** the same command and then `npx jest --selectProjects app -w 4 phone game-board online` — all pass; run `npx tsc -p projects/app/tsconfig.app.json --noEmit`.
- [ ] **Step 5: Look at it** in the browser pane (the `phone-8` scenario at 800 × 366) if the pane allows localhost; report what was seen, or say it could not be checked.
- [ ] **Step 6: Commit** `feat(app): lighter phone centre band`.

## Self-review

- **Spec coverage:** Chat tab and unread (Tasks 1–3), Draw Pile in the panel (Task 2) and out of the band (Task 3), newest card only (Task 3), tablets unchanged (inputs default to today's behavior, Chat tab gated on `toolbarHidden`).
- **Left to the implementer:** the tab-index bookkeeping and the badge styling.
