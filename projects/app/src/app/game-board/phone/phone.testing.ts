import type { Seat } from 'engine';

// A seat with hidden Generals, for the phone board's specs.
export function testSeat(id: string, index: number, extra: Partial<Seat> = {}): Seat {
  return {
    id,
    index,
    kingdom: 'hidden',
    eliminated: false,
    generals: { main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } },
    combinedHp: 4,
    maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` },
    equipped: { zoneId: `${id}:equip` },
    judgment: { zoneId: `${id}:judgment` },
    ...extra,
  };
}

export function testSeats(count: number): Seat[] {
  return Array.from({ length: count }, (_, i) => testSeat(`seat-${i}`, i));
}
