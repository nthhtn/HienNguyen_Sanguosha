import { Kysely, Migration, Migrator } from 'kysely';
import * as accounts from './migrations/0001_accounts';
import * as rooms from './migrations/0002_rooms';
import { Database } from './postgres/schema';

// Listed explicitly rather than read from disk, so migrations run the same
// under tsx, ts-jest and a bundled build. Names sort in the order they apply.
const MIGRATIONS: Record<string, Migration> = {
  '0001_accounts': accounts,
  '0002_rooms': rooms,
};

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => MIGRATIONS } });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
}
