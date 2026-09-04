import { RngState } from '../rng/rng';
// Type-only imports: `Effect` and `EngineEvent` are plain serializable
// discriminated unions declared alongside the pipeline that produces them.
// Importing them as types keeps the reference erased at compile time, so there
// is no runtime dependency from the domain module back onto the pipeline.
import type { Effect } from '../pipeline/effects';
import type { EngineEvent } from '../pipeline/events';

export type Kingdom = 'Wei' | 'Shu' | 'Wu' | 'Qun';

export type Target =
  | { kind: 'seat'; seatId: string }
  | { kind: 'general'; seatId: string; generalSlot: 'main' | 'deputy' };

export interface Turn {
  turnNumber: number;
  ownerSeatId: string;
  extraTurnStack: string[];
}

export type Phase = 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End';

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

export interface CardZoneRef {
  zoneId: string;
}

export interface Seat {
  id: string;
  index: number;
  kingdom: Kingdom;
  generals: { main: GeneralInstance; deputy: GeneralInstance };
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
}

export interface PendingResponse {
  id: string;
  respondingSeatId: string;
  allowedActionKinds: string[];
  allowedCardIds?: string[];
  context: { effect: Effect };
}

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
  log: EngineEvent[];
  rng: RngState;
  result: GameResult | null;
}
