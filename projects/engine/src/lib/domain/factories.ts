import { Seat, Player, Kingdom, CardZoneRef } from './types';

// A seat's max HP: half its two generals' printed HP, rounded down.
export function combinedMaxHp(mainMaxHp: number, deputyMaxHp: number): number {
  return Math.floor((mainMaxHp + deputyMaxHp) / 2);
}

export function createSeat(
  id: string,
  index: number,
  kingdom: Kingdom,
  mainGeneralId: string,
  deputyGeneralId: string,
  maxHpLookup: (generalDefinitionId: string) => number
): Seat {
  const maxCombinedHp = combinedMaxHp(maxHpLookup(mainGeneralId), maxHpLookup(deputyGeneralId));
  const hand: CardZoneRef = { zoneId: `${id}:hand` };
  const equipped: CardZoneRef = { zoneId: `${id}:equip` };
  const judgment: CardZoneRef = { zoneId: `${id}:judgment` };
  return {
    id,
    index,
    kingdom,
    generals: {
      main: { generalDefinitionId: mainGeneralId, revealed: false },
      deputy: { generalDefinitionId: deputyGeneralId, revealed: false },
    },
    combinedHp: maxCombinedHp,
    maxCombinedHp,
    hand,
    equipped,
    judgment,
    eliminated: false,
  };
}

export function createPlayer(id: string, seatId: string, kind: 'human' | 'bot', name: string): Player {
  return { id, seatId, kind, name };
}
