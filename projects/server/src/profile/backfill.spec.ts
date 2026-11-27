import { buildContentRegistry } from 'content';
import type { FinalSeatView } from 'protocol';
import { engineContext } from '../game/engineGame';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { GameRecord, SeatResultRecord } from '../persistence/records';
import { Repositories } from '../persistence/repositories';
import { RoomService } from '../rooms/roomService';
import { FakeConnection } from '../rooms/testing';
import { backfillSeatResults } from './backfill';
import { buildSeatResults } from './seatResults';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const registry = buildContentRegistry();
const ctx = engineContext(registry);

// Plays one real game with Ann and a bot to its end, and returns what the live path stored.
async function playOne() {
  const repos = createMemoryRepositories();
  const scheduler = new ManualScheduler(T0);
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 }, now: scheduler.clock, logError: jest.fn(), registry, buildId: 'test-build', randomSeed: () => 1234, scheduler, startHoldMs: 0 });
  const ann = await repos.users.createRegistered({ email: 'ann@example.com', passwordHash: 'h', displayName: 'Ann', now: new Date(T0) });
  const roomId = await rooms.create(ann, { seatCount: 2, rules: {}, displayName: 'Ann' });
  const connection = new FakeConnection();
  const playerId = await rooms.connect(ann, roomId, connection);
  await rooms.command(ann, roomId, playerId, { type: 'lobby.addBot' });
  await rooms.command(ann, roomId, playerId, { type: 'lobby.start' });
  const gameId = connection.game!.gameId;
  await rooms.disconnect(roomId, playerId, connection);
  await scheduler.runUntil(() => rooms.snapshot(ann, roomId).status === 'lobby', 50_000);
  const game = (await repos.games.findById(gameId))!;
  return { repos, ann, game, actions: await repos.games.listActions(gameId), live: await repos.games.listSeatResultsForUser(ann.id) };
}

// Copies a finished game into a fresh store, where it has no seat results.
async function copyUnrecorded(from: Awaited<ReturnType<typeof playOne>>, into: Repositories = createMemoryRepositories()): Promise<{ repos: Repositories; game: GameRecord }> {
  const repos = into;
  const user = (await repos.users.findByEmail('ann@example.com')) ?? (await repos.users.createRegistered({ email: 'ann@example.com', passwordHash: 'h', displayName: 'Ann', now: new Date(T0) }));
  const room = await repos.rooms.create({ visibility: 'open', seatCount: 2, rules: {}, now: new Date(T0) });
  const ids = new Map<string, string>();
  for (const seat of from.game.seats) {
    const player = await repos.rooms.addPlayer({ roomId: room.id, userId: seat.kind === 'human' ? user.id : null, kind: seat.kind, displayName: seat.name, ...(seat.botNameId ? { botNameId: seat.botNameId } : {}), now: new Date(T0) });
    ids.set(seat.roomPlayerId, player.id);
  }
  const seats = from.game.seats.map((s) => ({ ...s, roomPlayerId: ids.get(s.roomPlayerId)! }));
  const game = await repos.games.create({ roomId: room.id, seed: from.game.seed, seats, rules: from.game.rules, buildId: from.game.buildId, now: new Date(T0) });
  await repos.games.appendActions(game.id, 0, from.actions.map(({ seq, seatId, source, action, stateHash }) => ({ seq, seatId, source, action, stateHash })), new Date(T0));
  await repos.games.update(game.id, { status: 'finished', result: from.game.result, finishedAt: from.game.finishedAt });
  return { repos, game };
}

describe('buildSeatResults', () => {
  const finalSeats: FinalSeatView[] = [
    { seatId: 'seat-0', kingdom: 'Wei', allegiance: 'kingdom', mainGeneralId: 'cao-cao', deputyGeneralId: null, eliminated: false },
    { seatId: 'seat-1', kingdom: 'hidden', allegiance: null, mainGeneralId: null, deputyGeneralId: null, eliminated: true },
    { seatId: 'seat-2', kingdom: 'Shu', allegiance: 'kingdom', mainGeneralId: 'liu-bei', deputyGeneralId: 'guan-yu', eliminated: false },
  ];
  const result = { endedAt: 1, winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] };

  it('makes one row per seat that has a user, with the outcome from the result', () => {
    const rows: SeatResultRecord[] = buildSeatResults({ gameId: 'g', finalSeats, result, userIds: { 'seat-0': 'u0', 'seat-1': 'u1' } });
    expect(rows).toEqual([
      { gameId: 'g', seatId: 'seat-0', userId: 'u0', mainGeneralId: 'cao-cao', deputyGeneralId: null, kingdom: 'Wei', allegiance: 'kingdom', eliminated: false, won: true },
      { gameId: 'g', seatId: 'seat-1', userId: 'u1', mainGeneralId: null, deputyGeneralId: null, kingdom: 'hidden', allegiance: null, eliminated: true, won: false },
    ]);
  });

  it('gives won null when the result names neither a win nor a loss for the seat', () => {
    const [row] = buildSeatResults({ gameId: 'g', finalSeats, result, userIds: { 'seat-2': 'u2' } });
    expect(row.won).toBeNull();
  });
});

describe('backfillSeatResults', () => {
  it('fills the rows of a finished game that has none, the same as the live path stored them', async () => {
    const played = await playOne();
    expect(played.live).toHaveLength(1);
    const { repos, game } = await copyUnrecorded(played);
    const log = jest.fn();
    expect(await backfillSeatResults({ repos, ctx, log })).toEqual({ filled: 1, failed: 0 });
    const user = (await repos.users.findByEmail('ann@example.com'))!;
    const [row] = await repos.games.listSeatResultsForUser(user.id);
    expect(row).toMatchObject({ ...played.live[0], gameId: game.id, userId: user.id });
  }, 60_000);

  it('adds no duplicates when it runs twice', async () => {
    const { repos } = await copyUnrecorded(await playOne());
    await backfillSeatResults({ repos, ctx, log: jest.fn() });
    expect(await backfillSeatResults({ repos, ctx, log: jest.fn() })).toEqual({ filled: 0, failed: 0 });
    const user = (await repos.users.findByEmail('ann@example.com'))!;
    expect(await repos.games.listSeatResultsForUser(user.id)).toHaveLength(1);
  }, 60_000);

  it('logs a game that cannot replay, counts it as failed and still fills the others', async () => {
    const played = await playOne();
    const { repos } = await copyUnrecorded(played);
    await copyUnrecorded(played, repos);
    const log = jest.fn();
    const real = jest.requireActual<typeof import('../game/engineGame')>('../game/engineGame').replay;
    const replay = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('cannot replay');
      })
      .mockImplementation(real);
    expect(await backfillSeatResults({ repos, ctx, log, replay })).toEqual({ filled: 1, failed: 1 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('cannot be replayed'), expect.any(Error));
    const user = (await repos.users.findByEmail('ann@example.com'))!;
    expect(await repos.games.listSeatResultsForUser(user.id)).toHaveLength(1);
  }, 60_000);
});
