import type { GameResult } from 'engine';
import type { FinalSeatView } from 'protocol';
import { SeatResultRecord } from '../persistence/records';
import { seatOutcome } from './stats';

// One row for each final seat that has a user (`userIds`: seat id to user id);
// bots and users who no longer exist have none.
export function buildSeatResults(input: { gameId: string; finalSeats: readonly FinalSeatView[]; result: GameResult | null; userIds: Readonly<Record<string, string>> }): SeatResultRecord[] {
  return input.finalSeats.flatMap((seat) => {
    const userId = input.userIds[seat.seatId];
    if (!userId) return [];
    return [
      {
        gameId: input.gameId,
        seatId: seat.seatId,
        userId,
        mainGeneralId: seat.mainGeneralId,
        deputyGeneralId: seat.deputyGeneralId,
        kingdom: seat.kingdom,
        allegiance: seat.allegiance,
        eliminated: seat.eliminated,
        won: seatOutcome(input.result, seat.seatId),
      },
    ];
  });
}
