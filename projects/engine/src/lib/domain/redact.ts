import { CardInstance, CardZone, GameState, Seat } from './types';

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

function isKingdomRevealed(seat: Seat): boolean {
  return seat.generals.main.revealed || seat.generals.deputy.revealed;
}

function redactSeat(seat: Seat, viewerSeatId: string): Seat {
  if (seat.id === viewerSeatId) return seat;
  return {
    ...seat,
    kingdom: isKingdomRevealed(seat) ? seat.kingdom : 'hidden',
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
    zones: state.zones.map((zone) => redactZone(zone, viewerSeatId)),
  };
}
