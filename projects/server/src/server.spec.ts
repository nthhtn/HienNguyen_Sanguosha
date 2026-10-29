import { buildContentRegistry, guozhanMaxSeats } from 'content';
import type { GameRules } from 'engine';
import { loadConfig } from './config';
import { drawSeats } from './game/engineGame';
import { createPostgresRepositories } from './persistence/postgres/postgresRepositories';
import { createTestDatabase } from './persistence/postgres/testDatabase';
import { createServer } from './server';

describe('createServer', () => {
  it('serves the auth API on the in-memory store when there is no DATABASE_URL', async () => {
    const server = await createServer(loadConfig({}), { logger: false });
    try {
      expect((await server.app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
      const guest = await server.app.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { displayName: 'Guest' },
        headers: { origin: 'http://localhost:4200' },
      });
      expect(guest.statusCode).toBe(201);
    } finally {
      await server.close();
    }
  });

  it('lists rooms with the seat limits the content allows', async () => {
    const server = await createServer(loadConfig({}), { logger: false });
    try {
      const guest = await server.app.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { displayName: 'Guest' },
        headers: { origin: 'http://localhost:4200' },
      });
      const session = guest.cookies.find((c) => c.name === 'sgs_session')!.value;
      const list = await server.app.inject({ method: 'GET', url: '/api/rooms', cookies: { sgs_session: session } });
      expect(list.json()).toEqual({ rooms: [], seatLimits: { min: 2, max: guozhanMaxSeats(buildContentRegistry()) } });
    } finally {
      await server.close();
    }
  });
});

// Needs a running Postgres: `npm run db:up`, then `npm run test:db`.
const adminUrl = process.env['TEST_DATABASE_URL'];
const describeWithDb = adminUrl ? describe : describe.skip;

describeWithDb('createServer on Postgres', () => {
  let test: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeEach(async () => {
    test = await createTestDatabase(adminUrl!);
  });

  afterEach(() => test.drop());

  // A deploy that renames a deck leaves running games the engine can't rebuild.
  it('starts, and ends a running game it cannot restore as broken', async () => {
    const repos = createPostgresRepositories(test.db);
    const at = new Date('2026-10-28T12:00:00Z');
    const ann = await repos.users.createRegistered({ email: 'ann@example.com', passwordHash: 'h', displayName: 'Ann', now: at });
    const rules = { deck: 'alternate' } as unknown as GameRules;
    const room = await repos.rooms.create({ visibility: 'open', seatCount: 2, rules, now: at });
    const host = await repos.rooms.addPlayer({ roomId: room.id, userId: ann.id, kind: 'human', displayName: 'Ann', now: at });
    const bot = await repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: at });
    await repos.rooms.update(room.id, { hostPlayerId: host.id, status: 'playing' }, at);
    const seats = drawSeats(
      [
        { id: host.id, name: 'Ann', kind: 'human' },
        { id: bot.id, name: 'Bot 1', kind: 'bot' },
      ],
      1
    );
    const game = await repos.games.create({ roomId: room.id, seed: 1, seats, rules, buildId: 'old-build', now: at });

    const server = await createServer(loadConfig({ DATABASE_URL: test.url }), { logger: false });
    try {
      expect((await server.app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect((await repos.games.findById(game.id))!.status).toBe('broken');
    } finally {
      await server.close();
    }
  });
});
