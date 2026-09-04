import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition, CardDefinition } from '../registry/types';

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
      {
        id: 'seat-b',
        index: 1,
        kingdom: 'Shu',
        generals: {
          main: { generalDefinitionId: 'g3', revealed: false },
          deputy: { generalDefinitionId: 'g4', revealed: false },
        },
        combinedHp: 6,
        maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' },
        equipped: { zoneId: 'seat-b:equip' },
        eliminated: false,
      },
    ],
    players: [
      { id: 'p1', seatId: 'seat-a', kind: 'bot' },
      { id: 'p2', seatId: 'seat-b', kind: 'bot' },
    ],
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
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
  };
}

function withTestCardInSeatAHand(state: GameState): GameState {
  return {
    ...state,
    zones: state.zones.map((zone) =>
      zone.id === 'seat-a:hand'
        ? { ...zone, cards: [{ instanceId: 'test-card-1', definitionId: 'test-damage-card', suit: 'spade' as const, rank: 5 }] }
        : zone
    ),
  };
}

function registryWithTestDamageCard(): ContentRegistry {
  const testDamageCard: CardDefinition = {
    id: 'test-damage-card',
    name: 'Test Damage Card',
    category: 'basic',
    play: (_state, ctx) => [
      {
        kind: 'DamageEffect',
        damage: {
          source: { kind: 'seat', seatId: ctx.seatId },
          target: ctx.targets[0],
          amount: 2,
          nature: 'normal',
          cause: { cardInstanceId: ctx.cardInstanceId },
        },
      },
    ],
  };
  return { cards: new Map([['test-damage-card', testDamageCard]]), generals: new Map() };
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

describe('resolve: PlayCardAction with Target Selection and Damage', () => {
  it('applies damage to a legal target seat and logs a DamageDealtEvent', () => {
    const state = withTestCardInSeatAHand(baseState());
    const { state: next, events } = resolve(
      state,
      {
        kind: 'PlayCardAction',
        seatId: 'seat-a',
        cardInstanceId: 'test-card-1',
        targets: [{ kind: 'seat', seatId: 'seat-b' }],
      },
      { registry: registryWithTestDamageCard(), mode: stubMode() }
    );
    const seatB = next.seats.find((s) => s.id === 'seat-b')!;
    expect(seatB.combinedHp).toBe(4);
    expect(events).toEqual([
      {
        kind: 'DamageDealtEvent',
        damage: {
          source: { kind: 'seat', seatId: 'seat-a' },
          target: { kind: 'seat', seatId: 'seat-b' },
          amount: 2,
          nature: 'normal',
          cause: { cardInstanceId: 'test-card-1' },
        },
      },
    ]);
  });

  it('rejects an illegal target (eliminated seat) without mutating state', () => {
    const state = withTestCardInSeatAHand(baseState());
    state.seats[1].eliminated = true;
    expect(() =>
      resolve(
        state,
        {
          kind: 'PlayCardAction',
          seatId: 'seat-a',
          cardInstanceId: 'test-card-1',
          targets: [{ kind: 'seat', seatId: 'seat-b' }],
        },
        { registry: registryWithTestDamageCard(), mode: stubMode() }
      )
    ).toThrow(/Illegal target/);
  });

  it('rejects playing a card the seat does not hold', () => {
    const state = baseState();
    expect(() =>
      resolve(
        state,
        {
          kind: 'PlayCardAction',
          seatId: 'seat-a',
          cardInstanceId: 'not-in-hand',
          targets: [{ kind: 'seat', seatId: 'seat-b' }],
        },
        { registry: registryWithTestDamageCard(), mode: stubMode() }
      )
    ).toThrow(/does not hold/);
  });
});
