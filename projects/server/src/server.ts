import { FastifyInstance } from 'fastify';
import { AccountService } from './auth/accounts';
import { AuthRateLimits } from './auth/rateLimits';
import { ServerConfig } from './config';
import { buildApp } from './http/app';
import { ConsoleMailer } from './mail/mailer';
import { createMemoryRepositories } from './persistence/memory/memoryRepositories';
import { migrateToLatest } from './persistence/migrate';
import { createDb } from './persistence/postgres/db';
import { createPostgresRepositories } from './persistence/postgres/postgresRepositories';
import { Repositories } from './persistence/repositories';

const HOUSEKEEPING_MS = 60 * 60_000;

export interface RunningServer {
  app: FastifyInstance;
  close(): Promise<void>;
}

// Everything the process runs, wired from config: the store (Postgres,
// migrated on start, or in memory), accounts, the HTTP app and an hourly
// clean-up of rate-limit windows and idle guests.
export async function createServer(config: ServerConfig, options: { logger?: boolean } = {}): Promise<RunningServer> {
  const store = await openStore(config.databaseUrl);
  const accounts = new AccountService({ repos: store.repos, mailer: new ConsoleMailer(), publicOrigin: config.publicOrigin });
  const rateLimits = new AuthRateLimits();
  const app = await buildApp({
    accounts,
    publicOrigin: config.publicOrigin,
    cookieSecure: config.cookieSecure,
    trustProxy: config.trustProxy,
    rateLimits,
    logger: options.logger ?? true,
  });

  const housekeeping = setInterval(() => {
    rateLimits.prune(Date.now());
    accounts.purgeIdleGuests().catch((err: unknown) => app.log.error(err, 'Purging idle guests failed'));
  }, HOUSEKEEPING_MS);
  housekeeping.unref();

  return {
    app,
    close: async () => {
      clearInterval(housekeeping);
      await app.close();
      await store.close();
    },
  };
}

async function openStore(databaseUrl: string | null): Promise<{ repos: Repositories; close(): Promise<void> }> {
  if (!databaseUrl) return { repos: createMemoryRepositories(), close: async () => undefined };
  const db = createDb(databaseUrl);
  await migrateToLatest(db);
  return { repos: createPostgresRepositories(db), close: () => db.destroy() };
}
