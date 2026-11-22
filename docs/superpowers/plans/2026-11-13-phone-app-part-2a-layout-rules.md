# Phone App, Part 2a (Layout Rules) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The installed app on a landscape phone gets its own layout kind and may play, a phone browser tab is told to install, and an online game survives a phone's sleep and app switches better.

**Architecture:** `Layout` gains a fourth kind, `'compact'`, for an installed landscape window under 900 × 600 and at least 760 × 340. A feature flag, `phoneBoard`, keeps that kind off in production until Part 2b ships the board, and a dev-only switch forces "installed" in a desktop browser. A small `InstallPrompt` service holds Chrome's install event for the hint. The socket retries at once when the page comes back, and a `ScreenWakeLock` service keeps the screen on while a board is open.

**Tech Stack:** Angular (standalone components, signals, `InjectionToken` factories), Jest (`npx jest --selectProjects app -- <pattern>`).

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, sections "2. Layout rules" and "2b. Staying connected on a phone". The phone board (section 3) is Part 2b; the windows (section 4) are Part 3.

## Why 2a is its own pull request

The developer chose two pull requests for Part 2 (2026-11-13): 2a is the rules and the install hint, small enough to review alone; 2b is the board. The real-phone check from Part 1 has not run yet: The developer chose to plan now at the reference size (915 × 412) and the floor (760 × 340) and run the check before Part 2 merges.

## Decisions made for the plan (my calls)

- **The new kind is `'compact'`.** `'phone'` keeps meaning "too small to play", as the spec requires. `data-layout="compact"` is set on `<html>`. Device Info shows it as "Phone Board".
- **A `phoneBoard` feature flag**, on under `ng serve`, off in a production build (the same factory as `playOffline`). While it is off, `Layout` ignores the display mode: No `'compact'` kind, no install hint. Reason: Until 2b, an installed phone that could play would get a board built for tablets. 2b turns the flag on.
- **The dev switch:** In dev mode only, `?display=fullscreen`, `?display=standalone` or `?display=browser` in any URL forces that display mode, kept in `sessionStorage` (`sgs.display`) so it survives navigation; `?display=auto` clears it. A token, `DISPLAY_MODE_OVERRIDE`, carries the forced mode into `Layout`, so tests set it directly.
- **The install hint shows when it would help:** Not installed, the flag on, and the window would get `'compact'` if installed, as held or turned. A desktop window that is too small but under 760 × 340 gets no hint.
- **`'compact'` shares the phone's app shell:** The menu drawer (`wide` is false), the 44 px toolbar, the short-screen dialog rules in `styles.scss`, and the slide-over History panel (`panelAsOverlay` is true). The board itself is left as it renders in 2a; 2b styles it.
- **Wake Lock on every device, not only the installed app.** The spec's rule says so; a computer's screen staying on during a game is harmless.
- **Reconnect on return lives in `SocketService`**, which already owns the retry timer.

## Global Constraints

- Presentation only. No engine, content rules, bots, protocol, server or sign-in changes.
- The medium and large layouts do not change in any visible way.
- `Layout` stays the one place that decides layout facts; components read its signals.
- UI text follows `CLAUDE.md`: Title Case for labels ("Install App", "Phone Board"), sentence case for sentences. Vietnamese is sentence case and starts as a draft.
- New strings: `play.installHint` "Install the app to play on this phone."; `play.installApp` "Install App". `board.small.hint` and `play.needsLargerScreen` are unchanged; the install sentence comes after them.
- The agent never merges or pushes to `main`. Work on `feat/phone-app-layout-rules`, which branches from `feat/phone-app-install` (PR 80, not merged).
- `npm run verify` and `npx jest --selectProjects app` pass before the pull request.

## Review Focus

- **A production build:** With `phoneBoard` off, an installed phone is still `'phone'` and blocked, and no install hint appears. Pinned in Task 1 and Task 3.
- **A portrait phone in the installed app** (the landscape lock did not hold): It gets the rotate prompt, not the block. Pinned in Task 1.
- **`?display=` in a production build:** Ignored, and nothing is written to `sessionStorage`. Pinned in Task 2.
- **The Install App button after the player dismisses Chrome's dialog:** Chrome will not let the same event prompt twice, so the button goes away. Pinned in Task 3.
- **The page hidden and shown during a game, and the board closed while a lock request is still pending:** The lock is asked again on return, and a lock that arrives after the board closed is released at once. Pinned in Task 5.

---

### Task 1: The fourth layout

**Files:**
- Modify: `projects/app/src/app/layout.service.ts`, `projects/app/src/app/feature-flags.ts`, `projects/app/src/styles.scss` (the two `html[data-layout='phone']` blocks), `projects/app/src/app/app.css` (the three `[data-layout='phone']` rules), `projects/app/src/app/device-info.ts`, `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`
- Test: `projects/app/src/app/layout.service.spec.ts`, `projects/app/src/app/online/rooms-page.spec.ts`, `projects/app/src/app/online/lobby-page.spec.ts`, `projects/app/src/app/setup/setup.spec.ts`, `projects/app/src/app/device-info.spec.ts`

**Interfaces:**
- Produces:
  - `export const PHONE_BOARD_MIN_WIDTH = 760; export const PHONE_BOARD_MIN_HEIGHT = 340;`
  - `export type LayoutKind = 'phone' | 'compact' | 'medium' | 'large';`
  - `layoutFor(width: number, height: number, phoneBoard = false): LayoutKind`. `phoneBoard` means "installed and the flag is on".
  - `FeatureFlags.phoneBoard: boolean` (factory: `isDevMode()`).
  - `Layout.phoneBoardAllowed: Signal<boolean>` (flag on and `installed()`), and the existing `kind`, `wide`, `canPlay`, `fitsIfTurned`, `panelAsOverlay` following the table below.
  - `Layout.installWouldHelp: Signal<boolean>`: Flag on, not installed, and `layoutFor(w, h, true)` or `layoutFor(h, w, true)` is `'compact'`.
- String: `device.layout.compact` "Phone Board" / "Bàn chơi điện thoại".

- [ ] **Step 1: Write the failing tests** in `layout.service.spec.ts`. Extend the `layoutFor` table and add a `describe('Layout with the phone board', ...)` that provides `{ provide: FEATURE_FLAGS, useValue: { playOffline: true, playbackSettings: true, phoneBoard: true } }` and uses `stubDisplayMode` from `layout.testing.ts`.

```ts
it.each([
  [915, 412, 'compact'], [780, 360, 'compact'], [882, 344, 'compact'], [760, 340, 'compact'],
  [759, 400, 'phone'], [800, 339, 'phone'], [412, 915, 'phone'], [1133, 744, 'medium'], [1440, 900, 'large'],
])('with the phone board, %i x %i is %s', (w, h, kind) => {
  expect(layoutFor(w, h, true)).toBe(kind);
});
it('without the phone board, 915 x 412 is still phone', () => expect(layoutFor(915, 412)).toBe('phone'));
```

In the new `describe`, one test per cell of the spec's table:
- Installed, 915 × 412: `kind` is `'compact'`, `canPlay` true, `wide` false, `panelAsOverlay` true, `fitsIfTurned` false, `installWouldHelp` false.
- Browser, 915 × 412: `kind` is `'phone'`, `canPlay` false, `installWouldHelp` true.
- Browser, 412 × 915: `canPlay` false, `fitsIfTurned` false, `installWouldHelp` true.
- Installed, 412 × 915: `fitsIfTurned` true (the rotate prompt).
- Browser and installed, 744 × 1133: `fitsIfTurned` true, as today.
- Installed, 700 × 330: `kind` is `'phone'`, `fitsIfTurned` false; browser at the same size: `installWouldHelp` false.
- Installed or browser, 1366 × 768: `'large'`, `installWouldHelp` false.
- Flag off (`phoneBoard: false`), installed, 915 × 412: `kind` is `'phone'`, `canPlay` false, `installWouldHelp` false.
- `document.documentElement.dataset['layout']` is `'compact'` when installed at 915 × 412.

In `rooms-page.spec.ts`, `lobby-page.spec.ts` and `setup.spec.ts`, beside each existing "too small to play" block: A test that, installed with the flag on at 915 × 412, the same controls are enabled (Create Room, Play With Bots, Join, Rejoin; the lobby's Start when the room is full; Start Game) and `app-small-screen-notice` says nothing. In `device-info.spec.ts`: Installed with the flag on at 915 × 412, the page says "Phone Board".

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- layout.service rooms-page lobby-page setup.spec device-info`
Expected: FAIL; `layoutFor` returns `'phone'` for 915 × 412 with the third argument, and `installWouldHelp` is undefined.

- [ ] **Step 3: Implement.**
  - `layoutFor`: The current rule first (900 × 600 gives medium or large); then, with `phoneBoard`, landscape and at least 760 × 340 gives `'compact'`; else `'phone'`.
  - `Layout`: `kind` passes `phoneBoardAllowed()`. `wide` and `canPlay` treat `'compact'` as described; `fitsIfTurned` is true when not playable as held but `layoutFor(h, w, phoneBoardAllowed())` can play (this covers the tablet rule and the new installed-phone rule in one expression).
  - Styles: Each `[data-layout='phone']` selector in `styles.scss` and `app.css` also matches `'compact'`. The `[data-layout='medium']` rules in board components are not touched.
  - `DeviceInfo`: Add `compact` to its label map.

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src
git commit -m "feat(app): a phone board layout for the installed app, behind a flag"
```

### Task 2: Force "installed" in dev

**Files:**
- Create: `projects/app/src/app/display-mode-override.ts`
- Modify: `projects/app/src/app/layout.service.ts`
- Test: `projects/app/src/app/display-mode-override.spec.ts`, `projects/app/src/app/layout.service.spec.ts`

**Interfaces:**
- Consumes: `DisplayMode` (Part 1).
- Produces:
  - `export function readDisplayModeOverride(search: string, storage: Storage | null, dev: boolean): DisplayMode | null`
  - `export const DISPLAY_MODE_OVERRIDE = new InjectionToken<DisplayMode | null>(...)`, factory: `readDisplayModeOverride(location.search, sessionStorage or null if it throws, isDevMode())`.
  - `Layout.displayMode` returns the override when it is not null, and ignores `matchMedia` then.

- [ ] **Step 1: Write the failing tests** in `display-mode-override.spec.ts`, with a `Map`-backed `Storage` stub:
  - `?display=fullscreen` in dev: Returns `'fullscreen'` and stores it under `sgs.display`.
  - Later call with no query and the stored value: Returns `'fullscreen'`.
  - `?display=auto`: Returns `null` and removes the key.
  - `?display=bogus`: Returns the stored value or `null`; stores nothing new.
  - Not dev, `?display=fullscreen`: Returns `null` and writes nothing.
  - `storage` null (private mode): `?display=standalone` still returns `'standalone'`.

In `layout.service.spec.ts`: With `DISPLAY_MODE_OVERRIDE` provided as `'standalone'` and `matchMedia` stubbed as `'browser'`, `displayMode()` is `'standalone'` and `installed()` is true.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- display-mode-override layout.service`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement** the function, the token and the `Layout` change. Every `Storage` call is in a `try`.

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app
git commit -m "feat(app): force the installed display mode in dev with ?display="
```

### Task 3: The install hint and Install App button

**Files:**
- Create: `projects/app/src/app/install-prompt.service.ts`, `projects/app/src/app/install-hint.ts`
- Modify: `projects/app/src/app/app.ts` (inject `InstallPrompt` so it listens from the start), `projects/app/src/app/small-screen-notice.ts`, `projects/app/src/app/game-board/small-screen-prompt.ts`, `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`
- Test: `projects/app/src/app/install-prompt.service.spec.ts`, `projects/app/src/app/install-hint.spec.ts`

**Interfaces:**
- Consumes: `Layout.installWouldHelp` (Task 1).
- Produces:
  - `InstallPrompt` (root): `readonly available: Signal<boolean>`; `install(): Promise<void>`. It listens on `window` for `beforeinstallprompt` (calls `preventDefault()`, keeps the event, `available` true) and `appinstalled` (drops it). `install()` calls the event's `prompt()`, awaits `userChoice`, and drops the event whatever the choice. Listeners are removed on destroy.
  - `InstallHint` (selector `app-install-hint`): When `layout.installWouldHelp()`, a sentence (`play.installHint`) and, when `installPrompt.available()`, a button "Install App" (`play.installApp`, class `install-app`) that calls `install()`. Otherwise it renders nothing.
- Strings: `play.installHint` "Install the app to play on this phone." / "Cài ứng dụng để chơi trên điện thoại này."; `play.installApp` "Install App" / "Cài ứng dụng".

- [ ] **Step 1: Write the failing tests.**

`install-prompt.service.spec.ts`, firing a fake event (`Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: jest.fn(async () => undefined), userChoice: Promise.resolve({ outcome: 'dismissed' }) })`):
- Not available until the event fires; available after; the event's `defaultPrevented` is true.
- `install()` calls `prompt()` once, and afterwards `available` is false, for `'dismissed'` and for `'accepted'`.
- `appinstalled` makes it unavailable.
- After `TestBed.resetTestingModule()`, a new `beforeinstallprompt` does not reach the old service.

`install-hint.spec.ts`, with the flag on:
- Browser at 915 × 412, no event: The sentence, no button.
- Same, after the event: The button "Install App"; clicking it calls `prompt()`.
- Installed at 915 × 412: Nothing.
- Browser at 1366 × 768, and browser at 700 × 330: Nothing.
- Flag off, browser at 915 × 412: Nothing.
- Vietnamese: The sentence is "Cài ứng dụng để chơi trên điện thoại này."

`small-screen-notice` and `small-screen-prompt`: Each contains `app-install-hint` after its own sentence; the rotate variant of the prompt does not.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- install-prompt install-hint`
Expected: FAIL, the modules do not exist.

- [ ] **Step 3: Implement** the service, the component (styled like the notice's text, the button `mat-stroked-button`, at least 44 px tall), the two template lines and the strings. `App` injects `InstallPrompt` in its constructor so the listener is in place before Chrome fires the event.

- [ ] **Step 4: Run the app tests and the translation report**

Run: `npx jest --selectProjects app && npm run i18n:status`
Expected: PASS; the new keys are drafts.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app
git commit -m "feat(app): tell a phone browser to install the app, with an Install App button"
```

### Task 4: Reconnect at once when the page comes back

**Files:**
- Modify: `projects/app/src/app/online/socket.service.ts`
- Test: `projects/app/src/app/online/socket.service.spec.ts`

**Interfaces:**
- Produces: No new public members. `SocketService` listens for `visibilitychange` on `document` from construction and stops on destroy.

- [ ] **Step 1: Write the failing tests**, with the spec file's fake socket factory and Jest fake timers. A helper sets `document.visibilityState` (`Object.defineProperty(document, 'visibilityState', { configurable: true, value })`) and dispatches `visibilitychange`.
  - After a drop on the third attempt (backoff 4 s pending), becoming visible opens a new socket at once, and the pending timer no longer opens a second one (`jest.advanceTimersByTime(15_000)` adds no socket).
  - After that early retry also drops, the next delay is 1 000 ms (the backoff starts again).
  - Becoming visible while `open`, `connecting`, `idle` or `ended`: No new socket.
  - Becoming `hidden`: Nothing happens.
  - After `end()`, becoming visible: No new socket. After the service is destroyed: The listener is gone.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- socket.service`
Expected: FAIL; no socket opens until the timer runs.

- [ ] **Step 3: Implement:** On `visible`, if the status is `'reconnecting'` and a retry timer is pending, clear it, set `attempt` to 0, and `open()`.

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/online
git commit -m "feat(app): reconnect the room socket as soon as the page is visible again"
```

### Task 5: Keep the screen on during a game

**Files:**
- Create: `projects/app/src/app/screen-wake-lock.service.ts`
- Modify: `projects/app/src/app/game-board/game-board.ts`
- Test: `projects/app/src/app/screen-wake-lock.service.spec.ts`, `projects/app/src/app/game-board/game-board.layout.spec.ts` (or the board spec that already renders a game to Game Over)

**Interfaces:**
- Produces: `ScreenWakeLock` (root) with `hold(): void` and `release(): void`. While held, it keeps one `WakeLockSentinel` and asks again on `visibilitychange` to `visible` if the browser released it. With no `navigator.wakeLock`, or when `request` rejects, it does nothing and logs nothing.
- `GameBoard`: An effect holds the lock while the board is open and `gameOver()` is null, and releases it at Game Over; `DestroyRef` releases it.

- [ ] **Step 1: Write the failing tests** in `screen-wake-lock.service.spec.ts`, with a fake `navigator.wakeLock` whose `request` resolves to a sentinel (`released` flag, `release()`, and a way to fire its `release` event):
  - `hold()` requests `'screen'` once; a second `hold()` does not request again.
  - `release()` releases the sentinel; `hold()` after it requests again.
  - The browser releases the sentinel (page hidden), then the page becomes visible: It requests again. While not held, becoming visible requests nothing.
  - `release()` before the request resolves: The sentinel is released as soon as it arrives.
  - No `navigator.wakeLock`: `hold()` and `release()` do not throw. `request` rejects: No unhandled rejection.

In the board spec: Rendering a running game calls `hold()`; reaching Game Over calls `release()`; destroying the fixture calls `release()`. Use a `ScreenWakeLock` stub with `jest.fn()` members.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app -- screen-wake-lock game-board.layout`
Expected: FAIL, the service does not exist.

- [ ] **Step 3: Implement** the service and the board effect.

- [ ] **Step 4: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app
git commit -m "feat(app): keep the screen on while a game is running"
```

### Task 6: Check, document and open the pull request

**Files:**
- Modify: `docs/architecture/frontend.md` (the "Responsive layout" table gains the `compact` row; "Installed app" says `canPlay` now uses the display mode behind `phoneBoard`, describes `?display=`, the install hint, reconnect on return and the wake lock), `docs/deferrals.md` (one row: `phoneBoard` is off in production until Part 2b)

- [ ] **Step 1: Run the static checks and all tests**

Run: `npm run verify && npx jest --selectProjects app server`
Expected: Both pass.

- [ ] **Step 2: Check in the browser** (built app through the Node server, or `npm start`):
  - 915 × 412 with `?display=fullscreen`: `data-layout` is `compact`, the Rooms page enables Play With Bots, Device Info says "Phone Board".
  - 915 × 412 with `?display=browser`: Rooms shows the notice and the install sentence.
  - 412 × 915 with `?display=fullscreen`: A game shows the rotate prompt.
  - 1440 × 900 and 1133 × 744: The Rooms page and a game board look as on `feat/phone-app-install`.

- [ ] **Step 3: Write the doc changes and commit**

```bash
git add docs
git commit -m "docs: the phone board layout rules, install hint and staying connected"
```

- [ ] **Step 4: Push the branch and open a pull request** against `feat/phone-app-install` while PR 80 is open (against `main` once it is merged). The description says the phone check from Part 1 still has to pass before Part 2 merges. Do not merge.
