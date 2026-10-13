import type { GameRules } from 'engine';
import { GameActionRecord, GameRecord, GameSeat, ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserRecord } from './records';

export class EmailTakenError extends Error {
  constructor() {
    super('A user with that email already exists');
    this.name = 'EmailTakenError';
  }
}

export class NameTakenError extends Error {
  constructor() {
    super('A current member of the room already has that name');
    this.name = 'NameTakenError';
  }
}

export class StaleGameError extends Error {
  constructor() {
    super('The game has moved past the expected action count');
    this.name = 'StaleGameError';
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
  // Deletes sessions that expired or were revoked before `cutoff`; returns how many.
  deleteExpired(cutoff: Date): Promise<number>;
}

export interface ResetTokenRepository {
  create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<ResetTokenRecord>;
  // Atomically marks an unused, unexpired token used and returns it; null otherwise.
  consume(tokenHash: string, now: Date): Promise<ResetTokenRecord | null>;
  // Marks every unused token of the user used at `now`.
  invalidateAllForUser(userId: string, now: Date): Promise<void>;
  // Deletes tokens that expired before `cutoff`; returns how many.
  deleteExpired(cutoff: Date): Promise<number>;
}

export type RoomChanges = Partial<Pick<RoomRecord, 'status' | 'seatCount' | 'rules' | 'hostPlayerId'>>;

export interface LiveRoomRecord {
  room: RoomRecord;
  // Current members (leftAt null), in join order.
  players: RoomPlayerRecord[];
}

export interface RoomRepository {
  // A new room in 'lobby' with no host yet.
  create(input: { visibility: RoomRecord['visibility']; seatCount: number; rules: RoomRecord['rules']; now: Date }): Promise<RoomRecord>;
  // Applies the changes and sets updatedAt.
  update(roomId: string, changes: RoomChanges, now: Date): Promise<void>;
  // Throws NameTakenError when a current member has the name (compared
  // case-insensitively), and an Error when the user is already a current member.
  addPlayer(input: { roomId: string; userId: string | null; kind: RoomPlayerRecord['kind']; displayName: string; now: Date }): Promise<RoomPlayerRecord>;
  markLeft(playerId: string, now: Date): Promise<void>;
  // Every room that is not closed, with its current members.
  listLive(): Promise<LiveRoomRecord[]>;
}

export type GameChanges = Partial<Pick<GameRecord, 'status' | 'result' | 'finishedAt'>>;
// An action to store; the repository stamps the game and the time.
export type NewGameAction = Omit<GameActionRecord, 'gameId' | 'createdAt'>;

export interface GameRepository {
  // A new 'running' game with no actions. Throws when the room already has a running game.
  create(input: { roomId: string; seed: number; seats: GameSeat[]; rules: GameRules; buildId: string; now: Date }): Promise<GameRecord>;
  // Stores `actions`, numbered afterSeq + 1, afterSeq + 2, …, and sets
  // actionCount to the last. Throws StaleGameError when actionCount isn't
  // `afterSeq`. It makes two writes, so call it inside `transaction`.
  appendActions(gameId: string, afterSeq: number, actions: NewGameAction[], now: Date): Promise<void>;
  update(gameId: string, changes: GameChanges): Promise<void>;
  findById(gameId: string): Promise<GameRecord | null>;
  // Every running game, oldest first.
  listRunning(): Promise<GameRecord[]>;
  // A game's actions in seq order.
  listActions(gameId: string): Promise<GameActionRecord[]>;
}

export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  resetTokens: ResetTokenRepository;
  rooms: RoomRepository;
  games: GameRepository;
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
