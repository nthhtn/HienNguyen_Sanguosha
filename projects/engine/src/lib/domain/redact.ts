import { CardInstance, CardZone, GameState, GeneralSelectionState, Seat, SeatGenerals } from './types';

const HIDDEN_GENERAL_ID = 'hidden';
const HIDDEN_CARD_DEFINITION_ID = 'hidden';

function maskCard(card: CardInstance): CardInstance {
  return { ...card, definitionId: HIDDEN_CARD_DEFINITION_ID, suit: 'spade', rank: 0 };
}

function redactZone(zone: CardZone, viewerSeatId: string): CardZone {
  const isViewersOwnHand = zone.kind === 'hand' && zone.ownerSeatId === viewerSeatId;
  const shouldMask = (zone.kind === 'hand' && !isViewersOwnHand) || zone.kind === 'drawPile';
  if (!shouldMask) return zone;
  return { ...zone, cards: zone.cards.map(maskCard) };
}

function isKingdomRevealed(generals: SeatGenerals): boolean {
  return generals.main.revealed || generals.deputy.revealed;
}

function redactSeat(seat: Seat, viewerSeatId: string): Seat {
  // A seat with no generals yet has nothing to mask (its kingdom is 'hidden').
  if (seat.id === viewerSeatId || !seat.generals) return seat;
  const { main, deputy } = seat.generals;
  return {
    ...seat,
    kingdom: isKingdomRevealed(seat.generals) ? seat.kingdom : 'hidden',
    generals: {
      main: main.revealed ? main : { ...main, generalDefinitionId: HIDDEN_GENERAL_ID },
      deputy: deputy.revealed ? deputy : { ...deputy, generalDefinitionId: HIDDEN_GENERAL_ID },
    },
  };
}

function redactSelection(selection: GeneralSelectionState | null, viewerSeatId: string): GeneralSelectionState | null {
  if (!selection) return null;
  const candidates = Object.fromEntries(
    Object.entries(selection.candidates).map(([seatId, ids]) => [
      seatId,
      seatId === viewerSeatId ? ids : ids.map(() => HIDDEN_GENERAL_ID),
    ])
  );
  return { candidates };
}

export function redactStateForSeat(state: GameState, viewerSeatId: string): GameState {
  return {
    ...state,
    seats: state.seats.map((seat) => redactSeat(seat, viewerSeatId)),
    zones: state.zones.map((zone) => redactZone(zone, viewerSeatId)),
    generalSelection: redactSelection(state.generalSelection, viewerSeatId),
  };
}
