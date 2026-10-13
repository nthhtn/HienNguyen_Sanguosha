import type { GameRules } from 'engine';
import type { MemberKind, RoomStatus, RoomVisibility, UserKind } from 'protocol';

// Domain records: what the server works with. Database rows map to these in
// persistence/postgres/mappers.ts, and these map to wire shapes in views/.
export interface UserRecord {
  id: string;
  kind: UserKind;
  email: string | null; // registered only
  passwordHash: string | null; // registered only
  displayName: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface ResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface RoomRecord {
  id: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  seatCount: number;
  rules: GameRules;
  // A registered human member; null only while a room is being created, and for solo rooms.
  hostPlayerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// A member of a room: a person or a bot. One row per membership: leaving sets
// `leftAt`, and joining again adds a new row.
export interface RoomPlayerRecord {
  id: string;
  roomId: string;
  userId: string | null; // null for bots, and for a deleted guest
  kind: MemberKind;
  displayName: string;
  joinedAt: Date;
  leftAt: Date | null;
}
