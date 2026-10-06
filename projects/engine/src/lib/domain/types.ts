import { RngState } from '../rng/rng';
// Type-only imports: `Effect` and `EngineEvent` are plain serializable
// discriminated unions declared alongside the pipeline that produces them.
// Importing them as types keeps the reference erased at compile time, so there
// is no runtime dependency from the domain module back onto the pipeline.
import type { Effect } from '../pipeline/effects';
import type { EngineEvent } from '../pipeline/events';
import type { Action } from '../pipeline/actions';

export type Kingdom = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'hidden';

export type Target =
  | { kind: 'seat'; seatId: string }
  | { kind: 'general'; seatId: string; generalSlot: 'main' | 'deputy' };

export interface Turn {
  turnNumber: number;
  ownerSeatId: string;
  extraTurnStack: string[];
  // Proactive card plays this turn, by card definition id (responses excluded).
  cardPlays?: Record<string, number>;
}

export type Phase = 'GeneralSelection' | 'Start' | 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End';

export interface GameResult {
  endedAt: number;
  winningKingdom?: Kingdom;
  winningSeatIds: string[];
  losingSeatIds: string[];
}

export interface GeneralInstance {
  generalDefinitionId: string;
  revealed: boolean;
}

export interface SeatGenerals {
  main: GeneralInstance;
  deputy: GeneralInstance;
}

// Pre-game general selection. `candidates` holds the general ids dealt to each
// seat that has not chosen yet; a seat's entry is removed once it chooses.
export interface GeneralSelectionState {
  candidates: Record<string, string[]>;
}

export interface CardZoneRef {
  zoneId: string;
}

export interface Seat {
  id: string;
  index: number;
  kingdom: Kingdom;
  // null only during the GeneralSelection phase, before this seat has chosen.
  generals: SeatGenerals | null;
  combinedHp: number;
  maxCombinedHp: number;
  hand: CardZoneRef;
  equipped: CardZoneRef;
  eliminated: boolean;
}

export interface Player {
  id: string;
  seatId: string;
  kind: 'human' | 'bot';
  // Shown wherever the seat appears; the seat id stays the stable key.
  name: string;
}

export interface PendingResponse {
  id: string;
  respondingSeatId: string;
  allowedActionKinds: string[];
  allowedCardIds?: string[];
  context: { effect: Effect };
  // The card whose effect opened this window. When set, that card's
  // definition decides what an answer does (CardDefinition.onResponse);
  // otherwise an answer simply cancels context.effect.
  sourceCard?: { instanceId: string; definitionId: string };
  // Effects resolved, in order, after the answering card's own effects — for
  // windows the engine itself opens (e.g. the dying round's Peach heals the
  // dying seat, then asks again).
  onAnswer?: Effect[];
  // What is being asked, so the UI and bots can tell windows apart.
  reason?: DecisionReason;
}

export type DecisionReason = { kind: 'dying'; seatId: string };

export interface CardZone {
  id: string;
  kind: 'hand' | 'equip' | 'drawPile' | 'discardPile' | 'judgment';
  ownerSeatId?: string;
  cards: CardInstance[];
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  suit: 'spade' | 'heart' | 'club' | 'diamond';
  rank: number;
}

// The weak structural shape every engine event satisfies. `GameState.log` is
// typed as the concrete `EngineEvent` union instead, so consumers can read a
// specific event's fields after narrowing on `kind` without casting.
export interface GameEvent {
  kind: string;
}

// One step still to resolve: an effect, or an action a trigger asked for.
export type QueueItem = Effect | Action;

export interface Damage {
  source: Target | null;
  target: Target;
  amount: number;
  nature: 'normal' | 'fire' | 'thunder';
  cause?: { cardInstanceId?: string; skillId?: string };
}

export interface GameState {
  seats: Seat[];
  players: Player[];
  turn: Turn;
  phase: Phase;
  zones: CardZone[];
  pendingResponse: PendingResponse | null;
  // What is left to resolve, front first. Absent (never []) when nothing is
  // left: the engine only rests with items here while a decision is pending.
  resolutionQueue?: QueueItem[];
  log: EngineEvent[];
  rng: RngState;
  result: GameResult | null;
  generalSelection: GeneralSelectionState | null;
}
