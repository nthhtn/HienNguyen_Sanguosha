import { randomUUID } from 'node:crypto';
import type { BotPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import { TAKEOVER_AWAY_MS } from '../game/gameRunner';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import { RoomService, RoomServiceDeps } from './roomService';
import { FakeConnection } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const registry = buildContentRegistry();
const code = (value: string) => expect.objectContaining({ code: value });
const failing: BotPolicy = {
  id: 'failing',
  decide: () => {
    throw new Error('bot bug');
  },
};

async function setup(options: Partial<RoomServiceDeps> = {}) {
  const repos = createMemoryRepositories();
  const scheduler = new ManualScheduler(T0);
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 }, now: scheduler.clock, logError: jest.fn(), registry, buildId: 'test-build', randomSeed: () => 1234, scheduler, startHoldMs: 0, ...options });
  const registered = (name: string) =>
    repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(scheduler.now) });
  const guest = (name: string) => repos.users.createGuest({ displayName: name, now: new Date(scheduler.now) });
  const connect = async (user: UserRecord, roomId: string) => {
    const connection = new FakeConnection();
    const playerId = await rooms.connect(user, roomId, connection);
    return { connection, playerId };
  };
  const gameOf = async (roomId: string) => (await repos.games.listRunning()).find((g) => g.roomId === roomId)!;
  return { repos, rooms, scheduler, registered, guest, connect, gameOf };
}

describe('solo rooms', () => {
  it('seats the player with bots and starts at once, unlisted, paused until the player connects', async () => {
    const { rooms, repos, scheduler, guest, registered, connect, gameOf } = await setup();
    const gus = await guest('Gus');
    const id = await rooms.createSolo(gus, { seatCount: 3, rules: {} });
    const room = rooms.snapshot(gus, id);
    expect(room).toMatchObject({ visibility: 'solo', status: 'playing', hostPlayerId: null });
    expect(room.members.map((m) => [m.name, m.kind])).toEqual([
      ['Gus', 'human'],
      ['Bot 1', 'bot'],
      ['Bot 2', 'bot'],
    ]);
    expect(room.members.every((m) => m.seatId !== null)).toBe(true);
    expect(rooms.list(await registered('Ann')).rooms).toEqual([]);
    expect(rooms.list(gus).rooms.map((r) => r.id)).toEqual([id]);
    const game = await gameOf(id);
    await scheduler.advance(3_600_000);
    expect(await repos.games.listActions(game.id)).toEqual([]);
    const { connection } = await connect(gus, id);
    expect(connection.last('welcome')!.game).toMatchObject({ paused: false });
  });

  it('names the bots around a player called Bot 1', async () => {
    const { rooms, registered } = await setup();
    const user = await registered('Bot 1');
    const id = await rooms.createSolo(user, { seatCount: 3, rules: {} });
    expect(rooms.snapshot(user, id).members.map((m) => m.name)).toEqual(['Bot 1', 'Bot 2', 'Bot 3']);
  });

  it('refuses a second solo game while one runs, and replaces it when asked', async () => {
    const { rooms, repos, registered, connect, gameOf } = await setup();
    const ann = await registered('Ann');
    const first = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    const firstGame = await gameOf(first);
    const { connection } = await connect(ann, first);
    await expect(rooms.createSolo(ann, { seatCount: 2, rules: {} })).rejects.toEqual(code('solo_exists'));
    const second = await rooms.createSolo(ann, { seatCount: 4, rules: {}, replace: true });
    expect(second).not.toBe(first);
    expect(() => rooms.snapshot(ann, first)).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(await repos.games.findById(firstGame.id)).toMatchObject({ status: 'aborted' });
    expect(connection.last('room.left')).toEqual({ type: 'room.left', reason: 'left' });
    expect(rooms.snapshot(ann, second).seatCount).toBe(4);
  });

  it('replaces a solo room with no game running without asking', async () => {
    const { rooms, scheduler, registered, connect } = await setup({ botPolicy: failing });
    const ann = await registered('Ann');
    const first = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    await connect(ann, first);
    await scheduler.runUntil(() => rooms.snapshot(ann, first).status === 'lobby');
    const second = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    expect(() => rooms.snapshot(ann, first)).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(rooms.snapshot(ann, second).status).toBe('playing');
  });

  it("doesn't count toward the one open room a user may be in", async () => {
    const { rooms, registered } = await setup();
    const ann = await registered('Ann');
    await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    await expect(rooms.create(ann, { seatCount: 4, rules: {}, displayName: 'Ann' })).resolves.toEqual(expect.any(String));
  });

  it('starts again on Play Again, and closes on Back to Rooms', async () => {
    const { rooms, repos, scheduler, registered, connect } = await setup({ botPolicy: failing });
    const ann = await registered('Ann');
    const id = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    const { playerId } = await connect(ann, id);
    await scheduler.runUntil(() => rooms.snapshot(ann, id).status === 'lobby');
    await rooms.command(ann, id, playerId, { type: 'lobby.start' });
    expect(rooms.snapshot(ann, id).status).toBe('playing');
    const game = (await repos.games.listRunning()).find((g) => g.roomId === id)!;
    await rooms.command(ann, id, playerId, { type: 'room.leave' });
    expect(() => rooms.snapshot(ann, id)).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(await repos.games.findById(game.id)).toMatchObject({ status: 'aborted' });
  });

  it("stores a game's end that could not be stored yet when the room is replaced", async () => {
    const logError = jest.fn();
    const { rooms, repos, scheduler, registered, connect, gameOf } = await setup({ botPolicy: failing, logError });
    // The first transaction that marks a game broken fails, so its end stays pending.
    const transaction = repos.transaction.bind(repos);
    let failNext = true;
    jest.spyOn(repos, 'transaction').mockImplementation((work) =>
      transaction((tx) => {
        const update = tx.games.update.bind(tx.games);
        tx.games.update = async (gameId, changes) => {
          if (failNext && changes.status === 'broken') {
            failNext = false;
            throw new Error('store down');
          }
          return update(gameId, changes);
        };
        return work(tx);
      })
    );
    const ann = await registered('Ann');
    const id = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    const game = await gameOf(id);
    await connect(ann, id);
    await scheduler.runUntil(() => !failNext);
    expect(logError).toHaveBeenCalled();
    expect(rooms.snapshot(ann, id).status).toBe('playing');
    expect(await repos.games.findById(game.id)).toMatchObject({ status: 'running' });
    await rooms.createSolo(ann, { seatCount: 2, rules: {}, replace: true });
    expect(await repos.games.findById(game.id)).toMatchObject({ status: 'broken', result: null, finishedAt: expect.any(Date) });
    expect((await repos.rooms.listLive()).map((entry) => entry.room.id)).not.toContain(id);
  });

  it('pauses while the player is away, and never hands their seat to a bot', async () => {
    const { rooms, repos, scheduler, registered, connect, gameOf } = await setup();
    const ann = await registered('Ann');
    const id = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    const game = await gameOf(id);
    const { connection, playerId } = await connect(ann, id);
    await rooms.disconnect(id, playerId, connection);
    const stored = (await repos.games.listActions(game.id)).length;
    await scheduler.advance(2 * TAKEOVER_AWAY_MS);
    await rooms.tick();
    expect(await repos.games.listActions(game.id)).toHaveLength(stored);
    expect(rooms.snapshot(ann, id).members[0].botControlled).toBe(false);
  });

  it('refuses a seat count outside the limits', async () => {
    const { rooms, registered } = await setup();
    await expect(rooms.createSolo(await registered('Ann'), { seatCount: 9, rules: {} })).rejects.toEqual(code('invalid_seat_count'));
  });
});
