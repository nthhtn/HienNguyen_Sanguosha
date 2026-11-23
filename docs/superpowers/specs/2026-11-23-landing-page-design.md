# Landing page — design

A small front door for the hosted site. Approved by the developer on 2026-11-23: friends only, not a public showcase.

## Why

- **Today:** `/` redirects to `/setup`. On the hosted, online-only build that bounces to `/rooms`, which asks for sign-in, so a first-time visitor sees a sign-in form for a game nobody has introduced.
- **Who it is for:** Friends who are sent the link. They need to know what this is, how to get in, how to install the phone app and where the rules are.

## Goals

- **One screen** at `/` with the game's name, one line about it, and the ways in.
- **Ways in:**
  - **Play Online:** Goes to Rooms; a signed-out visitor is sent to Sign In and returned to Rooms afterwards.
  - **Play as Guest:** Goes to the guest page and returns to Rooms.
  - **Play Offline:** Only where offline play is on (the dev build), goes to Setup.
- **Install card:** On a phone browser tab the installed app could play on (the existing `Layout.installWouldHelp`): a title, one sentence, an Install App button where Chrome offers one, otherwise one line saying where Chrome's menu has it.
- **Links:** Sign In and Rules.

## Non-goals and anti-goals

- **Not a showcase:** No screenshots, marketing text or rules summary.
- **Never in the way:** The installed app, and anyone already signed in, skip it and go to Play (which resumes a game, or goes to Rooms or Setup as today).
- **Not in a game:** It is a route of its own; no board or phone board shows it.

## Approach

- **A route guard decides, a small component shows.** `homeRedirect` sends the installed app and signed-in players to `/play`; anyone else gets the `Home` component. The page reuses the auth pages' full-bleed card and background (`auth-card.css`), so it looks like the screens a friend meets next.
- **Rejected:** Rendering the landing page inside Rooms or Sign In (mixes two jobs); a separate marketing site (a second thing to deploy).

## Text

- **New messages:** `home.tagline`, `home.install.title`, `home.install.body`, `home.install.manual`, in English and Vietnamese (Vietnamese starts as a draft). Buttons reuse `nav.online`, `auth.playAsGuest`, `nav.play`, `nav.signIn`, `nav.rules` and `play.installApp`.

## Checks

- **Guard:** The installed app and a signed-in player are sent to `/play`; a signed-out browser visitor stays.
- **Page:** The three ways in with the right links, Offline only with the flag, the install card only when installing would help, the Install App button only when Chrome has offered, both languages.
