import { randomUUID } from 'node:crypto';
import type { BotPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import type { RoomCommand } from 'protocol';
import { TAKEOVER_AWAY_MS } from '../game/gameRunner';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import { RoomService, RoomServiceDeps } from './roomService';
import { FakeConnection } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const LIMITS = { min: 2, max: 6 };
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
  const logError = jest.fn();
  const rooms = new RoomService({
    repos,
    seatLimits: LIMITS,
    now: scheduler.clock,
    logError,
    registry,
    buildId: 'test-build',
    randomSeed: () => 1234,
    scheduler,
    ...options,
  });
  const registered = (name: string) =>
    repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(scheduler.now) });
  const guest = (name: string) => repos.users.createGuest({ displayName: name, now: new Date(scheduler.now) });
  const connect = async (user: UserRecord, roomId: string) => {
    const connection = new FakeConnection();
    const playerId = await rooms.connect(user, roomId, connection);
    return { user, connection, playerId };
  };
  type Seat = Awaited<ReturnType<typeof connect>>;
  const command = (seat: Seat, roomId: string, message: RoomCommand) => rooms.command(seat.user, roomId, seat.playerId, message);
  const start = (seat: Seat, roomId: string) => command(seat, roomId, { type: 'lobby.start' });
  // Ann (registered host) and Bo, both connected, in a two-seat room.
  const pair = async (bo: 'registered' | 'guest' = 'registered') => {
    const annUser = await registered('Ann');
    const boUser = bo === 'registered' ? await registered('Bo') : await guest('Bo');
    const roomId = await rooms.create(annUser, { seatCount: 2, rules: {}, displayName: 'Ann' });
    await rooms.join(boUser, roomId, 'Bo');
    return { roomId, a: await connect(annUser, roomId), b: await connect(boUser, roomId) };
  };
  // Ann (registered host, connected) and Bot 1 in a two-seat room.
  const withBot = async () => {
    const annUser = await registered('Ann');
    const roomId = await rooms.create(annUser, { seatCount: 2, rules: {}, displayName: 'Ann' });
    const a = await connect(annUser, roomId);
    await command(a, roomId, { type: 'lobby.addBot' });
    return { roomId, a };
  };
  // Whichever of these seats has moves offered now.
  const mover = (...seats: Seat[]) => seats.find((s) => (s.connection.game?.legalActions.length ?? 0) > 0)!;
  return { repos, rooms, scheduler, logError, registered, guest, connect, command, start, pair, withBot, mover };
}

describe('RoomService games', () => {
  it('starts a full room for its host: seats drawn at random, and each member gets their own view', async () => {
    const { repos, pair, start } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    const room = a.connection.room!;
    expect(room.status).toBe('playing');
    expect(room.members.map((m) => m.seatId).sort()).toEqual(['seat-0', 'seat-1']);
    const annSeat = room.members.find((m) => m.playerId === a.playerId)!.seatId!;
    expect(a.connection.game).toMatchObject({ seq: 0, logFrom: 0, paused: false });
    expect(a.connection.game!.view).not.toHaveProperty('rng');
    expect(a.connection.game!.view.players.find((p) => p.seatId === annSeat)?.name).toBe('Ann');
    expect([a, b].filter((s) => s.connection.game!.legalActions.length > 0)).toHaveLength(1);
    const [game] = await repos.games.listRunning();
    expect(game).toMatchObject({ roomId, seed: 1234, buildId: 'test-build', status: 'running' });
    expect(game.seats.map((s) => s.name).sort()).toEqual(['Ann', 'Bo']);
  });

  it('stores the judgment notice on every started game, while the room rules stay as chosen', async () => {
    const { repos, pair, start } = await setup();
    const { roomId, a } = await pair();
    await start(a, roomId);
    const [game] = await repos.games.listRunning();
    expect(game.rules).toEqual({ judgmentNotice: true });
    expect(a.connection.room!.rules).toEqual({});
  });

  it('deals a started game from the deck the room chose', async () => {
    const { repos, rooms, registered, guest, connect, start } = await setup();
    const annUser = await registered('Ann');
    const roomId = await rooms.create(annUser, { seatCount: 2, rules: { deck: 'alternate' }, displayName: 'Ann' });
    await rooms.join(await guest('Bo'), roomId, 'Bo');
    const a = await connect(annUser, roomId);
    await start(a, roomId);
    const [game] = await repos.games.listRunning();
    expect(game.rules).toEqual({ deck: 'alternate', judgmentNotice: true });
    expect(a.connection.room!.rules).toEqual({ deck: 'alternate' });
  });

  it('refuses Start Game from a member who is not the host, and while a game runs', async () => {
    const { pair, start } = await setup();
    const { roomId, a, b } = await pair();
    await expect(start(b, roomId)).rejects.toEqual(code('not_host'));
    await start(a, roomId);
    await expect(start(a, roomId)).rejects.toEqual(code('in_progress'));
  });

  it('refuses Start Game until every seat is filled', async () => {
    const { rooms, registered, connect, start } = await setup();
    const ann = await registered('Ann');
    const roomId = await rooms.create(ann, { seatCount: 3, rules: {}, displayName: 'Ann' });
    const a = await connect(ann, roomId);
    await expect(start(a, roomId)).rejects.toEqual(code('not_full'));
  });

  it("applies a member's move, stores it, and sends everyone the new events", async () => {
    const { repos, pair, start, command, mover } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    const seat = mover(a, b);
    const before = seat.connection.game!;
    const move = before.legalActions[0];
    await command(seat, roomId, { type: 'game.submit', gameId: before.gameId, baseSeq: 0, actions: [move] });
    for (const each of [a, b]) expect(each.connection.game).toMatchObject({ seq: 1, logFrom: before.events.length });
    expect(await repos.games.listActions(before.gameId)).toEqual([expect.objectContaining({ seq: 1, source: 'human', action: move })]);
  });

  it('refuses a move out of turn or stale, and game messages with no game running', async () => {
    const { pair, start, command, mover } = await setup();
    const { roomId, a, b } = await pair();
    const someGame = randomUUID();
    await expect(command(a, roomId, { type: 'game.submit', gameId: someGame, baseSeq: 0, actions: [{ kind: 'EndPhaseAction', seatId: 'seat-0' }] })).rejects.toEqual(code('no_game'));
    await expect(command(a, roomId, { type: 'game.resync' })).rejects.toEqual(code('no_game'));
    await start(a, roomId);
    const seat = mover(a, b);
    const other = seat === a ? b : a;
    const { gameId, legalActions } = seat.connection.game!;
    await expect(command(other, roomId, { type: 'game.submit', gameId, baseSeq: 0, actions: [legalActions[0]] })).rejects.toEqual(code('not_your_turn'));
    await expect(command(seat, roomId, { type: 'game.submit', gameId, baseSeq: 3, actions: [legalActions[0]] })).rejects.toEqual(code('stale'));
  });

  it('answers game.resync with the full game again', async () => {
    const { pair, start, command } = await setup();
    const { roomId, a } = await pair();
    await start(a, roomId);
    const first = a.connection.last('game.update')!;
    await command(a, roomId, { type: 'game.resync' });
    const again = a.connection.last('game.update')!;
    expect(again).not.toBe(first);
    expect(again.game).toEqual(first.game);
  });

  it('welcomes a returning member with their seat and the whole game', async () => {
    const { rooms, pair, start, connect } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    await rooms.disconnect(roomId, b.playerId, b.connection);
    const back = await connect(b.user, roomId);
    const seatId = a.connection.room!.members.find((m) => m.playerId === b.playerId)!.seatId;
    const welcome = back.connection.last('welcome')!;
    expect(welcome.you).toEqual({ playerId: b.playerId, seatId });
    expect(welcome.game).toMatchObject({ logFrom: 0, seq: 0 });
  });

  it("hands an away member's seat to a bot after 60 s, and gives it back when they return", async () => {
    const { rooms, scheduler, pair, start, connect } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    await rooms.disconnect(roomId, b.playerId, b.connection);
    await scheduler.advance(TAKEOVER_AWAY_MS);
    await rooms.tick();
    const bo = () => a.connection.room!.members.find((m) => m.playerId === b.playerId)!;
    expect(bo().botControlled).toBe(true);
    const back = await connect(b.user, roomId);
    expect(bo().botControlled).toBe(false);
    expect(back.connection.last('welcome')!.room.members.find((m) => m.playerId === b.playerId)!.botControlled).toBe(false);
  });

  it('lets a member leave a running game: a bot plays their seat, and the host role passes', async () => {
    const { repos, scheduler, pair, start, command } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await command(a, roomId, { type: 'room.leave' });
    expect(b.connection.room).toMatchObject({ status: 'playing', hostPlayerId: b.playerId });
    expect(b.connection.room!.members.map((m) => m.name)).toEqual(['Bo']);
    const tookOver = async () => (await repos.games.listActions(gameId)).some((x) => x.source === 'takeover');
    for (let i = 0; i < 100 && !(await tookOver()); i += 1) await scheduler.advance(10_000);
    expect(await tookOver()).toBe(true);
  });

  it('ends the game and closes the room when the last human leaves (Review Focus 5)', async () => {
    const { rooms, repos, scheduler, withBot, start, command } = await setup();
    const { roomId, a } = await withBot();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await command(a, roomId, { type: 'room.leave' });
    expect(rooms.list(a.user).rooms).toEqual([]);
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'aborted', finishedAt: expect.any(Date) });
    const stored = (await repos.games.listActions(gameId)).length;
    expect(scheduler.pending).toBe(0);
    await scheduler.advance(3_600_000);
    expect(await repos.games.listActions(gameId)).toHaveLength(stored);
  });

  it('returns the room to the lobby with the result when the game ends, keeping its members', async () => {
    const { rooms, repos, scheduler, withBot, start, connect } = await setup();
    const { roomId, a } = await withBot();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    // Away, Ann times out twice and a bot takes her seat; the bots finish the game.
    await rooms.disconnect(roomId, a.playerId, a.connection);
    await scheduler.runUntil(() => rooms.snapshot(a.user, roomId).status === 'lobby', 50_000);
    const room = rooms.snapshot(a.user, roomId);
    expect(room.members.map((m) => m.name)).toEqual(['Ann', 'Bot 1']);
    expect(room.members.every((m) => m.seatId === null && !m.botControlled)).toBe(true);
    expect(room.lastGame).toMatchObject({ gameId, outcome: 'finished', result: expect.objectContaining({ winningSeatIds: expect.any(Array) }) });
    expect(room.lastGame!.seats.map((s) => s.name).sort()).toEqual(['Ann', 'Bot 1']);
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'finished', result: room.lastGame!.result, finishedAt: expect.any(Date) });
    const back = await connect(a.user, roomId);
    expect(back.connection.last('welcome')).toMatchObject({ game: null, you: { seatId: null } });
  }, 60_000);

  it("retries storing the game's end on the room tick when the store fails", async () => {
    const { rooms, repos, scheduler, logError, withBot, start } = await setup();
    // The first transaction that marks a game finished fails.
    const transaction = repos.transaction.bind(repos);
    let failNext = true;
    jest.spyOn(repos, 'transaction').mockImplementation((work) =>
      transaction((tx) => {
        const update = tx.games.update.bind(tx.games);
        tx.games.update = async (gameId, changes) => {
          if (failNext && changes.status === 'finished') {
            failNext = false;
            throw new Error('store down');
          }
          return update(gameId, changes);
        };
        return work(tx);
      })
    );
    const { roomId, a } = await withBot();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await rooms.disconnect(roomId, a.playerId, a.connection);
    await scheduler.runUntil(() => !failNext, 50_000);
    expect(failNext).toBe(false);
    expect(rooms.snapshot(a.user, roomId).status).toBe('playing');
    expect(logError).toHaveBeenCalled();
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'running' });
    await rooms.tick();
    const room = rooms.snapshot(a.user, roomId);
    expect(room.status).toBe('lobby');
    expect(room.lastGame).toMatchObject({ gameId, outcome: 'finished' });
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'finished', result: room.lastGame!.result });
  }, 60_000);

  it('gives a host who is away when the game ends 60 s before the role passes', async () => {
    const { rooms, scheduler, pair, start } = await setup({ botPolicy: failing });
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    await rooms.disconnect(roomId, a.playerId, a.connection);
    // The failing bot breaks the game as soon as one plays: Ann's seat, once she has been away 60 s.
    await scheduler.advance(TAKEOVER_AWAY_MS);
    await rooms.tick();
    await scheduler.runUntil(() => b.connection.room!.status === 'lobby');
    expect(b.connection.room!.hostPlayerId).toBe(a.playerId);
    await rooms.tick();
    expect(b.connection.room!.hostPlayerId).toBe(a.playerId);
    await scheduler.advance(60_000);
    await rooms.tick();
    expect(b.connection.room!.hostPlayerId).toBe(b.playerId);
  });

  it('marks the game broken when a bot fails, and returns the room to the lobby', async () => {
    const { repos, scheduler, logError, withBot, start } = await setup({ botPolicy: failing });
    const { roomId, a } = await withBot();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await scheduler.runUntil(() => a.connection.room!.status === 'lobby');
    expect(a.connection.room!.lastGame).toMatchObject({ gameId, outcome: 'broken', result: null });
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'broken' });
    expect(logError).toHaveBeenCalled();
  });

  it("a finished game's lastGame carries a summary of every seat", async () => {
    const { rooms, scheduler, withBot, start } = await setup();
    const { roomId, a } = await withBot();
    await start(a, roomId);
    await rooms.disconnect(roomId, a.playerId, a.connection);
    await scheduler.runUntil(() => rooms.snapshot(a.user, roomId).status === 'lobby', 50_000);
    const lastGame = rooms.snapshot(a.user, roomId).lastGame!;
    expect(lastGame.outcome).toBe('finished');
    expect(lastGame.finalSeats).toHaveLength(2);
    expect(lastGame.finalSeats.map((s) => s.seatId)).toEqual(lastGame.seats.map((s) => s.seatId));
    for (const seat of lastGame.finalSeats) {
      expect(seat.mainGeneralId).not.toBeNull();
      expect(seat.deputyGeneralId).not.toBeNull();
    }
  }, 60_000);

  it("a stopped game's lastGame has no summary", async () => {
    const { scheduler, withBot, start } = await setup({ botPolicy: failing });
    const { roomId, a } = await withBot();
    await start(a, roomId);
    await scheduler.runUntil(() => a.connection.room!.status === 'lobby');
    expect(a.connection.room!.lastGame).toMatchObject({ outcome: 'broken', finalSeats: [] });
  });

  it('closes the room when its game ends with no registered member left to host', async () => {
    const { rooms, repos, scheduler, pair, start, command } = await setup();
    const { roomId, a, b } = await pair('guest');
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await command(a, roomId, { type: 'room.leave' });
    expect(b.connection.room!.hostPlayerId).toBeNull();
    await rooms.disconnect(roomId, b.playerId, b.connection);
    await scheduler.runUntil(() => rooms.list(b.user).rooms.length === 0, 50_000);
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'finished' });
    expect((await repos.rooms.listLive()).map((entry) => entry.room.id)).not.toContain(roomId);
  }, 60_000);
});
