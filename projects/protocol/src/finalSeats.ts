import type { GameState, Kingdom } from 'engine';

// What the Game Over screen needs of one seat, once the game has ended and
// every General is shown.
export interface FinalSeatView {
  seatId: string;
  // The printed Kingdom.
  kingdom: Kingdom;
  // null: never decided.
  allegiance: 'kingdom' | 'ambitionist' | null;
  // null when absent or 'hidden'.
  mainGeneralId: string | null;
  deputyGeneralId: string | null;
  eliminated: boolean;
}

const HIDDEN_GENERAL_ID = 'hidden';

function shownGeneralId(id: string | undefined): string | null {
  return id && id !== HIDDEN_GENERAL_ID ? id : null;
}

// One view per seat, in seat order.
export function finalSeatViews(state: Pick<GameState, 'seats'>): FinalSeatView[] {
  return state.seats.map((seat) => ({
    seatId: seat.id,
    kingdom: seat.kingdom,
    allegiance: seat.allegiance ?? null,
    mainGeneralId: shownGeneralId(seat.generals?.main.generalDefinitionId),
    deputyGeneralId: shownGeneralId(seat.generals?.deputy.generalDefinitionId),
    eliminated: seat.eliminated,
  }));
}
