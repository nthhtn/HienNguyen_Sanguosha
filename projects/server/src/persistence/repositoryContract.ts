import { randomUUID } from 'node:crypto';
import type { ActionSource } from 'protocol';
import { GameSeat } from './records';
import { EmailTakenError, NameTakenError, NewGameAction, RepositoryHarness, StaleGameError } from './repositories';

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

    it('deleteExpired deletes sessions expired or revoked before the cutoff, and only those', async () => {
      // Dates long before every other test's, so the count is exact on a shared store.
      const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
      const cutoff = at('2020-06-01');
      const user = await registered();
      const hash = () => `t-${randomUUID()}`;
      const [expired, revoked, live, revokedLater] = [hash(), hash(), hash(), hash()];
      await repos().sessions.create({ userId: user.id, tokenHash: expired, now: at('2020-01-01'), expiresAt: at('2020-03-01') });
      const revokedSession = await repos().sessions.create({ userId: user.id, tokenHash: revoked, now: at('2020-01-01'), expiresAt: at('2030-01-01') });
      await repos().sessions.revoke(revokedSession.id, at('2020-03-01'));
      await repos().sessions.create({ userId: user.id, tokenHash: live, now: at('2020-01-01'), expiresAt: at('2020-09-01') });
      const revokedLaterSession = await repos().sessions.create({ userId: user.id, tokenHash: revokedLater, now: at('2020-01-01'), expiresAt: at('2030-01-01') });
      await repos().sessions.revoke(revokedLaterSession.id, at('2020-09-01'));

      expect(await repos().sessions.deleteExpired(cutoff)).toBe(2);

      expect(await repos().sessions.deleteExpired(cutoff)).toBe(0);
      // Still there: active at a time before it expires.
      expect(await repos().sessions.findActiveByTokenHash(live, at('2020-08-01'))).not.toBeNull();
      // Gone: it would otherwise be active at this time.
      expect(await repos().sessions.findActiveByTokenHash(expired, at('2020-02-01'))).toBeNull();
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

    it('deleteExpired deletes tokens expired before the cutoff, and only those', async () => {
      const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
      const user = await registered();
      const expired = `r-${randomUUID()}`;
      const live = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash: expired, now: at('2020-01-01'), expiresAt: at('2020-03-01') });
      await repos().resetTokens.create({ userId: user.id, tokenHash: live, now: at('2020-01-01'), expiresAt: at('2020-09-01') });

      expect(await repos().resetTokens.deleteExpired(at('2020-06-01'))).toBe(1);

      expect(await repos().resetTokens.consume(expired, at('2020-02-01'))).toBeNull();
      expect(await repos().resetTokens.consume(live, at('2020-08-01'))).not.toBeNull();
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

  describe('rooms', () => {
    const newRoom = (rules = { firstRevealDraw: true }) => repos().rooms.create({ visibility: 'open', seatCount: 4, rules, now: NOW });
    const addHuman = (roomId: string, userId: string, displayName: string, at = NOW) =>
      repos().rooms.addPlayer({ roomId, userId, kind: 'human', displayName, now: at });
    const addBot = (roomId: string, displayName: string, at = NOW) => repos().rooms.addPlayer({ roomId, userId: null, kind: 'bot', displayName, now: at });
    const live = async (roomId: string) => (await repos().rooms.listLive()).find((entry) => entry.room.id === roomId);

    it('creates a room in the lobby with no host yet', async () => {
      const room = await newRoom();
      expect(room).toEqual({
        id: expect.any(String),
        visibility: 'open',
        status: 'lobby',
        seatCount: 4,
        rules: { firstRevealDraw: true },
        hostPlayerId: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      expect((await live(room.id))?.room).toEqual(room);
    });

    it('adds members and lists them in join order, a bot with no user', async () => {
      const room = await newRoom();
      const ann = await registered();
      const host = await addHuman(room.id, ann.id, 'Ann', minutes(1));
      const bot = await addBot(room.id, 'Bot 1', minutes(2));
      expect(host).toEqual({ id: expect.any(String), roomId: room.id, userId: ann.id, kind: 'human', displayName: 'Ann', joinedAt: minutes(1), leftAt: null });
      expect(bot).toMatchObject({ userId: null, kind: 'bot', displayName: 'Bot 1' });
      expect((await live(room.id))?.players).toEqual([host, bot]);
    });

    it('updates the status, seat count, rules and host, and the update time', async () => {
      const room = await newRoom();
      const host = await addHuman(room.id, (await registered()).id, 'Ann');
      await repos().rooms.update(room.id, { hostPlayerId: host.id, seatCount: 6, rules: { firstRevealDraw: false } }, minutes(3));
      expect((await live(room.id))?.room).toMatchObject({ hostPlayerId: host.id, seatCount: 6, rules: { firstRevealDraw: false }, status: 'lobby', updatedAt: minutes(3) });
    });

    it('refuses a name a current member has, in any case (Review Focus 2)', async () => {
      const room = await newRoom();
      await addHuman(room.id, (await registered()).id, 'Ann');
      await addBot(room.id, 'Bot 1');
      await expect(addHuman(room.id, (await registered()).id, 'ANN')).rejects.toBeInstanceOf(NameTakenError);
      await expect(addHuman(room.id, (await registered()).id, 'bot 1')).rejects.toBeInstanceOf(NameTakenError);
    });

    it('allows the same name in another room', async () => {
      const first = await newRoom();
      const second = await newRoom();
      await addHuman(first.id, (await registered()).id, 'Ann');
      await expect(addHuman(second.id, (await registered()).id, 'Ann')).resolves.toMatchObject({ displayName: 'Ann' });
    });

    it('frees a name once its member has left, and drops them from the live list', async () => {
      const room = await newRoom();
      const user = await registered();
      const ann = await addHuman(room.id, user.id, 'Ann');
      await repos().rooms.markLeft(ann.id, minutes(1));
      expect((await live(room.id))?.players).toEqual([]);
      await expect(addHuman(room.id, user.id, 'Ann', minutes(2))).resolves.toMatchObject({ displayName: 'Ann', leftAt: null });
    });

    it('lets exactly one of two racing joins with the same name win', async () => {
      const room = await newRoom();
      const [a, b] = [await registered(), await registered()];
      const results = await Promise.allSettled([addHuman(room.id, a.id, 'Cao Cao'), addHuman(room.id, b.id, 'cao cao')]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(NameTakenError);
    });

    it('refuses a second current membership for one user', async () => {
      const room = await newRoom();
      const user = await registered();
      await addHuman(room.id, user.id, 'Ann');
      await expect(addHuman(room.id, user.id, 'Annie')).rejects.toThrow();
    });

    it('leaves closed rooms out of the live list', async () => {
      const room = await newRoom();
      await repos().rooms.update(room.id, { status: 'closed' }, minutes(1));
      expect(await live(room.id)).toBeUndefined();
    });

    it("keeps a deleted guest's membership, with no user", async () => {
      const longAgo = new Date('2025-12-01T00:00:00.000Z');
      const room = await newRoom();
      const guest = await repos().users.createGuest({ displayName: 'Zhou Yu', now: longAgo });
      await addHuman(room.id, guest.id, 'Zhou Yu');
      await repos().users.deleteIdleGuests(new Date('2026-01-01T00:00:00.000Z'));
      expect((await live(room.id))?.players).toEqual([expect.objectContaining({ displayName: 'Zhou Yu', userId: null, kind: 'human' })]);
    });

    it('rolls back a room created in a failed transaction', async () => {
      const failure = new Error('boom');
      let roomId = '';
      await expect(
        repos().transaction(async (tx) => {
          const room = await tx.rooms.create({ visibility: 'open', seatCount: 4, rules: {}, now: NOW });
          roomId = room.id;
          await tx.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: NOW });
          throw failure;
        })
      ).rejects.toBe(failure);
      expect(await live(roomId)).toBeUndefined();
    });
  });

  describe('games', () => {
    const SEATS: GameSeat[] = [
      { seatId: 'seat-0', roomPlayerId: randomUUID(), name: 'Ann', kind: 'human' },
      { seatId: 'seat-1', roomPlayerId: randomUUID(), name: 'Bot 1', kind: 'bot' },
    ];
    const newRoom = () => repos().rooms.create({ visibility: 'open', seatCount: 2, rules: {}, now: NOW });
    const newGame = async (roomId?: string) =>
      repos().games.create({ roomId: roomId ?? (await newRoom()).id, seed: 2 ** 31 - 1, seats: SEATS, rules: { firstRevealDraw: true }, buildId: 'build-1', now: NOW });
    const row = (seq: number, source: ActionSource = 'human'): NewGameAction => ({
      seq,
      seatId: 'seat-0',
      source,
      action: { kind: 'EndPhaseAction', seatId: 'seat-0' },
      stateHash: `hash-${seq}`,
    });
    const append = (gameId: string, afterSeq: number, rows: NewGameAction[], at = NOW) =>
      repos().transaction((tx) => tx.games.appendActions(gameId, afterSeq, rows, at));

    it('creates a running game with no actions, and finds and lists it', async () => {
      const game = await newGame();
      expect(game).toEqual({
        id: expect.any(String),
        roomId: expect.any(String),
        seed: 2 ** 31 - 1,
        seats: SEATS,
        rules: { firstRevealDraw: true },
        buildId: 'build-1',
        status: 'running',
        result: null,
        actionCount: 0,
        startedAt: NOW,
        finishedAt: null,
      });
      expect(await repos().games.findById(game.id)).toEqual(game);
      expect((await repos().games.listRunning()).map((g) => g.id)).toContain(game.id);
      expect(await repos().games.listActions(game.id)).toEqual([]);
    });

    it('refuses a second running game in one room', async () => {
      const game = await newGame();
      await expect(newGame(game.roomId)).rejects.toThrow();
    });

    it('lets a room start a new game once its last one has ended', async () => {
      const game = await newGame();
      await repos().games.update(game.id, { status: 'aborted', finishedAt: minutes(1) });
      await expect(newGame(game.roomId)).resolves.toMatchObject({ status: 'running' });
    });

    it('appends actions in order, stamps them, and counts them', async () => {
      const game = await newGame();
      await append(game.id, 0, [row(1), row(2, 'bot')], minutes(1));
      await append(game.id, 2, [row(3, 'timeout')], minutes(2));
      expect(await repos().games.listActions(game.id)).toEqual([
        { gameId: game.id, seq: 1, seatId: 'seat-0', source: 'human', action: { kind: 'EndPhaseAction', seatId: 'seat-0' }, stateHash: 'hash-1', createdAt: minutes(1) },
        expect.objectContaining({ seq: 2, source: 'bot', createdAt: minutes(1) }),
        expect.objectContaining({ seq: 3, source: 'timeout', createdAt: minutes(2) }),
      ]);
      expect((await repos().games.findById(game.id))?.actionCount).toBe(3);
    });

    it('refuses actions after a stale count, and stores none of them (Review Focus 2)', async () => {
      const game = await newGame();
      await append(game.id, 0, [row(1)]);
      await expect(append(game.id, 0, [row(1), row(2)])).rejects.toBeInstanceOf(StaleGameError);
      expect((await repos().games.listActions(game.id)).map((a) => a.seq)).toEqual([1]);
      expect((await repos().games.findById(game.id))?.actionCount).toBe(1);
    });

    it('lets exactly one of two racing appends at the same count win', async () => {
      const game = await newGame();
      const results = await Promise.allSettled([append(game.id, 0, [row(1)]), append(game.id, 0, [row(1, 'bot')])]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await repos().games.listActions(game.id)).toHaveLength(1);
    });

    it('finishes a game with its result, and drops it from the running list', async () => {
      const game = await newGame();
      const result = { endedAt: 12, winningKingdom: 'Wei' as const, winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] };
      await repos().games.update(game.id, { status: 'finished', result, finishedAt: minutes(5) });
      expect(await repos().games.findById(game.id)).toMatchObject({ status: 'finished', result, finishedAt: minutes(5), actionCount: 0 });
      expect((await repos().games.listRunning()).map((g) => g.id)).not.toContain(game.id);
    });

    it('rolls back appended actions in a failed transaction', async () => {
      const game = await newGame();
      const failure = new Error('boom');
      await expect(
        repos().transaction(async (tx) => {
          await tx.games.appendActions(game.id, 0, [row(1)], NOW);
          throw failure;
        })
      ).rejects.toBe(failure);
      expect(await repos().games.listActions(game.id)).toEqual([]);
      expect((await repos().games.findById(game.id))?.actionCount).toBe(0);
    });
  });
}
