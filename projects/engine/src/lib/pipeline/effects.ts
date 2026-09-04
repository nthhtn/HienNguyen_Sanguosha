import { GameState, Damage, PendingResponse, Target } from '../domain/types';
import { drawTop, moveCard } from '../cards/zones';
import { EngineEvent } from './events';

export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage }
  | { kind: 'OpenResponseEffect'; pendingResponse: PendingResponse }
  | { kind: 'RevealGeneralEffect'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'HealEffect'; target: Target; amount: number }
  | { kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string };

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
    case 'RevealGeneralEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.generals[effect.slot].revealed) {
        return { state, events: [] };
      }
      const seats = state.seats.map((s) =>
        s.id === effect.seatId
          ? { ...s, generals: { ...s.generals, [effect.slot]: { ...s.generals[effect.slot], revealed: true } } }
          : s
      );
      const event: EngineEvent = { kind: 'GeneralRevealedEvent', seatId: effect.seatId, slot: effect.slot };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'HealEffect': {
      if (effect.target.kind !== 'seat') throw new Error('HealEffect currently only supports seat targets');
      const seat = state.seats.find((s) => s.id === effect.target.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.target.seatId}`);
      const combinedHp = Math.min(seat.maxCombinedHp, seat.combinedHp + effect.amount);
      const seats = state.seats.map((s) => (s.id === effect.target.seatId ? { ...s, combinedHp } : s));
      const event: EngineEvent = { kind: 'HealEvent', target: effect.target, amount: effect.amount };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'MoveCardEffect': {
      const zones = moveCard(state.zones, effect.cardInstanceId, effect.toZoneId);
      const event: EngineEvent = { kind: 'CardMovedEvent', cardInstanceId: effect.cardInstanceId, toZoneId: effect.toZoneId };
      return { state: { ...state, zones, log: [...state.log, event] }, events: [event] };
    }
    default:
      throw new Error(`Unhandled effect kind: ${(effect as Effect).kind}`);
  }
}
