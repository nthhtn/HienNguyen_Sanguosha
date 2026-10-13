# Server

The Node backend: Fastify HTTP API, the room WebSocket on `/api/ws`, and
Postgres through Kysely. Design: `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`.

## Run it locally

```bash
npm run db:up            # Postgres 17 in Docker (docker-compose.yml)
cp .env.example .env     # once
npm run server           # API on http://localhost:3000, restarts on change
npm start                # the Angular app; /api is proxied to the server
```

Without `DATABASE_URL` the server runs on an in-memory store. Migrations run on start.

Open the app at http://localhost:4200, not http://127.0.0.1:4200: the API only
accepts requests whose `Origin` equals `PUBLIC_ORIGIN`, so from any other origin
sign-in and sign-up answer 403.

Password reset emails are printed to the server log (`[mail] Password reset for …`).
The console Mailer is the only Mailer in this stage, in every environment; a
provider-backed one arrives with deployment.

## Behind a reverse proxy

The per-IP rate limits (sign-up, guest, forgot password, reset password) need the real client
IP. Set `TRUST_PROXY` to say which `X-Forwarded-For` hops to believe:

- unset, empty or `false`: trust none; the client IP is the socket peer.
- a hop count such as `1`: the server sits behind that many proxies and is only
  reachable through them.
- a comma-separated list of the proxies' addresses or CIDRs, such as
  `10.0.0.0/8, 127.0.0.1`: safer when clients could also reach the server directly.

`true` is refused: trusting every hop takes the left-most `X-Forwarded-For`
entry, which the client writes itself, so anyone could dodge the rate limits.

## Rooms and the socket

- Live rooms are held in memory by `RoomService`, and every change is written
  through to Postgres. On start, lobbies are reloaded from the store with every
  player away, so a restart (or `tsx watch` reloading) keeps them.
- Each room processes its inputs one at a time (`rooms/serialQueue.ts`).
- The socket authenticates with the session cookie and `Origin`, like the HTTP
  API. A browser opens one socket per Lobby screen, and its first message is
  `hello { protocolVersion, roomId }`.
- In dev, `projects/app/proxy.conf.json` already proxies `/api` with
  `ws: true`, so the socket works through `npm start`.

## Games

A room's host starts a game with `lobby.start`. The server keeps each running game in a `GameRunner` (`src/game/`), stores every action in `game_actions` (with the state's sha256 after it), and restores running games on start: the same build replays the log as stored, another build checks every hash and stops a game whose hash differs. `POST /api/rooms/solo` starts Play vs Bots, which pauses while its player is away. `BUILD_ID` (default `dev`) tags each game with the build it started on.

## Tests

- `npx jest --selectProjects server` runs the unit and HTTP tests on the in-memory store.
- `npm run test:db` also runs the repository contract against Postgres. It needs `npm run db:up`, and each run creates and drops its own database.
- `npm run typecheck:server` type-checks `protocol` and `server`.

## Pinned dependencies

`@fastify/cookie` is pinned to 11.0.2 and `light-my-request` is overridden to
6.6.0 (root `package.json`), because newer versions load an ESM-only `cookie`
package that Jest's CommonJS runtime can't load. Unpin both when the server
tests move off CommonJS Jest.

## Layout

- `src/http/`: Fastify app, request guard, session cookie, routes.
- `src/auth/`: AccountService, password hashing, tokens, rate limits.
- `src/persistence/`: domain records and repository interfaces, the in-memory and Postgres stores, migrations.
- `src/views/`: domain records to wire shapes.
- `src/mail/`: the Mailer interface and the console implementation.
- `src/rooms/`: `Room` (lobby rules), `RoomService` (live rooms, host rules, restore), the serial queue.
- `src/socket/`: the WebSocket server and the end-to-end `TestClient`.
