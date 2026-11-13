# Phone App (Installable Web App) — Design

Status: Approved by the developer on 2026-11-13. Nothing is built.

Preview: A mock-up of the phone board on nine phone and tablet screens, with the seat tile and every seat badge as the developer approved them, is at https://claude.ai/artifact/QDq44Kwn1NmHR57EeU8Kwu (private artifact; it is the reference for Part 2, and the text of this document wins where they differ).

Related: `2026-11-03-mobile-landscape-design.md` (medium and large layouts, navigation drawer, safe areas) and `2026-11-04-block-play-on-phones-design.md` (a game needs 900 × 600 px). This design keeps both for browsers and adds one exception: The installed app on a phone.

## Why

The developer wants to play Guozhan online with friends on phones, in the same rooms as people on the web app. Today a phone cannot play: The board needs a window of at least 900 × 600 px, and a landscape phone has about 400 px of height. An earlier phone board was built, tried on an Honor 400 Pro and removed. The developer's reason: It was **too small to read**. That board scaled the desktop seats down to 0.35 and 0.48 of their size. This design does not scale anything down; it lays the phone board out again from nothing.

## Goals

- A friend with an Android phone can install the game from the live site, sign in, join a room and play a full Guozhan game with touch only.
- Phone, tablet and computer players share the same rooms. Nothing about a room or a game depends on the device.
- Every table size the game allows (2 to 12 seats, `MAX_GUOZHAN_SEATS`) is playable on the phone board.
- All text on the phone board is readable at arm's length (rules in "Sizes" below).

## Non-goals

- iPhone. Friends are on Android. Nothing here should stop the app working in Safari, but it is not tested or tuned there.
- An APK, the Play Store, Capacitor or any native code.
- Playing with no connection. Online play needs the server anyway.
- Portrait play.
- Changes to rules, the engine, bots, the protocol or the server's sign-in.
- Changes to the medium and large layouts.

## Anti-goals (a failure even if it technically works)

- Any text or control on the phone board made by shrinking a larger one (`zoom`, `transform: scale` or an `em` chain that lands below the minimum sizes).
- The medium or large layout changes in any visible way.
- A phone browser tab (not installed) gets the phone board. Browser bars leave too little height; the block stays there.
- Rules or legality logic in layout code. The board still asks the game service for legal actions.

## Approaches

| | A · Bundled Capacitor app | B · Capacitor shell over the live site | C · Installable web app |
|---|---|---|---|
| What friends do | Install an APK sent to them | Install an APK sent to them | Open the site in Chrome, tap Install |
| Server changes | Token sign-in, a second allowed origin, socket sign-in by token | None | None |
| Updates | A new APK for each release; an old one can fall out of step with the server | With each deploy | With each deploy |
| Risks | Most work; a second sign-in path to keep secure; about 46 MB to send | Capacitor's docs discourage a production app that loads a remote URL | Depends on Chrome's install behaviour; not a store app |

**Chosen: C** (developer, 2026-11-13). The server already serves the built app from one origin, so the session cookie and the `Origin` check keep working with no change. C reaches the goal with the least work and no version drift. It can be wrapped into an APK later without redoing the board. React Native and Flutter were rejected earlier: Both mean writing every screen again, and Flutter cannot reuse the TypeScript engine.

## What gets built

Four parts. The first is small and comes first, because it tests the one assumption the rest depends on.

### 1. Install support

- **A web app manifest**, linked from `index.html`:
  - Name "Sanguosha (Tam quốc sát)", a short name, a theme and background colour matching the app shell.
  - `display: fullscreen`, with `display_override` falling back to `standalone`.
  - `orientation: landscape`. The whole installed app is landscape, not only the game (developer-approved proposal). Every other page already works in landscape.
  - `start_url: /` and `scope: /`.
  - Icons at 192 and 512 px, plus a maskable 512 px one. Art is the builder's call from existing assets; the developer can replace it.
- **Serving:** The static handler has no content type for `.webmanifest`. Either add one (`application/manifest+json`) or name the file `manifest.json`. Builder's call.
- **Service worker:** Only if Chrome on Android refuses to offer Install without one. If needed, it does nothing but exist (no caching), so a deploy can never be hidden by a stale cache. Builder verifies this on a real phone.
- **First check, before any board work.** Install needs HTTPS and there is one live service, so this is its own delivery: Part 1 is a pull request the developer merges and deploys; the board work starts after the check.
  - On the developer's Honor 400 Pro, install from the live site and confirm: Install is offered, the app opens with no browser bars, it stays landscape, sign-in survives closing and reopening the app, and the socket connects.
  - Record the window size the app reports (`innerWidth` × `innerHeight`).
  - If the phone gives `standalone` instead of `fullscreen` (the status bar stays), that is a pass as long as the window is still at least the minimum in part 2. Record it.
  - If Install is not offered, the landscape lock does not hold, or sign-in is lost, stop and bring the result back to the developer; approach B is the fallback.

### 2. Layout rules

`Layout` (`layout.service.ts`) is still the one place that decides the layout.

- **Installed:** A new signal, true when the page runs as the installed app (`display-mode: fullscreen` or `standalone`). It updates if the mode changes.
- **A fourth layout:** The phone board. It applies when the app is installed, the window is landscape, and it is below 900 × 600 px but at least **760 × 340 px**. The floor comes from real phones (Galaxy S24 at 780 × 360, a folded Galaxy Z Fold5 at 882 × 344) and from 12 seats: nine equal columns there are 78 px wide, just over the 76 px slim minimum. The name of the kind is the builder's call; the existing kind `'phone'` keeps meaning "too small to play".
- **`canPlay`** becomes: Medium, large, or the phone board.
- **Everything keyed on `'phone'` today must be revisited:** `Layout.wide`, `panelAsOverlay` and the `[data-layout='phone']` styles (`app.css`, `general-selection.ts`, `hand-view.ts`, `game-board.ts`). The phone board keeps the menu drawer and the slide-over panel; it does not fall into the medium styles by accident.

| Window | Not installed | Installed |
|---|---|---|
| 900 × 600 px or more | Medium or large, as today | Medium or large, as today |
| Landscape, 760 × 340 px or more | Blocked ("Larger Screen Needed"), plus the new install hint | **Phone board** |
| Portrait, a tablet that would fit if turned (900 × 600) | Rotate prompt, as today | Rotate prompt, as today |
| Portrait, a phone that would fit the phone board if turned (760 × 340) | Blocked, as today | Rotate prompt. A new rule: `fitsIfTurned` covers only tablets today. Should be rare; the lock is not guaranteed on every device |
| Anything smaller | Blocked | Blocked |

- **Start and join controls** (Start Game, Create Room, Play With Bots, Join, Rejoin, Start in the lobby) follow `canPlay`, so they are enabled in the installed app on a phone.
- **Install hint:** In a browser on a too-small window, the blocking screen and the notice beside the disabled controls gain one sentence telling the player to install the app. Where Chrome offers it (`beforeinstallprompt`), an **Install App** button sits beside the sentence. Shown only when not installed.
- **Navigation, Rooms, lobby, sign-in, wiki, My Games** keep the layout they have today under 900 px (menu drawer). No redesign.

### 2b. Staying connected on a phone

Added by the developer on 2026-11-13, built with the layout rules. Both apply on every device, not only the installed app; neither changes how a game is played.

- **Reconnect on return:** When the page becomes visible again (`visibilitychange` to `visible`) and the room socket is waiting to retry after a drop, it retries at once and starts its backoff again from the first delay. A socket that is open, connecting or ended is left alone; a dead socket that still looks open is found by the server's heartbeat, as today.
- **Screen stays on during a game:** While a game board is open and the game is not over, the app asks the browser to keep the screen on (Screen Wake Lock, `navigator.wakeLock.request('screen')`).
  - The browser drops the lock when the page is hidden, so it is asked again each time the page becomes visible while the game is still running.
  - The lock is released at Game Over and when the board closes.
  - Where the browser has no Wake Lock, or refuses, nothing happens and nothing is shown.

### 3. The phone board

Reference size: 915 × 412 px (Honor 400 Pro class). It must also work at 780 × 360 px (Galaxy S24) and at the floor, 760 × 340 px.

**The app toolbar is hidden during a game on the phone board** (developer-approved, 2026-11-13). It is 44 px tall, about an eighth of the height. A menu button in the centre band opens the same navigation drawer, which already holds leaving the game, language, music and sound. Outside a game the toolbar stays. The board's panel, scrim and prompts are positioned below the toolbar today and must account for it being gone.

```
+--------------------------------------------------------------------------+
| [Seat 10] [ 9 ][ 8 ][ 7 ][ 6 ][ 5 ][ 4 ][ 3 ]                   [Seat 2] |
| [Seat 11] +--------------------------------------------------+  [Seat 1] |
|           | Play Phase · your turn     [cards]   History Chat |           |
|           | Seat 3 used Sha on you               Deck 62      |           |
|           +--------------------------------------------------+           |
| [ You    ] [Sha][Shan][Tao][Sha][Duel][Shan][Sha][Tao]     [Use Card ]   |
| [ seat   ] [   ][    ][   ][   ][    ][    ][   ][   ]     [End Phase]   |
+--------------------------------------------------------------------------+
                         (12 seats: 2 + 7 + 2)
```

**Three bands**

- **Bottom row:** The viewer's own seat on the left, the hand in the middle, the action buttons on the right. It takes about 30% of the height (about 124 px on the reference size, never under 104 px); the developer found 36% too tall in the preview (2026-11-13).
- **Centre band:** Phase and whose turn, the latest Action History line, the cards just played, the deck count, the menu button, and the button that opens the Action History and Discard Pile panel.
- **Opponents:** Along the top, then down the sides.

**Where opponents sit** (developer-approved). Seats are placed so turn order reads around the table, as on the web board. The seats nearest the viewer in turn order are the ones that move to the side columns.

| Seats in the game | Left column | Top row | Right column |
|---|---|---|---|
| 2 to 8 | 0 | 1 to 7 | 0 |
| 9 | 1 | 6 | 1 |
| 10 | 2 | 5 | 2 |
| 11 | 2 | 6 | 2 |
| 12 | 2 | 7 | 2 |

With no side columns the centre band is the full width. On windows narrower than the reference, the builder may move seats to the side columns earlier, so that no tile drops below the slim width.

**Seat tiles.** Two forms, chosen by the width a tile gets:

- **How a tile is arranged** (developer, 2026-11-13, from the preview), top to bottom:
  - The name, with up to 3 Judgment boxes in the blank space to its right.
  - The Generals' pictures.
  - HP and hand count.
  - 4 Equipment boxes in a row along the bottom. An empty box is drawn as an outline, so the slots keep their places.
- **What a phone tile leaves out and keeps** (developer, 2026-11-13):
  - No kingdom banner. The tile's colour theme alone shows the force.
  - The Ambitionist indicator stays.
  - No status text such as "Chained". The chained indicator (the chain picture) stays.
  - The other text badges stay as text and lie on the General they are about (developer, 2026-11-13):
    - No Skills for one General: On that General's picture.
    - Form: On the General that changed, as the one word "Form". The form's name is in Seat Details.
    - Face Down, No Skills for the whole seat, and Dying: Across both Generals.
    - Eliminated: The stamp across the tile, as on the web.
  - So every tile shows both Generals, slim tiles too (two narrow pictures). A badge on a narrow picture may wrap to two lines; it is never under 12 px.
  - The chained indicator sits at the end of the HP row, clear of the badges.
- **Full tile** (110 px wide or more): Name, both Generals' pictures side by side, HP, hand count, Equipment as icons, Judgment cards as icons, and the states the web tile shows (turn owner, responding, chained, face down, dying, eliminated, bot, force colour, Ambitionist), within the rules above.
- **Slim tile** (under 110 px, never under 76 px, developer-approved 2026-11-13; at 12 seats, with the side columns the same width as the top tiles, expect about 96 px on the reference size, 81 px on a Galaxy S24 and 78 px at the floor): The same parts as a full tile, narrower: Both Generals as two narrow pictures, a shortened name, and single-character Equipment labels.
- **An opponent's tile is one tap target, and it opens a new Seat Details window** (Claude's call): Both Generals with their skills, Equipment and Judgment cards by name, cards under the General.
  - On the web board each General half and each Equipment or Judgment card is its own small button that opens its info window. On the phone board those are too small to tap, so they move inside Seat Details, where each opens the existing General or card info window.
  - Targets are not chosen by tapping seats (they come from the card's menu), so the tap does not clash with play.
  - Seat Details is a new component. It shows only what the viewer may see (it reads the redacted state, as the tile does).
- Damage pictures, seat cues and the dimming during playback must still land on the right tile.

**The viewer's own seat** is always a full tile, with the skill buttons the web tile has.

**The hand**

- Cards are large enough to read the name and suit and number at the sizes below.
- When the cards do not fit, they overlap; when the visible strip of a card would drop below 44 px, the hand scrolls sideways instead of shrinking further.
- Tapping a card selects it and shows its actions (Play, targets menu, Info), as the web hand does. No new gestures.

**Action buttons, Action History, Discard Pile and chat**

- The action buttons are the same list the web board shows (`boardActions`), stacked on the right.
- Action History and Discard Pile open in the slide-over panel the medium layout already uses (`board-panel.ts`).
- Chat stays what it is today: The floating chat of an online game (`app-board-chat`, owned by the lobby page, outside the board). On the phone board its button must not cover the hand or the action buttons, and the open chat must fit the height. A local game has no chat.

### 4. Windows on the phone

Every window that can open during a game must fit a 760 × 340 px window without the page scrolling, with its buttons always on screen. If the content is long, the content scrolls inside the window and the buttons stay fixed.

- General selection, with the selection roster.
- Response, choice, selection, discard, arrange, force and Start reveal windows.
- Judgment popup and Compete window.
- Resolution notice.
- Game Over and the Victory reveal.
- Card and General info windows.
- The decision banner, the decision countdown and the game start countdown.

These are the same components with phone styles, not second copies, unless a window cannot be made to fit; then the builder says so in the plan.

## Sizes (the answer to "too small to read")

These hold on the phone board and in every window opened from it.

- **No text under 12 px.** The web tile's 9 px and 11 px labels get phone sizes.
- **14 px or more** for names, HP, hand counts, card names, prompts, button labels and Action History lines.
- **Tap targets at least 44 × 44 px.**
- **Nothing is scaled down.** `seatScale` and `centreScale` are not used on the phone board.
- **Check by eye on the Honor 400 Pro**, not only in the browser's device mode. The developer's reading of the real screen is the acceptance test.

## Constraints

- Presentation only. No engine, content, bots, protocol or sign-in changes. The only server change allowed is a content type for the manifest.
- The local Setup and Game screens are not changed in behaviour. The board component is shared, so the phone board applies to a local game too, but offline play is a dev-only feature flag; friends use Play With Bots on the Rooms screen.
- UI text follows the casing rules in `CLAUDE.md`. Every new string gets an English entry and a Vietnamese draft.
- Safe areas: The app already uses `viewport-fit=cover`; the phone board keeps seats and buttons out of camera cut-outs and rounded corners.

## New strings (drafts)

- `play.installHint` "Install the app to play on this phone."
- `play.installApp` "Install App"
- Changed `board.small.hint` and `play.needsLargerScreen` only when not installed: The install sentence is added after them, not in place of them.
- Vietnamese drafts for each, marked for review.

## How to check it

- **Jest:** The layout table above (each cell), the seat placement table for 2 to 12 seats, full or slim tile by width, each start and join control enabled in the installed phone case, the install hint shown only when not installed.
- **Dev scenarios (`/preview`):** A phone-board scenario at 4, 8 and 12 seats, and one per window in part 4, so each can be opened at 915 × 412 and 760 × 340 without playing a game. A way to force "installed" in dev (a query flag or the builder's choice) so the phone board can be opened in a desktop browser.
- **Browser:** 915 × 412, 780 × 360 and 760 × 340 with installed forced on: No page scroll, no text under 12 px, every window's buttons on screen. 1133 × 744 and 1440 × 900: Unchanged against screenshots taken before.
- **Real phone:** The first check in part 1, then one full online game on the Honor 400 Pro against bots, then one with a friend in the same room on a computer.

## Left to the builder

- The exact pixel sizes of bands, tiles and cards, within the rules above.
- When seats move to the side columns on windows narrower than the reference.
- Whether the phone board is styles on the existing `round-table` and `seat-tile` or new components beside them. New components are acceptable if they keep the web layouts untouched.
- Icon art, manifest colours, the manifest file name.
- How "installed" is forced on in dev.

## Open, not decided here

- Whether the block on phone browsers should ever be lifted. Not now.
- An APK or store listing. Possible later by wrapping this app.
- Bots' pace, sound and music on phones: Unchanged; revisit only if the real-phone game shows a problem.
