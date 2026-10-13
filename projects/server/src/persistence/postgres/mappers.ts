import { Selectable } from 'kysely';
import { ResetTokenRecord, SessionRecord, UserRecord } from '../records';
import { PasswordResetTokensTable, SessionsTable, UsersTable } from './schema';

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
