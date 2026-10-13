import { Selectable } from 'kysely';
import { ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserRecord } from '../records';
import { PasswordResetTokensTable, RoomPlayersTable, RoomsTable, SessionsTable, UsersTable } from './schema';

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
