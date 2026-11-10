# Deferrals

Work that was decided, on purpose, to leave for later. Each entry says what is
missing, why it waits and what would bring it back. When an item is done, delete
its entry and say where it went in the commit.

## Game engine

| Deferred | Why it waits | Revisit when |
|---|---|---|
| **Synergistic Partners.** Each Kingdom Wars General's data lists the Generals it pairs well with (`synergisticPartners` in `projects/content/data/decks/kingdom-wars/generals/`), and the Wiki shows the list. The engine has no rule that uses it: holding a partner General changes nothing in a game. Noted on 2026-10-26. | The rule text is not specified yet, and CLAUDE.md asks for precise rules before a new mechanic is implemented. The data is kept as crawled, so nothing is lost meanwhile. | The Synergistic Partners rule is written down, with what a pairing does, when it applies and what a partner General counts as. Implement it in the engine and the Guozhan mode, then show it in the Wiki next to the list. |
| **Banish (Cao Pi) and Entrenched (Cao Ren) draw after they turn over, not before.** The deck says "draw X cards, then stack/unstack" his/her character cards. The engine (`exile` and `entrench` in `projects/content/src/lib/generals/forest.ts`) turns the seat over first and draws second, and the log line `history.exiled` reads "turns over and draws cards". The end state is the same; the order is not. | The preview films follow the deck (decided 2026-11-09), and no game depends on the order. | When Banish is next touched: draw first, then turn over, in the engine, its spec and the two log lines (English and Vietnamese). The Banish and Entrenched films need no change then. |
| **Warrior Saint (Guan Yu) can use an equipped red card as a Sha.** The engine (`fightingSaint` in `projects/content/src/lib/generals/shu.ts`) converts a red card `from: 'hand-and-equipment'`. The deck says "a red-suited card", and the rule is that only a hand card may be converted, so an equipped card is not a legal one to use. Noted on 2026-11-10. | The Warrior Saint preview films follow the rule and show a hand card only. No game depends on it yet. | When Warrior Saint is next touched: restrict the conversion to hand cards, update `shu.spec.ts` and `kingdom-wars-shu.spec.ts`, and check the other conversions that use `hand-and-equipment`. The films need no change then. |
| **Horsemanship (Ma Chao): the deck says "distance and range", the engine changes distance only.** The deck text is "Your distance and range when calculated to other players is always -1". `horsemanship` in `projects/content/src/lib/generals/shu.ts` sets `distanceToOthers: -1` and nothing else. Noted on 2026-11-10. | Distance only matches the other Sanguosha versions, and the Horsemanship preview films show distance only. Whether the deck wording or the engine is the intended rule is not settled. | When Horsemanship is next touched: decide which is right. Change the engine and its specs, or correct the deck text (and its Vietnamese). The films need no change if the engine stays as it is. |
| **Insanity Streak (Wei Yan) heals by attack range and per point, not only at distance 1.** The deck says "after you inflict 1 unit of damage to a player within physical distance of 1, you regain 1 unit of health". The engine (`violentSpirit` in `projects/content/src/lib/generals/wind.ts`) heals after damage to any seat within Wei Yan's attack range, measured after the damage, and heals once per point dealt. Noted on 2026-11-10. | The correct rule is: heal only when the damaged seat is at distance 1. The Insanity Streak preview films follow it. No game depends on it yet. | When Insanity Streak is next touched: restrict the engine to distance 1 (and settle whether it heals once per damage or per point), and update `wind.ts`, its specs and the skill text. The films need no change then. |

## Game setup

| Deferred | Why it waits | Revisit when |
|---|---|---|
| **The Identity deck (`identity`) in Game Setup.** Its radio button in the deck picker is disabled on every setup screen (Pass and Play, Play vs Bots, Create Room and the lobby), so new games are always dealt from Kingdom Wars, the default deck. Disabled on 2026-10-26. | The engine has no explicit rules for Identity yet; they get specified first. The deck, its data and its text are kept, and the server still accepts the `identity` deck. | The Identity rules are written and implemented. Remove `disabled: true` from the `identity` entry in `projects/app/src/app/deck-picker.ts` and restore the click test in `deck-picker.spec.ts`. |

## Translations

| Deferred | Why it waits | Revisit when |
|---|---|---|
| **"Stack/unstack" in Vietnamese.** The deck's "stacks/unstacks his/her character cards" (Cao Pi's Banish, Cao Ren's Entrenched) is translated "lật mặt" in the Vietnamese Banish text, and a face-down seat is labelled "Úp". The developer wants the term "chồng tướng" (decided 2026-11-09). | It touches the Kingdom Wars locale (`projects/content/data/locales/vi/kingdom-wars-generals.json`, Banish) and `projects/app/src/app/i18n/vi.ts` (`history.exiled`, and `seat.faceDown` if that label should follow), so it belongs in a pass over the Vietnamese terms. | When the Vietnamese terms are next reviewed: record it in the glossary (`docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`) first. The Banish and Entrenched films' Vietnamese captions then change with it, and are re-rendered from `projects/content/preview-films/`. |

## Deployment

| Deferred | Why it waits | Revisit when |
|---|---|---|
| **A real Mailer.** Password reset emails only print to the server log (`[mail] Password reset for …`), so on a hosted server nobody can reset a password. | The first live deployment is for a few friends. Sign-up, sign-in and guests work without email. A forgotten password is handled by hand for now. | Players beyond the first friends sign up, or someone is locked out. Needs a provider-backed `Mailer` in `projects/server/src/mail/`. |
| **Keeping the free host awake.** A free Render web service sleeps after about 15 minutes without traffic, and the first visit then waits for a cold start. | Decided on 2026-10-26 to accept the sleep for now; on 2026-11-04 the pinger was documented (the monitor itself is set up outside the repo). Games survive it: the server rebuilds each running game by replaying its action log. | The cold start gets in the way of playing. A pinger on `/health` (set up in [deployment.md](deployment.md), "Keeping it awake"), or an always-on host such as an Oracle Always Free VM, would fix it. |
| **A verified database certificate.** `DATABASE_SSL=require` encrypts the Supabase connection but does not check the certificate chain, because the pooler's chain is not in Node's trust store. | Friends-only game; the traffic is still encrypted. | The game goes public. Pass Supabase's CA certificate to `pg` and turn verification on. |
| **A dedicated database role.** The server connects as the default `postgres` user. | Decided on 2026-10-26 to keep setup simple. | Before a wider launch. Needs grants for the migrations and the app. |

Smaller items from the review of this deployment, left on purpose:

- Dotfiles and symlinks inside the static directory are served (the build has none).
- The container runs as root (`USER node` is a one-line fix).
- The image is about 1 GB with all dev dependencies, and starts through `npx` and `tsx`, which adds to the cold start. Pruning dev dependencies or bundling the server would shrink it.
- `.dockerignore` only matches at the repository root, so nested `.env` and `node_modules` are not excluded from a local build (Render builds from a clean clone).
- No security headers (`X-Content-Type-Options`, frame protection, CSP).
- `/api` without a trailing slash serves the app, and a few extensions (`.gif`, `.map`) have no content type.

## Backend

From [Backend](architecture/backend.md#not-done),
which holds the detail:

- Spectators, room codes and passwords, share links, matchmaking, ratings and
  friends lists.
- A replay viewer. The data and the debug endpoint exist.
- More than one server process. Live games live in the memory of one process.
- Merging a guest's games into a new account, and a recovery code for a guest's
  seat.
- Email verification.
