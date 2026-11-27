import type { Action, GameResult, GameRules, Kingdom } from 'engine';
import type { ActionSource, GameStatus, MemberKind, RoomStatus, RoomVisibility, UserKind } from 'protocol';

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
  // A bot's name id; null for a person and for a bot added before bot names.
  botNameId: string | null;
  joinedAt: Date;
  leftAt: Date | null;
}

// Who played each seat of a game, fixed when it starts.
export interface GameSeat {
  seatId: string;
  roomPlayerId: string;
  name: string;
  kind: MemberKind;
  // Absent for a person and for a seat saved before bot names.
  botNameId?: string;
}

// One Start Game. Its actions (GameActionRecord) are the event-sourced log.
export interface GameRecord {
  id: string;
  roomId: string;
  // Drives seating and all of the game's randomness. Secret while it runs.
  seed: number;
  seats: GameSeat[];
  rules: GameRules;
  // The engine + content build the game started on.
  buildId: string;
  status: GameStatus;
  result: GameResult | null;
  // How many actions are stored: the seq of the last one.
  actionCount: number;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface GameActionRecord {
  gameId: string;
  // 1, 2, 3, … in the order the actions applied.
  seq: number;
  seatId: string;
  source: ActionSource;
  action: Action;
  // sha256 of the state's canonical JSON (keys sorted) after this action; see stateHash.
  stateHash: string;
  createdAt: Date;
}

// A chat message with the name its sender had in the room.
export interface ChatMessageRecord {
  id: number;
  roomId: string;
  // The game that was running when it was sent, and how many actions it had
  // then; both null in a lobby.
  gameId: string | null;
  afterSeq: number | null;
  roomPlayerId: string;
  name: string;
  body: string;
  createdAt: Date;
}

// A finished game and the seat a user played in it.
export interface UserGameRecord {
  game: GameRecord;
  yourSeatId: string;
}

// What one human seat of a finished game came to: written when the game ends, read for the Profile.
export interface SeatResultRecord {
  gameId: string;
  seatId: string;
  userId: string;
  // null when the General was never shown.
  mainGeneralId: string | null;
  deputyGeneralId: string | null;
  kingdom: Kingdom;
  allegiance: 'kingdom' | 'ambitionist' | null;
  eliminated: boolean;
  // null when the game gave this seat neither a win nor a loss.
  won: boolean | null;
}

// A seat result with what the Profile filters and orders by.
export interface ProfileGameRow extends SeatResultRecord {
  finishedAt: Date;
  visibility: RoomRecord['visibility'];
}

// A finished game with no seat results yet, and the user at each human seat that has one.
export interface UnrecordedGame {
  game: GameRecord;
  userIds: Record<string, string>;
}

// A way to sign in that is not a password: the provider's own id for the user.
export interface IdentityRecord {
  id: string;
  userId: string;
  provider: 'google';
  providerUserId: string;
  // The email the provider reported when the identity was made.
  email: string;
  createdAt: Date;
}
