import { randomUUID } from 'node:crypto';
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildContentRegistry } from 'content';
import type { GameReplay, MyGames } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { engineContext, openingState, replay as replayGame, stateHash } from '../game/engineGame';
import { GameHistory } from '../game/history';
import { playBots } from '../game/testing';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { GameSeat } from '../persistence/records';
import { Repositories } from '../persistence/repositories';
import { RoomService } from '../rooms/roomService';
import { buildApp } from './app';

const ORIGIN = 'http://localhost:4200';
const ctx = engineContext(buildContentRegistry());
const NOW = new Date('2026-10-15T12:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

async function setup() {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app = await buildApp({ accounts, rooms, history: new GameHistory(repos), publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
  return { app, repos };
}

const token = (res: LightMyRequestResponse) => res.cookies.find((c) => c.name === 'sgs_session')!.value;
const post = (app: FastifyInstance, url: string, payload: object) => app.inject({ method: 'POST', url, payload, headers: { origin: ORIGIN } });
const get = (app: FastifyInstance, url: string, session?: string) => app.inject({ method: 'GET', url, cookies: session ? { sgs_session: session } : {} });
const signUp = async (app: FastifyInstance, displayName: string) =>
  token(await post(app, '/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName }));
const guest = async (app: FastifyInstance) => token(await post(app, '/api/auth/guest', { displayName: 'Gus' }));
const userId = async (app: FastifyInstance, session: string) => (await get(app, '/api/me', session)).json().id as string;

// A two-seat game that `userId` played on seat-1 against Bot 1 on seat-0, with
// moves played by the rule-based bot, stored the way the server stores them.
async function seedGame(repos: Repositories, user: string, options: { status?: 'finished' | 'aborted' | 'running'; finishedAt?: Date } = {}) {
  const status = options.status ?? 'finished';
  const room = await repos.rooms.create({ visibility: 'open', seatCount: 2, rules: {}, now: NOW });
  const person = await repos.rooms.addPlayer({ roomId: room.id, userId: user, kind: 'human', displayName: 'Ann', now: NOW });
  const bot = await repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: NOW });
  const seats: GameSeat[] = [
    { seatId: 'seat-0', roomPlayerId: bot.id, name: 'Bot 1', kind: 'bot' },
    { seatId: 'seat-1', roomPlayerId: person.id, name: 'Ann', kind: 'human' },
  ];
  const game = await repos.games.create({ roomId: room.id, seed: 1, seats, rules: {}, buildId: 'build-1', now: NOW });
  const { moves } = playBots(ctx, openingState(ctx, 1, seats, {}), 30);
  const rows = moves.map((move, i) => ({ seq: i + 1, seatId: move.seatId, source: 'bot' as const, action: move.action, stateHash: stateHash(move.after) }));
  await repos.transaction((tx) => tx.games.appendActions(game.id, 0, rows, NOW));
  if (status !== 'running') {
    const result = status === 'finished' ? { endedAt: rows.length, winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0'] } : null;
    await repos.games.update(game.id, { status, result, finishedAt: options.finishedAt ?? NOW });
  }
  return { game, room, person, actionCount: rows.length };
}

describe('game history routes', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('answers 401 without a session and 403 to a guest, on both routes (Review Focus 4)', async () => {
    ({ app } = await setup());
    const urls = ['/api/me/games', `/api/games/${randomUUID()}/replay`];
    for (const url of urls) {
      const anonymous = await get(app, url);
      expect(anonymous.statusCode).toBe(401);
      expect(anonymous.json().code).toBe('not_signed_in');
      const asGuest = await get(app, url, await guest(app));
      expect(asGuest.statusCode).toBe(403);
      expect(asGuest.json().code).toBe('registered_only');
    }
  });

  it('lists nothing for a user with no finished games', async () => {
    ({ app } = await setup());
    const res = await get(app, '/api/me/games', await signUp(app, 'Ann'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ games: [] });
  });

  it("lists the user's finished games newest first with their seat, and no other user's, running or aborted game (Review Focus 4)", async () => {
    let repos: Repositories;
    ({ app, repos } = await setup());
    const ann = await signUp(app, 'Ann');
    const bo = await signUp(app, 'Bo');
    const annId = await userId(app, ann);
    const older = await seedGame(repos, annId, { finishedAt: minutes(1) });
    const newer = await seedGame(repos, annId, { finishedAt: minutes(5) });
    await seedGame(repos, annId, { status: 'running' });
    await seedGame(repos, annId, { status: 'aborted', finishedAt: minutes(9) });
    await seedGame(repos, await userId(app, bo), { finishedAt: minutes(7) });
    const body = (await get(app, '/api/me/games', ann)).json() as MyGames;
    expect(body.games.map((g) => g.gameId)).toEqual([newer.game.id, older.game.id]);
    expect(body.games[0]).toEqual({
      gameId: newer.game.id,
      finishedAt: minutes(5).getTime(),
      players: [
        { seatId: 'seat-0', name: 'Bot 1', kind: 'bot' },
        { seatId: 'seat-1', name: 'Ann', kind: 'human' },
      ],
      result: { endedAt: newer.actionCount, winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0'] },
      yourSeat: 'seat-1',
    });
  });

  it("returns a finished game as a replay that rebuilds the same state, with only that game's chat", async () => {
    let repos: Repositories;
    ({ app, repos } = await setup());
    const ann = await signUp(app, 'Ann');
    const { game, room, person, actionCount } = await seedGame(repos, await userId(app, ann));
    await repos.chat.add({ roomId: room.id, gameId: null, afterSeq: null, roomPlayerId: person.id, body: 'lobby hello', now: NOW });
    await repos.chat.add({ roomId: room.id, gameId: game.id, afterSeq: 2, roomPlayerId: person.id, body: 'gg', now: NOW });
    const res = await get(app, `/api/games/${game.id}/replay`, ann);
    expect(res.statusCode).toBe(200);
    const body = res.json() as GameReplay;
    expect(Object.keys(body).sort()).toEqual(['actions', 'buildId', 'chat', 'rules', 'seats', 'seed']);
    expect(body.seed).toBe(1);
    expect(body.buildId).toBe('build-1');
    expect(body.actions).toHaveLength(actionCount);
    expect(body.chat).toEqual([{ id: expect.any(Number), from: { playerId: person.id, name: 'Ann' }, body: 'gg', at: NOW.getTime() }]);
    // Every stored hash must match what the engine computes again from the seed and the actions.
    const record = { id: game.id, roomId: room.id, seed: body.seed, seats: body.seats, rules: body.rules, buildId: body.buildId, status: 'finished' as const, result: null, actionCount, startedAt: NOW, finishedAt: NOW };
    const rows = body.actions.map((action) => ({ ...action, gameId: game.id, createdAt: NOW }));
    expect(() => replayGame(ctx, record, rows, true)).not.toThrow();
  });

  it("answers 404 for a game that is unknown, someone else's, running or aborted, and 400 for a bad id (Review Focus 4)", async () => {
    let repos: Repositories;
    ({ app, repos } = await setup());
    const ann = await signUp(app, 'Ann');
    const bo = await signUp(app, 'Bo');
    const annId = await userId(app, ann);
    const boGame = await seedGame(repos, await userId(app, bo));
    const running = await seedGame(repos, annId, { status: 'running' });
    const aborted = await seedGame(repos, annId, { status: 'aborted' });
    for (const id of [randomUUID(), boGame.game.id, running.game.id, aborted.game.id]) {
      const res = await get(app, `/api/games/${id}/replay`, ann);
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('not_found');
      expect(res.body).not.toContain('seed');
    }
    const bad = await get(app, '/api/games/not-a-uuid/replay', ann);
    expect(bad.statusCode).toBe(400);
    expect(bad.json().code).toBe('invalid_body');
  });
});
