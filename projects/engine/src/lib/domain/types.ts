import { RngState } from '../rng/rng';

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
  context: { effect: unknown };
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
  zones: CardZone[];
  pendingResponse: PendingResponse | null;
  log: GameEvent[];
  rng: RngState;
  result: GameResult | null;
}
