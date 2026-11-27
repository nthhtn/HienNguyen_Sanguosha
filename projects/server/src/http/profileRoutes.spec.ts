import { randomUUID } from 'node:crypto';
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { ProfileStats } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { GameHistory } from '../game/history';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { Repositories } from '../persistence/repositories';
import { ProfileService } from '../profile/profileService';
import { RoomService } from '../rooms/roomService';
import { buildApp } from './app';

const ORIGIN = 'http://localhost:4200';
const NOW = new Date('2026-11-27T12:00:00.000Z');

async function setup(rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } })) {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const app = await buildApp({ accounts, rooms, history: new GameHistory(repos), profile: new ProfileService({ repos }), publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
  return { app, repos };
}

const token = (res: LightMyRequestResponse) => res.cookies.find((c) => c.name === 'sgs_session')!.value;
const send = (app: FastifyInstance, method: 'POST' | 'PATCH', url: string, payload: object, session?: string) =>
  app.inject({ method, url, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
const get = (app: FastifyInstance, url: string, session?: string) => app.inject({ method: 'GET', url, cookies: session ? { sgs_session: session } : {} });
const signUp = async (app: FastifyInstance, name = 'Ann') => {
  const email = `${name.toLowerCase()}-${randomUUID()}@example.com`;
  const res = await send(app, 'POST', '/api/auth/signup', { email, password: 'secret-pass', displayName: name });
  return { session: token(res), email, id: res.json().id as string };
};
const guest = async (app: FastifyInstance) => token(await send(app, 'POST', '/api/auth/guest', { displayName: 'Gus' }));

// A finished two-seat game in which `userId` won on seat-1.
async function seedWin(repos: Repositories, userId: string) {
  const room = await repos.rooms.create({ visibility: 'solo', seatCount: 2, rules: {}, now: NOW });
  const person = await repos.rooms.addPlayer({ roomId: room.id, userId, kind: 'human', displayName: 'Ann', now: NOW });
  const game = await repos.games.create({ roomId: room.id, seed: 1, seats: [{ seatId: 'seat-1', roomPlayerId: person.id, name: 'Ann', kind: 'human' }], rules: {}, buildId: 'b', now: NOW });
  await repos.games.update(game.id, { status: 'finished', result: { endedAt: 1, winningSeatIds: ['seat-1'], losingSeatIds: [] }, finishedAt: NOW });
  await repos.games.saveSeatResults([{ gameId: game.id, seatId: 'seat-1', userId, mainGeneralId: 'cao-cao', deputyGeneralId: null, kingdom: 'Wei', allegiance: 'kingdom', eliminated: false, won: true }]);
}

describe('GET /api/me/profile', () => {
  it('returns the stats of a registered user, over all games by default', async () => {
    const { app, repos } = await setup();
    const ann = await signUp(app);
    await seedWin(repos, ann.id);
    const res = await get(app, '/api/me/profile', ann.session);
    expect(res.statusCode).toBe(200);
    const stats = res.json() as ProfileStats;
    expect(stats).toMatchObject({ displayName: 'Ann', mode: 'all', totals: { games: 1, wins: 1, winRate: 1 }, streak: { current: 1, best: 1 } });
    expect(stats.topGenerals).toEqual([{ generalId: 'cao-cao', games: 1, wins: 1, losses: 0, winRate: 1 }]);
  });

  it('filters by the mode in the query and rejects an unknown mode', async () => {
    const { app, repos } = await setup();
    const ann = await signUp(app);
    await seedWin(repos, ann.id);
    expect((await get(app, '/api/me/profile?mode=online', ann.session)).json().totals.games).toBe(0);
    expect((await get(app, '/api/me/profile?mode=solo', ann.session)).json().totals.games).toBe(1);
    expect((await get(app, '/api/me/profile?mode=nope', ann.session)).statusCode).toBe(400);
  });

  it('tells a signed-out request to sign in and refuses a guest', async () => {
    const { app } = await setup();
    expect((await get(app, '/api/me/profile')).statusCode).toBe(401);
    expect((await get(app, '/api/me/profile', await guest(app))).statusCode).toBe(403);
  });
});

describe('PATCH /api/me/profile', () => {
  it('renames the user and answers with the updated Me', async () => {
    const { app } = await setup();
    const ann = await signUp(app);
    const res = await send(app, 'PATCH', '/api/me/profile', { displayName: ' Ann Two ' }, ann.session);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: ann.id, kind: 'registered', displayName: 'Ann Two' });
    expect((await get(app, '/api/me', ann.session)).json().displayName).toBe('Ann Two');
  });

  it('answers 400 invalid_name for a blank name, and 403 for a guest', async () => {
    const { app } = await setup();
    const ann = await signUp(app);
    const blank = await send(app, 'PATCH', '/api/me/profile', { displayName: '  ' }, ann.session);
    expect(blank.statusCode).toBe(400);
    expect(blank.json().code).toBe('invalid_name');
    expect((await send(app, 'PATCH', '/api/me/profile', { displayName: 'Gus2' }, await guest(app))).statusCode).toBe(403);
  });
});

describe('POST /api/me/password', () => {
  it('changes the password with 204, keeps this session and signs the others out', async () => {
    const { app } = await setup();
    const ann = await signUp(app);
    const other = token(await send(app, 'POST', '/api/auth/signin', { email: ann.email, password: 'secret-pass' }));
    const res = await send(app, 'POST', '/api/me/password', { currentPassword: 'secret-pass', newPassword: 'another-pass' }, ann.session);
    expect(res.statusCode).toBe(204);
    expect((await get(app, '/api/me', ann.session)).statusCode).toBe(200);
    expect((await get(app, '/api/me', other)).statusCode).toBe(401);
    expect((await send(app, 'POST', '/api/auth/signin', { email: ann.email, password: 'another-pass' })).statusCode).toBe(200);
  });

  it('answers 401 invalid_credentials for a wrong current password and 400 weak_password for a short new one', async () => {
    const { app } = await setup();
    const ann = await signUp(app);
    const wrong = await send(app, 'POST', '/api/me/password', { currentPassword: 'wrong-pass', newPassword: 'another-pass' }, ann.session);
    expect([wrong.statusCode, wrong.json().code]).toEqual([401, 'invalid_credentials']);
    const weak = await send(app, 'POST', '/api/me/password', { currentPassword: 'secret-pass', newPassword: 'x' }, ann.session);
    expect([weak.statusCode, weak.json().code]).toEqual([400, 'weak_password']);
  });

  it('answers 429 once the per-user limit is used up', async () => {
    const limits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 }, passwordPerUser: { limit: 2, windowMs: 60_000 } });
    const { app } = await setup(limits);
    const ann = await signUp(app);
    const attempt = () => send(app, 'POST', '/api/me/password', { currentPassword: 'wrong-pass', newPassword: 'another-pass' }, ann.session);
    expect((await attempt()).statusCode).toBe(401);
    expect((await attempt()).statusCode).toBe(401);
    expect((await attempt()).statusCode).toBe(429);
  });

  it('refuses a guest and a signed-out request', async () => {
    const { app } = await setup();
    const body = { currentPassword: 'x', newPassword: 'another-pass' };
    expect((await send(app, 'POST', '/api/me/password', body)).statusCode).toBe(401);
    expect((await send(app, 'POST', '/api/me/password', body, await guest(app))).statusCode).toBe(403);
  });
});
