import { randomUUID } from 'node:crypto';
import { EmailTakenError, RepositoryHarness } from './repositories';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

// Behaviour every store must share. Run against the in-memory store always,
// and against Postgres when TEST_DATABASE_URL is set. One store is opened per
// suite, so every test uses its own fresh emails.
export function describeRepositoryContract(open: () => Promise<RepositoryHarness>): void {
  let harness: RepositoryHarness;
  const repos = () => harness.repos;
  const freshEmail = () => `user-${randomUUID()}@example.com`;
  const registered = (email = freshEmail()) => repos().users.createRegistered({ email, passwordHash: 'hash', displayName: 'Ann', now: NOW });

  beforeAll(async () => {
    harness = await open();
  });
  afterAll(async () => {
    await harness?.teardown();
  });

  describe('users', () => {
    it('creates a registered user and finds it by id and by email in any case', async () => {
      const email = freshEmail();
      const user = await registered(email);
      expect(user).toEqual({
        id: expect.any(String),
        kind: 'registered',
        email,
        passwordHash: 'hash',
        displayName: 'Ann',
        emailVerifiedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        lastSeenAt: NOW,
      });
      expect(await repos().users.findById(user.id)).toEqual(user);
      expect(await repos().users.findByEmail(email.toUpperCase())).toEqual(user);
    });

    it('returns null for an unknown id or email', async () => {
      expect(await repos().users.findById(randomUUID())).toBeNull();
      expect(await repos().users.findByEmail(freshEmail())).toBeNull();
    });

    it('refuses a second user with the same email in another case', async () => {
      const email = freshEmail();
      await registered(email);
      await expect(registered(email.toUpperCase())).rejects.toBeInstanceOf(EmailTakenError);
    });

    it('lets exactly one of two racing sign-ups with the same email win', async () => {
      const email = freshEmail();
      const results = await Promise.allSettled([registered(email), registered(email)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(EmailTakenError);
    });

    it('creates a guest with no email or password', async () => {
      const guest = await repos().users.createGuest({ displayName: 'Guest', now: NOW });
      expect(guest).toMatchObject({ kind: 'guest', email: null, passwordHash: null, displayName: 'Guest' });
    });

    it('sets a new password hash and records the update time', async () => {
      const user = await registered();
      await repos().users.setPasswordHash(user.id, 'new-hash', minutes(5));
      expect(await repos().users.findById(user.id)).toMatchObject({ passwordHash: 'new-hash', updatedAt: minutes(5) });
    });

    it('touch moves last_seen_at', async () => {
      const user = await registered();
      await repos().users.touch(user.id, minutes(7));
      expect((await repos().users.findById(user.id))?.lastSeenAt).toEqual(minutes(7));
    });

    it('deletes idle guests and their sessions, and nothing else', async () => {
      const longAgo = new Date('2025-12-01T00:00:00.000Z');
      const cutoff = new Date('2026-01-01T00:00:00.000Z');
      const idleGuest = await repos().users.createGuest({ displayName: 'Idle', now: longAgo });
      const freshGuest = await repos().users.createGuest({ displayName: 'Fresh', now: NOW });
      const idleRegistered = await repos().users.createRegistered({ email: freshEmail(), passwordHash: 'h', displayName: 'Old', now: longAgo });
      const idleSessionHash = `t-${randomUUID()}`;
      await repos().sessions.create({ userId: idleGuest.id, tokenHash: idleSessionHash, now: longAgo, expiresAt: minutes(60) });

      expect(await repos().users.deleteIdleGuests(cutoff)).toBeGreaterThanOrEqual(1);

      expect(await repos().users.findById(idleGuest.id)).toBeNull();
      expect(await repos().users.findById(freshGuest.id)).not.toBeNull();
      expect(await repos().users.findById(idleRegistered.id)).not.toBeNull();
      expect(await repos().sessions.findActiveByTokenHash(idleSessionHash, new Date('2025-12-01T00:30:00.000Z'))).toBeNull();
    });
  });

  describe('sessions', () => {
    it('finds an active session by token hash until it expires', async () => {
      const user = await registered();
      const tokenHash = `t-${randomUUID()}`;
      const session = await repos().sessions.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(10) });
      expect(session).toEqual({ id: expect.any(String), userId: user.id, tokenHash, createdAt: NOW, lastSeenAt: NOW, expiresAt: minutes(10), revokedAt: null });
      expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(9))).toEqual(session);
      expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(10))).toBeNull();
    });

    it('slides last_seen_at and expires_at', async () => {
      const user = await registered();
      const tokenHash = `t-${randomUUID()}`;
      const session = await repos().sessions.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(10) });
      await repos().sessions.slide(session.id, minutes(9), minutes(19));
      expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(15))).toMatchObject({ lastSeenAt: minutes(9), expiresAt: minutes(19) });
    });

    it('a revoked session is no longer active', async () => {
      const user = await registered();
      const tokenHash = `t-${randomUUID()}`;
      const session = await repos().sessions.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(10) });
      await repos().sessions.revoke(session.id, minutes(1));
      expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(2))).toBeNull();
    });

    it("revokeAllForUser revokes only that user's sessions", async () => {
      const ann = await registered();
      const bo = await registered();
      const annHashes = [`t-${randomUUID()}`, `t-${randomUUID()}`];
      const boHash = `t-${randomUUID()}`;
      for (const tokenHash of annHashes) await repos().sessions.create({ userId: ann.id, tokenHash, now: NOW, expiresAt: minutes(10) });
      await repos().sessions.create({ userId: bo.id, tokenHash: boHash, now: NOW, expiresAt: minutes(10) });

      await repos().sessions.revokeAllForUser(ann.id, minutes(1));

      for (const tokenHash of annHashes) expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(2))).toBeNull();
      expect(await repos().sessions.findActiveByTokenHash(boHash, minutes(2))).not.toBeNull();
    });
  });

  describe('reset tokens', () => {
    it('consumes a token once', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      expect(await repos().resetTokens.consume(tokenHash, minutes(1))).toMatchObject({ userId: user.id, tokenHash, usedAt: minutes(1) });
      expect(await repos().resetTokens.consume(tokenHash, minutes(2))).toBeNull();
    });

    it('lets exactly one of two racing consumes win', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      const results = await Promise.all([repos().resetTokens.consume(tokenHash, minutes(1)), repos().resetTokens.consume(tokenHash, minutes(1))]);
      expect(results.filter((r) => r !== null)).toHaveLength(1);
    });

    it('refuses an expired or unknown token', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      expect(await repos().resetTokens.consume(tokenHash, minutes(60))).toBeNull();
      expect(await repos().resetTokens.consume(`r-${randomUUID()}`, NOW)).toBeNull();
    });

    it("invalidateAllForUser uses up that user's unused tokens, and no one else's", async () => {
      const ann = await registered();
      const bo = await registered();
      const annHashes = [`r-${randomUUID()}`, `r-${randomUUID()}`];
      const boHash = `r-${randomUUID()}`;
      for (const tokenHash of annHashes) await repos().resetTokens.create({ userId: ann.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      await repos().resetTokens.create({ userId: bo.id, tokenHash: boHash, now: NOW, expiresAt: minutes(60) });

      await repos().resetTokens.invalidateAllForUser(ann.id, minutes(1));

      for (const tokenHash of annHashes) expect(await repos().resetTokens.consume(tokenHash, minutes(2))).toBeNull();
      expect(await repos().resetTokens.consume(boHash, minutes(2))).not.toBeNull();
    });
  });

  describe('transactions', () => {
    it('commits every write of the work and returns its result', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      const sessionHash = `t-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });

      const result = await repos().transaction(async (tx) => {
        await tx.resetTokens.consume(tokenHash, minutes(1));
        await tx.users.setPasswordHash(user.id, 'new-hash', minutes(1));
        await tx.sessions.create({ userId: user.id, tokenHash: sessionHash, now: minutes(1), expiresAt: minutes(10) });
        return 'done';
      });

      expect(result).toBe('done');
      expect(await repos().resetTokens.consume(tokenHash, minutes(2))).toBeNull();
      expect((await repos().users.findById(user.id))?.passwordHash).toBe('new-hash');
      expect(await repos().sessions.findActiveByTokenHash(sessionHash, minutes(2))).not.toBeNull();
    });

    it('rolls back every write when the work throws, and rethrows', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      const failure = new Error('boom');

      await expect(
        repos().transaction(async (tx) => {
          await tx.resetTokens.consume(tokenHash, minutes(1));
          await tx.users.setPasswordHash(user.id, 'new-hash', minutes(1));
          throw failure;
        })
      ).rejects.toBe(failure);

      expect((await repos().users.findById(user.id))?.passwordHash).toBe('hash');
      expect(await repos().resetTokens.consume(tokenHash, minutes(2))).not.toBeNull();
    });

    it('lets exactly one of two racing transactions consume the same token', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      const attempt = (passwordHash: string) =>
        repos().transaction(async (tx) => {
          const token = await tx.resetTokens.consume(tokenHash, minutes(1));
          if (!token) return false;
          await tx.users.setPasswordHash(user.id, passwordHash, minutes(1));
          return true;
        });

      const results = await Promise.all([attempt('hash-a'), attempt('hash-b')]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await repos().users.findById(user.id))?.passwordHash).toBe(results[0] ? 'hash-a' : 'hash-b');
    });

    it("keeps other callers' writes made while the work runs", async () => {
      const user = await registered();
      const outsideHash = `t-${randomUUID()}`;

      await repos().transaction(async (tx) => {
        await repos().sessions.create({ userId: user.id, tokenHash: outsideHash, now: NOW, expiresAt: minutes(10) });
        await tx.users.setPasswordHash(user.id, 'new-hash', minutes(1));
      });

      expect(await repos().sessions.findActiveByTokenHash(outsideHash, minutes(1))).not.toBeNull();
      expect((await repos().users.findById(user.id))?.passwordHash).toBe('new-hash');
    });
  });
}
