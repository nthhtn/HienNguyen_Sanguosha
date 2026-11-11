import { redactStateForSeat } from 'engine';
import type { GameState, Kingdom, Seat } from 'engine';
import { forcesOf, isDangerous, leadingForceOf, relationOf, seatDanger } from './table';
import { registry, table } from './testing';

// Six seats seat-a ... seat-f. `kingdoms` gives each seat's Kingdom ('hidden' = a seat that has shown no
// General yet: its real Kingdom is Qun, it has no allegiance). Shown seats play for their Kingdom unless
// listed in `ambitionists`. `eliminated` seats are dead.
function game(
  kingdoms: Kingdom[], o: { hp?: number[]; ambitionists?: string[]; eliminated?: string[] } = {},
): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'];
  const s = table({}, {
    seats: 6,
    kingdoms: Object.fromEntries(ids.map((id, i) => [id, kingdoms[i] === 'hidden' ? 'Qun' : kingdoms[i]])),
    generals: Object.fromEntries(ids.map((id, i) => [id, ['filler-xu-huang', 'filler-dong-zhuo', kingdoms[i] !== 'hidden']])),
    hp: Object.fromEntries(ids.map((id, i) => [id, o.hp?.[i] ?? 4])),
  });
  return {
    ...s,
    seats: s.seats.map((seat): Seat => {
      const dead = o.eliminated?.includes(seat.id) ?? false;
      const base = { ...seat, eliminated: dead, combinedHp: dead ? 0 : seat.combinedHp };
      if (kingdoms[seat.index] === 'hidden') return base;
      return { ...base, allegiance: o.ambitionists?.includes(seat.id) ? 'ambitionist' : 'kingdom' };
    }),
  };
}
const seat = (view: GameState, id: string) => view.seats.find((s) => s.id === id)!;
const relations = (view: GameState, meId: string) =>
  Object.fromEntries(view.seats.map((s) => [s.id, relationOf(view, seat(view, meId), s)]));

describe('forcesOf (rule 1)', () => {
  it('groups shown seats by Kingdom, makes each Ambitionist a force of one, and leaves hidden and dead seats out', () => {
    const s = game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden'], { hp: [3, 4, 2, 1, 4, 4], ambitionists: ['seat-e'] });
    const expected = [
      { key: 'Wei', seatIds: ['seat-a', 'seat-d'], hp: 4 },
      { key: 'Shu', seatIds: ['seat-b'], hp: 4 },
      { key: 'Wu', seatIds: ['seat-c'], hp: 2 },
      { key: 'ambitionist:seat-e', seatIds: ['seat-e'], hp: 4 },
    ];
    expect(forcesOf(s)).toEqual(expected);
    // The same from a seat's redacted view.
    expect(forcesOf(redactStateForSeat(s, 'seat-b'))).toEqual(expected);
    const dead = game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden'], { eliminated: ['seat-d'] });
    expect(forcesOf(dead).find((f) => f.key === 'Wei')!.seatIds).toEqual(['seat-a', 'seat-e']);
  });
});

describe('leadingForceOf (rule 2)', () => {
  it('3 Wei against 1 Shu and 1 Wu: Wei leads', () => {
    const view = redactStateForSeat(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden']), 'seat-b');
    expect(leadingForceOf(view)?.key).toBe('Wei');
  });

  it('a tie on seats, or a lone seat, leads nobody', () => {
    expect(leadingForceOf(game(['Wei', 'Shu', 'Wu', 'Wei', 'Shu', 'hidden']))).toBeNull();
    expect(leadingForceOf(game(['Wei', 'Shu', 'hidden', 'hidden', 'hidden', 'hidden']))).toBeNull();
  });

  it('a leader whose HP is not greater than the next force by seats is weakened', () => {
    // Wei 3 seats, 3 HP; Shu 1 seat, 3 HP.
    expect(leadingForceOf(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden'], { hp: [1, 3, 2, 1, 1, 4] }))).toBeNull();
    // Wei 4 HP > Shu 3 HP: Wei leads.
    expect(leadingForceOf(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden'], { hp: [2, 3, 2, 1, 1, 4] }))?.key).toBe('Wei');
  });

  it('only the force with the next most seats weakens the leader, the strongest of them when several tie', () => {
    // Wei 3 seats, 6 HP; Shu 2 seats, 5 HP; Wu 1 seat with 9 HP does not count.
    expect(leadingForceOf(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'Shu'], { hp: [2, 3, 9, 2, 2, 2] }))?.key).toBe('Wei');
    // Wei 3 seats, 6 HP; Shu and Wu 1 seat each, Wu at 6 HP: weakened.
    expect(leadingForceOf(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden'], { hp: [2, 1, 6, 2, 2, 4] }))).toBeNull();
  });
});

describe('relationOf (rule 3)', () => {
  it('a Shu bot while Wei leads: Wu is a truce partner; Wei and hidden seats are foes', () => {
    const view = redactStateForSeat(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden']), 'seat-b');
    expect(relations(view, 'seat-b')).toEqual({
      'seat-a': 'foe', 'seat-b': 'self', 'seat-c': 'truce', 'seat-d': 'foe', 'seat-e': 'foe', 'seat-f': 'foe',
    });
  });

  it('a Shu bot sees a Shu seat as an ally', () => {
    const view = redactStateForSeat(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'Shu']), 'seat-b');
    expect(relations(view, 'seat-b')).toEqual({
      'seat-a': 'foe', 'seat-b': 'self', 'seat-c': 'truce', 'seat-d': 'foe', 'seat-e': 'foe', 'seat-f': 'ally',
    });
  });

  it('a Wei bot whose own force leads sees no truce', () => {
    const view = redactStateForSeat(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'Shu']), 'seat-a');
    expect(relations(view, 'seat-a')).toEqual({
      'seat-a': 'self', 'seat-b': 'foe', 'seat-c': 'foe', 'seat-d': 'ally', 'seat-e': 'ally', 'seat-f': 'foe',
    });
  });

  it('once a Wei seat dies and Wei ties with Shu, nobody leads and there is no truce', () => {
    const view = redactStateForSeat(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'Shu'], { eliminated: ['seat-e'] }), 'seat-b');
    expect(relations(view, 'seat-b')['seat-c']).toBe('foe');
  });

  it('a hidden bot reads its own force from its own Main General', () => {
    // seat-f is hidden (its Kingdom is Qun) and sees Shu and Wu as truce partners while Wei leads.
    const hiddenQun = redactStateForSeat(game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden']), 'seat-f');
    expect(relations(hiddenQun, 'seat-f')).toEqual({
      'seat-a': 'foe', 'seat-b': 'truce', 'seat-c': 'truce', 'seat-d': 'foe', 'seat-e': 'foe', 'seat-f': 'self',
    });
    // A hidden Wei bot is part of the leading force: no truce.
    const s = game(['Wei', 'Shu', 'Wu', 'Wei', 'Wei', 'hidden']);
    const hiddenWei = redactStateForSeat({ ...s, seats: s.seats.map((x) => (x.id === 'seat-f' ? { ...x, kingdom: 'Wei' } : x)) }, 'seat-f');
    expect(relations(hiddenWei, 'seat-f')['seat-b']).toBe('foe');
  });

  it('an Ambitionist bot is its own force', () => {
    const view = redactStateForSeat(game(['Wei', 'Wei', 'Shu', 'Wei', 'Wu', 'Wei'], { ambitionists: ['seat-f'] }), 'seat-f');
    expect(relations(view, 'seat-f')).toEqual({
      'seat-a': 'foe', 'seat-b': 'foe', 'seat-c': 'truce', 'seat-d': 'foe', 'seat-e': 'truce', 'seat-f': 'self',
    });
  });
});

describe('seatDanger and isDangerous (rule 4)', () => {
  const danger = (id: string) => (id === 'filler-xu-huang' ? 2 : 1.5);

  it('sums the danger of revealed Generals only', () => {
    const s = game(['Wei', 'Shu', 'Wu', 'Qun', 'Wei', 'Shu']);
    const mainOnly = s.seats.map((x) => (x.id === 'seat-b' ? { ...x, generals: { ...x.generals!, deputy: { ...x.generals!.deputy, revealed: false } } } : x));
    const both = { ...s, seats: mainOnly };
    expect(seatDanger(both, seat(both, 'seat-a'), registry, danger)).toBe(3.5);
    expect(seatDanger(both, seat(both, 'seat-b'), registry, danger)).toBe(2);
    // From seat-c's view seat-b's hidden deputy shows as 'hidden'; from its own view it is known but still counts 0.
    const cView = redactStateForSeat(both, 'seat-c');
    const bView = redactStateForSeat(both, 'seat-b');
    expect(seatDanger(cView, seat(cView, 'seat-b'), registry, danger)).toBe(2);
    expect(seatDanger(bView, seat(bView, 'seat-b'), registry, danger)).toBe(2);
    const hidden = game(['hidden', 'Shu', 'Wu', 'Qun', 'Wei', 'Shu']);
    expect(seatDanger(hidden, seat(hidden, 'seat-a'), registry, danger)).toBe(0);
  });

  it('a seat is dangerous at 2 or more', () => {
    expect(isDangerous(2)).toBe(true);
    expect(isDangerous(1.99)).toBe(false);
  });
});
