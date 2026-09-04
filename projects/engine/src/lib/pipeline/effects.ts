import { GameState, Damage, PendingResponse } from '../domain/types';
import { drawTop } from '../cards/zones';
import { EngineEvent } from './events';

export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage }
  | { kind: 'OpenResponseEffect'; pendingResponse: PendingResponse };

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
    case 'DamageEffect': {
      if (effect.damage.target.kind !== 'seat') {
        throw new Error('DamageEffect currently only supports seat targets');
      }
      const seatId = effect.damage.target.seatId;
      const seat = state.seats.find((s) => s.id === seatId);
      if (!seat) throw new Error(`Unknown seat: ${seatId}`);
      const seats = state.seats.map((s) =>
        s.id === seatId ? { ...s, combinedHp: s.combinedHp - effect.damage.amount } : s
      );
      const event: EngineEvent = { kind: 'DamageDealtEvent', damage: effect.damage };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'OpenResponseEffect':
      return { state: { ...state, pendingResponse: effect.pendingResponse }, events: [] };
    default:
      throw new Error(`Unhandled effect kind: ${(effect as Effect).kind}`);
  }
}
