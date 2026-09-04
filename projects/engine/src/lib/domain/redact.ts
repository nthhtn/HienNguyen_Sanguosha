import { GameState, Seat } from './types';

const HIDDEN_GENERAL_ID = 'hidden';

function redactSeat(seat: Seat, viewerSeatId: string): Seat {
  if (seat.id === viewerSeatId) return seat;
  return {
    ...seat,
    generals: {
      main: seat.generals.main.revealed
        ? seat.generals.main
        : { ...seat.generals.main, generalDefinitionId: HIDDEN_GENERAL_ID },
      deputy: seat.generals.deputy.revealed
        ? seat.generals.deputy
        : { ...seat.generals.deputy, generalDefinitionId: HIDDEN_GENERAL_ID },
    },
  };
}

export function redactStateForSeat(state: GameState, viewerSeatId: string): GameState {
  return {
    ...state,
    seats: state.seats.map((seat) => redactSeat(seat, viewerSeatId)),
  };
}
