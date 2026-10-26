import { GameHistory } from './game/history';
import { FastifyInstance } from 'fastify';
import { AccountService } from './auth/accounts';
import { seedDevAccount } from './auth/devAccount';
import { AuthRateLimits } from './auth/rateLimits';
import { buildContentRegistry, kingdomWarMaxSeats } from 'content';
import { MIN_SEATS } from 'protocol';
import { ServerConfig } from './config';
import { buildApp } from './http/app';
import { ConsoleMailer } from './mail/mailer';
import { createMemoryRepositories } from './persistence/memory/memoryRepositories';
import { migrateToLatest } from './persistence/migrate';
import { createDb } from './persistence/postgres/db';
import { createPostgresRepositories } from './persistence/postgres/postgresRepositories';
import { Repositories } from './persistence/repositories';
import { ROOM_TICK_MS, RoomService } from './rooms/roomService';

const HOUSEKEEPING_MS = 60 * 60_000;

export interface RunningServer {
  app: FastifyInstance;
  close(): Promise<void>;
}

// Everything the process runs, wired from config: the store (Postgres,
// migrated on start, or in memory), accounts, rooms (restored from the store,
// running games included, rebuilt from their stored actions), the HTTP app,
// the room tick every 5 s, and an hourly clean-up of rate-limit windows, idle
// guests, and dead sessions and reset tokens. `seedDevAccount` adds the local
// development account (player@sgs.com). Closing stops the game timers
// first, then the HTTP app and the store.
export async function createServer(config: ServerConfig, options: { logger?: boolean; seedDevAccount?: boolean } = {}): Promise<RunningServer> {
  const store = await openStore(config.databaseUrl, config.databaseSsl);
  const accounts = new AccountService({ repos: store.repos, mailer: new ConsoleMailer(), publicOrigin: config.publicOrigin });
  if (options.seedDevAccount) await seedDevAccount(accounts);
  const rateLimits = new AuthRateLimits();
  const registry = buildContentRegistry();
  const rooms = new RoomService({
    repos: store.repos,
    seatLimits: { min: MIN_SEATS, max: kingdomWarMaxSeats(registry) },
    registry,
    buildId: config.buildId,
    logError: (err, message) => app.log.error(err, message),
  });
  await rooms.restore();
  const app = await buildApp({
    accounts,
    rooms,
    history: new GameHistory(store.repos),
    publicOrigin: config.publicOrigin,
    cookieSecure: config.cookieSecure,
    staticDir: config.staticDir,
    trustProxy: config.trustProxy,
    rateLimits,
    logger: options.logger ?? true,
  });

  const housekeeping = setInterval(() => {
    rateLimits.prune(Date.now());
    accounts.purgeIdleGuests().catch((err: unknown) => app.log.error(err, 'Purging idle guests failed'));
    accounts.purgeExpired().catch((err: unknown) => app.log.error(err, 'Purging expired sessions and reset tokens failed'));
  }, HOUSEKEEPING_MS);
  housekeeping.unref();

  const roomTick = setInterval(() => void rooms.tick(), ROOM_TICK_MS);
  roomTick.unref();

  return {
    app,
    close: async () => {
      clearInterval(roomTick);
      clearInterval(housekeeping);
      await rooms.stop();
      await app.close();
      await store.close();
    },
  };
}

async function openStore(databaseUrl: string | null, databaseSsl: boolean): Promise<{ repos: Repositories; close(): Promise<void> }> {
  if (!databaseUrl) return { repos: createMemoryRepositories(), close: async () => undefined };
  const db = createDb(databaseUrl, databaseSsl);
  await migrateToLatest(db);
  return { repos: createPostgresRepositories(db), close: () => db.destroy() };
}
