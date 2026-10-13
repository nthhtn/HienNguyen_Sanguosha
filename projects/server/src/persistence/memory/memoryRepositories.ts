import { randomUUID } from 'node:crypto';
import { ResetTokenRecord, SessionRecord, UserRecord } from '../records';
import { EmailTakenError, Repositories, ResetTokenRepository, SessionRepository, UserRepository } from '../repositories';

interface Store {
  users: Map<string, UserRecord>;
  sessions: Map<string, SessionRecord>;
  resetTokens: Map<string, ResetTokenRecord>;
}

type Table = keyof Store;
const TABLES: readonly Table[] = ['users', 'sessions', 'resetTokens'];
// Retries of a transaction whose records others changed under it, before giving up.
const MAX_TRANSACTION_ATTEMPTS = 10;

// For unit tests and local runs without Postgres. Each method does its checks
// and writes with no `await` between them, so concurrent calls can't interleave
// (the uniqueness and single-use rules hold under Promise.all).
export function createMemoryRepositories(): Repositories {
  return repositoriesOver({ users: new Map(), sessions: new Map(), resetTokens: new Map() });
}

function repositoriesOver(store: Store): Repositories {
  return {
    users: new MemoryUsers(store),
    sessions: new MemorySessions(store),
    resetTokens: new MemoryResetTokens(store),
    transaction: (work) => transact(store, work),
  };
}

// The work runs on a private copy of the store. On success, the records it
// changed are written back in one synchronous step, unless someone changed one
// of them meanwhile: then the work reruns on a fresh copy (optimistic
// concurrency, so two racing transactions can't both consume one token).
// Writes to records the work didn't touch are kept. Uniqueness across records
// (a user's email) is not re-checked at commit.
async function transact<T>(store: Store, work: (repos: Repositories) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const snapshot = cloneStore(store);
    const draft = cloneStore(snapshot);
    const result = await work(repositoriesOver(draft));
    if (commit(store, snapshot, draft)) return result;
    if (attempt === MAX_TRANSACTION_ATTEMPTS) throw new Error('Memory transaction kept conflicting with other writes');
  }
}

function commit(store: Store, snapshot: Store, draft: Store): boolean {
  const changes = TABLES.map((table) => {
    const keys = new Set([...snapshot[table].keys(), ...draft[table].keys()]);
    return { table, keys: [...keys].filter((key) => !sameRecord(snapshot[table].get(key), draft[table].get(key))) };
  });
  if (changes.some(({ table, keys }) => keys.some((key) => !sameRecord(store[table].get(key), snapshot[table].get(key))))) return false;
  for (const { table, keys } of changes) {
    const target = store[table] as Map<string, object>;
    for (const key of keys) {
      const record = draft[table].get(key);
      if (record) target.set(key, record);
      else target.delete(key);
    }
  }
  return true;
}

// Records are flat and their dates are replaced, never mutated, so copying each
// record is a deep enough copy.
const cloneMap = <T extends object>(map: Map<string, T>) => new Map([...map].map(([key, record]) => [key, { ...record }]));
const cloneStore = (store: Store): Store => ({ users: cloneMap(store.users), sessions: cloneMap(store.sessions), resetTokens: cloneMap(store.resetTokens) });

// Records are flat: compare field by field, dates by time.
function sameRecord(a: object | undefined, b: object | undefined): boolean {
  if (!a || !b) return a === b;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => {
    const x = left[key];
    const y = right[key];
    return x instanceof Date && y instanceof Date ? x.getTime() === y.getTime() : x === y;
  });
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

  async deleteExpired(cutoff: Date): Promise<number> {
    let deleted = 0;
    for (const [id, session] of this.store.sessions) {
      if (session.expiresAt >= cutoff && (session.revokedAt === null || session.revokedAt >= cutoff)) continue;
      this.store.sessions.delete(id);
      deleted += 1;
    }
    return deleted;
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

  async invalidateAllForUser(userId: string, now: Date): Promise<void> {
    for (const token of this.store.resetTokens.values()) {
      if (token.userId === userId && token.usedAt === null) token.usedAt = now;
    }
  }

  async deleteExpired(cutoff: Date): Promise<number> {
    let deleted = 0;
    for (const [id, token] of this.store.resetTokens) {
      if (token.expiresAt >= cutoff) continue;
      this.store.resetTokens.delete(id);
      deleted += 1;
    }
    return deleted;
  }
}
