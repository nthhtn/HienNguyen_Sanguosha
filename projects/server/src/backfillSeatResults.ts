import { existsSync } from 'node:fs';
import { buildContentRegistry } from 'content';
import { loadConfig } from './config';
import { engineContext } from './game/engineGame';
import { migrateToLatest } from './persistence/migrate';
import { createDb } from './persistence/postgres/db';
import { createPostgresRepositories } from './persistence/postgres/postgresRepositories';
import { backfillSeatResults } from './profile/backfill';

// `npm run backfill:seat-results`: fills seat results for finished games that have none.
// The server does the same at start; this is for running it by hand.
async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const config = loadConfig(process.env);
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set: the in-memory store has nothing to fill in');
  const db = createDb(config.databaseUrl, config.databaseSsl);
  try {
    await migrateToLatest(db);
    const ctx = engineContext(buildContentRegistry());
    const result = await backfillSeatResults({ repos: createPostgresRepositories(db), ctx, log: (message, err) => console.error(message, err) });
    console.log(`Filled ${result.filled} game(s), ${result.failed} could not be replayed`);
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
