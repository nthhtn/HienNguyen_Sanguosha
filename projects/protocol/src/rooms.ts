import type { Static } from '@sinclair/typebox';
import type { GameRules } from 'engine';
import type { LastGame } from './game';
import type { CreateRoomBodySchema, JoinRoomBodySchema } from './schemas/rooms';

// The card distributions a room can be dealt from. The content package holds the
// same list; the server has a test that the two agree.
export const DECK_IDS = ['default', 'alternate'] as const;
export type DeckId = (typeof DECK_IDS)[number];

export type RoomVisibility = 'open' | 'solo';
export type RoomStatus = 'lobby' | 'playing' | 'closed';
export type MemberKind = 'human' | 'bot';

export type CreateRoomBody = Static<typeof CreateRoomBodySchema>;
export type JoinRoomBody = Static<typeof JoinRoomBodySchema>;

// How many seats a room may have. The server decides; clients only offer it.
export interface SeatLimits {
  min: number;
  max: number;
}

export interface RoomMemberView {
  playerId: string;
  name: string;
  kind: MemberKind;
  // The seat this member plays in the running game; null in the lobby.
  seatId: string | null;
  isRegistered: boolean;
  connected: boolean;
  // A bot is playing this human's seat in the running game.
  botControlled: boolean;
}

// A room as every member sees it. Nothing in it is secret: no user ids.
export interface RoomSnapshot {
  id: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  seatCount: number;
  rules: GameRules;
  hostPlayerId: string | null;
  // In join order. Seat order is only drawn when a game starts.
  members: RoomMemberView[];
  // The room's last game, until another starts. Kept in memory only.
  lastGame: LastGame | null;
  seatLimits: SeatLimits;
}

export interface RoomListItem {
  id: string;
  visibility: RoomVisibility;
  hostName: string | null;
  memberCount: number;
  capacity: number;
  status: RoomStatus;
  youAreMember: boolean;
}

// GET /api/rooms: your rooms first, then the other open rooms, newest first.
export interface RoomList {
  rooms: RoomListItem[];
  seatLimits: SeatLimits;
}

export interface RoomCreated {
  id: string;
}
