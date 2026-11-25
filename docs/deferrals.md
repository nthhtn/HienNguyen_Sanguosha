# Deferrals

Work that was decided, on purpose, to leave for later.

Each entry has the same parts:

- **What is missing.** The gap, and where it lives.
- **Why it waits.** The reason it was left.
- **Revisit when.** What would bring it back.

When an item is done, delete its entry and say where it went in the commit.

## Contents

- [Game engine](#game-engine)
- [Bots](#bots)
- [Game setup](#game-setup)
- [Translations](#translations)
- [Deployment](#deployment)
- [Backend](#backend)
- [Presentation](#presentation)

## Game engine

### Banish (Cao Pi) and Entrenched (Cao Ren) draw after they turn over, not before

- **What is missing.**
  - The deck says "draw X cards, then stack/unstack" his/her character cards.
  - The engine (`exile` and `entrench` in `projects/content/src/lib/generals/forest.ts`) turns the seat over first and draws second.
  - The log line `history.exiled` reads "turns over and draws cards".
  - The end state is the same; the order is not.
- **Why it waits.**
  - The preview films follow the deck (decided 2026-11-09).
  - No game depends on the order.
- **Revisit when.**
  - Banish is next touched.
  - Then draw first and turn over second, in the engine, its spec and the two log lines (English and Vietnamese).
  - The Banish and Entrenched films need no change then.

### Warrior Saint (Guan Yu) can use an equipped red card as a Sha

- **What is missing.**
  - The engine (`fightingSaint` in `projects/content/src/lib/generals/shu.ts`) converts a red card `from: 'hand-and-equipment'`.
  - The deck says "a red-suited card", and the rule is that only a hand card may be converted, so an equipped card is not a legal one to use.
  - Noted on 2026-11-10.
- **Why it waits.**
  - The Warrior Saint preview films follow the rule and show a hand card only.
  - No game depends on it yet.
- **Revisit when.**
  - Warrior Saint is next touched.
  - Then restrict the conversion to hand cards, update `shu.spec.ts` and `kingdom-wars-shu.spec.ts`, and check the other conversions that use `hand-and-equipment`.
  - The films need no change then.

### Horsemanship (Ma Chao): The deck says "distance and range", the engine changes distance only

- **What is missing.**
  - The deck text is "Your distance and range when calculated to other players is always -1".
  - `horsemanship` in `projects/content/src/lib/generals/shu.ts` sets `distanceToOthers: -1` and nothing else.
  - Noted on 2026-11-10.
- **Why it waits.**
  - Distance only matches the other Sanguosha versions, and the Horsemanship preview films show distance only.
  - Whether the deck wording or the engine is the intended rule is not settled.
- **Revisit when.**
  - Horsemanship is next touched.
  - Then decide which is right: Change the engine and its specs, or correct the deck text (and its Vietnamese).
  - The films need no change if the engine stays as it is.

### Insanity Streak (Wei Yan) heals by attack range and per point, not only at distance 1

- **What is missing.**
  - The deck says "after you inflict 1 unit of damage to a player within physical distance of 1, you regain 1 unit of health".
  - The engine (`violentSpirit` in `projects/content/src/lib/generals/wind.ts`) heals after damage to any seat within Wei Yan's attack range, measured after the damage, and heals once per point dealt.
  - Noted on 2026-11-10.
- **Why it waits.**
  - The correct rule is: Heal only when the damaged seat is at distance 1.
  - The Insanity Streak preview films follow it.
  - No game depends on it yet.
- **Revisit when.**
  - Insanity Streak is next touched.
  - Then restrict the engine to distance 1 (and settle whether it heals once per damage or per point), and update `wind.ts`, its specs and the skill text.
  - The films need no change then.

### The game can end while a seat is still dying

- **What is missing.**
  - On seed 138 (11 seats, `rule-based`), Zhou Tai reveals his Deputy to use Refusing Death during his own rescue round.
  - The reveal ends the game, and he is left living at 0 HP before `stays-alive` is logged.
  - Noted on 2026-11-11.
- **Why it waits.**
  - Whether the win check should wait until a rescue round finishes is a rules question for the developer.
  - The property invariant (`checkInvariants`) skips a seat whose rescue round the game's end cut short.
- **Revisit when.**
  - The rule is decided.
  - Then either hold the win check until no rescue round is open (engine) or keep the invariant as it is.

## Bots

### Part 4's all-bot balance gate failed on one run and shipped anyway

- **What is missing.**
  - At 8 seats on seed 2600000 the all-bot force gap was 44.2 against 32.3 before Part 4 (limit +5), because 14 Ambitionist seats won nothing.
  - Without Ambitionists the gap was 32.7 against 31.1.
  - In all-bot games Qun wins 44 to 49% (before: About 10%), while the leading force wins 7 to 14 pp less.
  - Recorded on 2026-11-12.
- **Why it waits.**
  - The developer chose to ship for the head-to-head gain (+6.6 to +7.2 pp).
  - The gate metric is fragile to tiny groups.
- **Revisit when.**
  - Force balance or General picks are tuned again.
  - Then use a minimum group size or the four Kingdoms only, and look at why Qun dominates all-bot games.

## Game setup

### The Identity deck (`identity`) in Game Setup

- **What is missing.**
  - Its radio button in the deck picker is disabled on every setup screen: Pass and Play, Play vs Bots, Create Room and the lobby.
  - New games are always dealt from Kingdom Wars, the default deck.
  - Disabled on 2026-10-26.
- **Why it waits.**
  - The engine has no explicit rules for Identity yet; they get specified first.
  - The deck, its data and its text are kept, and the server still accepts the `identity` deck.
- **Revisit when.**
  - The Identity rules are written and implemented.
  - Then remove `disabled: true` from the `identity` entry in `projects/app/src/app/deck-picker.ts` and restore the click test in `deck-picker.spec.ts`.

## Translations

### "Stack/unstack" in Vietnamese

- **What is missing.**
  - The deck's "stacks/unstacks his/her character cards" (Cao Pi's Banish, Cao Ren's Entrenched) is translated "lật mặt" in the Vietnamese Banish text.
  - A face-down seat is labelled "Úp".
  - The developer wants the term "chồng tướng" (decided 2026-11-09).
- **Why it waits.**
  - It touches the Kingdom Wars locale (`projects/content/data/locales/vi/kingdom-wars-generals.json`, Banish) and `projects/app/src/app/i18n/vi.ts` (`history.exiled`, and `seat.faceDown` if that label should follow).
  - So it belongs in a pass over the Vietnamese terms.
- **Revisit when.**
  - The Vietnamese terms are next reviewed.
  - Then record it in the glossary (`docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`) first.
  - The Banish and Entrenched films' Vietnamese captions then change with it, and are re-rendered from `projects/content/preview-films/`.

## Deployment

### The phone app as an APK or a store listing

- **What is missing.** The phone app ships only as an installable web app (Chrome on Android, Install). There is no APK and no Play Store listing.
- **Why it waits.** The developer deferred it (2026-11-22). The installed web app reaches friends with no store, updates with each deploy and needs no second sign-in path (`docs/superpowers/specs/2026-11-13-phone-app-design.md`, Approaches).
- **Revisit when.** A store listing is wanted, or a phone cannot install the web app. The app can be wrapped (Capacitor over the live site, or a bundled build) without redoing the phone board.

### A real Mailer

- **What is missing.**
  - Password reset emails only print to the server log (`[mail] Password reset for …`).
  - On a hosted server nobody can reset a password.
- **Why it waits.**
  - The first live deployment is for a few friends.
  - Sign-up, sign-in and guests work without email.
  - A forgotten password is handled by hand for now.
- **Revisit when.**
  - Players beyond the first friends sign up, or someone is locked out.
  - Needs a provider-backed `Mailer` in `projects/server/src/mail/`.

### Keeping the free host awake

- **Status.** Mostly done: The developer set up an external pinger on `/health` (2026-11-23), as described in [deployment.md](deployment.md), "Keeping it awake". The service no longer sleeps between visits, so the installed phone app opens without a cold start.
- **What is still missing.**
  - **Restarts:** A deploy or a crash still gives one slow start and drops the sockets. Games survive it: The server rebuilds each running game by replaying its action log.
  - **Hours:** Render's free tier has 750 instance-hours a month, and one always-awake service uses about 744, so no second free service can stay awake in the workspace.
  - **Supabase:** `/health` does not touch the database, so a free Supabase project can still pause after a week without use; a paused project needs a visit to the dashboard.
- **Why it waits.** The pinger covers the friends-only game. A different host would remove the limits.
- **Revisit when.**
  - The Render hours or the Supabase pause get in the way.
  - An always-on host such as an Oracle Always Free VM would remove both.

### A verified database certificate

- **What is missing.**
  - `DATABASE_SSL=require` encrypts the Supabase connection but does not check the certificate chain.
  - The pooler's chain is not in Node's trust store.
- **Why it waits.**
  - Friends-only game; the traffic is still encrypted.
- **Revisit when.**
  - The game goes public.
  - Then pass Supabase's CA certificate to `pg` and turn verification on.

### A dedicated database role

- **What is missing.**
  - The server connects as the default `postgres` user.
- **Why it waits.**
  - Decided on 2026-10-26 to keep setup simple.
- **Revisit when.**
  - Before a wider launch.
  - Needs grants for the migrations and the app.

### Smaller deployment items

Left on purpose, from the review of this deployment:

- Dotfiles and symlinks inside the static directory are served (the build has none).
- The container runs as root (`USER node` is a one-line fix).
- The image is about 1 GB with all dev dependencies, and starts through `npx` and `tsx`, which adds to the cold start. Pruning dev dependencies or bundling the server would shrink it.
- `.dockerignore` only matches at the repository root, so nested `.env` and `node_modules` are not excluded from a local build (Render builds from a clean clone).
- No security headers (`X-Content-Type-Options`, frame protection, CSP).
- `/api` without a trailing slash serves the app, and a few extensions (`.gif`, `.map`) have no content type.

## Backend

From [Backend](architecture/backend.md#not-done), which holds the detail:

- Spectators, room codes and passwords, share links, matchmaking, ratings and friends lists.
- A replay viewer. The data and the debug endpoint exist.
- More than one server process. Live games live in the memory of one process.
- Merging a guest's games into a new account, and a recovery code for a guest's seat.
- Email verification.

## Presentation

From the Resolution Notice, picker and Judgment work (PR #62, 2026-11-09). The design is in `docs/superpowers/specs/2026-11-09-resolution-notice-and-pickers-design.md`.

### Phone board leftovers

- **What is missing.** Small things on the phone app (`projects/app/src/app/game-board/phone/` and the windows), found in the Part 2b to Part 3 reviews and the real-phone tests:
  - **Toolbar timing:** `PhoneBoard` hides the toolbar during change detection (`setBoardOpen` in its constructor); `afterNextRender` would be cleaner.
  - **Spectator at 12 seats:** With no viewer seat all 12 seats are opponents, so the top row holds 8 and the tiles are narrower than the 12-seat estimate.
  - **Short screens:** At the 340 px floor a played card fills the centre band edge to edge.
  - **Seat Details stays open:** After the board goes away (rotation, game end) the window stays open, frozen.
  - **Masked cards under a General:** They are tappable in Seat Details but show nothing.
  - **Own hidden Generals:** Seat Details does not say they are still hidden from others.
  - **Action column:** The 24 px icons on Play and Info take width from their labels, and those two have no tooltip; they are 36 px like the rest, where the spec said "full size" (reworded to "full width").
  - **Decision windows on rotation:** They stay open when the phone rotates.
  - **Small cards in windows:** A long Vietnamese card name can wrap to 3 lines and cover most of a 44 px card, and the elemental badge stays 9 px (Guozhan has no elements).
  - **Setup toggles:** The 44 px button rule also makes the Create Room and Play With Bots toggle groups 44 px tall on a phone.
  - **Response window when dying:** With a Peach it still scrolls by about 4 px at 800 × 366 (the buttons stay fixed).
  - **Windows not re-measured:** The Judgment popup (outcome box tightened later) and the Start popup scrolled in the PR 88 audit and were not audited again; side-by-side layouts were built only for Response and Discard.
- **Install and manifest:**
  - **Tab colour:** `theme-color` tints the address bar of a plain Chrome tab.
  - **Manifest check:** The manifest spec checks the source assets, not `dist`.
  - **Pixel ratio:** The device info page refreshes it only on a resize.
  - **Display-mode stub:** The test helper ignores the event name.
- **Why it waits.** The developer chose to leave them for later (2026-11-22 and 2026-11-23). None stops a game.
- **Revisit when.** The real-phone check, or a later pass on the phone board.

### Sharp General pictures on phone tiles

- **What is missing.** A phone seat tile draws each General's face crop (101 to 126 px square) enlarged to about 85 CSS px, which is about 300 device pixels at a pixel ratio of 3.5: about 2.5 times past the picture's real resolution, so it looks soft.
- **The idea.** Draw each face at its natural resolution (picture pixels divided by the phone's pixel ratio, about 30 to 36 px on the Honor 400 Pro), keep the tile its size, and fill the room with the General's name and its skill names (names only on slim tiles).
- **Other ways.** A wider crop (about 70% of the portrait, 66 crops to re-cut), or the full 250 × 292 portrait in the slot (nearly natural, smaller faces, no new assets).
- **Why it waits.** The developer deferred it (2026-11-23). The tile is readable as it is.
- **Revisit when.** The phone board gets a polish pass, or higher-resolution General art exists.

### Notices for skills and equipment abilities

- **What is missing.**
  - Blaze, Coerce, Harvest and Meng Huo's Resurgence have a notice (`RESOLUTION_NOTICES` in `projects/content/src/lib/resolutionNotice.ts`).
  - Every other card, skill and equipment ability gets none.
  - The registry makes each a data-only change: An entry in `RESOLUTION_NOTICES`, its `notice.*` keys and a spec.
- **Why it waits.**
  - Decided to add them case by case.
  - Which outcomes deserve a popup, and their wording, is the product owner's call.
- **Revisit when.**
  - A skill's outcome is hard to follow from the log alone.
  - Follow "A Resolution Notice for a card or skill" in [Content and extensibility](architecture/content-and-extensibility.md).

### Online, a notice does not hold playback

- **What is missing.**
  - Locally the Resolution Notice blocks (the director holds playback).
  - Online nothing waits for it, as for the Compete popup: The server paces bots and clocks with the shared durations in `playbackTiming.ts`, which cover beats only.
  - A bot may move while a notice shows, and the notice is dropped when the viewer owes a decision.
- **Why it waits.**
  - The server knows nothing of the popup.
  - The engine cannot know which batches end in one (that lives in `content`).
- **Revisit when.**
  - Players miss notices online.
  - Then have the content registry say which batches end in a notice and add its length (`ResolutionNoticeContent.seconds`) to the server's pacing.

### The Judgment popup still shows that someone holds a changing skill

- **What is missing.**
  - The popup and the table-centre line no longer name the seat or skill asked to change a judgment.
  - But the popup staying unsettled shows that some seat is deciding.
  - A local game's "thinking" indicator highlights a deciding bot.
- **Why it waits.**
  - Hiding it fully means the engine asks every seat in the same way and for the same time, which is an engine change.
- **Revisit when.**
  - Hidden skills matter more than the speed of a judgment.
  - Then ask all seats uniformly, or hold the unsettled phase for a fixed time, and stop the thinking indicator naming a judgment decider.

### The Choose Targets seat card is used in one popup

- **What is missing.**
  - The Choice dialog and the Selection panel keep their smaller portraits.
  - The game-start General selection is unchanged.
- **Why it waits.**
  - The redesign was approved for the target picker only.
- **Revisit when.**
  - The seat options in those popups look dated next to it.
  - Then reuse the card (portrait, name, revealed Generals, HP, hand size) there.

### No browser check of the new popups

- **What is missing.**
  - The Resolution Notice, the picker cards, the target labels and the preview scenarios have not been looked at in a browser.
  - Visuals, fade timing, phone landscape and Pass and Play are untested by eye.
- **Why it waits.**
  - Built and tested headlessly.
- **Revisit when.**
  - Before merging, or the next time `/preview` is opened.

### Animation-lab entries for notices

- **What is missing.**
  - The lab requires every event it appends to plan a visible beat.
  - Notices rest on events with none (a card shown, a secret pick), so no lab entry exists.
  - The `/preview` scenarios cover them instead.
- **Why it waits.**
  - The lab's own rule would have to change.
- **Revisit when.**
  - The lab can fire an event list without beats.

### The Playback Director reads state through an effect

- **What is missing.**
  - When several updates arrive in one tick (online bursts), it sees only the latest state.
  - Beats and notices are built from the log, so no event is lost, but a resolution's short "unsettled" states may be skipped.
- **Why it waits.**
  - Raised on 2026-11-09 and left as it is.
- **Revisit when.**
  - A notice shows late, early or not at all.
  - Then give the director every state as an explicit stream from `GameService` and `RemoteGameService`.

### Small notice logic left as it is

- **What is missing.**
  - `id in registry` also matches prototype keys such as `constructor` (use `Object.hasOwn`).
  - Resurgence reads the latest `CardsTurnedUpEvent` before its span, not strictly the adjacent one.
  - Harvest counts any card-showing `ChoiceMadeEvent` in its span.
  - `settled` in the director relies on the server sending per-action states and needs a comment saying so.
- **Why it waits.**
  - Found in the final review; none changes what a player sees today.
- **Revisit when.**
  - Next time `resolution-spans.ts`, `playback-director.ts` or those notices are touched.

### The Vietnamese text is draft

- **What is missing.**
  - Every new `notice.*`, `targets.*` and `preview.notice-*` message needs a native review.
- **Why it waits.**
  - The repo's rule for new Vietnamese text (`npm run i18n:status`).
- **Revisit when.**
  - A native speaker reviews the catalogs.

### Art sets: Follow-ups

From the art sets work (spec `docs/superpowers/specs/2026-11-25-art-sets-design.md`).

- **What is missing.**
  - **First real set:** Only `classic` ships, so the picker is hidden. The artwork and its provenance are still to be made.
  - **Account sync:** The choice lives in the browser only. It is not shared across devices.
  - **Wiki card art:** The Rules Wiki's card pictures (`cardArtUrl`) stay outside art sets.
  - **Bigger previews:** The Art Sets page and popup show tiles at the game's portrait size, with no zoom.
- **Why it waits.**
  - The developer scoped the first version to portraits and faces, with the choice stored per browser.
- **Revisit when.**
  - A second set is added, or accounts need to carry the choice.

### Tutorial: free play with hints

- **What is missing.**
  - The first Tutorial is a guided rail: The board is locked so only the highlighted control works.
  - The alternative is free play: The beginner can click anywhere, the Tutorial shows hints, and it nudges them back when they wander.
- **Why it waits.**
  - The rail is predictable, and easier to build and test (decided 2026-11-25).
  - Free play can reach situations a lesson never planned for.
- **Revisit when.**
  - The rail Tutorial is in use and beginners find it too restrictive.

### Tutorial: not looked at by eye

- **What is missing.**
  - The Tutorial was checked in a browser by reading the DOM, not by looking at screenshots.
  - The ring, the instruction card and the phone layouts (800 by 366) were measured, not seen.
  - Mobile and tablet portrait sizes were not tried.
  - On the phone, the History panel opens while the Discard Pile and Action History steps ring its button, and it has not been seen over the spotlight.
  - Lessons 2 to 5 were walked only to their first action step; the full lessons are covered by the headless `playLesson` specs.
- **Why it waits.**
  - The browser pane available while building could not paint (screenshots timed out and animation frames ran about once a second).
- **Revisit when.**
  - Before the Tutorial is announced, or the next time `/tutorial` is opened in a visible browser.
