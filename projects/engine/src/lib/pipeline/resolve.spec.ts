import { resolve } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition, CardDefinition, GeneralDefinition } from '../registry/types';
import { Effect } from './effects';
import { DamageDealtEvent } from './events';

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

describe('resolve: skill triggers modify effects and queue follow-ups', () => {
  function registryWithShieldAndDrawGenerals(): ContentRegistry {
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
            amount: 4,
            nature: 'normal',
            cause: { cardInstanceId: ctx.cardInstanceId },
          },
        },
      ],
    };
    const shieldGeneral: GeneralDefinition = {
      id: 'shield-general',
      kingdom: 'Shu',
      maxHp: 4,
      skills: [
        {
          id: 'shield-skill',
          activation: 'auto',
          triggers: [
            {
              point: 'before:DamageEffect',
              condition: (_state, subject) => (subject as Effect).kind === 'DamageEffect',
              effect: (_state, subject) => {
                const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
                return [{ ...effect, damage: { ...effect.damage, amount: Math.floor(effect.damage.amount / 2) } }];
              },
            },
          ],
        },
      ],
    };
    const drawGeneral: GeneralDefinition = {
      id: 'draw-general',
      kingdom: 'Shu',
      maxHp: 3,
      skills: [
        {
          id: 'draw-skill',
          activation: 'auto',
          triggers: [
            {
              point: 'after:DamageDealtEvent',
              condition: () => true,
              effect: (_state, subject) => {
                const event = subject as DamageDealtEvent;
                if (event.damage.target.kind !== 'seat') return [];
                return [{ kind: 'DrawCardsEffect', seatId: event.damage.target.seatId, count: 1 }];
              },
            },
          ],
        },
      ],
    };
    return {
      cards: new Map([['test-damage-card', testDamageCard]]),
      generals: new Map([
        ['shield-general', shieldGeneral],
        ['draw-general', drawGeneral],
      ]),
    };
  }

  it('halves incoming damage via a before:DamageEffect trigger and draws a card via after:DamageDealtEvent', () => {
    let state = withTestCardInSeatAHand(baseState());
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.id === 'seat-b'
          ? {
              ...seat,
              generals: {
                main: { generalDefinitionId: 'shield-general', revealed: false },
                deputy: { generalDefinitionId: 'draw-general', revealed: false },
              },
            }
          : seat
      ),
    };

    const { state: next } = resolve(
      state,
      {
        kind: 'PlayCardAction',
        seatId: 'seat-a',
        cardInstanceId: 'test-card-1',
        targets: [{ kind: 'seat', seatId: 'seat-b' }],
      },
      { registry: registryWithShieldAndDrawGenerals(), mode: stubMode() }
    );

    const seatB = next.seats.find((s) => s.id === 'seat-b')!;
    expect(seatB.combinedHp).toBe(4); // 6 - floor(4/2) = 4
    const seatBHand = next.zones.find((z) => z.id === 'seat-b:hand')!;
    expect(seatBHand.cards).toHaveLength(1);
  });
});
