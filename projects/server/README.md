# Server

The Node backend: Fastify HTTP API (and, from Stage 3, the WebSocket),
Postgres through Kysely. Design: `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`.

## Run it locally

```bash
npm run db:up            # Postgres 17 in Docker (docker-compose.yml)
cp .env.example .env     # once
npm run server           # API on http://localhost:3000, restarts on change
npm start                # the Angular app; /api is proxied to the server
```

Without `DATABASE_URL` the server runs on an in-memory store. Migrations run on start.

Password reset emails are printed to the server log (`[mail] Password reset for …`) in development.

## Behind a reverse proxy

The per-IP rate limits (sign-up, guest, forgot password) need the real client
IP. Set `TRUST_PROXY` to say which `X-Forwarded-For` hops to believe:

- unset, empty or `false`: trust none; the client IP is the socket peer.
- a hop count such as `1`: the server sits behind that many proxies and is only
  reachable through them.
- a comma-separated list of the proxies' addresses or CIDRs, such as
  `10.0.0.0/8, 127.0.0.1`: safer when clients could also reach the server directly.

`true` is refused: trusting every hop takes the left-most `X-Forwarded-For`
entry, which the client writes itself, so anyone could dodge the rate limits.

## Tests

- `npx jest --selectProjects server` runs the unit and HTTP tests on the in-memory store.
- `npm run test:db` also runs the repository contract against Postgres. It needs `npm run db:up`, and each run creates and drops its own database.
- `npm run typecheck:server` type-checks `protocol` and `server`.

## Layout

- `src/http/`: Fastify app, request guard, session cookie, routes.
- `src/auth/`: AccountService, password hashing, tokens, rate limits.
- `src/persistence/`: domain records and repository interfaces, the in-memory and Postgres stores, migrations.
- `src/views/`: domain records to wire shapes.
- `src/mail/`: the Mailer interface and the console implementation.
