import { Kysely, sql } from 'kysely';

// Users, sessions and password reset tokens (spec "Database"). Rooms, games and
// chat arrive in later stages' migrations.
const UP = [
  `CREATE EXTENSION IF NOT EXISTS citext`,
  `CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('registered', 'guest')),
    email citext UNIQUE,
    password_hash text,
    display_name text NOT NULL,
    email_verified_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    CONSTRAINT users_registered_has_credentials CHECK (kind = 'guest' OR (email IS NOT NULL AND password_hash IS NOT NULL))
  )`,
  `CREATE INDEX users_idle_guests ON users (last_seen_at) WHERE kind = 'guest'`,
  `CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
  )`,
  `CREATE INDEX sessions_user_id ON sessions (user_id)`,
  `CREATE TABLE password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL
  )`,
  `CREATE INDEX password_reset_tokens_user_id ON password_reset_tokens (user_id)`,
];

const DOWN = [`DROP TABLE password_reset_tokens`, `DROP TABLE sessions`, `DROP TABLE users`];

// Migrations take Kysely<any>: they run against whatever schema exists at their point in history.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
