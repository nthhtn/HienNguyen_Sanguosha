import { dongZhuoGeneral, zhaoYunGeneral, huangYueyingGeneral } from './setTwo';
import { resolve } from 'engine';
import type { GameState, ContentRegistry, GameModeDefinition, CardDefinition, CardZone, Seat } from 'engine';

const testHealSelfCard: CardDefinition = {
  id: 'test-heal-self-card', name: 'Test Heal Self', category: 'basic',
  play: (_state, ctx) => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: ctx.seatId }, amount: 2 }],
};
const testDamageCard: CardDefinition = {
  id: 'test-damage-card', name: 'Test Damage Card', category: 'basic',
  play: (_state, ctx) => [{
    kind: 'DamageEffect',
    damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 2, nature: 'normal' },
  }],
};

function registry(): ContentRegistry {
  return {
    cards: new Map([['test-heal-self-card', testHealSelfCard], ['test-damage-card', testDamageCard]]),
    generals: new Map([['dong-zhuo', dongZhuoGeneral], ['zhao-yun', zhaoYunGeneral]]),
  };
}

function stubMode(): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
}

function seat(id: string, index: number, generalId: string, combinedHp: number, maxCombinedHp: number): Seat {
  return {
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: generalId, revealed: false }, deputy: { generalDefinitionId: 'filler', revealed: false } },
    combinedHp, maxCombinedHp,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
  };
}

// A discard pile is mandatory: every non-equipment card is moved there once its
// play() effects have resolved.
function zonesFor(seats: Seat[], hands: Record<string, CardZone['cards']> = {}): CardZone[] {
  return [
    { id: 'discardPile', kind: 'discardPile', cards: [] },
    ...seats.flatMap((s) => [
      { id: s.hand.zoneId, kind: 'hand' as const, ownerSeatId: s.id, cards: hands[s.id] ?? [] },
      { id: s.equipped.zoneId, kind: 'equip' as const, ownerSeatId: s.id, cards: [] },
    ]),
  ];
}

function stateOf(seats: Seat[], zones: CardZone[], ownerSeatId: string): GameState {
  return {
    seats,
    players: [],
    turn: { turnNumber: 1, ownerSeatId, extraTurnStack: [] },
    phase: 'Play',
    zones,
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
  };
}

describe('Dong Zhuo — Tyranny', () => {
  it('reduces healing to this seat by 1', () => {
    const seats = [seat('seat-a', 0, 'dong-zhuo', 3, 6)];
    const zones = zonesFor(seats, {
      'seat-a': [{ instanceId: 'heal-1', definitionId: 'test-heal-self-card', suit: 'spade', rank: 1 }],
    });
    const state = stateOf(seats, zones, 'seat-a');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'heal-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(4); // 3 + (2-1)
  });

  // Regression guard for the owner mis-attribution bug: `condition`/`effect`
  // used to re-derive "which seat am I" by searching GameState for the general
  // id, which always resolved to the first holder — so with two holders the
  // skill fired twice for one of them (fully cancelling a 2-point heal) and
  // never for the other. Each holder's copy must now fire exactly once, scoped
  // to its own seat.
  it('fires exactly once per holder when two different seats both hold Dong Zhuo', () => {
    const seats = [
      seat('seat-a', 0, 'dong-zhuo', 3, 6),
      seat('seat-b', 1, 'filler2', 3, 6),
      seat('seat-c', 2, 'dong-zhuo', 3, 6),
      seat('seat-d', 3, 'filler3', 3, 6),
    ];
    const zones = zonesFor(seats, {
      'seat-a': [{ instanceId: 'heal-a', definitionId: 'test-heal-self-card', suit: 'spade', rank: 1 }],
      'seat-b': [{ instanceId: 'heal-b', definitionId: 'test-heal-self-card', suit: 'heart', rank: 2 }],
      'seat-c': [{ instanceId: 'heal-c', definitionId: 'test-heal-self-card', suit: 'club', rank: 3 }],
    });

    // seat-a's own copy of Tyranny: 2 healing becomes 1.
    const afterA = resolve(
      stateOf(seats, zones, 'seat-a'),
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'heal-a', targets: [] },
      { registry: registry(), mode: stubMode() }
    ).state;
    expect(afterA.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(4); // 3 + (2-1), reduced once — not twice
    expect(afterA.seats.find((s) => s.id === 'seat-c')!.combinedHp).toBe(3); // untouched

    // seat-c's own copy of Tyranny: independently reduces its own heal by 1.
    const afterC = resolve(
      stateOf(seats, zones, 'seat-c'),
      { kind: 'PlayCardAction', seatId: 'seat-c', cardInstanceId: 'heal-c', targets: [] },
      { registry: registry(), mode: stubMode() }
    ).state;
    expect(afterC.seats.find((s) => s.id === 'seat-c')!.combinedHp).toBe(4); // 3 + (2-1), fired for THIS holder
    expect(afterC.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(3); // untouched

    // A seat holding neither copy heals the full amount.
    const afterB = resolve(
      stateOf(seats, zones, 'seat-b'),
      { kind: 'PlayCardAction', seatId: 'seat-b', cardInstanceId: 'heal-b', targets: [] },
      { registry: registry(), mode: stubMode() }
    ).state;
    expect(afterB.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(5); // 3 + 2, no reduction
  });
});

describe('Zhao Yun — Vanguard', () => {
  it('reduces damage by 1 when the source is 2+ seats away', () => {
    const seats = [seat('seat-a', 0, 'filler', 5, 5), seat('seat-b', 1, 'filler', 5, 5), seat('seat-c', 2, 'zhao-yun', 6, 6), seat('seat-d', 3, 'filler', 5, 5)];
    const zones = zonesFor(seats, {
      'seat-a': [{ instanceId: 'dmg-1', definitionId: 'test-damage-card', suit: 'spade', rank: 1 }],
    });
    const state = stateOf(seats, zones, 'seat-a');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'dmg-1', targets: [{ kind: 'seat', seatId: 'seat-c' }] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-c')!.combinedHp).toBe(5); // 6 - (2-1), distance(seat-a, seat-c) === 2
  });

  it('fires exactly once per holder when two different seats both hold Zhao Yun', () => {
    const seats = [
      seat('seat-a', 0, 'filler', 5, 5),
      seat('seat-b', 1, 'zhao-yun', 6, 6),
      seat('seat-c', 2, 'filler', 5, 5),
      seat('seat-d', 3, 'zhao-yun', 6, 6),
      seat('seat-e', 4, 'filler', 5, 5),
    ];
    const zones = zonesFor(seats, {
      'seat-a': [
        { instanceId: 'dmg-1', definitionId: 'test-damage-card', suit: 'spade', rank: 1 },
        { instanceId: 'dmg-2', definitionId: 'test-damage-card', suit: 'heart', rank: 2 },
      ],
    });
    const state = stateOf(seats, zones, 'seat-a');

    // distance(seat-a, seat-c) === 2 → seat-c holds no Zhao Yun, full 2 damage.
    const hitC = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'dmg-1', targets: [{ kind: 'seat', seatId: 'seat-c' }] }, { registry: registry(), mode: stubMode() }).state;
    expect(hitC.seats.find((s) => s.id === 'seat-c')!.combinedHp).toBe(3); // 5 - 2

    // distance(seat-a, seat-d) === 2 → seat-d's own Vanguard reduces by exactly 1,
    // and seat-b's copy (a different holder) must not also apply.
    const hitD = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'dmg-2', targets: [{ kind: 'seat', seatId: 'seat-d' }] }, { registry: registry(), mode: stubMode() }).state;
    expect(hitD.seats.find((s) => s.id === 'seat-d')!.combinedHp).toBe(5); // 6 - (2-1)
    expect(hitD.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(6); // untouched
  });
});

describe('Huang Yueying', () => {
  it('has no skills', () => {
    expect(huangYueyingGeneral.skills).toEqual([]);
  });
});
