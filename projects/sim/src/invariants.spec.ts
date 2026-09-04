import { checkInvariants } from './invariants';
import type { GameState } from 'engine';

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
    state.pendingResponse = { id: 'r1', respondingSeatId: 'seat-a', allowedActionKinds: ['PassAction'], context: { effect: null } };
    expect(checkInvariants(state)).toEqual([expect.stringContaining('eliminated seat')]);
  });

  it('flags a GameResult that references an unknown seat', () => {
    const state = baseState({ result: { endedAt: 1, winningSeatIds: ['ghost-seat'], losingSeatIds: [] } });
    expect(checkInvariants(state)).toEqual([expect.stringContaining('unknown seat')]);
  });
});
