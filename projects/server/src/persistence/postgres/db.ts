import { Kysely, PostgresDialect } from 'kysely';
import { Pool, PoolConfig } from 'pg';
import { Database } from './schema';

// With `ssl` the connection is encrypted but the certificate chain is not verified: the
// Supabase pooler's chain is not in Node's trust store. Do not put `sslmode` in the URL,
// because `pg` lets the URL override this option.
export function poolConfig(url: string, ssl: boolean): PoolConfig {
  return ssl ? { connectionString: url, ssl: { rejectUnauthorized: false } } : { connectionString: url };
}

export function createDb(url: string, ssl = false): Kysely<Database> {
  const pool = new Pool(poolConfig(url, ssl));
  // An idle client erroring (e.g. Postgres restarting) would otherwise be an unhandled 'error' event that crashes the process.
  pool.on('error', (err) => console.error('Postgres pool error', err));
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
