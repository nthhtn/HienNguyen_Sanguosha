# Phone App, Part 1 (Install Support) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The live site can be installed from Chrome on Android as a landscape, full-screen app, and the developer can read on the phone what window the installed app really gets.

**Architecture:** A static web app manifest and three icons ship with the Angular build; the Node server learns the manifest's content type. `Layout` gains a display-mode signal (browser, standalone or full screen), and a small Device Info page shows it with the window size, so the real-phone check needs no debugging cable. Nothing about who can play changes in this part.

**Tech Stack:** Angular (standalone components, signals), Jest (`npx jest --selectProjects app server`), Fastify static handler, the `assets-src` → `assets` pipeline (`npm run assets:build`, `npm run assets:check`).

**Spec:** `docs/superpowers/specs/2026-11-13-phone-app-design.md`, section "1. Install support". This plan covers that section only.

## Why this is one of three plans

The spec makes part 1 its own delivery: Install needs the live HTTPS site, so it must be merged and deployed before it can be tried, and the window size recorded on the phone feeds the board work.

- **Part 1 (this plan):** Manifest, icons, serving, display mode, Device Info, the real-phone check.
- **Part 2 (written after the check):** The fourth layout, `canPlay`, the install hint, the phone board (spec sections 2 and 3).
- **Part 3:** The windows on the phone (spec section 4).

## Decisions made for the plan (my calls)

- **The install hint and Install App button move to Part 2.** The spec lists them under layout rules. Shipping them now would tell a player to install an app that still shows "Larger Screen Needed".
- **`canPlay` does not change in this part.** An installed phone still shows the blocking screen on a game. That is expected until Part 2.
- **A Device Info page at `/device-info`**, linked at the bottom of the navigation drawer (the menu under 900 px; the wide toolbar does not get a link). The installed app has no address bar, so the page must be reachable from the menu. It is how the developer records the window size, and later how a friend reports theirs.
- **The manifest file is `manifest.webmanifest`**, and the server gets the content type `application/manifest+json`.
- **Colours:** `theme_color` and `background_color` are `#3b332c`, the theme's primary seed colour (`projects/app/src/_theme-colors.scss`).
- **Icons are made from `projects/content/assets-src/ui/brand/logo.png`** (544 × 708): The logo scaled to fit a square `#3b332c` canvas. The developer can replace the art later.
- **No service worker in this plan.** The spec allows one only if Chrome refuses to offer Install without it; Task 6 finds out.

## Global Constraints

- Presentation only. No engine, content rules, bots, protocol or sign-in changes. The only server change is the manifest's content type.
- The medium and large layouts do not change in any visible way.
- `Layout` stays the one place that decides layout facts; components read its signals.
- UI text follows `CLAUDE.md`: Title Case for labels ("Device Info", "Window Size"), sentence case for sentences. Vietnamese is sentence case and starts as a draft (not added to the review file).
- `projects/content/assets/` is build output: Icons are added under `assets-src/` and built with `npm run assets:build`; never edit `assets/` by hand.
- The agent never merges or pushes to `main`. Work on branch `feat/phone-app-install`, which already exists.
- `npm run verify` and `npx jest --selectProjects app server` pass before the pull request.

## Review Focus

- **No `matchMedia`** (Jest's jsdom, and every existing spec that creates `Layout`): The display mode is `'browser'` and nothing throws. Pinned in Task 3.
- **The display mode changes while the page is open** (Chrome moves a tab into the installed window): The signal follows. Pinned in Task 3.
- **An icon file with the wrong pixel size** (Chrome then refuses to offer Install without saying why on the phone): The manifest spec reads each PNG's real size. Pinned in Task 2.
- **A missing manifest answered with `index.html`** (a deep-link fallback would hand Chrome HTML): A missing `.webmanifest` is a 404. Pinned in Task 1.
- **Device Info opened while signed out or in Vietnamese:** It needs no sign-in and every label is a catalog key. Pinned in Task 4.

---

### Task 1: The server serves the manifest with its content type

**Files:**
- Modify: `projects/server/src/http/staticFiles.ts` (the `CONTENT_TYPES` table)
- Test: `projects/server/src/http/staticFiles.spec.ts`

**Interfaces:**
- Produces: `GET /manifest.webmanifest` answers with `content-type: application/manifest+json` when the file is in `STATIC_DIR`.

- [ ] **Step 1: Switch to the branch.** It already exists and holds the spec and this plan.

```bash
git switch feat/phone-app-install
```

- [ ] **Step 2: Write the failing tests** in `staticFiles.spec.ts`, using the file's `start()` helper and the way its other tests make requests

```ts
it('serves the web app manifest with its own content type', async () => {
  writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"app"}');
  const res = await (await start()).app.inject({ method: 'GET', url: '/manifest.webmanifest' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toBe('application/manifest+json');
  expect(res.headers['cache-control']).toBe('public, max-age=86400');
});

it('returns 404 for a missing manifest, not the app', async () => {
  const res = await (await start()).app.inject({ method: 'GET', url: '/manifest.webmanifest' });
  expect(res.statusCode).toBe(404);
});
```

- [ ] **Step 3: Run them and see the first fail**

Run: `npx jest --selectProjects server -t "manifest"`
Expected: The first test fails with `application/octet-stream`; the second already passes.

- [ ] **Step 4: Add `'.webmanifest': 'application/manifest+json'` to `CONTENT_TYPES`.** Add `.webmanifest` to the `COMPRESSIBLE` set in `compression.ts`, beside `.json`.

- [ ] **Step 5: Run the server tests**

Run: `npx jest --selectProjects server -t "static files"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/http
git commit -m "feat(server): serve the web app manifest with its content type"
```

### Task 2: The manifest and its icons

**Files:**
- Create: `projects/app/public/manifest.webmanifest`
- Create: `projects/content/assets-src/ui/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and their built copies under `projects/content/assets/ui/brand/` (by `npm run assets:build`)
- Modify: `projects/app/src/index.html`
- Test: `projects/app/src/app/manifest.spec.ts`

**Interfaces:**
- Produces: The built app has `/manifest.webmanifest` and `/images/ui/brand/icon-192.png`, `/images/ui/brand/icon-512.png`, `/images/ui/brand/icon-maskable-512.png` (the build already copies every PNG in `projects/content/assets` to `images/`, and everything in `projects/app/public` to the root).

- [ ] **Step 1: Write the failing test** `manifest.spec.ts`. Read files from disk as `asset-links.spec.ts` does.

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

const manifest = JSON.parse(readFileSync(join(__dirname, '../../public/manifest.webmanifest'), 'utf8'));
const ASSETS = join(__dirname, '../../../content/assets');
// Width and height are in a PNG's IHDR chunk, bytes 16 to 23.
function pngSize(path: string): [number, number] {
  const head = readFileSync(path);
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

describe('web app manifest', () => {
  it('asks for a full screen, landscape app that starts at the root', () => {
    expect(manifest).toMatchObject({
      name: 'Sanguosha (Tam quốc sát)',
      short_name: 'Sanguosha',
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'fullscreen',
      display_override: ['fullscreen', 'standalone'],
      orientation: 'landscape',
      theme_color: '#3b332c',
      background_color: '#3b332c',
    });
  });

  it('lists icons that exist at the size they claim', () => {
    expect(manifest.icons).toEqual([
      { src: 'images/ui/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'images/ui/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'images/ui/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
    for (const icon of manifest.icons) {
      const side = Number(icon.sizes.split('x')[0]);
      expect(pngSize(join(ASSETS, icon.src.replace('images/', '')))).toEqual([side, side]);
    }
  });

  it('is linked from index.html with the theme colour', () => {
    const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="manifest.webmanifest" />');
    expect(html).toContain('<meta name="theme-color" content="#3b332c" />');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx jest --selectProjects app manifest.spec`
Expected: FAIL, the manifest file does not exist.

- [ ] **Step 3: Make the three icon masters** in `projects/content/assets-src/ui/brand/` from `logo.png`.
  - Each is a square `#3b332c` canvas with the logo centred, keeping its 544 × 708 proportions.
  - `icon-192.png` and `icon-512.png`: The logo's height is 80% of the side.
  - `icon-maskable-512.png`: The logo's height is 60% of the side, so it stays inside the round mask's safe zone (the centre 80%).
  - Use any tool on the machine (`sips`, ImageMagick, or Python with Pillow). Look at each with the Read tool before going on.

- [ ] **Step 4: Build the shipped copies.** Find `asset-recipes.json` and read the entry that covers `ui/brand` first; it should copy PNGs unchanged. If it re-encodes to another format, add the three icons as copy-only, because the manifest needs PNG.

Run: `npm run assets:build && npm run assets:check`
Expected: The three files appear in `projects/content/assets/ui/brand/`; the check passes.

- [ ] **Step 5: Write `manifest.webmanifest`** with exactly the fields the test names, and add the two lines to `index.html` after the favicon link.

- [ ] **Step 6: Run the test**

Run: `npx jest --selectProjects app manifest.spec asset-links`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add projects/app/public/manifest.webmanifest projects/app/src/index.html projects/app/src/app/manifest.spec.ts projects/content/assets-src/ui/brand projects/content/assets/ui/brand
git commit -m "feat(app): add a web app manifest and install icons"
```

### Task 3: `Layout` knows the display mode

**Files:**
- Modify: `projects/app/src/app/layout.service.ts`
- Test: `projects/app/src/app/layout.service.spec.ts`

**Interfaces:**
- Produces, on `Layout`:
  - `export type DisplayMode = 'fullscreen' | 'standalone' | 'browser';`
  - `readonly displayMode: Signal<DisplayMode>`
  - `readonly installed: Signal<boolean>` (true unless the mode is `'browser'`)
- `kind`, `canPlay`, `fitsIfTurned` and every other existing member are unchanged.

- [ ] **Step 1: Write the failing tests** in a new `describe('Layout display mode', ...)`. The helper replaces `window.matchMedia` before `Layout` is created and lets a test change the answer later:

```ts
function stubDisplayMode(initial: 'fullscreen' | 'standalone' | 'browser') {
  let mode = initial;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      get matches() { return query === `(display-mode: ${mode})`; },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }),
  });
  return { set(next: typeof mode) { mode = next; listeners.forEach((fn) => fn()); TestBed.tick(); }, listeners };
}
afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia; });

it('is browser, and not installed, when the window has no matchMedia', () => {
  const layout = TestBed.inject(Layout);
  expect(layout.displayMode()).toBe('browser');
  expect(layout.installed()).toBe(false);
});

it.each(['fullscreen', 'standalone'] as const)('is installed in %s mode', (mode) => {
  stubDisplayMode(mode);
  const layout = TestBed.inject(Layout);
  expect(layout.displayMode()).toBe(mode);
  expect(layout.installed()).toBe(true);
});

it('follows the mode when it changes while the page is open', () => {
  const display = stubDisplayMode('browser');
  const layout = TestBed.inject(Layout);
  display.set('standalone');
  expect(layout.installed()).toBe(true);
});

it('stops listening when it is destroyed', () => {
  const display = stubDisplayMode('browser');
  TestBed.inject(Layout);
  TestBed.resetTestingModule();
  expect(display.listeners.size).toBe(0);
});

it('does not change which windows can play', () => {
  stubDisplayMode('fullscreen');
  resizeTo(915, 412);
  expect(TestBed.inject(Layout).canPlay()).toBe(false);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app layout.service`
Expected: FAIL, `displayMode` is not a function.

- [ ] **Step 3: Implement.** Read `(display-mode: fullscreen)` first, then `(display-mode: standalone)`, else `'browser'`. Listen for `change` on both queries and remove the listeners in the existing `onDestroy`. When `window.matchMedia` is not a function, the mode is `'browser'` and no listener is added.

- [ ] **Step 4: Run the whole app project**, since most specs create `Layout`

Run: `npx jest --selectProjects app`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/layout.service.ts projects/app/src/app/layout.service.spec.ts
git commit -m "feat(app): Layout reports the display mode of an installed app"
```

### Task 4: The Device Info page

**Files:**
- Create: `projects/app/src/app/device-info.ts`
- Modify: `projects/app/src/app/app.routes.ts`, `projects/app/src/app/app.html` (one drawer link), `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/layout.service.ts` (expose the size)
- Test: `projects/app/src/app/device-info.spec.ts`, `projects/app/src/app/layout.service.spec.ts`, `projects/app/src/app/app.spec.ts`

**Interfaces:**
- Consumes: `Layout.displayMode`, `Layout.portrait`, `Layout.kind` (Task 3 and existing).
- Produces:
  - `Layout.size: Signal<{ width: number; height: number }>` (the window size `Layout` already tracks privately).
  - `export class DeviceInfo` (selector `app-device-info`), at route `device-info`, lazy, with no guard.

**Strings** (English, then the Vietnamese draft):

| Key | English | Vietnamese |
|---|---|---|
| `device.title` | Device Info | Thông tin thiết bị |
| `device.windowSize` | Window Size | Kích thước cửa sổ |
| `device.displayMode` | Display Mode | Chế độ hiển thị |
| `device.displayMode.fullscreen` | Full Screen | Toàn màn hình |
| `device.displayMode.standalone` | Standalone | Ứng dụng độc lập |
| `device.displayMode.browser` | Browser | Trình duyệt |
| `device.orientation` | Orientation | Hướng màn hình |
| `device.orientation.landscape` | Landscape | Ngang |
| `device.orientation.portrait` | Portrait | Dọc |
| `device.layout` | Layout | Bố cục |
| `device.layout.phone` | Too small to play | Quá nhỏ để chơi |
| `device.layout.medium` | Medium | Vừa |
| `device.layout.large` | Large | Lớn |
| `device.pixelRatio` | Pixel Ratio | Tỷ lệ điểm ảnh |

- [ ] **Step 1: Write the failing tests.** In `layout.service.spec.ts`:

```ts
it('reports the window size', () => {
  const layout = TestBed.inject(Layout);
  resizeTo(915, 412);
  expect(layout.size()).toEqual({ width: 915, height: 412 });
});
```

In `device-info.spec.ts` (render the component the way the app's other component specs do, with the real `Layout`; `stubDisplayMode` moves to a shared testing file, `projects/app/src/app/layout.testing.ts`, and both specs import it):

```ts
it('shows the window size, display mode, orientation and layout', () => {
  stubDisplayMode('fullscreen');
  resizeTo(915, 412);
  const text = render(); // the fixture's text content, English
  expect(text).toContain('Device Info');
  expect(text).toContain('915 × 412');
  expect(text).toContain('Full Screen');
  expect(text).toContain('Landscape');
  expect(text).toContain('Too small to play');
});

it('follows the window when it changes', () => {
  const text0 = render();
  resizeTo(1440, 900);
  expect(renderedText()).toContain('1440 × 900');
  expect(renderedText()).toContain('Large');
  expect(text0).not.toContain('1440 × 900');
});

it('is in Vietnamese when the language is Vietnamese', () => {
  // switch language the way app.vi.spec.ts does
  expect(render()).toContain('Thông tin thiết bị');
});
```

In `app.spec.ts`, beside the existing drawer tests:

- `/device-info` opens with no sign-in.
- The open drawer has a link to `/device-info` labelled "Device Info", after every other link; choosing it closes the drawer like the other links.
- The wide toolbar has no such link.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app device-info layout.service`
Expected: FAIL, `device-info` does not exist.

- [ ] **Step 3: Implement.**
  - `Layout.size` as a computed over the private width and height signals.
  - `DeviceInfo`: A standalone component with a heading and a two-column list (`<dl>`), each value from a `Layout` signal through the `t` pipe. The pixel ratio is `window.devicePixelRatio`, shown as a number.
  - The drawer link in `app.html`: An `<a class="drawer-link" routerLink="/device-info">` with the `info` icon and `device.title`, last in the drawer, following the pattern of the links above it.
  - The route: `{ path: 'device-info', loadComponent: () => import('./device-info').then((m) => m.DeviceInfo) }`, before the `''` redirect.
  - The 14 strings in `en.ts` and `vi.ts`. Do not add them to the Vietnamese review file.

- [ ] **Step 4: Run the app tests and the translation report**

Run: `npx jest --selectProjects app && npm run i18n:status`
Expected: PASS; the report counts the 14 new keys as drafts.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app
git commit -m "feat(app): add a Device Info page for the phone install check"
```

### Task 5: Check the built app and open the pull request

**Files:**
- Modify: `docs/architecture/frontend.md` (one short section, "Installed app": The manifest, `Layout.displayMode` and `installed`, the Device Info page, and that `canPlay` does not use them yet)
- Modify: `docs/deployment.md` (one line: The site is installable; the manifest is `projects/app/public/manifest.webmanifest`)

- [ ] **Step 1: Run the static checks and all tests**

Run: `npm run verify && npx jest --selectProjects app server`
Expected: Both pass.

- [ ] **Step 2: Check the built app in a browser.** Start the app (`npm start`, or the built app through the server as `docs/deployment.md` describes) and, with the browser tools:
  - `GET /manifest.webmanifest` is 200 with `application/manifest+json` (through the Node server) and parses as JSON.
  - Each icon URL in it is 200 and shows the logo on the dark square.
  - `/device-info` shows the real window size and "Browser".
  - At 1440 × 900 the Rooms page and a game board look as they did before (compare with `main`).

- [ ] **Step 3: Write the two doc changes and commit**

```bash
git add docs
git commit -m "docs: describe the installable app and the Device Info page"
```

- [ ] **Step 4: Push the branch and open a pull request** to `main`. The description says what the developer does next: Merge, wait for the deploy, then run the check in Task 6. Do not merge.

### Task 6: The check on a real phone (developer, after merge and deploy)

This task is the developer's. The agent prepares the checklist and records the answers.

- [ ] **Step 1: On the Honor 400 Pro, open the live site in Chrome.** Is **Install app** (or **Add to Home screen** → **Install**) offered in Chrome's menu?
  - If it is not: Open the same site in Chrome on a computer, DevTools → Application → Manifest, and note the installability errors. If the only one is a missing service worker, add a task: A service worker file that registers and handles nothing (no caching), then repeat this step. Anything else comes back to the developer.
- [ ] **Step 2: Install it and open it from the home screen.** Note:
  - Are the browser bars gone?
  - Does it open in landscape and stay there when the phone is turned?
  - Is the status bar (clock, battery) hidden?
- [ ] **Step 3: Sign in, then close the app completely and open it again.** Still signed in?
- [ ] **Step 4: Open a room's lobby.** Does the room load and stay connected (the socket)? Entering a game shows "Larger Screen Needed"; that is expected in this part.
- [ ] **Step 5: Open the menu and choose Device Info.** Write down Window Size, Display Mode, Layout and Pixel Ratio.
- [ ] **Step 6: Record the answers** in the spec under a new heading "First check results (date)", with the pass rules the spec gives:
  - **Pass:** Install offered, no browser bars, landscape holds, sign-in kept, socket connects, and the window is at least 760 × 340 px. `Standalone` instead of `Full Screen` is a pass if the size holds.
  - **Stop:** Install not offered after the service worker task, the landscape lock does not hold, or sign-in is lost. Bring the result to the developer; approach B in the spec is the fallback.
- [ ] **Step 7: On a pass, write the Part 2 plan** (layout rules and the phone board) using the recorded window size.
