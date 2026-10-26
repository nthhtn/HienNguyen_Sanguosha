# Live deployment design

Date: 2026-10-26. Branch: `ops/pre-deployment`.

## Intent

Put the game online so the owner can play it with a few friends. Production
should behave like the local development setup: the same app, the same server,
the same Postgres. Only the place it runs changes. The first live deployment is
for friends, not the public, and it costs nothing to run.

## Goals

- One public https URL where the Angular app, the HTTP API and the room
  WebSocket all work, with sign-up, guests, rooms, online play and Play vs Bots.
- The Node server and the built Angular app deployed as **one service**, so the
  existing same-origin rules (Origin check, session cookie, socket cookie) work
  unchanged.
- Supabase Postgres as the production database, reached through the existing
  `DATABASE_URL` and the existing migrations.
- No change to the engine, content, bots, protocol or Angular components.
- A deployment procedure written down in the repo.

## Non-goals

- A real password-reset Mailer (deferred, see [deferrals](../../deferrals.md)).
- Keeping the free host awake (deferred; the owner accepts sleep and cold start).
- More than one server process, spectators, a replay viewer, or anything else on
  the backend "Not done" list.
- Supabase Auth, Storage, the Data API or edge functions. Supabase is only a
  Postgres host.
- A dedicated least-privilege database role (deferred).
- Staging environments, CI pipelines or monitoring.

## Anti-goals

- Anything that makes production differ from local in game rules, UI behaviour
  or the way a player signs in.
- Any secret, password or connection string committed to the repo or pasted into
  chat.
- Exposing `users`, `sessions` or other tables over a public API.

## Decisions (the owner's)

- **Host:** Render.com, free web service, region Singapore (next to the
  Supabase project).
- **Database:** Supabase free Postgres, Singapore region, default `postgres`
  user, **session-mode pooler** connection string. The Supabase Data API is
  switched off (done by the owner on 2026-10-26).
- **One service:** the Node server also serves the built Angular app.
- **Free-tier sleep:** accepted. Games survive it because the server restores
  running games by replaying their action log.
- **Engine changes stopping games:** accepted. A deploy whose engine or content
  behaviour changes makes a running game stop as `outdated`, which the server
  already does.
- **Domain:** the Render `onrender.com` address for now; a custom domain is not
  planned yet. Moving to one later means changing `PUBLIC_ORIGIN` once.
- **Password reset:** deferred; guests and sign-up are enough for now.
- **Deploy trigger:** every merge to `main` deploys automatically (Render's
  auto-deploy on the `main` branch). A merge that changes engine or content
  behaviour therefore stops running games; the owner accepts that. The first
  deploy may point at `ops/pre-deployment` to test before the merge.

## Decisions (the designer's, to be checked)

- **`BUILD_ID`:** the git commit SHA, set at image build time, so each game
  records the exact build it started on.

## How it fits together

```
 browsers --https--> Render web service (one Docker image)
                       Node server (Fastify)
                         static files (the built Angular app)
                         /api/*   HTTP
                         /api/ws  WebSocket
                         /healthz health check
                       |  DATABASE_URL
                       v
                     Supabase Postgres (session pooler)
```

- The app builds the socket URL from `location` (`wss://<host>/api/ws` on
  https), and calls `/api/...` with relative URLs, so no front-end change is
  needed.
- Render's proxy terminates TLS and forwards the WebSocket upgrade. The server
  already handles the upgrade on the Fastify HTTP server and checks cookie and
  `Origin`.

## What gets built

1. **Static serving.** The server serves `dist/app/browser` when the directory
   is configured, and answers any non-`/api` GET that is not a file with
   `index.html` so Angular routes survive a reload. `/api/*` keeps its own 404.
   The directory is off by default so local development and the tests are
   unaffected.
2. **`GET /healthz`.** Returns 200 without touching the database, for Render's
   health check.
3. **Dockerfile** (multi-stage, plus `.dockerignore`). Build stage: `npm ci`,
   build the Angular app. Run stage: the server, the static files, started on
   `PORT`, with `BUILD_ID` passed in at build time.
4. **Postgres over TLS.** Supabase requires SSL. The connection must work with
   the pooler string in `DATABASE_URL` without the owner editing code (see the
   verification section; the exact TLS settings are left to the builder).
5. **Production env template** and the settings to enter in Render:
   `NODE_ENV=production`, `DATABASE_URL`, `PUBLIC_ORIGIN` (the Render URL),
   `TRUST_PROXY=1`, `BUILD_ID`. `PORT` is set by Render.
6. **Docs.** A deployment guide (Render setup step by step, Supabase settings,
   how to redeploy, how to read logs) and an update to
   [Backend and deployment](../../architecture/backend-and-deployment.md), which
   today says nothing in the repo deploys the server. [Deferrals](../../deferrals.md)
   already lists what was left out.

## Constraints

- The server must keep refusing to start in production without `DATABASE_URL`
  and an https `PUBLIC_ORIGIN` (already enforced by `loadConfig`).
- The well-known dev account is never seeded in production (already enforced).
- `TRUST_PROXY=1`, never `true`.
- The layering rules in `CLAUDE.md` hold: static serving and the health check
  are application-layer code in `projects/server`; nothing in the engine or
  Angular components changes.

## Verification

- `npm test` and `npm run typecheck:server` still pass.
- New server tests: static files and the SPA fallback are served only when
  configured, `/api/*` unknown paths still return the JSON 404, `/healthz`
  returns 200.
- The Docker image builds and runs locally against the local Postgres
  (`npm run db:up`) and plays a Play vs Bots game and a two-browser room through
  the socket on one origin.
- Against Supabase: migrations run on first start; no table is reachable
  without the server (the Data API is off, and this is checked rather than
  assumed).
- On Render: sign up, guest sign-in, create a room, join from another browser,
  play a few turns, reload mid-game and see it resume, and watch the socket
  survive an idle minute (heartbeat).

## Answers to the builder check

Settled by the repo:

- **Migrations through the pooler.** The migration files (`0001` to `0004`) use
  no advisory locks, and the session-mode pooler keeps a session per client, so
  the app and the migrations use the same `DATABASE_URL`.
- **Running the server in the image.** The server already runs from TypeScript
  source under `tsx` with the root `tsconfig` path aliases (`npm run server`), so
  the image runs it the same way. No tsconfig or package changes, and none to
  engine, content, bots or protocol.
- **Heartbeat.** The socket pings every 15 s (`HEARTBEAT_MS`), well inside
  typical proxy idle timeouts. Whether Render's proxy keeps the socket open is
  still checked on the first deploy.
- **`BUILD_ID` and "outdated".** A changed `BUILD_ID` alone stops nothing. On
  restore the server replays the log and compares hashes, and only a hash
  mismatch stops a game. Deploys that leave engine and content behaviour alone
  keep running games.

Settled by the designer (marked as calls to check):


- **Docker on Render's free plan.** The design assumes it supports Docker web
  services and WebSockets. The builder confirms against Render's current docs
  before relying on it; if not, the host changes and this document comes back.
- **No `render.yaml`.** The deployment guide gives step-by-step dashboard
  settings. Fewer moving parts for one service.
- **`BUILD_ID` source.** Render's Docker builds have no `.git`, so the server
  reads `BUILD_ID` from the environment and the guide sets it to Render's
  `RENDER_GIT_COMMIT`. If that variable is not available, the builder passes the
  commit as a build argument.
- **First-deploy order.** Create the service, copy its `onrender.com` URL into
  `PUBLIC_ORIGIN`, then redeploy. The guide says so.
- **The `supabase/` folder and the `supabase` npm package.** The folder holds the
  CLI's project link (`.temp` with the project ref) and `config.toml`. It is
  excluded from the image (`.dockerignore`) and from this work. The owner decides
  separately whether to commit it; the `supabase` devDependency is not part of
  the deployment.
- **Who verifies against Supabase.** The owner runs the Supabase and Render
  checks, since they hold the credentials; the builder writes the steps.

## Left to the builder

- Node version and base image for the Dockerfile.
- How `tsx` or compiled output starts the server in the image.
- The exact TLS options for `pg`, and whether to read them from the connection
  string or an env var.
- The env var name for the static directory, and the file layout of the new
  server code.
- Wording of the deployment guide.

## Risks

- WebSocket behaviour through Render's proxy is untested until the first deploy.
- A cold start after sleep can take up to a minute; players must be able to
  reconnect to the room afterwards.
- Supabase pauses a free project after about a week without activity, which the
  owner restores from its dashboard.
