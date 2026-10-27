import { randomUUID } from 'node:crypto';
import { ruleBasedPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import { getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import type { GameState } from 'engine';
import { applyActions, drawSeats, engineContext, openingState, stateHash } from '../game/engineGame';
import { TAKEOVER_AWAY_MS } from '../game/gameRunner';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { Repositories, NewGameAction } from '../persistence/repositories';
import { UserRecord } from '../persistence/records';
import { RoomService } from './roomService';
import { FakeConnection } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const registry = buildContentRegistry();
const ctx = engineContext(registry);
// A seed whose game is still running after three bot-chosen actions (with
// seed 99 both players pick Shu Generals, and the game ends at once).
const SEED = 1;

function service(repos: Repositories, scheduler: ManualScheduler, buildId: string, logError = jest.fn()) {
  return new RoomService({ repos, seatLimits: { min: 2, max: 6 }, now: scheduler.clock, logError, registry, buildId, randomSeed: () => 1234, scheduler });
}

const registered = (repos: Repositories, name: string) =>
  repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(T0) });

async function connect(rooms: RoomService, user: UserRecord, roomId: string) {
  const connection = new FakeConnection();
  const playerId = await rooms.connect(user, roomId, connection);
  return { connection, playerId };
}

// Stores a playing open room (Ann and Bot 1) whose game has three bot-chosen
// actions, as a crash would leave it. `tamper` changes the second hash, and
// `badAction` replaces the third action with one the engine refuses.
async function storedGame(repos: Repositories, options: { buildId?: string; tamper?: boolean; badAction?: boolean; annLeft?: boolean } = {}) {
  const at = new Date(T0);
  const ann = await registered(repos, 'Ann');
  const room = await repos.rooms.create({ visibility: 'open', seatCount: 2, rules: {}, now: at });
  const host = await repos.rooms.addPlayer({ roomId: room.id, userId: ann.id, kind: 'human', displayName: 'Ann', now: at });
  const bot = await repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: new Date(T0 + 1) });
  await repos.rooms.update(room.id, { hostPlayerId: host.id, status: 'playing' }, at);
  const seats = drawSeats(
    [
      { id: host.id, name: 'Ann', kind: 'human' },
      { id: bot.id, name: 'Bot 1', kind: 'bot' },
    ],
    SEED
  );
  const game = await repos.games.create({ roomId: room.id, seed: SEED, seats, rules: {}, buildId: options.buildId ?? 'old-build', now: at });
  let state: GameState = openingState(ctx, SEED, seats, {});
  const rows: NewGameAction[] = [];
  for (let seq = 1; seq <= 3; seq += 1) {
    const seatId = getActiveSeatId(state)!;
    const action = ruleBasedPolicy.decide(redactStateForSeat(state, seatId), seatId, getLegalActions(state, seatId, registry), registry, null).action;
    state = applyActions(ctx, state, [action]).at(-1)!;
    rows.push({ seq, seatId, source: 'bot', action, stateHash: stateHash(state) });
  }
  if (options.tamper) rows[1] = { ...rows[1], stateHash: 'tampered' };
  if (options.badAction) rows[2] = { ...rows[2], action: { kind: 'RespondAction', seatId: rows[2].seatId, pendingResponseId: 'missing', cardInstanceId: 'missing' } };
  await repos.transaction((tx) => tx.games.appendActions(game.id, 0, rows, at));
  if (options.annLeft) await repos.rooms.markLeft(host.id, at);
  return { ann, roomId: room.id, game, hash: stateHash(state) };
}

describe('RoomService.restore', () => {
  it('restores a running game at the same point, every human away, and an open room takes over after 60 s (Review Focus 4)', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId, game } = await storedGame(repos, { buildId: 'test-build' });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    const room = rooms.snapshot(ann, roomId);
    expect(room.status).toBe('playing');
    expect(room.members.find((m) => m.name === 'Ann')).toMatchObject({ connected: false, botControlled: false });
    await scheduler.advance(TAKEOVER_AWAY_MS);
    await rooms.tick();
    expect(rooms.snapshot(ann, roomId).members.find((m) => m.name === 'Ann')!.botControlled).toBe(true);
    const { connection } = await connect(rooms, ann, roomId);
    expect(connection.last('welcome')!.game).toMatchObject({ gameId: game.id, logFrom: 0 });
    expect(connection.last('welcome')!.game!.seq).toBeGreaterThanOrEqual(3);
  });

  it('restores exactly the stored actions: the restored seq is the stored log length', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId } = await storedGame(repos, { buildId: 'test-build' });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    const { connection } = await connect(rooms, ann, roomId);
    const restored = connection.last('welcome')!.game!;
    // 3 stored actions; a bot may have moved since, and stored that too.
    expect((await repos.games.listActions(restored.gameId)).length).toBe(restored.seq);
  });

  it('trusts the replay on the same build even when a stored hash differs', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId } = await storedGame(repos, { buildId: 'test-build', tamper: true });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    expect(rooms.snapshot(ann, roomId).status).toBe('playing');
  });

  it('checks the hashes on another build, and continues when they match', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId } = await storedGame(repos, { buildId: 'old-build' });
    const rooms = service(repos, scheduler, 'new-build');
    await rooms.restore();
    expect(rooms.snapshot(ann, roomId).status).toBe('playing');
  });

  it("stops a game whose hash differs on another build: the room shows it can't continue (Review Focus 4)", async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const logError = jest.fn();
    const { ann, roomId, game } = await storedGame(repos, { buildId: 'old-build', tamper: true });
    const rooms = service(repos, scheduler, 'new-build', logError);
    await rooms.restore();
    const room = rooms.snapshot(ann, roomId);
    expect(room.status).toBe('lobby');
    expect(room.lastGame).toMatchObject({ gameId: game.id, outcome: 'outdated', result: null, finalSeats: [] });
    expect(await repos.games.findById(game.id)).toMatchObject({ status: 'broken' });
    expect(logError).toHaveBeenCalled();
  });

  it('stops a game whose stored action the engine refuses, whatever the build', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId } = await storedGame(repos, { buildId: 'test-build', badAction: true });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    expect(rooms.snapshot(ann, roomId).lastGame?.outcome).toBe('outdated');
  });

  it('ends a game with no humans left unfinished, and closes its room', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { roomId, game } = await storedGame(repos, { buildId: 'test-build', annLeft: true });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    expect((await repos.rooms.listLive()).map((entry) => entry.room.id)).not.toContain(roomId);
    expect(await repos.games.findById(game.id)).toMatchObject({ status: 'aborted' });
  });

  it('restores a solo game paused, and it resumes when the player returns', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const first = service(repos, scheduler, 'test-build');
    const ann = await registered(repos, 'Ann');
    const id = await first.createSolo(ann, { seatCount: 2, rules: {} });
    await first.stop();
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    const game = (await repos.games.listRunning()).find((g) => g.roomId === id)!;
    await scheduler.advance(3_600_000);
    expect(await repos.games.listActions(game.id)).toEqual([]);
    const { connection } = await connect(rooms, ann, id);
    expect(connection.last('welcome')!.game).toMatchObject({ paused: false });
  });

  it('stop() leaves no game timer behind', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const rooms = service(repos, scheduler, 'test-build');
    const ann = await registered(repos, 'Ann');
    const id = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    await connect(rooms, ann, id);
    expect(scheduler.pending).toBeGreaterThan(0);
    await rooms.stop();
    expect(scheduler.pending).toBe(0);
  });
});
