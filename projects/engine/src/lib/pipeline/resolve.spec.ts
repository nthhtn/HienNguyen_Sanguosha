import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';

function emptyRegistry(): ContentRegistry {
  return { cards: new Map(), generals: new Map() };
}

function stubMode(): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused in this test'); }) as GameModeDefinition['setup'],
    checkWinCondition: () => null,
    triggers: [],
  };
}

function baseState(): GameState {
  return {
    seats: [
      {
        id: 'seat-a',
        index: 0,
        kingdom: 'Wei',
        generals: {
          main: { generalDefinitionId: 'g1', revealed: false },
          deputy: { generalDefinitionId: 'g2', revealed: false },
        },
        combinedHp: 7,
        maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' },
        equipped: { zoneId: 'seat-a:equip' },
        eliminated: false,
      },
    ],
    players: [{ id: 'p1', seatId: 'seat-a', kind: 'bot' }],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [
      {
        id: 'drawPile',
        kind: 'drawPile',
        cards: [
          { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 1 },
          { instanceId: 'c2', definitionId: 'sha', suit: 'heart', rank: 2 },
        ],
      },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
    ],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
  };
}

describe('resolve: DrawCardsAction', () => {
  it('moves cards from the draw pile into the seat hand and logs a CardsDrawnEvent', () => {
    const state = baseState();
    const { state: next, events } = resolve(
      state,
      { kind: 'DrawCardsAction', seatId: 'seat-a', count: 2 },
      { registry: emptyRegistry(), mode: stubMode() }
    );
    const hand = next.zones.find((z) => z.id === 'seat-a:hand')!;
    expect(hand.cards.map((c) => c.instanceId)).toEqual(['c1', 'c2']);
    expect(events).toEqual([{ kind: 'CardsDrawnEvent', seatId: 'seat-a', cardInstanceIds: ['c1', 'c2'] }]);
  });

  it('throws for an unknown seat rather than silently mutating state', () => {
    const state = baseState();
    expect(() =>
      resolve(
        state,
        { kind: 'DrawCardsAction', seatId: 'missing', count: 1 },
        { registry: emptyRegistry(), mode: stubMode() }
      )
    ).toThrow(/Unknown seat/);
  });
});
