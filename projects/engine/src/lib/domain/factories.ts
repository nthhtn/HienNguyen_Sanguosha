import { Seat, Player, Kingdom, CardZoneRef } from './types';

export function createSeat(
  id: string,
  index: number,
  kingdom: Kingdom,
  mainGeneralId: string,
  deputyGeneralId: string,
  maxHpLookup: (generalDefinitionId: string) => number
): Seat {
  const maxCombinedHp = maxHpLookup(mainGeneralId) + maxHpLookup(deputyGeneralId);
  const hand: CardZoneRef = { zoneId: `${id}:hand` };
  const equipped: CardZoneRef = { zoneId: `${id}:equip` };
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
    eliminated: false,
  };
}

export function createPlayer(id: string, seatId: string, kind: 'human' | 'bot'): Player {
  return { id, seatId, kind };
}
