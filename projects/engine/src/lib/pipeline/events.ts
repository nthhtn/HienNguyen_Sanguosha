export interface CardsDrawnEvent {
  kind: 'CardsDrawnEvent';
  seatId: string;
  cardInstanceIds: string[];
}

export type EngineEvent = CardsDrawnEvent;
