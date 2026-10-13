import { randomBytes } from 'node:crypto';
import { Kysely } from 'kysely';
import { Pool } from 'pg';
import { migrateToLatest } from '../migrate';
import { createDb } from './db';
import { Database } from './schema';

// A fresh, migrated database per test file, so test files can run in parallel
// and every run starts from an empty schema. `adminUrl` connects to any
// database on the server as a user allowed to CREATE DATABASE.
export async function createTestDatabase(adminUrl: string): Promise<{ db: Kysely<Database>; drop(): Promise<void> }> {
  const name = `sgs_test_${randomBytes(6).toString('hex')}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const db = createDb(url.toString());
  await migrateToLatest(db);
  return {
    db,
    drop: async () => {
      await db.destroy();
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
