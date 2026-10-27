import { GameResult, Kingdom } from 'engine';
import { FinalSeatView } from 'protocol';
import { Force } from '../labels';

export type VictoryGroup = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'WinningAmbitionist' | 'LosingAmbitionist';

export interface VictoryMember {
  seatId: string;
  mainGeneralId: string | null;
  deputyGeneralId: string | null;
  survived: boolean;
  you: boolean;
}

export interface VictoryColumn {
  group: VictoryGroup;
  force: Force;
  winning: boolean;
  members: VictoryMember[];
}

export type HeadlineKind = 'kingdom' | 'ambitionist' | 'lone-survivor' | 'draw';

export interface VictoryView {
  // In the fixed order; a group nobody belongs to is left out.
  columns: VictoryColumn[];
  winningGroup: VictoryGroup | null;
  headlineKind: HeadlineKind;
  // The sole survivor, else null.
  winnerSeatId: string | null;
  // For the headline, when headlineKind is 'kingdom'.
  winningKingdom: Kingdom | null;
}

const ORDER: readonly VictoryGroup[] = ['Wei', 'Shu', 'Wu', 'Qun', 'WinningAmbitionist', 'LosingAmbitionist'];

type KingdomGroup = 'Wei' | 'Shu' | 'Wu' | 'Qun';

const kingdomGroup = (kingdom: Kingdom): KingdomGroup | null => (kingdom === 'hidden' ? null : kingdom);

// The group a seat belongs to once Ambitionists are split: an Ambitionist by
// allegiance, else its Kingdom (a seat with no decided allegiance keeps its
// printed one). null when it has neither.
function groupOf(seat: FinalSeatView, winners: ReadonlySet<string>, ambitionistWins: boolean): VictoryGroup | null {
  if (seat.allegiance === 'ambitionist') return ambitionistWins && winners.has(seat.seatId) ? 'WinningAmbitionist' : 'LosingAmbitionist';
  return kingdomGroup(seat.kingdom);
}

// Turns the final seats and the result into the Victory window's columns.
// Membership follows each seat's allegiance and Kingdom, not winningSeatIds.
export function victoryColumns(seats: readonly FinalSeatView[], result: GameResult, youSeatId: string | null): VictoryView {
  const winners = new Set(result.winningSeatIds);
  const winningKingdom = result.winningKingdom && result.winningKingdom !== 'hidden' ? result.winningKingdom : null;
  const sole = winningKingdom ? undefined : seats.find((s) => winners.has(s.seatId));

  let headlineKind: HeadlineKind;
  let winningGroup: VictoryGroup | null = null;
  let headlineKingdom: Kingdom | null = null;
  if (winningKingdom) {
    headlineKind = 'kingdom';
    winningGroup = winningKingdom;
    headlineKingdom = winningKingdom;
  } else if (winners.size === 0) {
    headlineKind = 'draw';
  } else if (sole?.allegiance === 'ambitionist') {
    headlineKind = 'ambitionist';
    winningGroup = 'WinningAmbitionist';
  } else {
    headlineKind = sole?.allegiance === 'kingdom' ? 'kingdom' : 'lone-survivor';
    winningGroup = sole ? kingdomGroup(sole.kingdom) : null;
    if (headlineKind === 'kingdom' && sole) headlineKingdom = sole.kingdom;
  }

  const byGroup = new Map<VictoryGroup, VictoryMember[]>();
  for (const seat of seats) {
    const group = groupOf(seat, winners, winningGroup === 'WinningAmbitionist');
    if (!group) continue;
    const members = byGroup.get(group) ?? [];
    members.push({
      seatId: seat.seatId,
      mainGeneralId: seat.mainGeneralId,
      deputyGeneralId: seat.deputyGeneralId,
      survived: !seat.eliminated,
      you: seat.seatId === youSeatId,
    });
    byGroup.set(group, members);
  }

  const columns = ORDER.filter((group) => byGroup.has(group)).map((group): VictoryColumn => ({
    group,
    force: group === 'WinningAmbitionist' || group === 'LosingAmbitionist' ? 'Ambitionist' : group,
    winning: group === winningGroup,
    members: byGroup.get(group) ?? [],
  }));

  return {
    columns,
    winningGroup,
    headlineKind,
    winnerSeatId: winners.size === 1 ? [...winners][0] : null,
    winningKingdom: headlineKingdom,
  };
}
