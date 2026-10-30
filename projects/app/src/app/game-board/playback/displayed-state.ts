import { CardInstance, EngineEvent, GameState, Seat } from 'engine';

type FoldDefinition<E extends EngineEvent> = (state: GameState, event: E, target: GameState) => GameState;

// Applies one logged event's recorded facts to the board's displayed state. No rules: a fold changes only what
// its event says changed. `target` is the latest visible state, the source of card faces and General identities.
export const FOLDS: { [K in EngineEvent['kind']]?: FoldDefinition<Extract<EngineEvent, { kind: K }>> } = {
  DamageDealtEvent: (state, e) => changeHp(state, e.damage.target.seatId, -e.damage.amount),
  HpLostEvent: (state, e) => changeHp(state, e.seatId, -e.amount),
  HealEvent: (state, e) => changeHp(state, e.target.seatId, e.amount),
  MaxHpReducedEvent: (state, e) =>
    updateSeat(state, e.seatId, (s) => ({ ...s, maxCombinedHp: e.maxHp, combinedHp: Math.min(s.combinedHp, e.maxHp) })),
  CardMovedEvent: (state, e, target) => moveCard(state, e.cardInstanceId, e.fromZoneId, e.toZoneId, faceOf(e.cardInstanceId, target, e.card)),
  CardsDrawnEvent: (state, e, target) => {
    const handZoneId = state.seats.find((s) => s.id === e.seatId)?.hand.zoneId;
    if (!handZoneId) return state;
    return e.cardInstanceIds.reduce((s, id) => moveCard(s, id, 'drawPile', handZoneId, faceOf(id, target)), state);
  },
  SeatEliminatedEvent: (state, e) => updateSeat(state, e.seatId, (s) => ({ ...s, eliminated: true })),
  GeneralRevealedEvent: (state, e, target) => copyGenerals(state, e.seatId, target),
  GeneralHiddenEvent: (state, e, target) => copyGenerals(state, e.seatId, target),
  TurnAdvancedEvent: (state, e) => ({ ...state, turn: { ...state.turn, ownerSeatId: e.seatId } }),
  PhaseChangedEvent: (state, e) => ({ ...state, phase: e.phase }),
};

export function foldEvent(state: GameState, event: EngineEvent, target: GameState): GameState {
  // The table is keyed by kind, so the entry always matches this event.
  const fold = FOLDS[event.kind] as FoldDefinition<EngineEvent> | undefined;
  return fold ? fold(state, event, target) : state;
}

function updateSeat(state: GameState, seatId: string, change: (seat: Seat) => Seat): GameState {
  if (!state.seats.some((s) => s.id === seatId)) return state;
  return { ...state, seats: state.seats.map((s) => (s.id === seatId ? change(s) : s)) };
}

const changeHp = (state: GameState, seatId: string, delta: number): GameState =>
  updateSeat(state, seatId, (s) => ({ ...s, combinedHp: s.combinedHp + delta }));

const copyGenerals = (state: GameState, seatId: string, target: GameState): GameState => {
  const generals = target.seats.find((s) => s.id === seatId)?.generals;
  return generals === undefined ? state : updateSeat(state, seatId, (s) => ({ ...s, generals }));
};

// The card as the target state shows it, else as the event carries it, else masked like a redacted hidden card.
function faceOf(instanceId: string, target: GameState, fromEvent?: CardInstance): CardInstance {
  const shown = target.zones.flatMap((z) => z.cards).find((c) => c.instanceId === instanceId);
  return shown ?? fromEvent ?? { instanceId, definitionId: 'hidden', suit: 'spade', rank: 0 };
}

function moveCard(state: GameState, instanceId: string, fromZoneId: string, toZoneId: string, face: CardInstance): GameState {
  if (fromZoneId === toZoneId || !state.zones.some((z) => z.id === fromZoneId) || !state.zones.some((z) => z.id === toZoneId)) return state;
  return {
    ...state,
    zones: state.zones.map((z) => {
      if (z.id === fromZoneId) return { ...z, cards: z.cards.filter((c) => c.instanceId !== instanceId) };
      if (z.id === toZoneId) return { ...z, cards: [...z.cards.filter((c) => c.instanceId !== instanceId), face] };
      return z;
    }),
  };
}
