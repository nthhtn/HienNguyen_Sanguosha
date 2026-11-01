import { buildContentRegistry } from 'content';
import { getActiveSeatId, getLegalActions } from 'engine';
import type { Action, GameState } from 'engine';
import { GameActionRecord, GameRecord, GameSeat } from '../persistence/records';
import { toGameUpdate, toSeatView } from '../views/game';
import { applyActions, applyMove, drawSeats, engineContext, IllegalMoveError, openingState, replay, stateHash } from './engineGame';
import { playBots, reorderKeys } from './testing';

const registry = buildContentRegistry();
const ctx = engineContext(registry);
const SEED = 1234;
const SEATS: GameSeat[] = [
  { seatId: 'seat-0', roomPlayerId: 'p-ann', name: 'Ann', kind: 'human' },
  { seatId: 'seat-1', roomPlayerId: 'p-bot', name: 'Bot 1', kind: 'bot' },
];

// Plays `count` moves, the rule-based bot choosing for whoever must act.
const botMoves = (state: GameState, count: number) => playBots(ctx, state, count);

const record = (): GameRecord => ({
  id: 'game-1',
  roomId: 'room-1',
  seed: SEED,
  seats: SEATS,
  rules: {},
  buildId: 'build-1',
  status: 'running',
  result: null,
  actionCount: 0,
  startedAt: new Date(0),
  finishedAt: null,
});

describe('engineGame', () => {
  describe('drawSeats', () => {
    const members = ['Ann', 'Bo', 'Cy', 'Di'].map((name) => ({ id: `p-${name}`, name, kind: 'human' as const }));

    it('seats every member once, as seat-0, seat-1, … in a seeded order', () => {
      const seats = drawSeats(members, 7);
      expect(seats.map((s) => s.seatId)).toEqual(['seat-0', 'seat-1', 'seat-2', 'seat-3']);
      expect(seats.map((s) => s.roomPlayerId).sort()).toEqual(members.map((m) => m.id).sort());
      expect(drawSeats(members, 7)).toEqual(seats);
      expect(seats[0]).toEqual({ seatId: 'seat-0', roomPlayerId: expect.any(String), name: expect.any(String), kind: 'human' });
    });

    it('does not always keep the join order', () => {
      const orders = new Set(Array.from({ length: 20 }, (_, seed) => drawSeats(members, seed).map((s) => s.name).join(',')));
      expect(orders.size).toBeGreaterThan(1);
    });
  });

  describe('openingState', () => {
    it("gives each seat its member's name and kind, the same way for the same seed", () => {
      const state = openingState(ctx, SEED, SEATS, {});
      expect(state.players.map((p) => ({ seatId: p.seatId, name: p.name, kind: p.kind }))).toEqual([
        { seatId: 'seat-0', name: 'Ann', kind: 'human' },
        { seatId: 'seat-1', name: 'Bot 1', kind: 'bot' },
      ]);
      expect(stateHash(openingState(ctx, SEED, SEATS, {}))).toBe(stateHash(state));
      expect(stateHash(state)).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('stateHash', () => {
    it('does not depend on the order of object keys, but does on array order and values', () => {
      const { state } = botMoves(openingState(ctx, SEED, SEATS, {}), 40);
      expect(stateHash(reorderKeys(state))).toBe(stateHash(state));
      expect(stateHash({ ...state, players: [...state.players].reverse() })).not.toBe(stateHash(state));
      expect(stateHash({ ...state, rng: { ...state.rng, extra: 1 } } as GameState)).not.toBe(stateHash(state));
    });

    it('skips keys whose value is undefined, as JSON does', () => {
      const state = openingState(ctx, SEED, SEATS, {});
      expect(stateHash({ ...state, extra: undefined } as GameState)).toBe(stateHash(state));
    });
  });

  describe('applyMove', () => {
    const opening = () => openingState(ctx, SEED, SEATS, {});

    it('applies an offered move and returns the state after each action', () => {
      const state = opening();
      const [move] = getLegalActions(state, 'seat-0', registry);
      const steps = applyMove(ctx, state, 'seat-0', [move]);
      expect(steps).toHaveLength(1);
      expect(getActiveSeatId(steps[0])).toBe('seat-1');
      expect(stateHash(steps[0])).not.toBe(stateHash(state));
    });

    it('accepts a General choice from a seat other than the first one still choosing', () => {
      const state = opening();
      const [move] = getLegalActions(state, 'seat-1', registry);
      expect(move.kind).toBe('ChooseGeneralsAction');
      const steps = applyMove(ctx, state, 'seat-1', [move]);
      expect(steps[0].generalSelection?.candidates).not.toHaveProperty('seat-1');
      expect(steps[0].generalSelection?.candidates).toHaveProperty('seat-0');
    });

    it('refuses an action the engine did not offer, such as drawing cards (Review Focus 1)', () => {
      expect(() => applyMove(ctx, opening(), 'seat-0', [{ kind: 'DrawCardsAction', seatId: 'seat-0', count: 5 }])).toThrow(IllegalMoveError);
    });

    it('refuses a move for a seat that is not the one to act, or that names another seat', () => {
      const state = opening();
      const [move] = getLegalActions(state, 'seat-0', registry);
      expect(() => applyMove(ctx, state, 'seat-1', [move])).toThrow(IllegalMoveError);
      expect(() => applyMove(ctx, state, 'seat-0', [{ ...move, seatId: 'seat-1' } as Action])).toThrow(IllegalMoveError);
    });

    it('changes nothing when a later action is refused (Review Focus 2)', () => {
      const state = opening();
      const before = stateHash(state);
      const [move] = getLegalActions(state, 'seat-0', registry);
      expect(() => applyMove(ctx, state, 'seat-0', [move, move])).toThrow(IllegalMoveError);
      expect(stateHash(state)).toBe(before);
    });
  });

  describe('applyActions', () => {
    it('throws what the engine throws', () => {
      expect(() => applyActions(ctx, openingState(ctx, SEED, SEATS, {}), [{ kind: 'EndPhaseAction', seatId: 'seat-0' }])).toThrow('general selection');
    });
  });

  describe('replay', () => {
    const stored = (moves: ReturnType<typeof botMoves>['moves']): GameActionRecord[] =>
      moves.map((move, i) => ({ gameId: 'game-1', seq: i + 1, seatId: move.seatId, source: 'bot', action: move.action, stateHash: stateHash(move.after), createdAt: new Date(0) }));

    it('rebuilds the same state from the stored actions, checking every hash', () => {
      const { state, moves } = botMoves(openingState(ctx, SEED, SEATS, {}), 30);
      expect(stateHash(replay(ctx, record(), stored(moves), true))).toBe(stateHash(state));
    });

    it('checks hashes of actions read back with their object keys in another order, as jsonb does', () => {
      const seats4: GameSeat[] = ['Ann', 'Bo', 'Cy', 'Di'].map((name, i) => ({ seatId: `seat-${i}`, roomPlayerId: `p-${name}`, name, kind: 'bot' }));
      for (const seed of [1, 2, 3, 4]) {
        const { state, moves } = botMoves(openingState(ctx, seed, seats4, {}), 400);
        const game = { ...record(), seed, seats: seats4 };
        const readBack = stored(moves).map((row) => ({ ...row, action: reorderKeys(row.action) }));
        expect(stateHash(replay(ctx, game, readBack, true))).toBe(stateHash(state));
      }
    });

    it('rebuilds a game played with the judgment notice, acknowledgements included', () => {
      const seats4: GameSeat[] = ['Ann', 'Bo', 'Cy', 'Di'].map((name, i) => ({ seatId: `seat-${i}`, roomPlayerId: `p-${name}`, name, kind: 'bot' }));
      let acknowledgements = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const rules = { judgmentNotice: true };
        const { state, moves } = botMoves(openingState(ctx, seed, seats4, rules), 600);
        acknowledgements += moves.filter((m) => m.action.kind === 'AcknowledgeJudgmentAction').length;
        const game = { ...record(), seed, seats: seats4, rules };
        const readBack = stored(moves).map((row) => ({ ...row, action: reorderKeys(row.action) }));
        expect(stateHash(replay(ctx, game, readBack, true))).toBe(stateHash(state));
        expect(state.judgmentView?.settled === true && !state.result).toBe(false);
      }
      expect(acknowledgements).toBeGreaterThan(0);
    });

    it('replays a game stored without logPasses with the same hashes', () => {
      const seats4: GameSeat[] = ['Ann', 'Bo', 'Cy', 'Di'].map((name, i) => ({ seatId: `seat-${i}`, roomPlayerId: `p-${name}`, name, kind: 'bot' }));
      let passes = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const rules = { judgmentNotice: true };
        const { state, moves } = botMoves(openingState(ctx, seed, seats4, rules), 600);
        passes += moves.filter((m) => m.action.kind === 'PassAction').length;
        const game = { ...record(), seed, seats: seats4, rules };
        const replayed = replay(ctx, game, stored(moves), true);
        expect(stateHash(replayed)).toBe(stateHash(state));
        expect(replayed.log.some((e) => e.kind === 'ResponsePassedEvent')).toBe(false);
      }
      expect(passes).toBeGreaterThan(0);
    });

    it('throws on a hash that differs when checking, and trusts it when not', () => {
      const { moves } = botMoves(openingState(ctx, SEED, SEATS, {}), 10);
      const actions = stored(moves);
      actions[4] = { ...actions[4], stateHash: 'tampered' };
      expect(() => replay(ctx, record(), actions, true)).toThrow('State hash differs after action 5');
      expect(() => replay(ctx, record(), actions, false)).not.toThrow();
    });

    it('throws on a gap in the actions', () => {
      const { moves } = botMoves(openingState(ctx, SEED, SEATS, {}), 3);
      expect(() => replay(ctx, record(), stored(moves).filter((a) => a.seq !== 2), false)).toThrow('Action 2 is missing');
    });
  });

  describe('views', () => {
    it("shows a seat its own hand and masks the other's, without the RNG or the log", () => {
      const { state } = botMoves(openingState(ctx, SEED, SEATS, {}), 2);
      const view = toSeatView(state, 'seat-0');
      expect(view).not.toHaveProperty('rng');
      expect(view).not.toHaveProperty('log');
      const hand = (seatId: string) => view.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === seatId)!.cards;
      expect(hand('seat-1').length).toBeGreaterThan(0);
      expect(hand('seat-1').every((card) => card.definitionId === 'hidden')).toBe(true);
      expect(hand('seat-0').some((card) => card.definitionId !== 'hidden')).toBe(true);
    });

    it('carries the log from logFrom, and the given legal actions and clock', () => {
      const { state } = botMoves(openingState(ctx, SEED, SEATS, {}), 2);
      const update = toGameUpdate({ gameId: 'game-1', seq: 2, state, seatId: 'seat-0', legalActions: [], logFrom: 1, clock: null, paused: false });
      expect(update.events).toEqual(state.log.slice(1));
      expect(update).toMatchObject({ gameId: 'game-1', seq: 2, logFrom: 1, legalActions: [], clock: null, paused: false });
    });
  });
});
