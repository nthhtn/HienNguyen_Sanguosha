import { randomUUID } from 'node:crypto';
import { buildContentRegistry } from 'content';
import type { ChatMessage } from 'protocol';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import { LOBBY_IDLE_MS, ROOM_TICK_MS, RoomService } from './roomService';
import { FakeConnection } from './testing';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const registry = buildContentRegistry();
const code = (value: string) => expect.objectContaining({ code: value });

async function setup() {
  const repos = createMemoryRepositories();
  const scheduler = new ManualScheduler(T0);
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 }, now: scheduler.clock, logError: jest.fn(), registry, buildId: 'test-build', randomSeed: () => 1234, scheduler });
  const registered = (name: string) =>
    repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(scheduler.now) });
  const guest = (name: string) => repos.users.createGuest({ displayName: name, now: new Date(scheduler.now) });
  const connect = async (user: UserRecord, roomId: string) => {
    const connection = new FakeConnection();
    const playerId = await rooms.connect(user, roomId, connection);
    return { user, connection, playerId };
  };
  type Seat = Awaited<ReturnType<typeof connect>>;
  const say = (seat: Seat, roomId: string, body: string) => rooms.command(seat.user, roomId, seat.playerId, { type: 'chat.send', body });
  const chatsOf = (connection: FakeConnection): ChatMessage[] =>
    connection.sent.flatMap((m) => (m.type === 'chat.message' ? [{ id: m.id, from: m.from, body: m.body, at: m.at }] : []));
  // Ann (registered host) and Bo, in a two-seat room, with only Ann connected.
  const lobby = async () => {
    const annUser = await registered('Ann');
    const boUser = await registered('Bo');
    const roomId = await rooms.create(annUser, { seatCount: 2, rules: {}, displayName: 'Ann' });
    await rooms.join(boUser, roomId, 'Bo');
    return { annUser, boUser, roomId, a: await connect(annUser, roomId) };
  };
  return { repos, rooms, scheduler, registered, guest, connect, say, chatsOf, lobby };
}

describe('chat in a room', () => {
  it('sends a stored message to every connected member, the sender included', async () => {
    const { repos, say, chatsOf, connect, lobby } = await setup();
    const { boUser, roomId, a } = await lobby();
    const b = await connect(boUser, roomId);
    await say(a, roomId, '  hello   Bo ');
    const expected = [{ id: expect.any(Number), from: { playerId: a.playerId, name: 'Ann' }, body: 'hello Bo', at: T0 }];
    expect(chatsOf(a.connection)).toEqual(expected);
    expect(chatsOf(b.connection)).toEqual(expected);
    expect((await repos.chat.listRecent(roomId, 10)).map((m) => m.body)).toEqual(['hello Bo']);
  });

  it('gives a member who connects later the recent messages, oldest first, in the welcome', async () => {
    const { say, connect, lobby } = await setup();
    const { boUser, roomId, a } = await lobby();
    await say(a, roomId, 'one');
    await say(a, roomId, 'two');
    const b = await connect(boUser, roomId);
    expect(b.connection.last('welcome')!.chat.map((m) => m.body)).toEqual(['one', 'two']);
  });

  it('refuses a stranger who uses a member player id, and stores and sends nothing (Review Focus 3)', async () => {
    const { rooms, registered, repos, chatsOf, lobby } = await setup();
    const { roomId, a } = await lobby();
    const stranger = await registered('Eve');
    await expect(rooms.command(stranger, roomId, a.playerId, { type: 'chat.send', body: 'hi' })).rejects.toEqual(code('not_member'));
    expect(await repos.chat.listRecent(roomId, 10)).toEqual([]);
    expect(chatsOf(a.connection)).toEqual([]);
  });

  it('refuses a message once the sender has left the room (Review Focus 3)', async () => {
    const { rooms, say, connect, lobby } = await setup();
    const { boUser, roomId, a } = await lobby();
    const b = await connect(boUser, roomId);
    await rooms.command(b.user, roomId, b.playerId, { type: 'room.leave' });
    await expect(say(b, roomId, 'still here?')).rejects.toEqual(code('not_member'));
    await expect(say(a, roomId, 'now alone')).resolves.toBeUndefined();
  });

  it('has no chat in a solo room: refused, and an empty history in the welcome (Review Focus 3)', async () => {
    const { rooms, guest, connect, say } = await setup();
    const gus = await guest('Gus');
    const roomId = await rooms.createSolo(gus, { seatCount: 3, rules: {} });
    const g = await connect(gus, roomId);
    expect(g.connection.last('welcome')!.chat).toEqual([]);
    await expect(say(g, roomId, 'anyone?')).rejects.toEqual(code('chat_unavailable'));
  });

  it('refuses the empty, the over-long and the too-fast with their codes (Review Focus 1 and 2)', async () => {
    const { say, lobby } = await setup();
    const { roomId, a } = await lobby();
    await expect(say(a, roomId, '   ')).rejects.toEqual(code('chat_empty'));
    await expect(say(a, roomId, 'x'.repeat(301))).rejects.toEqual(code('chat_too_long'));
    for (let i = 0; i < 5; i += 1) await say(a, roomId, `m${i}`);
    await expect(say(a, roomId, 'sixth')).rejects.toEqual(code('chat_rate_limited'));
  });

  it("records the game and the action count a message followed", async () => {
    const { rooms, repos, say, connect, lobby } = await setup();
    const { boUser, roomId, a } = await lobby();
    await connect(boUser, roomId);
    await say(a, roomId, 'before');
    await rooms.command(a.user, roomId, a.playerId, { type: 'lobby.start' });
    const game = (await repos.games.listRunning())[0];
    await say(a, roomId, 'during');
    const [before, during] = await repos.chat.listRecent(roomId, 10);
    expect([before.gameId, before.afterSeq]).toEqual([null, null]);
    expect([during.gameId, during.afterSeq]).toEqual([game.id, 0]);
  });

  it('counts as activity, so a lobby where people talk is not idle', async () => {
    const { rooms, scheduler, say, lobby } = await setup();
    const { roomId, a } = await lobby();
    await scheduler.advance(LOBBY_IDLE_MS - ROOM_TICK_MS);
    await say(a, roomId, 'still here');
    await scheduler.advance(2 * ROOM_TICK_MS);
    await rooms.tick();
    expect(rooms.snapshot(a.user, roomId).status).toBe('lobby');
  });
});
