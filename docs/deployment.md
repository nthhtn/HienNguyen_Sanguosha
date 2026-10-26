# Deployment

How the game runs live: one Docker image on Render's free web service, with
Supabase as the Postgres. The design and its reasoning are in
`docs/superpowers/specs/2026-10-26-live-deployment-design.md`.

```
 browsers --https--> Render web service (one Docker image)
                       Node server (Fastify)
                         the built Angular app (static files)
                         /api/*   HTTP
                         /api/ws  WebSocket
                         /healthz health check
                       |  DATABASE_URL
                       v
                     Supabase Postgres (session pooler)
```

The server serves the built app itself, so the app, the API and the socket
share one origin and the Origin and cookie checks need no change. See
[Backend and deployment](architecture/backend-and-deployment.md) for what the
server does.

## Supabase

1. The project is in the Singapore region. Only its Postgres is used: no Auth,
   Storage or edge functions.
2. **Turn off the Data API** (Project Settings, API). The server talks to
   Postgres directly; with the Data API on, the `public` tables (`users`,
   `sessions`) would be reachable with the public anon key.
3. Copy the **session pooler** connection string (Connect, then Session pooler,
   port 5432, `postgres.<ref>` as the user). The direct connection is IPv6 only
   on the free tier, which Render cannot reach. Use the default `postgres` user
   and keep its password to yourself: it only goes into Render's environment.
4. Do not add `sslmode` or any other `ssl*` parameter to the string; the server
   refuses to start if it finds one. It turns TLS on with `DATABASE_SSL=require`,
   which encrypts the connection without verifying the certificate chain (see
   [Deferrals](deferrals.md)). The server also refuses to start in production
   when `DATABASE_SSL` is not set.
5. In Project Settings, Database, turn on **Enforce SSL on incoming
   connections**, so a plaintext connection is refused on Supabase's side too.
6. A free project pauses after about a week without activity. Open the
   dashboard and click Restore; nothing is lost.

## Render

1. Sign in with GitHub and give Render access to this repository.
2. New, Web Service, pick the repository. Language: **Docker**. Region:
   **Singapore**. Instance type: **Free**. Branch: `main` (use
   `ops/pre-deployment` for a test deploy before merging).
3. Advanced: health check path `/healthz`; auto-deploy **on**, so every merge to
   `main` deploys.
4. Environment variables (the image already sets `NODE_ENV=production`,
   `HOST=0.0.0.0`, `PORT=8080` and `STATIC_DIR`):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Supabase session pooler string |
   | `DATABASE_SSL` | `require` (required in production; `off` only for a local Postgres) |
   | `PUBLIC_ORIGIN` | the service's `https://<name>.onrender.com` URL |
   | `TRUST_PROXY` | `1` (Render is one proxy; never `true`) |

   `BUILD_ID` is taken from Render's `RENDER_GIT_COMMIT`, so it needs no setting.
5. **First deploy order.** The service URL exists only after it is created, and
   the server refuses to start without a correct `PUBLIC_ORIGIN`. Create the
   service, let the first deploy fail, copy the URL into `PUBLIC_ORIGIN`, then
   redeploy.

Logs are under the service's Logs tab. Migrations run on start, so the tables
appear in Supabase after the first successful boot.

## First deploy checklist

On the live URL:

- [ ] `/healthz` returns `{"status":"ok"}`.
- [ ] The app loads, and reloading a deep link such as `/rooms` still shows it.
- [ ] Sign up, sign out, sign in; sign in as a guest.
- [ ] Create a Play vs Bots game and play a few turns.
- [ ] Create an open room, join it from a second browser, start a game.
- [ ] Reload mid-game: the game resumes.
- [ ] Leave a game open for a minute: the socket stays connected (the server
      pings every 15 s).
- [ ] In Supabase, the tables exist and the Data API is off.

## What to expect

- **Cold start.** A free service sleeps after about 15 minutes without traffic.
  The first visit then waits up to a minute. Running games survive: the server
  rebuilds them by replaying their action log.
- **Deploys.** Every merge to `main` restarts the server. A merge that changes
  engine or content behaviour makes a running game stop as `outdated`; other
  merges leave games running. Prefer to merge engine changes when nobody is
  mid-game.
- **Password reset.** Reset emails only go to the server log, so a forgotten
  password cannot be reset yet (see [Deferrals](deferrals.md)).

## Run the image locally

```bash
npm run db:up
docker build -t sanguosha .
docker run --rm -p 8080:8080 \
  -e PUBLIC_ORIGIN=http://localhost:8080 \
  -e DATABASE_SSL=off \
  -e DATABASE_URL=postgres://sanguosha:sanguosha@host.docker.internal:5433/sanguosha \
  sanguosha
```
