import { getLegalActions, getLegalTargets } from './legality';
import { GameState } from '../domain/types';
import { createRng } from '../rng/rng';

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 7, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
      {
        id: 'seat-c', index: 2, kingdom: 'Wu',
        generals: { main: { generalDefinitionId: 'g5', revealed: false }, deputy: { generalDefinitionId: 'g6', revealed: false } },
        combinedHp: 5, maxCombinedHp: 5,
        hand: { zoneId: 'seat-c:hand' }, equipped: { zoneId: 'seat-c:equip' }, eliminated: true,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [{ instanceId: 'c2', definitionId: 'shan', suit: 'club', rank: 2 }] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-c:hand', kind: 'hand', ownerSeatId: 'seat-c', cards: [] },
      { id: 'seat-c:equip', kind: 'equip', ownerSeatId: 'seat-c', cards: [] },
    ],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
    ...overrides,
  };
}

describe('getLegalTargets', () => {
  it('excludes the acting seat and eliminated seats', () => {
    expect(getLegalTargets(state(), 'seat-a')).toEqual([{ kind: 'seat', seatId: 'seat-b' }]);
  });
});

describe('getLegalActions', () => {
  it('returns no actions once the game has a result', () => {
    expect(getLegalActions(state({ result: { endedAt: 1, winningSeatIds: [], losingSeatIds: [] } }), 'seat-a')).toEqual([]);
  });

  it('during a pending response, only the responding seat gets Pass + whitelisted Respond actions', () => {
    const withPending = state({
      pendingResponse: {
        id: 'resp-1', respondingSeatId: 'seat-b',
        allowedActionKinds: ['RespondAction', 'PassAction'],
        allowedCardIds: ['shan'],
        context: { effect: null },
      },
    });
    expect(getLegalActions(withPending, 'seat-a')).toEqual([]);
    const actionsForB = getLegalActions(withPending, 'seat-b');
    expect(actionsForB).toContainEqual({ kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'resp-1' });
    expect(actionsForB).toContainEqual({
      kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'resp-1', cardInstanceId: 'c2',
    });
    expect(actionsForB).toHaveLength(2);
  });

  it('outside a pending response, only the active seat gets EndPhaseAction and PlayCardAction variants', () => {
    const actionsForA = getLegalActions(state(), 'seat-a');
    expect(actionsForA).toContainEqual({ kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(actionsForA).toContainEqual({ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [] });
    expect(actionsForA).toContainEqual({
      kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'c1', targets: [{ kind: 'seat', seatId: 'seat-b' }],
    });
    expect(getLegalActions(state(), 'seat-b')).toEqual([]);
  });
});
