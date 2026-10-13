import { randomUUID } from 'node:crypto';
import { ResetTokenRecord, SessionRecord, UserRecord } from '../records';
import { EmailTakenError, Repositories, ResetTokenRepository, SessionRepository, UserRepository } from '../repositories';

interface Store {
  users: Map<string, UserRecord>;
  sessions: Map<string, SessionRecord>;
  resetTokens: Map<string, ResetTokenRecord>;
}

// For unit tests and local runs without Postgres. Each method does its checks
// and writes with no `await` between them, so concurrent calls can't interleave
// (the uniqueness and single-use rules hold under Promise.all).
export function createMemoryRepositories(): Repositories {
  const store: Store = { users: new Map(), sessions: new Map(), resetTokens: new Map() };
  return { users: new MemoryUsers(store), sessions: new MemorySessions(store), resetTokens: new MemoryResetTokens(store) };
}

const copy = <T extends object>(record: T | undefined): T | null => (record ? { ...record } : null);

class MemoryUsers implements UserRepository {
  constructor(private readonly store: Store) {}

  private byEmail(email: string): UserRecord | undefined {
    const key = email.toLowerCase();
    for (const user of this.store.users.values()) if (user.email?.toLowerCase() === key) return user;
    return undefined;
  }

  async createRegistered(input: { email: string; passwordHash: string; displayName: string; now: Date }): Promise<UserRecord> {
    if (this.byEmail(input.email)) throw new EmailTakenError();
    const user: UserRecord = {
      id: randomUUID(),
      kind: 'registered',
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      emailVerifiedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      lastSeenAt: input.now,
    };
    this.store.users.set(user.id, user);
    return { ...user };
  }

  async createGuest(input: { displayName: string; now: Date }): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomUUID(),
      kind: 'guest',
      email: null,
      passwordHash: null,
      displayName: input.displayName,
      emailVerifiedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      lastSeenAt: input.now,
    };
    this.store.users.set(user.id, user);
    return { ...user };
  }

  async findById(id: string): Promise<UserRecord | null> {
    return copy(this.store.users.get(id));
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return copy(this.byEmail(email));
  }

  async setPasswordHash(userId: string, passwordHash: string, now: Date): Promise<void> {
    const user = this.store.users.get(userId);
    if (user) Object.assign(user, { passwordHash, updatedAt: now });
  }

  async touch(userId: string, now: Date): Promise<void> {
    const user = this.store.users.get(userId);
    if (user) user.lastSeenAt = now;
  }

  async deleteIdleGuests(cutoff: Date): Promise<number> {
    let deleted = 0;
    for (const user of [...this.store.users.values()]) {
      if (user.kind !== 'guest' || user.lastSeenAt >= cutoff) continue;
      this.store.users.delete(user.id);
      for (const [id, session] of this.store.sessions) if (session.userId === user.id) this.store.sessions.delete(id);
      for (const [id, token] of this.store.resetTokens) if (token.userId === user.id) this.store.resetTokens.delete(id);
      deleted += 1;
    }
    return deleted;
  }
}

class MemorySessions implements SessionRepository {
  constructor(private readonly store: Store) {}

  async create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      lastSeenAt: input.now,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.store.sessions.set(session.id, session);
    return { ...session };
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    for (const session of this.store.sessions.values()) {
      if (session.tokenHash === tokenHash) return session.revokedAt === null && session.expiresAt > now ? { ...session } : null;
    }
    return null;
  }

  async slide(sessionId: string, now: Date, expiresAt: Date): Promise<void> {
    const session = this.store.sessions.get(sessionId);
    if (session) Object.assign(session, { lastSeenAt: now, expiresAt });
  }

  async revoke(sessionId: string, now: Date): Promise<void> {
    const session = this.store.sessions.get(sessionId);
    if (session && session.revokedAt === null) session.revokedAt = now;
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    for (const session of this.store.sessions.values()) {
      if (session.userId === userId && session.revokedAt === null) session.revokedAt = now;
    }
  }
}

class MemoryResetTokens implements ResetTokenRepository {
  constructor(private readonly store: Store) {}

  async create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<ResetTokenRecord> {
    const token: ResetTokenRecord = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: input.now,
    };
    this.store.resetTokens.set(token.id, token);
    return { ...token };
  }

  async consume(tokenHash: string, now: Date): Promise<ResetTokenRecord | null> {
    for (const token of this.store.resetTokens.values()) {
      if (token.tokenHash !== tokenHash) continue;
      if (token.usedAt !== null || token.expiresAt <= now) return null;
      token.usedAt = now;
      return { ...token };
    }
    return null;
  }
}
