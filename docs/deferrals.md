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

### Horsemanship (Ma Chao): the deck says "distance and range", the engine changes distance only

- **What is missing.**
  - The deck text is "Your distance and range when calculated to other players is always -1".
  - `horsemanship` in `projects/content/src/lib/generals/shu.ts` sets `distanceToOthers: -1` and nothing else.
  - Noted on 2026-11-10.
- **Why it waits.**
  - Distance only matches the other Sanguosha versions, and the Horsemanship preview films show distance only.
  - Whether the deck wording or the engine is the intended rule is not settled.
- **Revisit when.**
  - Horsemanship is next touched.
  - Then decide which is right: change the engine and its specs, or correct the deck text (and its Vietnamese).
  - The films need no change if the engine stays as it is.

### Insanity Streak (Wei Yan) heals by attack range and per point, not only at distance 1

- **What is missing.**
  - The deck says "after you inflict 1 unit of damage to a player within physical distance of 1, you regain 1 unit of health".
  - The engine (`violentSpirit` in `projects/content/src/lib/generals/wind.ts`) heals after damage to any seat within Wei Yan's attack range, measured after the damage, and heals once per point dealt.
  - Noted on 2026-11-10.
- **Why it waits.**
  - The correct rule is: heal only when the damaged seat is at distance 1.
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
  - In all-bot games Qun wins 44 to 49% (before: about 10%), while the leading force wins 7 to 14 pp less.
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

- **What is missing.**
  - A free Render web service sleeps after about 15 minutes without traffic.
  - The first visit then waits for a cold start.
- **Why it waits.**
  - Decided on 2026-10-26 to accept the sleep for now.
  - On 2026-11-04 the pinger was documented (the monitor itself is set up outside the repo).
  - Games survive it: The server rebuilds each running game by replaying its action log.
- **Revisit when.**
  - The cold start gets in the way of playing.
  - A pinger on `/health` (set up in [deployment.md](deployment.md), "Keeping it awake"), or an always-on host such as an Oracle Always Free VM, would fix it.

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

### Notices for skills and equipment abilities

- **What is missing.**
  - Blaze, Coerce, Harvest and Meng Huo's Resurgence have a notice (`RESOLUTION_NOTICES` in `projects/content/src/lib/resolutionNotice.ts`).
  - Every other card, skill and equipment ability gets none.
  - The registry makes each a data-only change: an entry in `RESOLUTION_NOTICES`, its `notice.*` keys and a spec.
- **Why it waits.**
  - Decided to add them case by case.
  - Which outcomes deserve a popup, and their wording, is the product owner's call.
- **Revisit when.**
  - A skill's outcome is hard to follow from the log alone.
  - Follow "A Resolution Notice for a card or skill" in [Content and extensibility](architecture/content-and-extensibility.md).

### Online, a notice does not hold playback

- **What is missing.**
  - Locally the Resolution Notice blocks (the director holds playback).
  - Online nothing waits for it, as for the Compete popup: the server paces bots and clocks with the shared durations in `playbackTiming.ts`, which cover beats only.
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
