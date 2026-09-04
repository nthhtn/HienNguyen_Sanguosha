import { dongZhuoGeneral, zhaoYunGeneral, huangYueyingGeneral } from './setTwo';
import { resolve } from 'engine';
import type { GameState, ContentRegistry, GameModeDefinition, CardDefinition } from 'engine';

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

function seat(id: string, index: number, generalId: string, combinedHp: number, maxCombinedHp: number) {
  return {
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: generalId, revealed: false }, deputy: { generalDefinitionId: 'filler', revealed: false } },
    combinedHp, maxCombinedHp,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
  };
}

describe('Dong Zhuo — Tyranny', () => {
  it('reduces healing to this seat by 1', () => {
    const state: GameState = {
      seats: [seat('seat-a', 0, 'dong-zhuo', 3, 6)],
      players: [],
      turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
      phase: 'Play',
      zones: [
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'heal-1', definitionId: 'test-heal-self-card', suit: 'spade', rank: 1 }] },
        { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      ],
      pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
    };
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'heal-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(4); // 3 + (2-1)
  });
});

describe('Zhao Yun — Vanguard', () => {
  it('reduces damage by 1 when the source is 2+ seats away', () => {
    const seats = [seat('seat-a', 0, 'filler', 5, 5), seat('seat-b', 1, 'filler', 5, 5), seat('seat-c', 2, 'zhao-yun', 6, 6), seat('seat-d', 3, 'filler', 5, 5)];
    const state: GameState = {
      seats,
      players: [],
      turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
      phase: 'Play',
      zones: [
        { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'dmg-1', definitionId: 'test-damage-card', suit: 'spade', rank: 1 }] },
        { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
        { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] }, { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
        { id: 'seat-c:hand', kind: 'hand', ownerSeatId: 'seat-c', cards: [] }, { id: 'seat-c:equip', kind: 'equip', ownerSeatId: 'seat-c', cards: [] },
        { id: 'seat-d:hand', kind: 'hand', ownerSeatId: 'seat-d', cards: [] }, { id: 'seat-d:equip', kind: 'equip', ownerSeatId: 'seat-d', cards: [] },
      ],
      pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
    };
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'dmg-1', targets: [{ kind: 'seat', seatId: 'seat-c' }] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-c')!.combinedHp).toBe(5); // 6 - (2-1), distance(seat-a, seat-c) === 2
  });
});

describe('Huang Yueying', () => {
  it('has no skills', () => {
    expect(huangYueyingGeneral.skills).toEqual([]);
  });
});
