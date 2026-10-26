# Deferrals

Work that was decided, on purpose, to leave for later. Each entry says what is
missing, why it waits and what would bring it back. When an item is done, delete
its entry and say where it went in the commit.

## Game engine

| Deferred | Why it waits | Revisit when |
|---|---|---|
| **Synergistic Partners.** Each Alternate General's data lists the Generals it pairs well with (`synergisticPartners` in `projects/content/data/decks/alternate/generals/`), and the Wiki shows the list. The engine has no rule that uses it: holding a partner General changes nothing in a game. Noted on 2026-10-26. | The rule text is not specified yet, and CLAUDE.md asks for precise rules before a new mechanic is implemented. The data is kept as crawled, so nothing is lost meanwhile. | The Synergistic Partners rule is written down, with what a pairing does, when it applies and what a partner General counts as. Implement it in the engine and the Kingdom War mode, then show it in the Wiki next to the list. |

## Game setup

| Deferred | Why it waits | Revisit when |
|---|---|---|
| **The Dynasty Wars deck (`default`) in Game Setup.** Its radio button in the deck picker is disabled on every setup screen (Pass and Play, Play vs Bots, Create Room and the lobby), so new games are always dealt from Kingdom Wars. Disabled on 2026-10-26. | The engine has no explicit rules for Dynasty Wars yet; they get specified first. The deck, its data and its text are kept, and the server still accepts the `default` deck, so stored games replay unchanged. | The Dynasty Wars rules are written and implemented. Remove `disabled: true` from the `default` entry in `projects/app/src/app/deck-picker.ts` and restore the click test in `deck-picker.spec.ts`. |

## Deployment

| Deferred | Why it waits | Revisit when |
|---|---|---|
| **A real Mailer.** Password reset emails only print to the server log (`[mail] Password reset for …`), so on a hosted server nobody can reset a password. | The first live deployment is for a few friends. Sign-up, sign-in and guests work without email. A forgotten password is handled by hand for now. | Players beyond the first friends sign up, or someone is locked out. Needs a provider-backed `Mailer` in `projects/server/src/mail/`. |
| **Keeping the free host awake.** A free Render web service sleeps after about 15 minutes without traffic, and the first visit then waits for a cold start. | Decided on 2026-10-26 to accept the sleep for now. Games survive it: the server rebuilds each running game by replaying its action log. | The cold start gets in the way of playing. A pinger on `/healthz`, or an always-on host such as an Oracle Always Free VM, would fix it. |
| **A verified database certificate.** `DATABASE_SSL=require` encrypts the Supabase connection but does not check the certificate chain, because the pooler's chain is not in Node's trust store. | Friends-only game; the traffic is still encrypted. | The game goes public. Pass Supabase's CA certificate to `pg` and turn verification on. |
| **A dedicated database role.** The server connects as the default `postgres` user. | Decided on 2026-10-26 to keep setup simple. | Before a wider launch. Needs grants for the migrations and the app. |

Smaller items from the review of this deployment, left on purpose:

- Dotfiles and symlinks inside the static directory are served (the build has none).
- The container runs as root (`USER node` is a one-line fix).
- The image is about 1 GB with all dev dependencies, and starts through `npx` and `tsx`, which adds to the cold start. Pruning dev dependencies or bundling the server would shrink it.
- `.dockerignore` only matches at the repository root, so nested `.env` and `node_modules` are not excluded from a local build (Render builds from a clean clone).
- No security headers (`X-Content-Type-Options`, frame protection, CSP) and no ETag on `index.html`.
- The long-cache pattern misses build files with a `-` in the hash, which get a one-hour cache instead.
- `/api` without a trailing slash serves the app, and a few extensions (`.woff`, `.gif`, `.map`) have no content type.

## Backend

From [Backend and deployment](architecture/backend-and-deployment.md#not-done),
which holds the detail:

- Spectators, room codes and passwords, share links, matchmaking, ratings and
  friends lists.
- A replay viewer. The data and the debug endpoint exist.
- More than one server process. Live games live in the memory of one process.
- Merging a guest's games into a new account, and a recovery code for a guest's
  seat.
- Email verification.
