import { usedCardOf } from '../domain/usedCard';
import { resolve, MAX_RESOLUTION_STEPS } from './resolve';
import { createRng } from '../rng/rng';
import { GameState, Target } from '../domain/types';
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
        equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' },
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
        equipped: { zoneId: 'seat-b:equip' }, judgment: { zoneId: 'seat-b:judgment' },
        eliminated: false,
      },
    ],
    players: [
      { id: 'p1', seatId: 'seat-a', kind: 'bot', name: 'Seat A' },
      { id: 'p2', seatId: 'seat-b', kind: 'bot', name: 'Seat B' },
    ],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      {
        id: 'drawPile',
        kind: 'drawPile',
        cards: [
          { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 1 },
          { instanceId: 'c2', definitionId: 'sha', suit: 'heart', rank: 2 },
        ],
      },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null, generalSelection: null,
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
      // The play itself is public: who used which card on whom.
      {
        kind: 'CardPlayedEvent', seatId: 'seat-a',
        card: usedCardOf({ instanceId: 'test-card-1', definitionId: 'test-damage-card', suit: 'spade', rank: 5 }),
        targets: [{ kind: 'seat', seatId: 'seat-b' }],
      },
      // A used non-equipment card leaves the hand before its effects resolve.
      {
        kind: 'CardMovedEvent', cardInstanceId: 'test-card-1', fromZoneId: 'seat-a:hand', toZoneId: 'discardPile',
        card: { instanceId: 'test-card-1', definitionId: 'test-damage-card', suit: 'spade', rank: 5 },
      },
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

  it('takes combinedHp below 0 on overkill damage (a big hit needs more Peaches)', () => {
    const state = withTestCardInSeatAHand(baseState());
    state.seats[1].combinedHp = 1; // less than the 2 damage the test card deals
    const { state: next } = resolve(
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
    expect(seatB.combinedHp).toBe(-1);
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

describe('resolve: Response Window pause and resume', () => {
  function registryWithShaAndShield(): ContentRegistry {
    const testShaLikeCard: CardDefinition = {
      id: 'test-sha-like-card',
      name: 'Test Sha-like Card',
      category: 'basic',
      play: (_state, ctx) => [
        {
          kind: 'OpenResponseEffect',
          pendingResponse: {
            id: 'resp-1',
            respondingSeatId: (ctx.targets[0] as { kind: 'seat'; seatId: string }).seatId,
            allowedActionKinds: ['RespondAction', 'PassAction'],
            context: {
              effect: {
                kind: 'DamageEffect',
                damage: {
                  source: { kind: 'seat', seatId: ctx.seatId },
                  target: ctx.targets[0],
                  amount: 3,
                  nature: 'normal',
                  cause: { cardInstanceId: ctx.cardInstanceId },
                },
              },
            },
          },
        },
      ],
    };
    const testShieldCard: CardDefinition = {
      id: 'test-shield-card',
      name: 'Test Shield Card',
      category: 'basic',
      play: () => [],
    };
    return {
      cards: new Map([
        ['test-sha-like-card', testShaLikeCard],
        ['test-shield-card', testShieldCard],
      ]),
      generals: new Map(),
    };
  }

  function stateWithShaInHandAndShieldForB(): GameState {
    let state = withTestCardInSeatAHand(baseState());
    state = {
      ...state,
      zones: state.zones.map((zone) =>
        zone.id === 'seat-a:hand'
          ? { ...zone, cards: [{ instanceId: 'sha-1', definitionId: 'test-sha-like-card', suit: 'spade' as const, rank: 7 }] }
          : zone.id === 'seat-b:hand'
          ? { ...zone, cards: [{ instanceId: 'shield-1', definitionId: 'test-shield-card', suit: 'club' as const, rank: 2 }] }
          : zone
      ),
    };
    return state;
  }

  it('opens a pending response and defers damage instead of applying it immediately', () => {
    const state = stateWithShaInHandAndShieldForB();
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(next.pendingResponse).toEqual({
      id: 'resp-1',
      respondingSeatId: 'seat-b',
      allowedActionKinds: ['RespondAction', 'PassAction'],
      context: { effect: expect.objectContaining({ kind: 'DamageEffect' }) },
    });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('PassAction resumes resolution and applies the deferred damage', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    const { state: next } = resolve(
      opened.state,
      { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'resp-1' },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(next.pendingResponse).toBeNull();
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(3);
  });

  it('RespondAction resumes resolution and the shield card prevents the damage', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    const { state: next } = resolve(
      opened.state,
      { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'resp-1', cardInstanceId: 'shield-1' },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(next.pendingResponse).toBeNull();
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6);
  });

  it('rejects an unrelated action while a response is pending', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(() =>
      resolve(opened.state, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry: registryWithShaAndShield(), mode: stubMode() })
    ).toThrow(/not legal while a response is pending/);
  });

  it('rejects a PassAction whose pendingResponseId does not match the open response', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(opened.state.pendingResponse!.id).toBe('resp-1');
    expect(() =>
      resolve(
        opened.state,
        { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'stale-resp' },
        { registry: registryWithShaAndShield(), mode: stubMode() }
      )
    ).toThrow(/No matching pending response: stale-resp/);
  });

  it('rejects a RespondAction whose pendingResponseId does not match the open response', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(() =>
      resolve(
        opened.state,
        { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'stale-resp', cardInstanceId: 'shield-1' },
        { registry: registryWithShaAndShield(), mode: stubMode() }
      )
    ).toThrow(/No matching pending response: stale-resp/);
  });

  it('rejects a RespondAction from a seat that is not the responder', () => {
    const state = stateWithShaInHandAndShieldForB();
    const opened = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'sha-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registryWithShaAndShield(), mode: stubMode() }
    );
    expect(() =>
      resolve(
        opened.state,
        { kind: 'RespondAction', seatId: 'seat-a', pendingResponseId: 'resp-1', cardInstanceId: 'shield-1' },
        { registry: registryWithShaAndShield(), mode: stubMode() }
      )
    ).toThrow(/is not the responder for resp-1/);
  });
});

describe('resolve: step budget', () => {
  // Two fixture triggers that each produce an effect the other reacts to:
  // DamageDealtEvent -> HealEffect -> HealEvent -> DamageEffect -> ... (the
  // seat's HP swings between 3 and 4, so every heal really heals and is logged)
  function registryWithCyclicTriggers(): ContentRegistry {
    const healCard: CardDefinition = {
      id: 'test-heal-card',
      name: 'Test Heal Card',
      category: 'basic',
      play: (_state, ctx) => [{ kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: ctx.seatId }, amount: 1, nature: 'normal' } }],
    };
    const healToDamageGeneral: GeneralDefinition = {
      id: 'heal-to-damage-general',
      kingdom: 'Wei',
      maxHp: 4,
      skills: [
        {
          id: 'heal-to-damage',
          triggers: [
            {
              point: 'after:HealEvent',
              condition: () => true,
              effect: () => [
                {
                  kind: 'DamageEffect',
                  damage: {
                    source: null,
                    target: { kind: 'seat', seatId: 'seat-a' },
                    amount: 1,
                    nature: 'normal',
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const damageToHealGeneral: GeneralDefinition = {
      id: 'damage-to-heal-general',
      kingdom: 'Shu',
      maxHp: 3,
      skills: [
        {
          id: 'damage-to-heal',
          triggers: [
            {
              point: 'after:DamageDealtEvent',
              condition: () => true,
              effect: () => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 }],
            },
          ],
        },
      ],
    };
    return {
      cards: new Map([['test-heal-card', healCard]]),
      generals: new Map([
        ['heal-to-damage-general', healToDamageGeneral],
        ['damage-to-heal-general', damageToHealGeneral],
      ]),
    };
  }

  it('throws a descriptive error instead of exhausting the call stack on a trigger cycle', () => {
    let state = baseState();
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.id === 'seat-a'
          ? {
              ...seat,
              generals: {
                main: { generalDefinitionId: 'heal-to-damage-general', revealed: false },
                deputy: { generalDefinitionId: 'damage-to-heal-general', revealed: false },
              },
            }
          : seat
      ),
      zones: state.zones.map((z) =>
        z.id === 'seat-a:hand'
          ? { ...z, cards: [{ instanceId: 'heal-1', definitionId: 'test-heal-card', suit: 'heart' as const, rank: 4 }] }
          : z
      ),
    };

    let thrown: unknown;
    try {
      resolve(
        state,
        { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'heal-1', targets: [] },
        { registry: registryWithCyclicTriggers(), mode: stubMode() }
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toMatch(/Resolution step budget exceeded/);
    expect(message).toMatch(new RegExp(String(MAX_RESOLUTION_STEPS)));
    expect(message).toMatch(/DamageEffect|HealEffect/);
    expect(message).toMatch(/trigger cycle/);
  });

  it('does not fire for a legitimate multi-level chain', () => {
    // damage -> after:DamageDealtEvent -> DrawCardsEffect is only two levels
    // deep, comfortably under the limit.
    const state = withTestCardInSeatAHand(baseState());
    expect(() =>
      resolve(
        state,
        { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'test-card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
        { registry: registryWithTestDamageCard(), mode: stubMode() }
      )
    ).not.toThrow();
  });
});

describe('resolve: Heal and MoveCard effects', () => {
  const healPlayCard: CardDefinition = {
    id: 'test-heal-card', name: 'Test Heal Card', category: 'basic',
    play: (_state, ctx) => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: ctx.seatId }, amount: 3 }],
  };
  const moveCard: CardDefinition = {
    id: 'test-move-card', name: 'Test Move Card', category: 'equipment',
    play: (_state, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: `${ctx.seatId}:equip` }],
  };
  function registry(): ContentRegistry {
    return { cards: new Map([['test-heal-card', healPlayCard], ['test-move-card', moveCard]]), generals: new Map() };
  }

  it('HealEffect increases combinedHp but never above maxCombinedHp', () => {
    let state = withTestCardInSeatAHand(baseState());
    state = {
      ...state,
      seats: state.seats.map((s) => (s.id === 'seat-a' ? { ...s, combinedHp: 5 } : s)), // maxCombinedHp is 7
      zones: state.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'heal-1', definitionId: 'test-heal-card', suit: 'spade' as const, rank: 1 }] } : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'heal-1', targets: [] },
      { registry: registry(), mode: stubMode() }
    );
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(7); // capped at max, not 8
  });

  it('MoveCardEffect relocates the played card into the given zone', () => {
    let state = withTestCardInSeatAHand(baseState());
    state = {
      ...state,
      zones: state.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'move-1', definitionId: 'test-move-card', suit: 'club' as const, rank: 1 }] } : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'move-1', targets: [] },
      { registry: registry(), mode: stubMode() }
    );
    const equip = next.zones.find((z) => z.id === 'seat-a:equip')!;
    expect(equip.cards.map((c) => c.instanceId)).toEqual(['move-1']);
  });
});

describe('resolve: discard-after-play', () => {
  const trivialCard: CardDefinition = {
    id: 'test-trivial-card',
    name: 'Test Trivial Card',
    category: 'basic',
    play: () => [],
  };
  const equipmentCard: CardDefinition = {
    id: 'test-equipment-card',
    name: 'Test Equipment Card',
    category: 'equipment',
    play: (_state, ctx) => [
      { kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: `${ctx.seatId}:equip` },
    ],
  };
  function registry(): ContentRegistry {
    return {
      cards: new Map([
        ['test-trivial-card', trivialCard],
        ['test-equipment-card', equipmentCard],
      ]),
      generals: new Map(),
    };
  }

  it('moves a non-equipment card to discardPile after PlayCardAction resolves', () => {
    let state = baseState();
    state = {
      ...state,
      zones: state.zones.map((z) =>
        z.id === 'seat-a:hand'
          ? { ...z, cards: [{ instanceId: 'trivial-1', definitionId: 'test-trivial-card', suit: 'spade' as const, rank: 3 }] }
          : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'trivial-1', targets: [] },
      { registry: registry(), mode: stubMode() }
    );
    const hand = next.zones.find((z) => z.id === 'seat-a:hand')!;
    const discard = next.zones.find((z) => z.id === 'discardPile')!;
    expect(hand.cards.map((c) => c.instanceId)).not.toContain('trivial-1');
    expect(discard.cards.map((c) => c.instanceId)).toContain('trivial-1');
  });

  it('does NOT discard an equipment card after PlayCardAction — it stays in the equip zone', () => {
    let state = baseState();
    state = {
      ...state,
      zones: state.zones.map((z) =>
        z.id === 'seat-a:hand'
          ? { ...z, cards: [{ instanceId: 'equip-1', definitionId: 'test-equipment-card', suit: 'club' as const, rank: 4 }] }
          : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'equip-1', targets: [] },
      { registry: registry(), mode: stubMode() }
    );
    const equip = next.zones.find((z) => z.id === 'seat-a:equip')!;
    const discard = next.zones.find((z) => z.id === 'discardPile')!;
    expect(equip.cards.map((c) => c.instanceId)).toContain('equip-1');
    expect(discard.cards.map((c) => c.instanceId)).not.toContain('equip-1');
  });

  it('moves a non-equipment card to discardPile after RespondAction resolves', () => {
    let state = baseState();
    state = {
      ...state,
      pendingResponse: {
        id: 'resp-discard-1',
        respondingSeatId: 'seat-b',
        allowedActionKinds: ['RespondAction', 'PassAction'],
        context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-b' }, amount: 0 } },
      },
      zones: state.zones.map((z) =>
        z.id === 'seat-b:hand'
          ? { ...z, cards: [{ instanceId: 'trivial-2', definitionId: 'test-trivial-card', suit: 'heart' as const, rank: 5 }] }
          : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'resp-discard-1', cardInstanceId: 'trivial-2' },
      { registry: registry(), mode: stubMode() }
    );
    const hand = next.zones.find((z) => z.id === 'seat-b:hand')!;
    const discard = next.zones.find((z) => z.id === 'discardPile')!;
    expect(hand.cards.map((c) => c.instanceId)).not.toContain('trivial-2');
    expect(discard.cards.map((c) => c.instanceId)).toContain('trivial-2');
  });
});

describe('resolve: RespondAction to a window a card opened', () => {
  // seat-b answers a pending 1-damage effect with 'answer-1'; 'opener' is the
  // card that opened the window and heals seat-a whenever it is answered.
  function answered(sourceCard?: { instanceId: string; definitionId: string }) {
    const opener: CardDefinition = {
      id: 'opener', name: 'Opener', category: 'tool', play: () => [],
      onResponse: (_state, ctx) => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: ctx.seatId === 'seat-b' ? 1 : 0 }],
    };
    const answer: CardDefinition = { id: 'answer', name: 'Answer', category: 'basic', play: () => [] };
    const registry: ContentRegistry = { cards: new Map([['opener', opener], ['answer', answer]]), generals: new Map() };
    const base = baseState();
    const state: GameState = {
      ...base,
      seats: base.seats.map((seat) => (seat.id === 'seat-a' ? { ...seat, combinedHp: seat.maxCombinedHp - 1 } : seat)),
      pendingResponse: {
        id: 'opened-1', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'],
        context: { effect: { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal' } } },
        ...(sourceCard ? { sourceCard } : {}),
      },
      zones: base.zones.map((z) =>
        z.id === 'seat-b:hand' ? { ...z, cards: [{ instanceId: 'answer-1', definitionId: 'answer', suit: 'heart' as const, rank: 2 }] } : z
      ),
    };
    return resolve(state, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'opened-1', cardInstanceId: 'answer-1' }, { registry, mode: stubMode() }).state;
  }
  const hpOf = (state: GameState, seatId: string) => state.seats.find((s) => s.id === seatId)!;

  it('lets the opening card decide what the answer leads to', () => {
    const next = answered({ instanceId: 'opener-1', definitionId: 'opener' });
    expect(hpOf(next, 'seat-a').combinedHp).toBe(hpOf(next, 'seat-a').maxCombinedHp);
    expect(hpOf(next, 'seat-b').combinedHp).toBe(hpOf(next, 'seat-b').maxCombinedHp);
  });

  it('just cancels the pending effect when no card opened the window', () => {
    const next = answered();
    expect(hpOf(next, 'seat-a').combinedHp).toBe(hpOf(next, 'seat-a').maxCombinedHp - 1);
    expect(hpOf(next, 'seat-b').combinedHp).toBe(hpOf(next, 'seat-b').maxCombinedHp);
  });
});

describe('resolve: EndPhaseAction', () => {
  it("ends the Play phase and rests in the next seat's Play phase", () => {
    const state = { ...baseState(), phase: 'Play' as const };
    const { state: next, events } = resolve(
      state,
      { kind: 'EndPhaseAction', seatId: 'seat-a' },
      { registry: emptyRegistry(), mode: stubMode() }
    );
    expect(next.phase).toBe('Play');
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(events).toEqual([
      { kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'Discard' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-a', phase: 'End' },
      { kind: 'TurnAdvancedEvent', seatId: 'seat-b', turnNumber: 2 },
      { kind: 'PhaseChangedEvent', seatId: 'seat-b', phase: 'Start' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-b', phase: 'Judgment' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-b', phase: 'Draw' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-b', phase: 'Play' },
    ]);
  });

  it('rejects EndPhaseAction from a seat that is not the current turn owner', () => {
    const state = { ...baseState(), phase: 'Play' as const };
    expect(() =>
      resolve(state, { kind: 'EndPhaseAction', seatId: 'seat-b' }, { registry: emptyRegistry(), mode: stubMode() })
    ).toThrow(/not seat seat-b's turn/);
  });
});

describe('RevealGeneralAction on a seat with no generals yet', () => {
  it('throws a clear error', () => {
    const state = baseState();
    const unchosen = { ...state, seats: state.seats.map((s, i) => (i === 0 ? { ...s, generals: null } : s)) };
    expect(() =>
      resolve(
        unchosen,
        { kind: 'RevealGeneralAction', seatId: unchosen.seats[0].id, slot: 'main' },
        { registry: emptyRegistry(), mode: stubMode() }
      )
    ).toThrow(/has not chosen its generals/);
  });
});

describe('resolve: UseConversionAction', () => {
  it('accepts a UseConversionAction whose targets have reordered keys', () => {
    const damage = registryWithTestDamageCard().cards.get('test-damage-card')!;
    const worn: CardDefinition = {
      id: 'test-worn', name: 'Test Worn', category: 'equipment',
      abilities: { conversions: [{ id: 'conv', as: 'test-damage-card', cards: 1, when: 'play' }] },
    } as CardDefinition;
    const registry: ContentRegistry = { cards: new Map([['test-damage-card', damage], ['test-worn', worn]]), generals: new Map() };
    const base = baseState();
    const state: GameState = {
      ...base,
      zones: base.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'h1', definitionId: 'test-damage-card', suit: 'spade' as const, rank: 5 }] }
        : z.id === 'seat-a:equip' ? { ...z, cards: [{ instanceId: 'w1', definitionId: 'test-worn', suit: 'club' as const, rank: 2 }] }
        : z
      ),
    };
    const via = { owner: { kind: 'equipment' as const, seatId: 'seat-a', cardInstanceId: 'w1' }, conversionId: 'conv' };
    const reordered = { seatId: 'seat-b', kind: 'seat' } as Target;
    const action = { kind: 'UseConversionAction' as const, seatId: 'seat-a', via, targets: [reordered] };
    expect(() => resolve(state, action, { registry, mode: stubMode() })).not.toThrow();
  });
});
