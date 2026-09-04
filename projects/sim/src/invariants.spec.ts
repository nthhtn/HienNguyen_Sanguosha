import { checkInvariants } from './invariants';
import type { CardInstance, GameState } from 'engine';

function card(instanceId: string): CardInstance {
  return { instanceId, definitionId: 'sha', suit: 'spade', rank: 1 };
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
    ],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [], pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
    ...overrides,
  };
}

describe('checkInvariants', () => {
  it('reports no violations for a clean state', () => {
    expect(checkInvariants(baseState())).toEqual([]);
  });

  it('flags negative combinedHp', () => {
    const state = baseState();
    state.seats[0].combinedHp = -1;
    expect(checkInvariants(state)).toEqual([expect.stringContaining('negative combinedHp')]);
  });

  it('flags a pendingResponse pointing at an eliminated seat', () => {
    const state = baseState();
    state.seats[0].eliminated = true;
    state.pendingResponse = {
      id: 'r1',
      respondingSeatId: 'seat-a',
      allowedActionKinds: ['PassAction'],
      context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 } },
    };
    expect(checkInvariants(state)).toEqual([expect.stringContaining('eliminated seat')]);
  });

  it('flags a GameResult that references an unknown seat', () => {
    const state = baseState({ result: { endedAt: 1, winningSeatIds: ['ghost-seat'], losingSeatIds: [] } });
    expect(checkInvariants(state)).toEqual([expect.stringContaining('unknown seat')]);
  });
});

describe('checkInvariants: card conservation', () => {
  it('reports no violations when every card instance appears exactly once', () => {
    const state = baseState({
      zones: [
        { id: 'drawPile', kind: 'drawPile', cards: [card('c1'), card('c2')] },
        { id: 'discardPile', kind: 'discardPile', cards: [card('c3')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [card('c4')] },
      ],
    });
    expect(checkInvariants(state)).toEqual([]);
  });

  it('flags a card instance present in two zones at once, naming the duplicate', () => {
    const state = baseState({
      zones: [
        { id: 'drawPile', kind: 'drawPile', cards: [card('c1')] },
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [card('c1')] },
      ],
    });
    const violations = checkInvariants(state);
    expect(violations).toEqual([expect.stringContaining('c1')]);
    expect(violations[0]).toContain('more than one zone');
    expect(violations[0]).toContain('drawPile');
    expect(violations[0]).toContain('seat-a:hand');
  });

  it('flags a card instance duplicated inside a single zone, naming the duplicate', () => {
    const state = baseState({
      zones: [{ id: 'discardPile', kind: 'discardPile', cards: [card('c7'), card('c7')] }],
    });
    const violations = checkInvariants(state);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('c7');
    expect(violations[0]).toContain('discardPile');
  });
});
