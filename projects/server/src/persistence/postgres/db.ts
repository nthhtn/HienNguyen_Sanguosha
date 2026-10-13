import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './schema';

export function createDb(url: string): Kysely<Database> {
  const pool = new Pool({ connectionString: url });
  // An idle client erroring (e.g. Postgres restarting) would otherwise be an unhandled 'error' event that crashes the process.
  pool.on('error', (err) => console.error('Postgres pool error', err));
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
