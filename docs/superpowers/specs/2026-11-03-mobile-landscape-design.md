# Mobile and Tablet Landscape Layout — Design

Status: draft for approval. Nothing is built. A visual mock-up of everything below was reviewed with the developer: https://claude.ai/artifact/5rZyRL17nWayVuPjNBjtkD (private artifact; colours and card art are approximate, the layout is the proposal).

## Why

The web app is hard to use on phones and tablets. The developer's words: "almost everything" is a problem, and the first example is the navigation bar, which spreads every link across the top instead of collapsing into a menu. The game board is the most important screen and needs the most care.

## Decision summary

1. **The game is played in landscape.** In portrait, a game shows a "Rotate Your Device" message instead of a squeezed board.
2. **Every other screen works in portrait and landscape.** Setup, Rooms, Rules, wiki, sign-in and settings must be usable at 360 px wide.
3. **Width decides the layout: 900 px.** The unfolded Galaxy Z Fold5 (841 px wide) keeps the phone layout (developer-approved). A second condition for tall-enough screens is an open question below, because 915 px wide phones need it.
4. **Under 900 px** the navigation bar is a menu button, the brand and the music and sound toggles. Every other link moves into a slide-in drawer. In a game, Action History and Discard Pile live in a slide-over panel opened from a button in the bar.
5. **Medium: 900 to 1279 px wide (and 600 px tall or more)** the full navigation bar stays as today, with larger seats and cards. In a game History and Discard Pile are collapsed into the panel button, as on phones, so the hand keeps the width (developer-approved 2026-11-04: the two 140 px tiles squeezed the hand).
6. **Large: 1280 px wide and up (and 600 px tall or more)** the panel is permanently open as a side rail, as the two tiles are today.
7. **Your own seat sits on the table**, above the hand, on phone and medium layouts. The bottom row is only the hand and the action buttons (developer-approved 2026-11-04).

## Goals

- Every Guozhan game, local and online, can be played start to finish on the devices below, in landscape, with touch only.
- All seats, the player's hand, the phase and prompt, and the main action buttons are visible at once without scrolling the page.
- Navigation is reachable and readable at 360 px wide.
- Touch targets are at least 44 × 44 px.
- No layout change touches game rules. The engine, bots and protocol are untouched.

## Non-goals

- Playing a game in portrait.
- A native app, installable app (PWA) or offline support.
- Redesigning card art, avatars, animations or the desktop layout.
- Pinch zoom or custom gestures beyond scrolling the hand row sideways.
- Any new rules, text or language beyond the strings listed below.

## Anti-goals (a failure even if it technically works)

- The desktop layout changes in any visible way at 900 px and up, other than the rail being part of the game board there. Check this against screenshots before and after.
- The game board needs page scrolling, or any seat, the hand or the action buttons sit under the browser or phone chrome.
- Rules or legality logic appears in layout code. Presentation only, as the project rules require.

## Target devices

Landscape CSS pixel sizes (width × height). These are the test matrix.

| Device | Size | Layout |
| --- | --- | --- |
| iPhone SE | 667 × 375 | Phone |
| iPhone 15 | 852 × 393 | Phone |
| Galaxy S24 | 780 × 360 | Phone |
| Galaxy S24 Ultra, Pixel 8 | 915 × 412 | Phone (see note) |
| Galaxy Z Fold5, folded | 882 × 344 | Phone, smallest height |
| Galaxy Z Fold5, unfolded | 841 × 673 | Phone, roomier |
| iPad Mini | 1133 × 744 | Medium (panel slides over) |
| iPad Pro 11 inch | 1194 × 834 | Medium (panel slides over) |
| Galaxy Tab S9 | 1280 × 800 | Large (panel rail) |
| PC or small laptop | 1366 × 768 | Large, the desktop layout as today |
| MacBook Air 13 inch | 1440 × 900 | Same |
| Medium monitor, Full HD | 1920 × 1080 | Same, seats and cards scale up |
| Large monitor, QHD | 2560 × 1440 | Same, seats and cards scale up |

Note: 915 px wide is above the 900 px breakpoint, so the S24 Ultra and Pixel 8 would get the tablet layout (full bar and open rail) by the width rule, which is wrong for a 412 px tall screen. The mock-up shows them with the phone layout. This must be resolved; see Open Questions. Until then the rule is: tablet layout needs **width ≥ 900 px and height ≥ 600 px**; otherwise phone layout. (Builder's call to adjust the numbers, keeping the nine devices above on the layouts the table shows.)

The smallest height to support is the folded Fold5 at 344 px, minus the browser's own bars.

## What changes

### Navigation bar (all screens)

Today `app.html` renders one toolbar with Play, Online, deck menus, Rules, Battlefield, account, language switcher, music toggle, sound toggle and the playback-speed button (when its feature flag is on). Under 599 px the link labels are hidden and only icons show.

Phone layout:

- Left: menu button, then the brand.
- Right: music toggle and sound toggle.
- Menu button opens a drawer from the left with: Play (when the feature flag allows), Play Online, one group per deck with its pages, Rules pages, Battlefield, the account entry (Sign In, or the name with Create Account and Sign Out), language switcher, and Playback Speed when its flag is on.
- The current page is marked in the drawer, as it is in the bar now.
- Drawer closes on choosing a link, on tapping outside it and on Escape. Focus moves into the drawer on open and back to the menu button on close.
- Reuse the existing links, labels, translation keys and feature flags. No new navigation logic.

Wide layout: unchanged.

### Game board, phone layout (landscape)

- Slim bar (44 px): menu button, brand, phase chip (existing phase indicator), music and sound toggles, and a History button that opens the panel.
- Table fills the rest. All seats stay visible: opponents around the top and sides, as the round table does today, compacted. Seat shows face, name, HP pips, hand count and equipment strip.
- Your seat: a compact seat tile on the table, centred right above the hand (still at the bottom of the screen), outside the whole bottom box, which holds the hand, the action buttons and the History button in one box that starts below the seat (developer-confirmed 2026-11-04), not in the bottom row. On medium and tall phones (480 px and up) it has a row of its own; on shorter phones it floats over the foot of the table, since a row would leave the table too little height.
- Player's hand: one row along the bottom. **Scroll and Shrink (developer-chosen 2026-11-04):** one row of smaller cards (about 80% of the normal size) that scrolls sideways with a fade at the edge. Overlap and Two Rows were considered and not chosen. A selected card lifts and shows in full.
- Action buttons (Play Card, Pass and whatever the ask or response panel currently offers) sit in a fixed spot at the bottom right.
- Prompts and the countdown stay centred on the table.
- Slide-over panel from the right, about 40 to 42% of the width, with two tabs, Action History and Discard Pile, and shortcuts for sound, speed and leaving the game. A dim layer covers the table while it is open; tapping it closes the panel.
- Existing dialogs (judgment, targets, choice, compete, arrange, start reveal, victory) must fit in the landscape height and scroll inside themselves when they do not.

### Game board, tablet layout (landscape)

Medium (900 to 1279 px wide): same as phone, with larger seats, cards and buttons and the full navigation bar. The panel still slides over from a button.

Large (1280 px and up): the same, with the panel permanently open as a rail of about 280 px at the right. No panel button.

### Portrait during a game

A full-screen "Rotate Your Device" message with a short sentence ("The Guozhan board needs a landscape screen. Turn your phone sideways to keep playing."), shown only when the game board is on screen and the viewport is portrait and narrower than the tablet layout. The game keeps running behind it (online games are server-paced; local games wait for the player). A tablet in portrait also gets the message unless the builder finds the board fits.

### Safe areas

Seats and buttons stay clear of camera cut-outs and rounded corners using `env(safe-area-inset-*)`. The viewport meta tag in `index.html` gains `viewport-fit=cover`. Use `dvh` units, not `vh`, so the browser's address bar does not hide the hand (the code already does this under 599 px).

### New strings

Written in the UI text style from CLAUDE.md (Title Case for labels, sentence case for sentences). Each needs a Vietnamese draft following that file's rules.

- "Menu" (button label, for screen readers)
- "Rotate Your Device"
- "The Guozhan board needs a landscape screen. Turn your phone sideways to keep playing."
- "History" button label (the panel tabs reuse "Action History" and "Discard Pile")

## Constraints

- Angular, standalone components, signals; presentation only. The layout code must not decide rules; it only reads existing game state.
- Existing project checks must pass (`npm run verify` and tests).
- Existing unit tests for the board must keep passing; add tests for the new behaviour (drawer open and close, panel open and close, rotate message shown only in portrait on the game board, layout class chosen from width).
- Do not change the local Setup and Game screens' behaviour (standing rule from the project owner, with a layout-only exception granted on 2026-11-03): this work changes their presentation only, and nothing about how a local or online game is started or played. The online duplicates get the same layout through shared components.
- Keep the existing 599 px and 899 px rules working until the new rules replace them; list what was replaced in the pull request.

## Calls made by the author (not yet confirmed; change any of them)

- **Priority when space is tight** (folded Fold5, about 256 px of table height): all seats visible first, then the hand row, then the 44 px touch size. Hand cards are cards, not buttons, and may be smaller than 44 px. Seats and buttons keep 44 px where they are tappable. The compact seat is a variant of the existing seat tile, not a new component. Guozhan seat counts are whatever the engine already supports.
- **Drawer and panel:** only one is open at a time; opening one closes the other. The panel holds the two tabs and a Leave Game button that reuses the existing leave flow and its confirmation. It does not repeat the sound and speed controls, which stay in the bar and the drawer.
- **Online timers while the rotate message is up:** nothing extra; the decision countdown keeps running on the server as it does today.
- **Pages covered at 360 px:** every routed page, found by walking the routes in `app.routes.ts`.
- **Desktop check:** manual screenshots, no new tooling.

## Left to the builder

- How to detect the layout (CSS container or media queries, a small signal service, or both), as long as it is one source for the whole app and testable.
- How to implement the drawer (Angular Material `mat-sidenav` or a custom one) and the panel.
- The exact seat positions, sizes and fonts on each device, using the mock-up as a guide, not a pixel spec.
- Whether the tablet in portrait shows the rotate message.
- Component and file structure, and how to split the work into stages.

## Open questions for the developer

1. **Resolved by the developer (2026-11-03):** the tablet layout needs width of at least 900 px and height of at least 600 px, so a short, wide desktop window gets the phone layout. See the note under Target devices.
2. **Resolved by the developer (2026-11-03):** the local Setup and Game screens may change their layout for phones and tablets, presentation only. Their behaviour, and how a local game starts and plays, stay exactly as they are.
3. **Resolved by the developer (2026-11-04):** the hand on small screens is Scroll and Shrink. The preview compares it with Overlap and Two Rows.

## How to check it

- Browser device emulation for every device in the table, in landscape, running a full bot game.
- A real phone and a real tablet, at least one each, before merge (the developer's check; Chrome emulation does not cover browser bars or cut-outs).
- Desktop screenshots before and after to confirm nothing changed at 1280 px and up.
