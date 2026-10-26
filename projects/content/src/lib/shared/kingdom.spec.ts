import { exposedKingdom, exposedKingdomCounts, exposedGroup, kingdomCap, ownKingdom, sameKingdomSeatIds, seatsInKingdom } from './kingdom';
import type { GameState, Seat } from 'engine';

function seat(id: string, index: number, kingdom: Seat['kingdom'], eliminated = false, revealed = kingdom !== 'hidden'): Seat {
  return {
    id, index, kingdom,
    generals: { main: { generalDefinitionId: 'g1', revealed }, deputy: { generalDefinitionId: 'g2', revealed } },
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated,
  };
}

function stateWith(seats: Seat[]): GameState {
  return {
    seats, players: [],
    turn: { turnNumber: 1, ownerSeatId: seats[0].id, extraTurnStack: [] },
    phase: 'Play', zones: [], pendingResponse: null, log: [],
    rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('Kingdom helpers', () => {
  const state = stateWith([seat('a', 0, 'Wei'), seat('b', 1, 'Wei'), seat('c', 2, 'hidden')]);

  it('lists living seats sharing the Kingdom, starting with the given seat', () => {
    expect(sameKingdomSeatIds(state, 'a')).toEqual(['a', 'b']);
    expect(sameKingdomSeatIds(state, 'b')).toEqual(['b', 'a']);
  });

  it('returns only the seat itself when it has no Kingdom', () => {
    expect(sameKingdomSeatIds(state, 'c')).toEqual(['c']);
  });

  it('a seat that has not chosen Generals (generals null) has no exposed Kingdom', () => {
    const early = stateWith([seat('a', 0, 'Wei'), { ...seat('b', 1, 'Wei'), generals: null } as Seat]);
    expect(exposedKingdom(early, 'b')).toBeNull();
    expect(sameKingdomSeatIds(early, 'a')).toEqual(['a']);
    expect(exposedKingdomCounts(early).get('Wei')).toBe(1);
  });

  it('excludes dead seats', () => {
    const dead = stateWith([seat('a', 0, 'Wei'), seat('b', 1, 'Wei', true), seat('c', 2, 'hidden')]);
    expect(sameKingdomSeatIds(dead, 'a')).toEqual(['a']);
  });

  it('exposedKingdom is null for a hidden seat and the Kingdom otherwise', () => {
    expect(exposedKingdom(state, 'c')).toBeNull();
    expect(exposedKingdom(state, 'a')).toBe('Wei');
  });

  describe('exposure', () => {
    it('a seat with a true Kingdom but both Generals face-down has no exposed Kingdom', () => {
      const s = stateWith([seat('a', 0, 'Wei'), seat('b', 1, 'Wei', false, false)]);
      expect(exposedKingdom(s, 'b')).toBeNull();
      expect(sameKingdomSeatIds(s, 'a')).toEqual(['a']);
    });

    it('revealing only the deputy exposes the Kingdom', () => {
      const b = seat('b', 1, 'Wei', false, false);
      b.generals!.deputy.revealed = true;
      const s = stateWith([seat('a', 0, 'Wei'), b]);
      expect(exposedKingdom(s, 'b')).toBe('Wei');
      expect(sameKingdomSeatIds(s, 'a')).toEqual(['a', 'b']);
    });

    it('exposedKingdomCounts counts living exposed seats per Kingdom', () => {
      const s = stateWith([
        seat('a', 0, 'Wei'), seat('b', 1, 'Wei', false, false), seat('c', 2, 'Wei', true),
        seat('d', 3, 'Shu'), seat('e', 4, 'hidden'),
      ]);
      expect(exposedKingdomCounts(s)).toEqual(new Map([['Wei', 1], ['Shu', 1]]));
    });
  });
});

describe('Ambitionists and the Kingdom cap', () => {
  const withAllegiance = (s: Seat, allegiance: 'kingdom' | 'ambitionist'): Seat => ({ ...s, allegiance });
  const table = (n: number) => stateWith(Array.from({ length: n }, (_, i) => seat(`s${i}`, i, 'Shu')));

  it('kingdomCap is half the table rounded down', () => {
    expect(kingdomCap(table(7))).toBe(3);
    expect(kingdomCap(table(6))).toBe(3);
    expect(kingdomCap(table(2))).toBe(1);
  });

  it('seatsInKingdom counts decided Kingdom seats of that Kingdom, dead ones too', () => {
    const s = stateWith([
      withAllegiance(seat('a', 0, 'Wei'), 'kingdom'),
      withAllegiance(seat('b', 1, 'Wei', true), 'kingdom'),
      withAllegiance(seat('c', 2, 'Wei'), 'ambitionist'),
      seat('d', 3, 'Wei'),
      withAllegiance(seat('e', 4, 'Shu'), 'kingdom'),
    ]);
    expect(seatsInKingdom(s, 'Wei')).toBe(2);
    expect(seatsInKingdom(s, 'Shu')).toBe(1);
  });

  it('exposedKingdom is null for an Ambitionist, and it stands alone', () => {
    const s = stateWith([seat('a', 0, 'Wei'), withAllegiance(seat('b', 1, 'Wei'), 'ambitionist'), seat('c', 2, 'Wei')]);
    expect(exposedKingdom(s, 'b')).toBeNull();
    expect(sameKingdomSeatIds(s, 'b')).toEqual(['b']);
    expect(sameKingdomSeatIds(s, 'a')).toEqual(['a', 'c']);
  });

  it('exposedKingdomCounts skips Ambitionists', () => {
    const s = stateWith([seat('a', 0, 'Wei'), withAllegiance(seat('b', 1, 'Wei'), 'ambitionist')]);
    expect(exposedKingdomCounts(s).get('Wei')).toBe(1);
  });

  it('exposedGroup is the Kingdom, or a group of one for an Ambitionist, or null while hidden', () => {
    const s = stateWith([seat('a', 0, 'Wei'), withAllegiance(seat('b', 1, 'Wei'), 'ambitionist'), seat('c', 2, 'hidden')]);
    expect(exposedGroup(s, 'a')).toBe('Wei');
    expect(exposedGroup(s, 'b')).toBe('ambitionist:b');
    expect(exposedGroup(s, 'c')).toBeNull();
  });

  it('ownKingdom is null for an Ambitionist', () => {
    const s = stateWith([withAllegiance(seat('a', 0, 'Wei'), 'ambitionist')]);
    expect(ownKingdom(s, { kind: 'general', seatId: 'a', slot: 'main', skillId: 'x' }, { cards: new Map(), generals: new Map() })).toBeNull();
  });
});
