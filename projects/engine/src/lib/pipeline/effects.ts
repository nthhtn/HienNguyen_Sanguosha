import { GameState } from '../domain/types';
import { drawTop } from '../cards/zones';
import { EngineEvent } from './events';

export type Effect = { kind: 'DrawCardsEffect'; seatId: string; count: number };

export interface ApplyResult {
  state: GameState;
  events: EngineEvent[];
}

export function applyEffect(state: GameState, effect: Effect): ApplyResult {
  switch (effect.kind) {
    case 'DrawCardsEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const { zones, drawn } = drawTop(state.zones, 'drawPile', seat.hand.zoneId, effect.count);
      const event: EngineEvent = {
        kind: 'CardsDrawnEvent',
        seatId: seat.id,
        cardInstanceIds: drawn.map((c) => c.instanceId),
      };
      return { state: { ...state, zones, log: [...state.log, event] }, events: [event] };
    }
    default:
      throw new Error(`Unhandled effect kind: ${(effect as Effect).kind}`);
  }
}
