import { Kysely } from 'kysely';
import { ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserRecord } from '../records';
import {
  EmailTakenError,
  LiveRoomRecord,
  NameTakenError,
  Repositories,
  ResetTokenRepository,
  RoomChanges,
  RoomRepository,
  SessionRepository,
  UserRepository,
} from '../repositories';
import { toResetTokenRecord, toRoomPlayerRecord, toRoomRecord, toSessionRecord, toUserRecord } from './mappers';
import { Database } from './schema';

const UNIQUE_VIOLATION = '23505';
const isUniqueViolation = (err: unknown) => (err as { code?: unknown } | null)?.code === UNIQUE_VIOLATION;

// For a unique index (not a constraint), Postgres reports the index name here.
const violatedIndex = (err: unknown) => (err as { constraint?: unknown } | null)?.constraint;

// `db` may be a Transaction (a Kysely too): then every method runs inside it.
export function createPostgresRepositories(db: Kysely<Database>): Repositories {
  return {
    users: new PostgresUsers(db),
    sessions: new PostgresSessions(db),
    resetTokens: new PostgresResetTokens(db),
    rooms: new PostgresRooms(db),
    transaction: (work) => db.transaction().execute((trx) => work(createPostgresRepositories(trx))),
  };
}

class PostgresUsers implements UserRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async createRegistered(input: { email: string; passwordHash: string; displayName: string; now: Date }): Promise<UserRecord> {
    try {
      const row = await this.db
        .insertInto('users')
        .values({
          kind: 'registered',
          email: input.email,
          password_hash: input.passwordHash,
          display_name: input.displayName,
          created_at: input.now,
          updated_at: input.now,
          last_seen_at: input.now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return toUserRecord(row);
    } catch (err) {
      // `email` is citext UNIQUE, so another casing of the same email lands here.
      if (isUniqueViolation(err)) throw new EmailTakenError();
      throw err;
    }
  }

  async createGuest(input: { displayName: string; now: Date }): Promise<UserRecord> {
    const row = await this.db
      .insertInto('users')
      .values({ kind: 'guest', display_name: input.displayName, created_at: input.now, updated_at: input.now, last_seen_at: input.now })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toUserRecord(row);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toUserRecord(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
    return row ? toUserRecord(row) : null;
  }

  async setPasswordHash(userId: string, passwordHash: string, now: Date): Promise<void> {
    await this.db.updateTable('users').set({ password_hash: passwordHash, updated_at: now }).where('id', '=', userId).execute();
  }

  async touch(userId: string, now: Date): Promise<void> {
    await this.db.updateTable('users').set({ last_seen_at: now }).where('id', '=', userId).execute();
  }

  async deleteIdleGuests(cutoff: Date): Promise<number> {
    // Sessions and reset tokens go with them (ON DELETE CASCADE).
    const result = await this.db.deleteFrom('users').where('kind', '=', 'guest').where('last_seen_at', '<', cutoff).executeTakeFirst();
    return Number(result.numDeletedRows);
  }
}

class PostgresSessions implements SessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<SessionRecord> {
    const row = await this.db
      .insertInto('sessions')
      .values({ user_id: input.userId, token_hash: input.tokenHash, created_at: input.now, last_seen_at: input.now, expires_at: input.expiresAt })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toSessionRecord(row);
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    const row = await this.db
      .selectFrom('sessions')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .executeTakeFirst();
    return row ? toSessionRecord(row) : null;
  }

  async slide(sessionId: string, now: Date, expiresAt: Date): Promise<void> {
    await this.db.updateTable('sessions').set({ last_seen_at: now, expires_at: expiresAt }).where('id', '=', sessionId).execute();
  }

  async revoke(sessionId: string, now: Date): Promise<void> {
    await this.db.updateTable('sessions').set({ revoked_at: now }).where('id', '=', sessionId).where('revoked_at', 'is', null).execute();
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.db.updateTable('sessions').set({ revoked_at: now }).where('user_id', '=', userId).where('revoked_at', 'is', null).execute();
  }

  async deleteExpired(cutoff: Date): Promise<number> {
    const result = await this.db
      .deleteFrom('sessions')
      .where((eb) => eb.or([eb('expires_at', '<', cutoff), eb('revoked_at', '<', cutoff)]))
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }
}

class PostgresResetTokens implements ResetTokenRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<ResetTokenRecord> {
    const row = await this.db
      .insertInto('password_reset_tokens')
      .values({ user_id: input.userId, token_hash: input.tokenHash, expires_at: input.expiresAt, created_at: input.now })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toResetTokenRecord(row);
  }

  async consume(tokenHash: string, now: Date): Promise<ResetTokenRecord | null> {
    // One UPDATE … WHERE used_at IS NULL: of two racing consumes, only one row update wins.
    const row = await this.db
      .updateTable('password_reset_tokens')
      .set({ used_at: now })
      .where('token_hash', '=', tokenHash)
      .where('used_at', 'is', null)
      .where('expires_at', '>', now)
      .returningAll()
      .executeTakeFirst();
    return row ? toResetTokenRecord(row) : null;
  }

  async invalidateAllForUser(userId: string, now: Date): Promise<void> {
    await this.db.updateTable('password_reset_tokens').set({ used_at: now }).where('user_id', '=', userId).where('used_at', 'is', null).execute();
  }

  async deleteExpired(cutoff: Date): Promise<number> {
    const result = await this.db.deleteFrom('password_reset_tokens').where('expires_at', '<', cutoff).executeTakeFirst();
    return Number(result.numDeletedRows);
  }
}

class PostgresRooms implements RoomRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: { visibility: RoomRecord['visibility']; seatCount: number; rules: RoomRecord['rules']; now: Date }): Promise<RoomRecord> {
    const row = await this.db
      .insertInto('rooms')
      .values({
        visibility: input.visibility,
        status: 'lobby',
        seat_count: input.seatCount,
        rules: JSON.stringify(input.rules),
        created_at: input.now,
        updated_at: input.now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRoomRecord(row);
  }

  async update(roomId: string, changes: RoomChanges, now: Date): Promise<void> {
    await this.db
      .updateTable('rooms')
      .set({
        updated_at: now,
        ...(changes.status !== undefined ? { status: changes.status } : {}),
        ...(changes.seatCount !== undefined ? { seat_count: changes.seatCount } : {}),
        ...(changes.rules !== undefined ? { rules: JSON.stringify(changes.rules) } : {}),
        ...(changes.hostPlayerId !== undefined ? { host_player_id: changes.hostPlayerId } : {}),
      })
      .where('id', '=', roomId)
      .execute();
  }

  async addPlayer(input: { roomId: string; userId: string | null; kind: RoomPlayerRecord['kind']; displayName: string; now: Date }): Promise<RoomPlayerRecord> {
    try {
      const row = await this.db
        .insertInto('room_players')
        .values({ room_id: input.roomId, user_id: input.userId, kind: input.kind, display_name: input.displayName, joined_at: input.now })
        .returningAll()
        .executeTakeFirstOrThrow();
      return toRoomPlayerRecord(row);
    } catch (err) {
      if (isUniqueViolation(err) && violatedIndex(err) === 'room_players_current_name') throw new NameTakenError();
      throw err;
    }
  }

  async markLeft(playerId: string, now: Date): Promise<void> {
    await this.db.updateTable('room_players').set({ left_at: now }).where('id', '=', playerId).where('left_at', 'is', null).execute();
  }

  async listLive(): Promise<LiveRoomRecord[]> {
    const rooms = await this.db.selectFrom('rooms').selectAll().where('status', '<>', 'closed').orderBy('created_at').execute();
    if (rooms.length === 0) return [];
    const players = await this.db
      .selectFrom('room_players')
      .selectAll()
      .where(
        'room_id',
        'in',
        rooms.map((room) => room.id)
      )
      .where('left_at', 'is', null)
      .orderBy('joined_at')
      .orderBy('id')
      .execute();
    return rooms.map((row) => ({ room: toRoomRecord(row), players: players.filter((p) => p.room_id === row.id).map(toRoomPlayerRecord) }));
  }
}
