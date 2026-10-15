import { GameHistory } from '../game/history';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { FastifyInstance } from 'fastify';
import { buildContentRegistry } from 'content';
import { PROTOCOL_VERSION } from 'protocol';
import type { GameUpdate } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { buildApp } from '../http/app';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { BotSeat, TestClient } from './testClient';

const ORIGIN = 'http://localhost:4200';
const registry = buildContentRegistry();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Checks `done` every 10 ms until it holds; fails after `timeoutMs`.
async function until(done: () => boolean | Promise<boolean>, what: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await wait(10);
  }
}

// Makes the client's first offered move, once per state, until `done` holds.
async function playUntil(client: TestClient, done: () => boolean | Promise<boolean>, what: string): Promise<void> {
  let answered = -1;
  let reqs = 0;
  await until(async () => {
    if (await done()) return true;
    const game = client.latestGame;
    if (game && game.legalActions.length > 0 && game.seq !== answered) {
      answered = game.seq;
      client.send({ type: 'game.submit', reqId: `play-${reqs++}`, gameId: game.gameId, baseSeq: game.seq, actions: [game.legalActions[0]] });
    }
    return false;
  }, what);
}

// One in-memory store across restarts. Bots move at once, and a seat goes to
// a bot after 300 ms away, so whole games and takeovers run in test time.
async function setup(options: { botDelayMs?: number } = {}) {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const clients: TestClient[] = [];
  let rooms!: RoomService;
  let app!: FastifyInstance;
  let url = '';

  const startServer = async () => {
    // A fixed seed: with a random one, two seats can get the same kingdom and the game ends at General selection.
    rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 }, registry, buildId: 'test-build', randomSeed: () => 1, botDelayMs: options.botDelayMs ?? 0, takeoverAwayMs: 300 });
    await rooms.restore();
    app = await buildApp({ accounts, rooms, history: new GameHistory(repos), publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
    await app.listen({ port: 0, host: '127.0.0.1' });
    url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ws`;
  };
  const stopServer = async () => {
    await rooms.stop();
    await app.close();
  };
  await startServer();

  const post = (path: string, payload: object, session?: string) =>
    app.inject({ method: 'POST', url: path, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
  const signUp = async (displayName: string) => {
    const res = await post('/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName });
    return res.cookies.find((c) => c.name === 'sgs_session')!.value;
  };
  // Ann (host) and Bo in a two-seat room.
  const pairRoom = async () => {
    const ann = await signUp('Ann');
    const bo = await signUp('Bo');
    const roomId = (await post('/api/rooms', { seatCount: 2, rules: {}, displayName: 'Ann' }, ann)).json().id as string;
    await post(`/api/rooms/${roomId}/join`, { displayName: 'Bo' }, bo);
    return { ann, bo, roomId };
  };
  const open = async (session: string) => {
    const client = await TestClient.open(url, { origin: ORIGIN, token: session });
    clients.push(client);
    return client;
  };
  const hello = (client: TestClient, roomId: string) => client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId });
  const connect = async (session: string, roomId: string) => {
    const client = await open(session);
    hello(client, roomId);
    return { client, welcome: await client.next('welcome') };
  };
  const connectBot = async (session: string, roomId: string) => {
    const client = await open(session);
    const seat = new BotSeat(client, registry);
    hello(client, roomId);
    await client.next('welcome');
    return { client, seat };
  };
  const startGame = async (client: TestClient) => {
    client.send({ type: 'lobby.start', reqId: 'start' });
    await client.next('ack', (m) => m.reqId === 'start');
  };
  const teardown = async () => {
    for (const client of clients) client.close();
    await stopServer();
  };
  return { repos, rooms: () => rooms, post, signUp, pairRoom, connect, connectBot, startGame, startServer, stopServer, teardown };
}

describe('games over the socket', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  afterEach(async () => {
    await ctx?.teardown();
  });

  it('two people play a whole game to its end, each from their own view', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pairRoom();
    const a = await ctx.connectBot(ann, roomId);
    const b = await ctx.connectBot(bo, roomId);
    await ctx.startGame(a.client);
    const ended = await a.client.next('room.updated', (m) => m.room.status === 'lobby' && m.room.lastGame !== null, 60_000);
    expect(ended.room.lastGame).toMatchObject({ outcome: 'finished', result: expect.objectContaining({ winningSeatIds: expect.any(Array) }) });
    expect(a.seat.resyncs + b.seat.resyncs).toBe(0);
    expect([...a.client.received, ...b.client.received].filter((m) => m.type === 'error')).toEqual([]);
    const final = a.seat.lastUpdate!;
    expect(final.view.result).not.toBeNull();
    const actions = await ctx.repos.games.listActions(final.gameId);
    expect(actions).toHaveLength(final.seq);
    expect(actions.every((x) => x.source === 'human')).toBe(true);
  }, 60_000);

  it('refuses moves out of turn, stale or never offered, and a bad second action undoes the first (Review Focus 1 and 2)', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pairRoom();
    const a = await ctx.connect(ann, roomId);
    const b = await ctx.connect(bo, roomId);
    await ctx.startGame(a.client);
    const [forA, forB] = await Promise.all([a.client.next('game.update'), b.client.next('game.update')]);
    const [mover, other, game] = forA.game.legalActions.length > 0 ? [a, b, forA.game] : [b, a, forB.game];
    const move = game.legalActions[0];
    const submit = (client: TestClient, reqId: string, fields: object = {}) =>
      client.send({ type: 'game.submit', reqId, gameId: game.gameId, baseSeq: 0, actions: [move], ...fields });
    const refusal = (client: TestClient, reqId: string) => client.next('error', (m) => m.reqId === reqId);

    submit(other.client, 'x1');
    expect(await refusal(other.client, 'x1')).toMatchObject({ code: 'not_your_turn', message: "It's not your turn" });
    submit(mover.client, 'x2', { baseSeq: 5 });
    expect(await refusal(mover.client, 'x2')).toMatchObject({ code: 'stale' });
    submit(mover.client, 'x3', { actions: [{ kind: 'DrawCardsAction', seatId: move.seatId, count: 5 }] });
    expect(await refusal(mover.client, 'x3')).toMatchObject({ code: 'illegal_action' });
    submit(mover.client, 'x4', { actions: [move, move] });
    expect(await refusal(mover.client, 'x4')).toMatchObject({ code: 'illegal_action' });
    submit(mover.client, 'x5', { gameId: randomUUID() });
    expect(await refusal(mover.client, 'x5')).toMatchObject({ code: 'stale' });

    const beforeResync = mover.client.received.length;
    mover.client.send({ type: 'game.resync', reqId: 'x6' });
    const resynced = await mover.client.next('game.update', () => true, 2000, beforeResync);
    expect(resynced.game).toMatchObject({ seq: 0, logFrom: 0 });
    expect(mover.client.isOpen).toBe(true);

    const beforeMove = other.client.received.length;
    submit(mover.client, 'x7');
    await mover.client.next('ack', (m) => m.reqId === 'x7');
    expect((await other.client.next('game.update', () => true, 2000, beforeMove)).game.seq).toBe(1);
    expect(await ctx.repos.games.listActions(game.gameId)).toHaveLength(1);
  });

  it("hands an away player's seat to a bot, and gives it back when they return", async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pairRoom();
    const a = await ctx.connect(ann, roomId);
    const b = await ctx.connect(bo, roomId);
    await ctx.startGame(a.client);
    const gameId = (await a.client.next('game.update')).game.gameId;
    const takeovers = async () => (await ctx.repos.games.listActions(gameId)).filter((x) => x.source === 'takeover');
    b.client.close();
    await a.client.next('room.updated', (m) => m.room.members.some((x) => x.name === 'Bo' && !x.connected));
    await wait(350);
    await ctx.rooms().tick();
    await a.client.next('room.updated', (m) => m.room.members.some((x) => x.name === 'Bo' && x.botControlled));

    // Ann plays on until a bot has moved for Bo and the game waits on Ann.
    await playUntil(
      a.client,
      async () => (await takeovers()).length > 0 && (a.client.latestGame?.legalActions.length ?? 0) > 0,
      'a takeover move for Bo'
    );
    const before = await takeovers();
    const boSeat = before[0].seatId;
    expect(before.every((x) => x.seatId === boSeat)).toBe(true);

    const beforeReturn = a.client.received.length;
    const back = await ctx.connect(bo, roomId);
    expect(back.welcome.room.members.find((x) => x.name === 'Bo')).toMatchObject({ botControlled: false, connected: true });
    expect(back.welcome.you.seatId).toMatch(/^seat-[01]$/);
    expect(back.welcome.you.seatId).toBe(boSeat);
    expect(back.welcome.game).toMatchObject({ logFrom: 0 });
    await a.client.next('room.updated', (m) => m.room.members.some((x) => x.name === 'Bo' && x.connected && !x.botControlled), 2000, beforeReturn);

    // Ann plays on until Bo has a move of his own: no bot moves for him now.
    await playUntil(a.client, () => (back.client.latestGame?.legalActions.length ?? 0) > 0, 'a move for Bo');
    await wait(50);
    expect(await takeovers()).toHaveLength(before.length);
  });

  it('pauses a solo game while its player is away, and resumes when they return', async () => {
    // The bot waits 200 ms before each move, so it has a move due when Ann leaves.
    ctx = await setup({ botDelayMs: 200 });
    const ann = await ctx.signUp('Ann');
    const created = await ctx.post('/api/rooms/solo', { seatCount: 2, rules: {} }, ann);
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    const first = await ctx.connect(ann, id);
    const game = first.welcome.game as GameUpdate;
    expect(game.paused).toBe(false);

    // Ann makes her moves until the bot is to move next, then leaves at once.
    await until(() => (first.client.latestGame?.legalActions.length ?? 0) > 0, 'a move for Ann');
    let mine = first.client.latestGame!;
    for (let i = 0; mine.legalActions.length > 0; i++) {
      if (i === 50) throw new Error('Ann never handed the move to the bot');
      first.client.send({ type: 'game.submit', reqId: `ann-${i}`, gameId: mine.gameId, baseSeq: mine.seq, actions: [mine.legalActions[0]] });
      await first.client.next('ack', (m) => m.reqId === `ann-${i}`);
      const seq = mine.seq + 1;
      mine = (await first.client.next('game.update', (m) => m.game.seq === seq)).game;
    }
    expect(mine.view.result).toBeNull();
    first.client.close();
    await wait(100);
    const stored = (await ctx.repos.games.listActions(game.gameId)).length;
    expect(stored).toBe(mine.seq);
    await wait(200);
    expect(await ctx.repos.games.listActions(game.gameId)).toHaveLength(stored);
    const again = await ctx.connect(ann, id);
    expect(again.welcome.game).toMatchObject({ gameId: game.gameId, paused: false, seq: stored });
    // Play goes on: the bot makes its move after Ann's return.
    await again.client.next('game.update', (m) => m.game.seq > stored);
    expect((await ctx.repos.games.listActions(game.gameId)).length).toBeGreaterThan(stored);
  });

  it('restores a game after a restart: the same seq and the same view (Review Focus 4)', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pairRoom();
    const a = await ctx.connect(ann, roomId);
    const b = await ctx.connect(bo, roomId);
    await ctx.startGame(a.client);
    const [forA, forB] = await Promise.all([a.client.next('game.update'), b.client.next('game.update')]);
    const [mover, game] = forA.game.legalActions.length > 0 ? [a, forA.game] : [b, forB.game];
    mover.client.send({ type: 'game.submit', reqId: 'm1', gameId: game.gameId, baseSeq: 0, actions: [game.legalActions[0]] });
    await mover.client.next('ack', (m) => m.reqId === 'm1');
    const annBefore = (await a.client.next('game.update', (m) => m.game.seq === 1)).game;

    a.client.close();
    b.client.close();
    await ctx.stopServer();
    await ctx.startServer();

    const again = await ctx.connect(ann, roomId);
    expect(again.welcome.room.status).toBe('playing');
    expect(again.welcome.game).toMatchObject({ gameId: game.gameId, seq: 1, logFrom: 0 });
    expect(again.welcome.game!.view).toEqual(annBefore.view);
  });
});
