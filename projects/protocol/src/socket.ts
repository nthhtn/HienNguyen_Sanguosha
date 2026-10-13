import type { Static } from '@sinclair/typebox';
import type { ErrorCode } from './errors';
import type { RoomSnapshot } from './rooms';
import type { ClientMessageSchema } from './schemas/socket';

export const SOCKET_PATH = '/api/ws';

// Every message a client may send.
export type ClientMessage = Static<typeof ClientMessageSchema>;
export type HelloMessage = Extract<ClientMessage, { type: 'hello' }>;
// What a member asks for once connected.
export type RoomCommand = Exclude<ClientMessage, HelloMessage>;
// A command before the client numbers it.
export type RoomRequest = RoomCommand extends infer C ? (C extends unknown ? Omit<C, 'reqId'> : never) : never;

export interface WelcomeMessage {
  type: 'welcome';
  you: { playerId: string; seatId: string | null };
  room: RoomSnapshot;
  // The running game: always null until online games arrive (Stage 4).
  game: null;
}

export interface RoomUpdatedMessage {
  type: 'room.updated';
  room: RoomSnapshot;
}

export type RoomLeftReason = 'left' | 'removed' | 'host_left' | 'idle';

// This connection is no longer in the room; the server closes it next.
export interface RoomLeftMessage {
  type: 'room.left';
  reason: RoomLeftReason;
}

// A newer connection for the same member took over; the server closes this one next.
export interface ReplacedMessage {
  type: 'replaced';
}

export interface AckMessage {
  type: 'ack';
  reqId: string;
}

export interface ErrorMessage {
  type: 'error';
  reqId?: string;
  code: ErrorCode;
  message: string;
}

export type ServerMessage = WelcomeMessage | RoomUpdatedMessage | RoomLeftMessage | ReplacedMessage | AckMessage | ErrorMessage;

export const ROOM_LEFT_MESSAGES: Record<RoomLeftReason, string> = {
  left: 'You left the room',
  removed: 'The host removed you from the room',
  host_left: 'The host closed the room',
  idle: 'The room closed after 30 minutes without activity',
};

export const REPLACED_MESSAGE = 'This room is open in another tab';
