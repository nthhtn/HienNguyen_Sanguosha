import { xiahouDunGeneral, sunShangxiangGeneral, zhugeLiangGeneral } from './setOne';
import { resolve } from 'engine';
import type { GameState, ContentRegistry, GameModeDefinition, CardDefinition, GeneralDefinition } from 'engine';
import type { GeneralSkillSet } from './types';

// Skill tests don't depend on kingdom or maxHp (seat HP is set explicitly below).
const asDefinition = (g: GeneralSkillSet): GeneralDefinition => ({ ...g, kingdom: 'Wei', maxHp: 4 });

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

function registry(): ContentRegistry {
  return {
    cards: new Map([['test-damage-card', testDamageCard]]),
    generals: new Map([
      ['xiahou-dun', asDefinition(xiahouDunGeneral)],
      ['sun-shangxiang', asDefinition(sunShangxiangGeneral)],
      ['zhuge-liang', asDefinition(zhugeLiangGeneral)],
    ]),
  };
}

function stubMode(): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
}

function stateWithMainGeneral(generalId: string, seatACombinedHp = 5): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: generalId, revealed: false }, deputy: { generalDefinitionId: 'filler', revealed: false } },
        combinedHp: seatACombinedHp, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'filler2', revealed: false }, deputy: { generalDefinitionId: 'filler3', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Judgment',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [{ instanceId: 'draw-1', definitionId: 'sha', suit: 'spade', rank: 1 }] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'card-1', definitionId: 'test-damage-card', suit: 'heart', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null,
  };
}

describe('Xiahou Dun — Ferocity', () => {
  it('adds 1 to damage this seat deals with a card', () => {
    const state = stateWithMainGeneral('xiahou-dun');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(3); // 6 - (2+1)
  });
});

describe('Sun Shangxiang — Valor', () => {
  it('heals this seat 1 after it deals damage', () => {
    const state = stateWithMainGeneral('sun-shangxiang', 5);
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(6); // 5 + 1
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(4); // 6 - 2
  });
});

describe('Zhuge Liang — Insight', () => {
  it('draws 1 extra card when this seat enters the Draw phase', () => {
    const state = stateWithMainGeneral('zhuge-liang');
    const { state: next } = resolve(state, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry: registry(), mode: stubMode() });
    expect(next.phase).toBe('Draw');
    const hand = next.zones.find((z) => z.id === 'seat-a:hand')!;
    expect(hand.cards.map((c) => c.instanceId)).toContain('draw-1');
  });

  it('only the seat entering the Draw phase draws, when two seats both hold Zhuge Liang', () => {
    // Regression guard for owner mis-attribution: the trigger is gathered once
    // per holder, and each copy must only react to its own seat's phase change.
    let state = stateWithMainGeneral('zhuge-liang');
    state = {
      ...state,
      seats: state.seats.map((s) =>
        s.id === 'seat-b'
          ? { ...s, generals: { ...s.generals, main: { generalDefinitionId: 'zhuge-liang', revealed: false } } }
          : s
      ),
    };
    const { state: next } = resolve(state, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry: registry(), mode: stubMode() });
    expect(next.phase).toBe('Draw');
    // Exactly one card left the draw pile, and it went to seat-a — not one per holder.
    expect(next.zones.find((z) => z.id === 'drawPile')!.cards).toHaveLength(0);
    expect(next.zones.find((z) => z.id === 'seat-a:hand')!.cards.map((c) => c.instanceId)).toContain('draw-1');
    expect(next.zones.find((z) => z.id === 'seat-b:hand')!.cards).toHaveLength(0);
  });
});

describe('owner scoping across two holders of the same general', () => {
  // Regression guard for the same bug on a skill that uses owner context in its
  // `effect` (not just its `condition`): only the seat that actually dealt the
  // damage may be healed, and only once.
  it('Sun Shangxiang heals only the holder that dealt the damage', () => {
    let state = stateWithMainGeneral('sun-shangxiang', 5);
    state = {
      ...state,
      seats: state.seats.map((s) =>
        s.id === 'seat-b'
          ? {
              ...s,
              combinedHp: 4,
              maxCombinedHp: 6,
              generals: { ...s.generals, main: { generalDefinitionId: 'sun-shangxiang', revealed: false } },
            }
          : s
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry: registry(), mode: stubMode() }
    );
    expect(next.seats.find((s) => s.id === 'seat-a')!.combinedHp).toBe(6); // 5 + 1, healed once
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(2); // 4 - 2, its own copy did not heal it
  });
});
