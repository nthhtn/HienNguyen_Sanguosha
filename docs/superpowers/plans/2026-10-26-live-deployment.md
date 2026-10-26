# Live Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the Node server and the built Angular app as one Docker image that runs on Render's free web service against Supabase Postgres.

**Architecture:** The Fastify server also serves `dist/app/browser` (with an `index.html` fallback for Angular routes) and answers `GET /healthz`, so the app, `/api/*` and `/api/ws` share one origin and the existing Origin and cookie rules need no change. A Dockerfile builds the app and runs the server under `tsx`, as `npm run server` does. Postgres TLS and the build id come from environment variables.

**Tech Stack:** Fastify 5, `ws`, Kysely + `pg`, Angular 22 (`ng build app`), Docker, Render, Supabase Postgres, Jest.

**Spec:** [docs/superpowers/specs/2026-10-26-live-deployment-design.md](../specs/2026-10-26-live-deployment-design.md)

## Global Constraints

- One service, one origin: the server serves the app; no front-end change, no change to `engine`, `content`, `bots` or `protocol` (spec, Goals).
- The server keeps refusing to start in production without `DATABASE_URL` and an https `PUBLIC_ORIGIN`; the dev account is never seeded in production (spec, Constraints).
- `TRUST_PROXY=1`, never `true`.
- Static serving and `/healthz` are application-layer code in `projects/server`; local development and existing tests behave as before when the static directory is not configured (spec, "What gets built" 1).
- No secret, password or connection string in the repo or in chat. Supabase: session-mode pooler, default `postgres` user, Data API off (spec, Decisions).
- Render: free web service, region Singapore, `onrender.com` origin, every merge to `main` deploys. `BUILD_ID` is Render's `RENDER_GIT_COMMIT`.
- UI text rules in `CLAUDE.md` do not apply (no UI change).
- Do not `git add -A`: the working tree has unrelated uncommitted changes (`package.json`, `package-lock.json`, `supabase/`). Add files by name.

## Review Focus

- Reloading a deep link such as `/rooms/abc` returns `index.html`, not a 404 (Task 2).
- An unknown `/api/...` path still returns the JSON 404, never `index.html` (Task 2).
- A path-traversal request such as `/..%2f..%2fetc/passwd` is not served (Task 2).
- `/healthz` answers 200 with no cookie and no Origin, for `GET` and `HEAD`, without touching the database (Task 2).
- A configured static directory with no `index.html` fails at startup with a clear message, not on the first request (Task 2).
- A malformed `DATABASE_SSL` value is refused at startup, not silently treated as off (Task 1).

---

### Task 1: Config for static files, TLS and build id

**Files:**
- Modify: `projects/server/src/config.ts`
- Test: `projects/server/src/config.spec.ts`

**Interfaces:**
- Produces: `ServerConfig` gains `staticDir: string | null` and `databaseSsl: boolean`. `loadConfig` reads `STATIC_DIR` (empty or unset → `null`), `DATABASE_SSL` (`'require'` → `true`; unset, empty or `'off'` → `false`; anything else throws `ConfigError`), and `buildId` becomes `BUILD_ID || RENDER_GIT_COMMIT || 'dev'`.

- [ ] **Step 0: Commit the design docs.** `git add docs/deferrals.md docs/superpowers/specs/2026-10-26-live-deployment-design.md docs/superpowers/plans/2026-10-26-live-deployment.md README.md && git commit -m "docs: live deployment design, plan and deferrals"`.
- [ ] **Step 1: Write failing tests** in `config.spec.ts`: extend the two existing full-object `toEqual` tests with `staticDir: null, databaseSsl: false` (and `staticDir: '/app/dist/app/browser'`, `databaseSsl: true` in "reads every variable"); add `it('uses RENDER_GIT_COMMIT when BUILD_ID is unset')`, `it('prefers BUILD_ID over RENDER_GIT_COMMIT')`, `it('treats an empty STATIC_DIR as unset')`, `it('reads DATABASE_SSL=require and off')`, and `it('refuses an unknown DATABASE_SSL value')` expecting `ConfigError` mentioning `DATABASE_SSL`.
- [ ] **Step 2: Run** `npx jest --selectProjects server projects/server/src/config.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the new fields in `config.ts`, with a `parseDatabaseSsl(raw: string | undefined): boolean` helper next to `parseTrustProxy`.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then `npm run typecheck:server`; it will fail where `ServerConfig` is built by hand in other specs. Fix those call sites by adding the two fields.
- [ ] **Step 5: Commit** `config.ts`, `config.spec.ts` and any spec fixed in step 4.

### Task 2: `/healthz` and static serving

**Files:**
- Create: `projects/server/src/http/staticFiles.ts`
- Modify: `projects/server/src/http/app.ts`, `projects/server/src/server.ts`, `package.json` (`@fastify/static`, if used)
- Test: `projects/server/src/http/staticFiles.spec.ts`

**Interfaces:**
- Consumes: `ServerConfig.staticDir` from Task 1.
- Produces: `registerStatic(app: FastifyInstance, staticDir: string): Promise<void>` (serves files, and sets the not-found handler to return `index.html` for `GET`/`HEAD` requests outside `/api/`); `AppDeps.staticDir?: string | null`; route `GET /healthz` (always registered, returns `200 { status: 'ok' }`).

- [ ] **Step 1: Write failing tests** in `staticFiles.spec.ts`, using a temp directory holding `index.html` and `assets/app.js`, built through `createServer(loadConfig({}) + staticDir, { logger: false })` as `server.spec.ts` does. Tests: `serves index.html at /`; `serves a file under /assets/app.js`; `returns index.html for a deep link /rooms/abc` (Review Focus); `returns the JSON 404 for an unknown /api/nope` (Review Focus); `does not serve outside the directory` for `/..%2f..%2fpackage.json` (Review Focus); `answers /healthz with 200 for GET and HEAD without cookie or Origin` (Review Focus); `refuses to start when STATIC_DIR has no index.html`, expecting `createServer` to reject with a message naming the directory (Review Focus); `serves nothing extra when staticDir is null` (`/` is the JSON 404).
- [ ] **Step 2: Run** `npx jest --selectProjects server projects/server/src/http/staticFiles.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `registerStatic` with `@fastify/static` (hashed assets cached long, `index.html` `no-cache`); if Jest's CommonJS runtime cannot load it (see the pinned-dependencies note in `projects/server/README.md`), write a small handler over `node:fs` instead. Validate `index.html` exists when `staticDir` is set. Register `/healthz` in `buildApp`, and call `registerStatic` after the API routes and before `attachSocketServer`. Pass `config.staticDir` from `server.ts` into `buildApp`. The not-found handler must keep returning `errorBody('not_found')` for every path that is not a `GET`/`HEAD` outside `/api/`.
- [ ] **Step 4: Run** the new spec, then `npx jest --selectProjects server`. Expected: PASS, including the existing socket specs.
- [ ] **Step 5: Commit** the new and changed files, adding `package.json` and `package-lock.json` only if a dependency was added (stage those two with `git add -p` so the unrelated `supabase` lines stay out).

### Task 3: Postgres over TLS

**Files:**
- Modify: `projects/server/src/persistence/postgres/db.ts`, `projects/server/src/server.ts`
- Test: `projects/server/src/persistence/postgres/db.spec.ts` (create)

**Interfaces:**
- Consumes: `ServerConfig.databaseSsl` from Task 1.
- Produces: `poolConfig(url: string, ssl: boolean): PoolConfig` returning `{ connectionString: url }` plus `ssl: { rejectUnauthorized: false }` when `ssl` is true; `createDb(url: string, ssl = false)` uses it. `openStore` in `server.ts` takes the flag.

- [ ] **Step 1: Write failing tests** in `db.spec.ts`: `poolConfig('postgres://x', false)` has no `ssl`; `poolConfig('postgres://x', true).ssl` equals `{ rejectUnauthorized: false }`.
- [ ] **Step 2: Run** `npx jest --selectProjects server projects/server/src/persistence/postgres/db.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `poolConfig` and thread `config.databaseSsl` through `createServer` → `openStore` → `createDb`. The option encrypts without verifying the certificate chain (the designer's call; the Supabase pooler chain is not in Node's trust store). Note in a comment that `sslmode` must not be put in the URL, because `pg` lets the URL override `ssl`.
- [ ] **Step 4: Run** `npx jest --selectProjects server` and `npm run test:db` (needs `npm run db:up`). Expected: PASS.
- [ ] **Step 5: Commit** `db.ts`, `server.ts`, `db.spec.ts`.

### Task 4: Docker image

**Files:**
- Create: `Dockerfile`, `.dockerignore`

**Interfaces:**
- Consumes: `STATIC_DIR`, `PORT`, `BUILD_ID`/`RENDER_GIT_COMMIT`, `DATABASE_SSL` from Task 1.
- Produces: an image that starts the server with `NODE_ENV=production`, `STATIC_DIR` pointing at the built app and `HOST=0.0.0.0`.

- [ ] **Step 1: Write `.dockerignore`** excluding `node_modules`, `dist`, `.git`, `.angular`, `tmp`, `supabase`, `.env*` (but not `.env.example`), `docs`.
- [ ] **Step 2: Write the multi-stage `Dockerfile`.** Build stage: `npm ci` (all dependencies, because the server runs under `tsx`, a dev dependency), then `npx ng build app`. Run stage: the same dependencies, the project sources the server imports (`projects/{engine,content,bots,protocol,server}`, the root `tsconfig.json` and `package.json`), the built `dist/app/browser`. Start command: `npx tsx --tsconfig projects/server/tsconfig.json projects/server/src/main.ts`. Pick a current LTS Node base image; keep the image free of any secret.
- [ ] **Step 3: Verify the build.** Run `docker build -t sanguosha .`. Expected: success.
- [ ] **Step 4: Verify it runs against local Postgres.** `npm run db:up`, then run the image with `-p 8080:8080 -e NODE_ENV=production -e PORT=8080 -e PUBLIC_ORIGIN=http://localhost:8080 -e DATABASE_URL=postgres://sanguosha:sanguosha@host.docker.internal:5433/sanguosha -e BUILD_ID=local`. (`http://localhost` is allowed in production by `loadConfig`.) Expected: `curl localhost:8080/healthz` returns `{"status":"ok"}`; the page loads at `http://localhost:8080/`; reloading a deep link works; sign in as a guest, play a Play vs Bots game, and join a room from a second browser to confirm the socket works on one origin.
- [ ] **Step 5: Commit** `Dockerfile` and `.dockerignore`.

### Task 5: Docs

**Files:**
- Create: `docs/deployment.md`, and a production section in `.env.example` (commented lines only)
- Modify: `docs/architecture/backend-and-deployment.md`, `docs/architecture/README.md`, `docs/deferrals.md`, `projects/server/README.md`

**Interfaces:**
- Produces: a guide the owner follows to create the Render service.

- [ ] **Step 1: Write `docs/deployment.md`**: the architecture sketch; Supabase settings (session pooler string, default `postgres` user, Data API off, database password kept private); Render settings (Docker web service, repo, branch `main`, auto-deploy on, region Singapore, health check path `/healthz`, env vars `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=require`, `PUBLIC_ORIGIN`, `TRUST_PROXY=1`, `HOST=0.0.0.0` already set by the image); the first-deploy order (create the service, copy its `onrender.com` URL into `PUBLIC_ORIGIN`, redeploy; `BUILD_ID` comes from `RENDER_GIT_COMMIT`, which Render sets); how to read logs; the first-deploy checklist from the spec's Verification section (sign up, guest, room, second browser, reload mid-game, idle minute); what a cold start looks like; that a merge changing engine or content behaviour stops running games.
- [ ] **Step 2: Update the other docs.** Replace the "Deployment packaging" line under "Not done" in `backend-and-deployment.md` with a short "Deployment" section linking `deployment.md`; add the guide to the architecture README table; add to `docs/deferrals.md` the unverified Postgres certificate (Supabase CA) and the dedicated database role; replace the "provider-backed Mailer arrives with deployment" sentence in `projects/server/README.md` with a pointer to the deferral.
- [ ] **Step 3: Verify.** `npm test` and `npm run typecheck:server` pass; every relative link in the new and edited docs resolves.
- [ ] **Step 4: Commit** the docs by name.

### Task 6: First deploy (owner runs, builder supports)

**Files:** none.

- [ ] **Step 1: Push** `ops/pre-deployment` and open a pull request to `main`.
- [ ] **Step 2: The owner creates the Render service** from `docs/deployment.md`, first pointing at `ops/pre-deployment`, with the env vars set in Render's dashboard.
- [ ] **Step 3: Run the first-deploy checklist** on the live URL. Expected: every item in the guide's checklist passes; the Supabase tables exist and are not reachable through any public API.
- [ ] **Step 4: Merge to `main`**, switch the Render branch to `main` with auto-deploy on, and confirm the merge deploys. Ask whether to delete the stage branch.
