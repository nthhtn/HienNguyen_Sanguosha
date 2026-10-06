import { CardInstance, CardZone, GameState, GeneralSelectionState, Seat, SeatGenerals } from './types';

const HIDDEN_GENERAL_ID = 'hidden';
const HIDDEN_CARD_DEFINITION_ID = 'hidden';

function maskCard(card: CardInstance): CardInstance {
  return { ...card, definitionId: HIDDEN_CARD_DEFINITION_ID, suit: 'spade', rank: 0 };
}

// Zones whose cards lie face-up for every seat to see.
export function isFaceUpZoneKind(kind: CardZone['kind']): boolean {
  return kind !== 'hand' && kind !== 'drawPile';
}

function redactZone(zone: CardZone, viewerSeatId: string): CardZone {
  const isViewersOwnHand = zone.kind === 'hand' && zone.ownerSeatId === viewerSeatId;
  const shouldMask = !isFaceUpZoneKind(zone.kind) && !isViewersOwnHand;
  if (!shouldMask) return zone;
  return { ...zone, cards: zone.cards.map(maskCard) };
}

// The instance ids `viewerSeatId` can't see where they lie: other seats'
// hands and the draw pile.
function hiddenInstanceIds(state: GameState, viewerSeatId: string): ReadonlySet<string> {
  return new Set(
    state.zones
      .filter((z) => !isFaceUpZoneKind(z.kind) && !(z.kind === 'hand' && z.ownerSeatId === viewerSeatId))
      .flatMap((z) => z.cards.map((c) => c.instanceId))
  );
}

function isCardInstance(value: object): value is CardInstance {
  const v = value as Partial<CardInstance>;
  return typeof v.instanceId === 'string' && typeof v.definitionId === 'string' && typeof v.suit === 'string' && typeof v.rank === 'number';
}

// Masks every hidden card instance anywhere inside `value` (queued effects, a
// pending response or choice), the same way its zone masks it.
function maskHiddenCards<T>(value: T, hidden: ReadonlySet<string>): T {
  if (Array.isArray(value)) return value.map((v) => maskHiddenCards(v, hidden)) as T;
  if (value === null || typeof value !== 'object') return value;
  if (isCardInstance(value)) return (hidden.has(value.instanceId) ? maskCard(value) : value) as T;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskHiddenCards(v, hidden)])) as T;
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
  const hidden = hiddenInstanceIds(state, viewerSeatId);
  return {
    ...state,
    seats: state.seats.map((seat) => redactSeat(seat, viewerSeatId)),
    zones: state.zones.map((zone) => redactZone(zone, viewerSeatId)),
    generalSelection: redactSelection(state.generalSelection, viewerSeatId),
    pendingResponse: maskHiddenCards(state.pendingResponse, hidden),
    ...(state.pendingChoice ? { pendingChoice: maskHiddenCards(state.pendingChoice, hidden) } : {}),
    ...(state.pendingSelection ? { pendingSelection: maskHiddenCards(state.pendingSelection, hidden) } : {}),
    ...(state.resolutionQueue ? { resolutionQueue: maskHiddenCards(state.resolutionQueue, hidden) } : {}),
  };
}
