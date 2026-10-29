import { Kysely, PostgresDialect } from 'kysely';
import { Pool, PoolConfig } from 'pg';
import { Database } from './schema';

// Without a timeout an unreachable Postgres makes the start-up migration wait forever,
// so the server never listens and logs nothing.
export const CONNECT_TIMEOUT_MS = 15_000;

// With `ssl` the connection is encrypted but the certificate chain is not verified: the
// Supabase pooler's chain is not in Node's trust store. Do not put `sslmode` in the URL,
// because `pg` lets the URL override this option.
export function poolConfig(url: string, ssl: boolean): PoolConfig {
  const base = { connectionString: url, connectionTimeoutMillis: CONNECT_TIMEOUT_MS };
  return ssl ? { ...base, ssl: { rejectUnauthorized: false } } : base;
}

export function createDb(url: string, ssl = false): Kysely<Database> {
  const pool = new Pool(poolConfig(url, ssl));
  // An idle client erroring (e.g. Postgres restarting) would otherwise be an unhandled 'error' event that crashes the process.
  pool.on('error', (err) => console.error('Postgres pool error', err));
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
