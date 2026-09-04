import { Damage } from '../domain/types';

export interface CardsDrawnEvent {
  kind: 'CardsDrawnEvent';
  seatId: string;
  cardInstanceIds: string[];
}

export interface DamageDealtEvent {
  kind: 'DamageDealtEvent';
  damage: Damage;
}

export type EngineEvent = CardsDrawnEvent | DamageDealtEvent;
