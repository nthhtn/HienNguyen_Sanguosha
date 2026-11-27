import { Kysely, sql } from 'kysely';

// Sign-in identities (Google), and registered users without a password: a
// Google-only account has none. Google accounts are never linked to an
// existing password account (Google sign-in spec "Signing in").
const UP = [
  `CREATE TABLE identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('google')),
    provider_user_id text NOT NULL,
    email text NOT NULL,
    created_at timestamptz NOT NULL,
    UNIQUE (provider, provider_user_id),
    UNIQUE (user_id, provider)
  )`,
  `CREATE INDEX identities_user_id ON identities (user_id)`,
  `ALTER TABLE users DROP CONSTRAINT users_registered_has_credentials`,
  `ALTER TABLE users ADD CONSTRAINT users_registered_has_email CHECK (kind = 'guest' OR email IS NOT NULL)`,
];

const DOWN = [
  `ALTER TABLE users DROP CONSTRAINT users_registered_has_email`,
  // Google-only users have no password: the old rule cannot hold for them, so they go with it.
  `DELETE FROM users WHERE kind = 'registered' AND password_hash IS NULL`,
  `ALTER TABLE users ADD CONSTRAINT users_registered_has_credentials CHECK (kind = 'guest' OR (email IS NOT NULL AND password_hash IS NOT NULL))`,
  `DROP TABLE identities`,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
