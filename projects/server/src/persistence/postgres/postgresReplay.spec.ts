import { randomUUID } from 'node:crypto';
import { buildContentRegistry } from 'content';
import { engineContext, openingState, replay, stateHash } from '../../game/engineGame';
import { playBots, reorderKeys } from '../../game/testing';
import { GameActionRecord, GameRecord, GameSeat } from '../records';
import { Repositories } from '../repositories';
import { createPostgresRepositories } from './postgresRepositories';
import { createTestDatabase } from './testDatabase';

// Needs a running Postgres: `npm run db:up`, then `npm run test:db`.
const adminUrl = process.env['TEST_DATABASE_URL'];
const describeWithDb = adminUrl ? describe : describe.skip;

describeWithDb('Replaying a game stored in Postgres', () => {
  const ctx = engineContext(buildContentRegistry());
  const NOW = new Date('2026-10-13T12:00:00Z');
  let repos: Repositories;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    const test = await createTestDatabase(adminUrl!);
    repos = createPostgresRepositories(test.db);
    drop = test.drop;
  });

  afterAll(() => drop());

  // jsonb keeps no key order, so the actions come back with their keys in
  // another order than they were stored in; every hash must still match.
  it.each([1, 2, 3])('replays a whole bot game (seed %i) read back from game_actions, checking every hash', async (seed) => {
    const seats: GameSeat[] = ['Ann', 'Bo', 'Cy', 'Di'].map((name, i) => ({ seatId: `seat-${i}`, roomPlayerId: randomUUID(), name, kind: 'bot' }));
    const room = await repos.rooms.create({ visibility: 'solo', seatCount: 4, rules: {}, now: NOW });
    const game = await repos.games.create({ roomId: room.id, seed, seats, rules: {}, buildId: 'build-1', now: NOW });
    const { state, moves } = playBots(ctx, openingState(ctx, seed, seats, {}), 3000);
    const rows = moves.map((move, i) => ({ seq: i + 1, seatId: move.seatId, source: 'bot' as const, action: move.action, stateHash: stateHash(move.after) }));
    await repos.transaction((tx) => tx.games.appendActions(game.id, 0, rows, NOW));

    const stored = await repos.games.listActions(game.id);
    expect(stored).toHaveLength(moves.length);
    const replayed = replay(ctx, (await repos.games.findById(game.id))!, stored, true);
    expect(stateHash(replayed)).toBe(stateHash(state));
  });
});

describe('Replaying a short recorded game', () => {
  const ctx = engineContext(buildContentRegistry());

  it('a plain game that touches none of the changed situations replays to identical state hashes', () => {
    const seed = 7;
    const seats: GameSeat[] = ['Ann', 'Bo', 'Cy', 'Di'].map((name, i) => ({ seatId: `seat-${i}`, roomPlayerId: randomUUID(), name, kind: 'bot' }));
    const { state, moves } = playBots(ctx, openingState(ctx, seed, seats, {}), 60);
    const rows = moves.map((move, i) => ({ seq: i + 1, seatId: move.seatId, source: 'bot' as const, action: reorderKeys(move.action), stateHash: stateHash(move.after) }));
    const game = { seed, seats, rules: {} } as GameRecord;

    expect(rows.length).toBeGreaterThan(0);
    expect(stateHash(replay(ctx, game, rows as unknown as GameActionRecord[], true))).toBe(stateHash(state));
  });
});
