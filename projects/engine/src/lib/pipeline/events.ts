import { AbilityOwner, CardInstance, ChoiceOption, Damage, DecisionReason, JudgmentReader, PendingChoice, Phase, Target, UsedCard } from '../domain/types';

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

// The turn owner passed over a phase (a skip flag, e.g. Capture's skipPlay).
export interface PhaseSkippedEvent {
  kind: 'PhaseSkippedEvent';
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
  // Set when it was revealed to use that skill.
  forAbilityId?: string;
}

// A seat lost HP: not damage, so it has no source and nothing that reacts to
// damage applies. `abilityId`: the skill that cost it (Battered Body).
export interface HpLostEvent {
  kind: 'HpLostEvent';
  seatId: string;
  amount: number;
  abilityId?: string;
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
// response with it. Played cards are face-up, so the face is public. `card` is
// the card as used: one physical card normally, two for a Serpent Spear Sha.
export interface CardPlayedEvent {
  kind: 'CardPlayedEvent';
  seatId: string;
  card: UsedCard;
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
  verb: PendingChoice['verb'];
  shows: ChoiceOption['shows'];
}

// A card turned up for `seatId`'s judgment, for `reader`.
export interface JudgmentEvent {
  kind: 'JudgmentEvent';
  seatId: string;
  reader: JudgmentReader;
  card: CardInstance;
}

// A skill replaced a judgment's card (`replaced`) with `card`.
export interface JudgmentChangedEvent {
  kind: 'JudgmentChangedEvent';
  owner: AbilityOwner;
  abilityId: string;
  judgedSeatId: string;
  card: CardInstance;
  replaced: CardInstance;
}

// An ability applied (Black Shield stopping a Sha; Eight Trigrams counting as a
// Shan). `outcome` is content's code for what it did; `targetSeatId` is the
// other seat involved, if any.
export interface AbilityUsedEvent {
  kind: 'AbilityUsedEvent';
  owner: AbilityOwner;
  abilityId: string;
  outcome: string;
  targetSeatId?: string;
}

// A seat made a selection. Card ids name no face (a hand card stays hidden
// until it moves face up); seat ids are public.
export interface SelectionMadeEvent {
  kind: 'SelectionMadeEvent';
  seatId: string;
  reason: DecisionReason;
  of: 'cards' | 'seats';
  ids: string[];
}

export type EngineEvent =
  | CardsDrawnEvent
  | DamageDealtEvent
  | HpLostEvent
  | PhaseChangedEvent
  | PhaseSkippedEvent
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
  | CardsTurnedUpEvent
  | JudgmentEvent
  | JudgmentChangedEvent
  | AbilityUsedEvent
  | SelectionMadeEvent;
