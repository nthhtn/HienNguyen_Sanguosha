import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { FastifyInstance } from 'fastify';
import { PROTOCOL_VERSION } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { GameHistory } from '../game/history';
import { buildApp } from '../http/app';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { TestClient } from './testClient';

const ORIGIN = 'http://localhost:4200';

async function setup() {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app: FastifyInstance = await buildApp({ accounts, rooms, history: new GameHistory(repos), publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ws`;
  const clients: TestClient[] = [];

  const post = (path: string, payload: object, session?: string) =>
    app.inject({ method: 'POST', url: path, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
  const signUp = async (displayName: string) => {
    const res = await post('/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName });
    return res.cookies.find((c) => c.name === 'sgs_session')!.value;
  };
  const open = async (session: string) => {
    const client = await TestClient.open(url, { origin: ORIGIN, token: session });
    clients.push(client);
    return client;
  };
  const connect = async (session: string, roomId: string) => {
    const client = await open(session);
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId });
    const welcome = await client.next('welcome');
    return { client, welcome, playerId: welcome.you.playerId };
  };
  // Ann (host) and Bo in a room, both signed up but not yet connected.
  const pair = async () => {
    const ann = await signUp('Ann');
    const bo = await signUp('Bo');
    const roomId = (await post('/api/rooms', { seatCount: 4, rules: {}, displayName: 'Ann' }, ann)).json().id as string;
    await post(`/api/rooms/${roomId}/join`, { displayName: 'Bo' }, bo);
    return { ann, bo, roomId };
  };
  const teardown = async () => {
    for (const client of clients) client.close();
    await rooms.stop();
    await app.close();
  };
  return { repos, open, connect, pair, teardown };
}

describe('chat over the socket', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  afterEach(async () => {
    await ctx?.teardown();
  });

  it('acks the sender and delivers the normalized message to every member', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pair();
    const a = await ctx.connect(ann, roomId);
    const b = await ctx.connect(bo, roomId);
    a.client.send({ type: 'chat.send', reqId: 'c1', body: '  hello   there ' });
    await a.client.next('ack', (m) => m.reqId === 'c1');
    const expected = expect.objectContaining({ id: expect.any(Number), from: { playerId: a.playerId, name: 'Ann' }, body: 'hello there', at: expect.any(Number) });
    expect(await a.client.next('chat.message')).toEqual(expected);
    expect(await b.client.next('chat.message')).toEqual(expected);
  });

  it('gives a member who connects later the recent messages, oldest first, in the welcome', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pair();
    const a = await ctx.connect(ann, roomId);
    for (const body of ['one', 'two']) {
      a.client.send({ type: 'chat.send', reqId: body, body });
      await a.client.next('ack', (m) => m.reqId === body);
    }
    const b = await ctx.connect(bo, roomId);
    expect(b.welcome.chat.map((m) => m.body)).toEqual(['one', 'two']);
  });

  it('answers an empty, an over-long and a too-fast message with their codes, and stores only the accepted ones (Review Focus 1 and 2)', async () => {
    ctx = await setup();
    const { ann, roomId } = await ctx.pair();
    const a = await ctx.connect(ann, roomId);
    const refused = async (reqId: string, body: string, code: string) => {
      a.client.send({ type: 'chat.send', reqId, body });
      const error = await a.client.next('error', (m) => m.reqId === reqId);
      expect(error.code).toBe(code);
    };
    await refused('e1', '   ', 'chat_empty');
    await refused('e2', 'x'.repeat(301), 'chat_too_long');
    for (let i = 0; i < 5; i += 1) {
      a.client.send({ type: 'chat.send', reqId: `ok${i}`, body: `m${i}` });
      await a.client.next('ack', (m) => m.reqId === `ok${i}`);
    }
    await refused('e3', 'sixth', 'chat_rate_limited');
    expect((await ctx.repos.chat.listRecent(roomId, 100)).map((m) => m.body)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
  });

  it('refuses a body that is not text, naming the request (Review Focus 1)', async () => {
    ctx = await setup();
    const { ann, roomId } = await ctx.pair();
    const a = await ctx.connect(ann, roomId);
    a.client.send({ type: 'chat.send', reqId: 'bad', body: 42 });
    const error = await a.client.next('error', (m) => m.reqId === 'bad');
    expect(error.code).toBe('invalid_message');
    expect(await ctx.repos.chat.listRecent(roomId, 10)).toEqual([]);
  });

  it('refuses chat.send from a connection that has not said hello (Review Focus 3)', async () => {
    ctx = await setup();
    const { ann, roomId } = await ctx.pair();
    const client = await ctx.open(ann);
    client.send({ type: 'chat.send', reqId: 'early', body: 'hi' });
    const error = await client.next('error', (m) => m.reqId === 'early');
    expect(error.code).toBe('invalid_message');
    expect(await ctx.repos.chat.listRecent(roomId, 10)).toEqual([]);
  });
});
