# Block Play on Phones — Design

Status: approved by the developer on 2026-11-04 ("let's block the play on phones"). Supersedes the phone parts of `2026-11-03-mobile-landscape-design.md`; that spec's medium and large layouts stand.

## Why

The developer tried the merged landscape layout on an Honor 400 Pro and found the game board not playable. A landscape phone leaves about 400 px of height; the Guozhan table needs seats, equipment, HP, the action log and a hand on one screen. Sanguosha already has a native mobile app that forces landscape, so a phone is better served there. Tablets (considerably larger screens) stay supported.

## Rules

1. **A game can be played only in a window of at least 900 px wide and at least 600 px tall.** This is the existing medium and large layout. The test is by window size, never by device, so "desktop site" mode on a phone (about 980 px wide, still short) and a desktop window made too small are blocked as well. Anything else is "too small".
2. **A too-small window shows a blocking screen** over any game (local or online, General selection included): "Larger Screen Needed" and "Guozhan needs a tablet or computer screen. Use a larger device to play." The game keeps going underneath, as the rotate prompt did (local games wait for the player; online games are server-paced).
3. **A window that would be large enough if turned** (its longer side at least 900 px and its shorter side at least 600 px, so a tablet held upright) shows the rotate prompt instead: "Rotate Your Device" and "The Guozhan board needs a wider screen. Turn your device sideways to keep playing."
4. **Starting or joining is blocked early on a too-small window.** These are disabled, with the sentence "Playing needs a tablet or computer screen." beside them: Start Game on Setup; Create Room, Play With Bots, Join, Rejoin on Rooms; Start on the room lobby. This stops an online player joining on a phone and then losing turns behind the blocking screen.
5. **Every other page stays usable on a phone** (Rules wiki, sign-in and sign-up, Rooms list, My Games, settings), with the menu drawer and the 360 px fixes. They are not blocked.
6. **The medium and large layouts are unchanged**, except that the touch size of the action buttons returns to the normal one on medium.

## Removed

All phone-only board code: the short-phone and tall-phone tuning, seat scales of 0.35 and 0.48, the shrunk phone hand, compact phone buttons, the phone rules of the phase bar, decision banner and General selection, and the compact table centre room. The layout kind `'phone'` remains and now means "too small to play".

## New strings (UI text style: Title Case for labels, sentence case for sentences)

- `board.small.title` "Larger Screen Needed"
- `board.small.hint` "Guozhan needs a tablet or computer screen. Use a larger device to play."
- `play.needsLargerScreen` "Playing needs a tablet or computer screen."
- changed `board.rotate.hint` (above), Vietnamese drafts for all four.

## How to check it

- Jest: layout kinds and "could fit if turned", the prompt on the board (local General selection and a running game, small and upright tablet), each disabled control and its hint.
- Browser: 915 × 412 (Honor 400 Pro class) shows the blocking screen on a game and the disabled Start; 1133 × 744 plays as before; 744 × 1133 shows the rotate prompt.
- A real phone and a real tablet before merge.
