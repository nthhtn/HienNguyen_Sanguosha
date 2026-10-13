import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { FastifyInstance } from 'fastify';
import { PROTOCOL_VERSION } from 'protocol';
import type { RoomSnapshot } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { buildApp } from '../http/app';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { SocketOptions } from './socketServer';
import { refusedStatus, TestClient } from './testClient';

const ORIGIN = 'http://localhost:4200';

async function setup(socket: SocketOptions = {}) {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app = await buildApp({ accounts, rooms, publicOrigin: ORIGIN, cookieSecure: false, rateLimits, socket });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ws`;
  const clients: TestClient[] = [];

  const sessionOf = (res: { cookies: { name: string; value: string }[] }) => res.cookies.find((c) => c.name === 'sgs_session')!.value;
  const post = (path: string, payload: object, session?: string) =>
    app.inject({ method: 'POST', url: path, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
  const signUp = async (displayName: string) =>
    sessionOf(await post('/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName }));
  const createRoom = async (session: string, displayName = 'Ann') =>
    (await post('/api/rooms', { seatCount: 4, rules: {}, displayName }, session)).json().id as string;
  const join = (session: string, roomId: string, displayName: string) => post(`/api/rooms/${roomId}/join`, { displayName }, session);
  const snapshot = async (session: string, roomId: string) =>
    (await app.inject({ method: 'GET', url: `/api/rooms/${roomId}`, cookies: { sgs_session: session } })).json() as RoomSnapshot;
  // Lets the server finish handling a close it has already seen.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  const open = async (session: string, autoPong = true) => {
    const client = await TestClient.open(url, { origin: ORIGIN, token: session, autoPong });
    clients.push(client);
    return client;
  };
  const connect = async (session: string, roomId: string, autoPong = true) => {
    const client = await open(session, autoPong);
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId });
    const welcome = await client.next('welcome');
    return { client, welcome, playerId: welcome.you.playerId };
  };
  // A room with Ann (host) and Bo, both connected.
  const twoInRoom = async () => {
    const ann = await signUp('Ann');
    const bo = await signUp('Bo');
    const roomId = await createRoom(ann);
    await join(bo, roomId, 'Bo');
    const host = await connect(ann, roomId);
    const guest = await connect(bo, roomId);
    await host.client.next('room.updated');
    return { ann, bo, roomId, host, guest };
  };
  const teardown = async () => {
    for (const client of clients) client.close();
    await app.close();
  };
  return { app, url, signUp, createRoom, join, snapshot, settle, open, connect, twoInRoom, teardown };
}

describe('socket server', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  afterEach(async () => {
    await ctx?.teardown();
  });

  it('refuses an upgrade without a session (401), from another origin (403) or on another path (404)', async () => {
    ctx = await setup();
    const session = await ctx.signUp('Ann');
    expect(await refusedStatus(ctx.url, { origin: ORIGIN })).toBe(401);
    expect(await refusedStatus(ctx.url, { origin: ORIGIN, cookie: 'sgs_session=garbage' })).toBe(401);
    expect(await refusedStatus(ctx.url, { origin: 'https://evil.example', cookie: `sgs_session=${session}` })).toBe(403);
    expect(await refusedStatus(ctx.url.replace('/api/ws', '/api/other'), { origin: ORIGIN, cookie: `sgs_session=${session}` })).toBe(404);
  });

  it("welcomes a member with their player id and the room, and the others see them connected", async () => {
    ctx = await setup();
    const { host, guest } = await ctx.twoInRoom();
    expect(guest.welcome).toMatchObject({ type: 'welcome', you: { playerId: expect.any(String), seatId: null }, game: null });
    expect(guest.welcome.room.members.map((m) => m.name)).toEqual(['Ann', 'Bo']);
    const update = host.client.received.filter((m) => m.type === 'room.updated').at(-1);
    expect(update?.type === 'room.updated' && update.room.members.map((m) => m.connected)).toEqual([true, true]);
  });

  it('answers a hello from another protocol version with version, then closes', async () => {
    ctx = await setup();
    const ann = await ctx.signUp('Ann');
    const roomId = await ctx.createRoom(ann);
    const client = await ctx.open(ann);
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION + 1, roomId });
    expect(await client.next('error')).toEqual({ type: 'error', code: 'version', message: 'Please reload to get the latest version' });
    await client.closed();
  });

  it('answers a hello from a non-member with not_member, then closes', async () => {
    ctx = await setup();
    const roomId = await ctx.createRoom(await ctx.signUp('Ann'));
    const client = await ctx.open(await ctx.signUp('Bo'));
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId, reqId: 'h1' });
    expect(await client.next('error')).toMatchObject({ code: 'not_member', reqId: 'h1' });
    await client.closed();
  });

  it('answers malformed messages with invalid_message and stays open (Review Focus 5)', async () => {
    ctx = await setup();
    const ann = await ctx.signUp('Ann');
    const roomId = await ctx.createRoom(ann);
    const client = await ctx.open(ann);
    client.send({ type: 'lobby.addBot', reqId: 'early' });
    expect(await client.next('error')).toMatchObject({ code: 'invalid_message', reqId: 'early' });
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId });
    await client.next('welcome');
    client.send('not json');
    expect(await client.next('error')).toEqual({ type: 'error', code: 'invalid_message', message: 'That request was not understood' });
    client.sendBinary(new Uint8Array([1, 2, 3]));
    expect((await client.next('error')).code).toBe('invalid_message');
    client.send({ type: 'lobby.dance', reqId: 'r1' });
    expect(await client.next('error')).toMatchObject({ code: 'invalid_message', reqId: 'r1' });
    client.send({ type: 'lobby.addBot', reqId: 'r2', extra: true });
    expect(await client.next('error')).toMatchObject({ code: 'invalid_message', reqId: 'r2' });
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId, reqId: 'r3' });
    expect(await client.next('error')).toMatchObject({ code: 'invalid_message', reqId: 'r3' });
    client.send({ type: 'lobby.addBot', reqId: 'r4' });
    expect(await client.next('ack')).toEqual({ type: 'ack', reqId: 'r4' });
    expect(client.isOpen).toBe(true);
  });

  it('closes the socket on a message over 16 KiB', async () => {
    ctx = await setup();
    const ann = await ctx.signUp('Ann');
    const { client } = await ctx.connect(ann, await ctx.createRoom(ann));
    client.send({ type: 'lobby.addBot', reqId: 'x'.repeat(20_000) });
    await client.closed();
  });

  it('routes lobby commands: the host adds a bot and everyone hears; a non-host gets not_host', async () => {
    ctx = await setup();
    const { host, guest } = await ctx.twoInRoom();
    host.client.send({ type: 'lobby.addBot', reqId: 'a1' });
    expect(await host.client.next('ack')).toEqual({ type: 'ack', reqId: 'a1' });
    const update = await guest.client.next('room.updated');
    expect(update.room.members.map((m) => m.name)).toEqual(['Ann', 'Bo', 'Bot 1']);
    guest.client.send({ type: 'lobby.addBot', reqId: 'b1' });
    expect(await guest.client.next('error')).toEqual({ type: 'error', reqId: 'b1', code: 'not_host', message: 'Only the host can do that' });
  });

  it('a second tab replaces the first, and the member stays connected (Review Focus 4)', async () => {
    ctx = await setup();
    const { ann, guest, bo, roomId } = await ctx.twoInRoom();
    const secondTab = await ctx.connect(bo, roomId);
    expect(await guest.client.next('replaced')).toEqual({ type: 'replaced' });
    await guest.client.closed();
    expect(secondTab.playerId).toBe(guest.playerId);
    await ctx.settle();
    expect((await ctx.snapshot(ann, roomId)).members.map((m) => m.connected)).toEqual([true, true]);
    expect(secondTab.client.isOpen).toBe(true);
  });

  it('tells a removed member and closes their socket', async () => {
    ctx = await setup();
    const { host, guest } = await ctx.twoInRoom();
    host.client.send({ type: 'lobby.removePlayer', reqId: 'k1', playerId: guest.playerId });
    expect(await guest.client.next('room.left')).toEqual({ type: 'room.left', reason: 'removed' });
    await guest.client.closed();
    expect((await host.client.next('room.updated')).room.members.map((m) => m.name)).toEqual(['Ann']);
  });

  it('acks room.leave, closes the socket, and the others see the member gone', async () => {
    ctx = await setup();
    const { host, guest } = await ctx.twoInRoom();
    guest.client.send({ type: 'room.leave', reqId: 'l1' });
    expect(await guest.client.next('ack')).toEqual({ type: 'ack', reqId: 'l1' });
    await guest.client.closed();
    expect((await host.client.next('room.updated')).room.members.map((m) => m.name)).toEqual(['Ann']);
  });

  it('drops a client that stops answering pings, and shows them away', async () => {
    ctx = await setup({ heartbeatMs: 40 });
    const ann = await ctx.signUp('Ann');
    const bo = await ctx.signUp('Bo');
    const roomId = await ctx.createRoom(ann);
    await ctx.join(bo, roomId, 'Bo');
    const host = await ctx.connect(ann, roomId);
    const silent = await ctx.connect(bo, roomId, false);
    await silent.client.closed();
    await host.client.next('room.updated', (m) => m.room.members.find((member) => member.name === 'Bo')?.connected === false);
    expect(host.client.isOpen).toBe(true);
  });

  it('closes a socket that never says hello', async () => {
    ctx = await setup({ helloTimeoutMs: 40 });
    const client = await ctx.open(await ctx.signUp('Ann'));
    await client.closed();
  });
});
