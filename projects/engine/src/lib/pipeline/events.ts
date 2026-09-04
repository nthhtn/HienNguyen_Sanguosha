import { Damage, Phase, Target } from '../domain/types';

export interface CardsDrawnEvent {
  kind: 'CardsDrawnEvent';
  seatId: string;
  cardInstanceIds: string[];
}

export interface DamageDealtEvent {
  kind: 'DamageDealtEvent';
  damage: Damage;
}

export interface PhaseChangedEvent {
  kind: 'PhaseChangedEvent';
  seatId: string;
  phase: Phase;
}

export interface TurnAdvancedEvent {
  kind: 'TurnAdvancedEvent';
  seatId: string;
  turnNumber: number;
}

export interface GeneralRevealedEvent {
  kind: 'GeneralRevealedEvent';
  seatId: string;
  slot: 'main' | 'deputy';
}

export interface HealEvent {
  kind: 'HealEvent';
  target: Target;
  amount: number;
}

export interface CardMovedEvent {
  kind: 'CardMovedEvent';
  cardInstanceId: string;
  toZoneId: string;
}

export interface SeatEliminatedEvent {
  kind: 'SeatEliminatedEvent';
  seatId: string;
}

export type EngineEvent =
  | CardsDrawnEvent
  | DamageDealtEvent
  | PhaseChangedEvent
  | TurnAdvancedEvent
  | GeneralRevealedEvent
  | HealEvent
  | CardMovedEvent
  | SeatEliminatedEvent;
