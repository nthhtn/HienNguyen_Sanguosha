import { Selectable } from 'kysely';
import { ChatMessageRecord, GameActionRecord, GameRecord, ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserGameRecord, UserRecord } from '../records';
import { ChatMessagesTable, GameActionsTable, GamesTable, PasswordResetTokensTable, RoomPlayersTable, RoomsTable, SessionsTable, UsersTable } from './schema';

export function toUserRecord(row: Selectable<UsersTable>): UserRecord {
  return {
    id: row.id,
    kind: row.kind,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function toSessionRecord(row: Selectable<SessionsTable>): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export function toResetTokenRecord(row: Selectable<PasswordResetTokensTable>): ResetTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

export function toRoomRecord(row: Selectable<RoomsTable>): RoomRecord {
  return {
    id: row.id,
    visibility: row.visibility,
    status: row.status,
    seatCount: row.seat_count,
    rules: row.rules,
    hostPlayerId: row.host_player_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRoomPlayerRecord(row: Selectable<RoomPlayersTable>): RoomPlayerRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    kind: row.kind,
    displayName: row.display_name,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
  };
}

export function toGameRecord(row: Selectable<GamesTable>): GameRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    seed: Number(row.seed),
    seats: row.seats,
    rules: row.rules,
    buildId: row.build_id,
    status: row.status,
    result: row.result,
    actionCount: row.action_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function toGameActionRecord(row: Selectable<GameActionsTable>): GameActionRecord {
  return {
    gameId: row.game_id,
    seq: row.seq,
    seatId: row.seat_id,
    source: row.source,
    action: row.action,
    stateHash: row.state_hash,
    createdAt: row.created_at,
  };
}

export function toChatMessageRecord(row: Selectable<ChatMessagesTable> & { name: string }): ChatMessageRecord {
  return {
    id: Number(row.id),
    roomId: row.room_id,
    gameId: row.game_id,
    afterSeq: row.after_seq,
    roomPlayerId: row.room_player_id,
    name: row.name,
    body: row.body,
    createdAt: row.created_at,
  };
}

// A games row plus the seat found for the user by the query that read it.
export function toUserGameRecord(row: Selectable<GamesTable> & { your_seat_id: string }): UserGameRecord {
  return { game: toGameRecord(row), yourSeatId: row.your_seat_id };
}
