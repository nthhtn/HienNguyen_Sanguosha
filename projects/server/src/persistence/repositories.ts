import { ResetTokenRecord, SessionRecord, UserRecord } from './records';

export class EmailTakenError extends Error {
  constructor() {
    super('A user with that email already exists');
    this.name = 'EmailTakenError';
  }
}

export interface UserRepository {
  // Throws EmailTakenError when the email (compared case-insensitively) exists.
  createRegistered(input: { email: string; passwordHash: string; displayName: string; now: Date }): Promise<UserRecord>;
  createGuest(input: { displayName: string; now: Date }): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  // Case-insensitive.
  findByEmail(email: string): Promise<UserRecord | null>;
  setPasswordHash(userId: string, passwordHash: string, now: Date): Promise<void>;
  touch(userId: string, now: Date): Promise<void>;
  // Deletes guests last seen before `cutoff`, with their sessions; returns how many.
  deleteIdleGuests(cutoff: Date): Promise<number>;
}

export interface SessionRepository {
  create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<SessionRecord>;
  // Not revoked and not expired at `now`.
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  slide(sessionId: string, now: Date, expiresAt: Date): Promise<void>;
  revoke(sessionId: string, now: Date): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}

export interface ResetTokenRepository {
  create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<ResetTokenRecord>;
  // Atomically marks an unused, unexpired token used and returns it; null otherwise.
  consume(tokenHash: string, now: Date): Promise<ResetTokenRecord | null>;
  // Marks every unused token of the user used at `now`.
  invalidateAllForUser(userId: string, now: Date): Promise<void>;
}

export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  resetTokens: ResetTokenRepository;
  // Runs `work` against repositories whose writes all commit together when it
  // resolves, or none of them when it throws (the error is rethrown). Not
  // nestable: don't call `transaction` on the repositories passed to `work`.
  transaction<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}

// A store opened for a test run, and how to close it afterwards.
export interface RepositoryHarness {
  repos: Repositories;
  teardown(): Promise<void>;
}
