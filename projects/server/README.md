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
