import { CardInstance, ChoiceOption, Damage, DecisionReason, Phase, Target } from '../domain/types';

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
  fromZoneId: string;
  toZoneId: string;
  // The card's face, only when it lands face-up (discard pile, equipment,
  // judgment): the log is visible to every seat, so a move into a hand or the
  // draw pile never says what the card was.
  card?: CardInstance;
}

// A seat used a card: played it in its Play phase, or answered a pending
// response with it. Played cards are face-up, so the face is public.
export interface CardPlayedEvent {
  kind: 'CardPlayedEvent';
  seatId: string;
  card: CardInstance;
  targets: Target[];
  // Set for a response: the seat and card whose effect it answered, when known;
  // the dying seat a Peach was played to save; for a cancel, the target the Tool
  // was cancelled on; `counters` when it cancelled another counter card.
  inResponseTo?: { seatId?: string; cardInstanceId?: string; dyingSeatId?: string; targetSeatId?: string; counters?: boolean };
}

// The discard pile was shuffled into the draw pile to finish a draw.
export interface DiscardPileReshuffledEvent {
  kind: 'DiscardPileReshuffledEvent';
  cardCount: number;
}

// A seat at 0 HP or below: the rescue round begins.
export interface SeatDyingEvent {
  kind: 'SeatDyingEvent';
  seatId: string;
}

// A dying seat is back above 0 HP.
export interface SeatSavedEvent {
  kind: 'SeatSavedEvent';
  seatId: string;
}

export interface SeatEliminatedEvent {
  kind: 'SeatEliminatedEvent';
  seatId: string;
}

// Deliberately carries no general ids: the log is visible to every seat.
export interface GeneralsChosenEvent {
  kind: 'GeneralsChosenEvent';
  seatId: string;
}

// Cards turned face up from the draw pile into `zoneId` (Harvest's cards).
export interface CardsTurnedUpEvent {
  kind: 'CardsTurnedUpEvent';
  zoneId: string;
  cards: CardInstance[];
}

// A seat picked an option of a pending choice. `shows` is what the option
// showed, so a pick from a hidden hand never names the card.
export interface ChoiceMadeEvent {
  kind: 'ChoiceMadeEvent';
  seatId: string;
  reason: DecisionReason;
  verb: 'take' | 'discard';
  shows: ChoiceOption['shows'];
}

export type EngineEvent =
  | CardsDrawnEvent
  | DamageDealtEvent
  | PhaseChangedEvent
  | TurnAdvancedEvent
  | GeneralRevealedEvent
  | HealEvent
  | CardMovedEvent
  | CardPlayedEvent
  | DiscardPileReshuffledEvent
  | SeatEliminatedEvent
  | SeatDyingEvent
  | SeatSavedEvent
  | GeneralsChosenEvent
  | ChoiceMadeEvent
  | CardsTurnedUpEvent;
