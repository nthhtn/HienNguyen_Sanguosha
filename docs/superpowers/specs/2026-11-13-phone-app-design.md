# Phone App (Installable Web App) — Design

Status: Approved by the developer on 2026-11-13. Built in Parts 1 to 3 (2026-11-13 to 2026-11-22); the real-phone game check remains.

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

### 3b. Changes from the first real-phone test (2026-11-22)

The developer ran the phone board on the Honor 400 Pro through a test tunnel and asked for these changes.

- **The phone's real size:** A Chrome tab on the Honor 400 Pro gets 759 × 269 px at pixel ratio 3.5, so the installed app gets about 800 × 366 px, not the 915 × 412 the plan assumed. The 760 × 340 floor stands; the board must look right at 800 × 366.
- **HP on a phone tile** (developer's choice):
  - **Full tiles and the viewer's tile:** One HP icon (the existing HP ramp) per point of maximum HP. Points still held are drawn as they are; lost points are drawn dark. The word "HP" is not shown; the numbers stay as the accessible label.
  - **Slim tiles:** A heart and the numbers, "4/4", no word.
- **Face avatars** (developer's choice):
  - Every phone seat tile (full, slim and the viewer's) shows each General as a square face crop instead of the top of the full portrait. Seat Details and the web board keep the full portraits.
  - The crops are generated by the asset pipeline from the 66 portraits in `assets-src/generals/skins`, one square box per portrait, about 160 × 160 px. A General with no crop falls back to its portrait.
  - The developer approves the crops by looking at the built files in `projects/content/assets/generals/faces/<force>/` before they ship.
- **No thinking line:** The phone board does not show which bot is thinking (developer, 2026-11-22).
- **Install hint judged by the screen, not the tab:** A Chrome tab loses height to the address bar, so the tab's window can be too small for the phone board when the installed app would not be (the Honor 400 Pro tab is 759 × 269). The hint uses the screen's size (`screen.width` × `screen.height`, either way round) minus nothing, against the 760 × 340 floor.

### 3c. Touch fixes from playing on the phone (2026-11-23)

The developer played on the Honor 400 Pro and mis-touched Play and Info: on the phone board they appear on the card as it is touched, so the same tap that opens a card can press one of them.

- **Picking a card** (developer's choice): On the phone board a tap on a hand card only picks it: it lifts and is outlined, and nothing is played. Its actions (Play, with its menu or targets window, and Info) appear full width at the top of the action column, above the other actions, at the column's 36 px height. A tap on the picked card puts it back; a tap on another card picks that one instead. Nothing appears on the card itself. Playing the card, or the card leaving the hand, clears the pick.
- **Action buttons** (developer's choice, an exception to the 44 px tap rule): The buttons in the phone board's action column are 36 px tall with 13 px text on one line; a label too long ends in "…" and shows in full on a long press (tooltip).
- Tablets and computers keep the Play and Info buttons on the card, as today.
- **Menu drawer** (developer's choice): 220 px wide on the phone board layout (its longest item needs about 142 px; it was 320 px).
- **General picker** (developer's choices, revised 2026-11-23):
  - **Portrait and basic info:** On the phone each candidate is its portrait with the name, force and HP beside it (to its right) and a small Info button in the card's corner. (Over the portrait, at two rows' height, the caption hid the portrait and the Info button hid the name.) The skills half of the card is not shown on the phone; the Info button opens the General's full window (the same one Seat Details opens) without picking the General.
  - **Two rows, no scrolling** (revised by the developer, 2026-11-23): As on a computer, 7 candidates sit 4 on top and 3 below, 5 sit 3 on top and 2 below, each row centred and half the card area's height, so every card is visible at once.
  - Tablets and computers keep today's cards with their skills.

### 3d. Less on the seat tile (2026-11-23)

The developer asked to drop what a tile shows without information, so names and Generals have more room.

- **Judgment** (developer's choice): The name row shows one box per Judgment card on the seat and nothing for an empty slot, so a seat with no Judgment cards shows none. This reverses the three always-drawn boxes in section 3.
- **Equipment** (developer's choice, option 2): Only filled slots draw a box. The row keeps its height whether or not any slot is filled, so the Generals' pictures never resize when a card is equipped. A filled box stays in its fixed slot position (weapon, armor, defensive mount, offensive mount) and an empty slot is blank (Claude's call). This reverses "an empty box is drawn as an outline" in section 3.
- **Bot marker** (developer's choice): Every phone tile of a bot, slim ones too, shows the robot icon beside the name, and the "[Bot] " text is not part of the shown name. A bot whose stored name has no such prefix (an old "Bot 1") shows its name as it is. The icon keeps its accessible label. The web board, Action History and Seat Details are unchanged (Claude's call: those are not tiles).
- **Accessible names:** An empty slot is no longer an element, so the tile's tooltips for empty slots go; filled boxes keep theirs.

### 3e. A lighter centre band and one right-hand panel (2026-11-23)

The developer asked for a lighter centre band, with the in-game extras grouped into the slide-out panel.

- **One right-hand panel** (developer's choice): The History button opens the existing panel that slides in from the right. On the phone board it gets a third tab, Chat, beside History and Discard Pile. The Menu drawer is separate and stays as it is, sliding in from the left with its links, battlefield, account, language and playback speed.
- **Chat button leaves the band** (follows from the above, Claude's call): The Chat tab shows only in an online room. The unread count shows on the tab, and also as a badge on the History button while the panel is closed, so a message is never missed. The floating Chat button stays on tablets and computers, and the chat drawer there is unchanged.
- **Draw Pile count** (developer's choice): The count moves out of the centre band into the panel, as a line above the tabs (Claude's call: it is visible whichever tab is open). The web board keeps it in the phase indicator.
- **Last played card** (developer's choice): The band shows only the newest card the engine has in the processing zone, not all of them.
- **Cancel** (developer's request): No Cancel button; a tap on the picked card again puts it back (already the rule in 3c). Which Cancel the developer meant is still to be confirmed.

### 3f. Feedback from the second real-phone test (2026-11-23)

- **Tight centre band** (developer's choice): The centre band is as tall as its contents (Claude's number: 64 px minimum), and the height it gives up goes to the opponent tiles. With no stacked side columns a tile may be up to 150 px tall (was 110); with two seats stacked in a side column (9 to 12 seats) the tile height rule stays as it was, because the column needs the band's height.
- **Seat Details** (developer's choices):
  - **Alignment:** The title, the HP and hand summary, the states and the General cards start at the same left edge.
  - **Hidden General:** Shows the hidden-General picture used on the tile, not an empty box.
  - **Equipment:** One row of four columns, one per slot (weapon, armor, defensive mount, offensive mount), always shown. A filled slot shows the card's picture with its name, the same card face as the hand, and a tap opens the card info. An empty slot is a dimmed dashed box with the slot icon and "Empty" (Claude's call).
- **Hand card names** (developer's choice): On the phone board's hand, a card name is one line with an ellipsis, 12 px (was two lines at 14 px, which spilled out of the card).
- **Language** (developer's choice): The language switcher is in the top bar, directly left of the Music button, on every layout, and no longer in the Menu drawer.

### 3g. Feedback from the third real-phone test (2026-11-23)

- **Seat Details** (developer's choices):
  - **Summary:** The HP and hand line is bold. The player's name takes the seat's force colour.
  - **Judgment:** Shown like Equipment: the card face with its name, up to 3 columns, and nothing at all when the seat has no Judgment card.
  - **Layout with Judgment cards:** Equipment on the left in 2 columns of 2 rows, Judgment on the right in up to 3 columns. With no Judgment card Equipment keeps its row of four.
- **Discard window** (developer's choices):
  - **Hand:** The cards are full size in one row that scrolls sideways, not packed tight.
  - **Buttons:** Both buttons (View Board and Discard) are fully on screen. Cause of the cut: A minimum width added in section 4b pushed the content wider than the window; it is removed.
  - **Hint:** The part after the dot starts with a capital in Vietnamese ("Đã chọn 2/2").
- **Judgment window** (developer's choice): The outcome box is only as tall as its contents and the spacing around it is tighter.
- **"(You)"** (developer's choice): It starts with a capital in every language and on every board, "(You)" and "(Bạn)".
- **Centre band countdown:** The timer is wide enough for its clock icon, seconds and bar, which were clipped.
- **General pictures** (answer to a question, no change): The face crops are 101 to 126 px square and the portraits 250 × 292 px. A tile picture about 85 px wide is drawn at about 300 device pixels on a phone with a pixel ratio of 3.5, so it is enlarged about 2.5 times beyond its natural resolution, and even the full portrait would be. A sharper picture needs higher-resolution source art.

### 3h. Feedback from the fourth real-phone test (2026-11-23)

- **General picker** (developer's choices):
  - **Role badge:** The Main and Deputy badge sits in the bottom right corner of the General card, not over the portrait, as narrow as its longest word so its text wraps inside it (12 px), and it never spills out of the badge.
  - **Stable size:** The picker has the same width and card positions whether no General, one or two are picked. Cause: On narrow screens the picker's column was as wide as its widest content, and the bar's content changes with the picks; the column now stretches to the full width.
- **Discard and card-pick windows** (developer's choice, replaces the sideways scroll of 3g for the Discard window): The cards are full size and wrap into rows with room between them; when they do not all fit they scroll vertically inside their own area, and the buttons sit below it and never cover a card. This holds for the Discard phase window and for picks such as Amass and Compete.
- **Centre band** (developer's choice): A player's name in the newest line is in their force's colour, bold.

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

### 4b. Smaller windows on the phone board (2026-11-23)

The developer found the windows too big on the phone: They fit, but Material's spacing takes about 100 px of a 366 px screen and the dark backdrop hides the board.

- **Dense chrome** (developer's choice, numbers are Claude's calls): On the phone board layout, every window gets a 18 px title (was 24 px) with 8 px 12 px 4 px padding, 12 px content padding on all sides, and a 8 px 12 px actions row. Set through Material's dialog tokens on the overlay container, in one place (`styles.scss`), so no window gets its own copy.
- **Lighter backdrop** (developer's choice): The backdrop behind a window is 15% black (Material's is 32%), so the board stays readable behind it.
- **Unchanged:** Buttons stay 44 px and text stays 12 px or more; medium and large layouts keep Material's sizes.
- **Side-by-side layouts** (developer's choice, conditional): For the Response, Choice, Discard and Selection windows, the prompt sits left and the choices right, but only for windows that still scroll at 800 × 366 after the two changes above. Which windows those are needs the browser audit at 800 × 366 and 760 × 340, which has not run yet.

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

## Decided later (developer, 2026-11-22)

- **Phone browsers stay blocked, for good:** A phone plays only in the installed app. The block on phone browser tabs is never lifted; the install hint sends players to the app.
- **APK or store listing:** Deferred (`docs/deferrals.md`). Possible later by wrapping this app.
- **Bots' pace, sound and music on phones:** Kept as they are.
