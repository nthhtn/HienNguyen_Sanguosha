import type { CardInstance, GameState } from 'engine';
import { buildContentRegistry } from './registry';
import { attackRange, getSeatDistance, seatDistance } from './shared/queries';
import { shaTargetIds } from './shared/shaRules';
import { wikiDistanceTable, wikiDistanceWeapons } from './wikiDistance';

const registry = buildContentRegistry();
const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 7 });

// A table of six built here, apart from the helper, so the helper is compared with the game's own rules on the same seats.
function sixSeats(setup: { out?: number[]; equip?: Record<number, string[]> } = {}): GameState {
  const ids = [1, 2, 3, 4, 5, 6].map((n) => `seat-${n}`);
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index % 4], eliminated: !!setup.out?.includes(index + 1),
      generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
      combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-1', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id, i) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: (setup.equip?.[i + 1] ?? []).map((def, k) => card(`e${i + 1}-${k}`, def)) },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
const seats = (n = 6, patch: Record<number, object> = {}) => Array.from({ length: n }, (_, i) => ({ n: i + 1, ...(patch[i + 1] ?? {}) }));
const row = (result: ReturnType<typeof wikiDistanceTable>, n: number) => result.seats.find((s) => s.n === n)!;

describe('wikiDistanceTable', () => {
  it('reports steps, distance and reach for a plain table of six', () => {
    const result = wikiDistanceTable({ seats: seats() });
    expect(result.range).toBe(1);
    expect([2, 3, 4, 5, 6].map((n) => row(result, n).steps)).toEqual([1, 2, 3, 2, 1]);
    expect([2, 3, 4, 5, 6].map((n) => row(result, n).distance)).toEqual([1, 2, 3, 2, 1]);
    expect([2, 3, 4, 5, 6].filter((n) => row(result, n).canReach)).toEqual([2, 6]);
  });

  it('a seat that is out has no distance, and the seats beside it get closer', () => {
    const result = wikiDistanceTable({ seats: seats(6, { 2: { out: true } }) });
    expect(row(result, 2)).toEqual({ n: 2, steps: null, distance: null, canReach: false });
    expect(row(result, 3).distance).toBe(1);
    expect(row(result, 3).canReach).toBe(true);
  });

  it('the attacker has no distance to itself', () => {
    expect(row(wikiDistanceTable({ seats: seats() }), 1)).toEqual({ n: 1, steps: null, distance: null, canReach: false });
  });

  it('a Mount on the target adds 1 and one on the attacker takes 1 off, never below 1, as the game counts it', () => {
    const plus = wikiDistanceTable({ seats: seats(6, { 3: { mount: 'shadow-runner' } }) });
    expect(row(plus, 3)).toMatchObject({ steps: 2, distance: 3 });
    const minus = wikiDistanceTable({ seats: seats(6, { 1: { mount: 'red-hare' } }) });
    expect(row(minus, 2).distance).toBe(1);
    expect(row(minus, 3).distance).toBe(1);
    const state = sixSeats({ equip: { 1: ['red-hare'], 3: ['shadow-runner'] } });
    const both = wikiDistanceTable({ seats: seats(6, { 1: { mount: 'red-hare' }, 3: { mount: 'shadow-runner' } }) });
    for (const n of [2, 3, 4, 5, 6]) expect(row(both, n).distance).toBe(seatDistance(state, 'seat-1', `seat-${n}`, registry));
  });

  it('a Weapon sets the range and decides reach, as the game says', () => {
    const state = sixSeats({ equip: { 1: ['gender-swords'] } });
    const result = wikiDistanceTable({ seats: seats(), weapon: 'gender-swords' });
    expect(result.range).toBe(attackRange(state, 'seat-1', registry));
    expect(result.range).toBe(2);
    expect(shaTargetIds(state, 'seat-1', registry)).toEqual(result.seats.filter((s) => s.canReach).map((s) => `seat-${s.n}`));
    expect(row(result, 3).canReach).toBe(true);
    expect(row(wikiDistanceTable({ seats: seats() }), 3).canReach).toBe(false);
  });

  it('agrees with the game rule by rule on a mixed table', () => {
    const state = sixSeats({ out: [4], equip: { 1: ['red-hare', 'green-dragon-blade'], 6: ['shadow-runner'] } });
    const result = wikiDistanceTable({ seats: seats(6, { 4: { out: true }, 1: { mount: 'red-hare' }, 6: { mount: 'shadow-runner' } }), weapon: 'green-dragon-blade' });
    for (const n of [2, 3, 5, 6]) {
      expect(row(result, n).steps).toBe(getSeatDistance(state, 'seat-1', `seat-${n}`));
      expect(row(result, n).distance).toBe(seatDistance(state, 'seat-1', `seat-${n}`, registry));
    }
    expect(result.range).toBe(3);
  });
});

describe('wikiDistanceTable refuses a table that is not one', () => {
  it('needs seats numbered 1 to N in order, with seat 1 the attacker', () => {
    expect(() => wikiDistanceTable({ seats: [{ n: 2 }, { n: 3 }] })).toThrow(/numbered 1 to/);
    expect(() => wikiDistanceTable({ seats: [{ n: 1 }, { n: 1 }, { n: 2 }] })).toThrow(/numbered 1 to/);
    expect(() => wikiDistanceTable({ seats: [{ n: 1 }, { n: 3 }, { n: 2 }] })).toThrow(/numbered 1 to/);
    expect(() => wikiDistanceTable({ seats: [] })).toThrow(/numbered 1 to/);
  });

  it('refuses a mount or weapon the game does not know, or one worn in the wrong slot', () => {
    expect(() => wikiDistanceTable({ seats: seats(3, { 2: { mount: 'not-a-horse' } }) })).toThrow(/mount/i);
    expect(() => wikiDistanceTable({ seats: seats(3, { 2: { mount: 'crossbow' } }) })).toThrow(/mount/i);
    expect(() => wikiDistanceTable({ seats: seats(3), weapon: 'red-hare' })).toThrow(/weapon/i);
    expect(() => wikiDistanceTable({ seats: seats(3), weapon: 'nothing' })).toThrow(/weapon/i);
  });
});

describe('wikiDistanceWeapons', () => {
  it('lists the demo weapons with ranges from the registry', () => {
    expect(wikiDistanceWeapons()).toEqual([
      { id: 'gender-swords', range: 2 },
      { id: 'green-dragon-blade', range: 3 },
      { id: 'fire-fan', range: 4 },
    ]);
  });
});
