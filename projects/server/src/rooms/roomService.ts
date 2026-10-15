import { randomInt } from 'node:crypto';
import { ruleBasedPolicy } from 'bots';
import type { BotPolicy } from 'bots';
import { buildContentRegistry, FIRST_REVEAL_MIN_SEATS } from 'content';
import type { Action, ContentRegistry, EngineContext, GameResult, GameRules, GameState } from 'engine';
import { normalizeDisplayName } from 'protocol';
import type { CreateRoomBody, GameOutcome, RoomCommand, RoomLeftReason, RoomList, RoomSnapshot, SeatLimits, ServerMessage, SoloRoomBody } from 'protocol';
import { drawSeats, engineContext, openingState, replay } from '../game/engineGame';
import { BOT_DELAY_MS, GameRunner, RunnerHost, TAKEOVER_AWAY_MS } from '../game/gameRunner';
import { realScheduler, Scheduler } from '../game/scheduler';
import { GameRecord, RoomPlayerRecord, UserRecord } from '../persistence/records';
import { NameTakenError, Repositories } from '../persistence/repositories';
import { toRoomListItem, toRoomSnapshot } from '../views/room';
import { RoomError } from './errors';
import { ChatService } from './chatService';
import { memberFrom, Room, RoomMember, sameName } from './room';
import { SerialQueue } from './serialQueue';

// A host away this long in the lobby hands the role on (spec "Host rules").
export const HOST_AWAY_MS = 60_000;
// A lobby with no input for this long closes.
export const LOBBY_IDLE_MS = 30 * 60_000;
// How often the server calls tick().
export const ROOM_TICK_MS = 5_000;

// One member's socket, as the room sees it.
export interface MemberConnection {
  send(message: ServerMessage): void;
  // Ends the connection from the server side.
  close(): void;
}

export interface RoomServiceDeps {
  repos: Repositories;
  seatLimits: SeatLimits;
  // Clock in ms.
  now?: () => number;
  // Where failures of background work (tick, game timers) go.
  logError?: (err: unknown, message: string) => void;
  // The engine's content. Built on first use when not given.
  registry?: ContentRegistry;
  // Stored on each game: the engine + content build (config BUILD_ID).
  buildId?: string;
  // Seeds for new games.
  randomSeed?: () => number;
  // Game timers. Tests pass a ManualScheduler.
  scheduler?: Scheduler;
  botDelayMs?: number;
  takeoverAwayMs?: number;
  botPolicy?: BotPolicy;
}

interface LiveRoom {
  room: Room;
  queue: SerialQueue;
  // The current connection of each connected human, by player id.
  connections: Map<string, MemberConnection>;
  // The running game, while the room is playing.
  runner: GameRunner | null;
  // A game that ended but whose end could not be stored yet: the room stays
  // playing until the tick stores it.
  pendingEnd: PendingEnd | null;
}

interface PendingEnd {
  game: GameRecord;
  outcome: GameOutcome;
  result: GameResult | null;
}

// Stores a game's end that could not be stored when the game ended, if any.
async function storePendingEnd(tx: Repositories, end: PendingEnd | null, at: Date): Promise<void> {
  if (end) await tx.games.update(end.game.id, { status: end.outcome === 'finished' ? 'finished' : 'broken', result: end.result, finishedAt: at });
}

// The rules the engine reads. Unknown keys never get stored, and First Reveal
// Bonus is dropped below the seat count where it applies.
function rulesFrom(rules: GameRules, seatCount: number): GameRules {
  return rules.firstRevealDraw === undefined || seatCount < FIRST_REVEAL_MIN_SEATS ? {} : { firstRevealDraw: rules.firstRevealDraw };
}

function requireName(raw: string): string {
  const name = normalizeDisplayName(raw);
  if (name === null) throw new RoomError('invalid_name');
  return name;
}

// "Bot 1", "Bot 2", … skipping the player's own name.
function botNamesBeside(name: string, count: number): string[] {
  const names: string[] = [];
  for (let n = 1; names.length < count; n += 1) if (!sameName(`Bot ${n}`, name)) names.push(`Bot ${n}`);
  return names;
}

// Every live room, held in memory. Each room's inputs run one at a time on
// its queue: check, persist, commit in memory, publish. A playing room's
// GameRunner moves its game, and its timers run on the same queue.
export class RoomService {
  private readonly repos: Repositories;
  private readonly seatLimits: SeatLimits;
  private readonly now: () => number;
  private readonly logError: (err: unknown, message: string) => void;
  private readonly registry: ContentRegistry | null;
  private readonly buildId: string;
  private readonly randomSeed: () => number;
  private readonly scheduler: Scheduler;
  private readonly botDelayMs: number;
  private readonly takeoverAwayMs: number;
  private readonly botPolicy: BotPolicy;
  private readonly chat: ChatService;
  private engine: EngineContext | null = null;
  private readonly live = new Map<string, LiveRoom>();
  // Create and join check memberships across rooms, so they run one at a time.
  private readonly membership = new SerialQueue();

  constructor(deps: RoomServiceDeps) {
    this.repos = deps.repos;
    this.seatLimits = deps.seatLimits;
    this.now = deps.now ?? Date.now;
    this.logError = deps.logError ?? ((err, message) => console.error(message, err));
    this.registry = deps.registry ?? null;
    this.buildId = deps.buildId ?? 'dev';
    this.randomSeed = deps.randomSeed ?? (() => randomInt(0, 2 ** 31));
    this.scheduler = deps.scheduler ?? realScheduler;
    this.botDelayMs = deps.botDelayMs ?? BOT_DELAY_MS;
    this.takeoverAwayMs = deps.takeoverAwayMs ?? TAKEOVER_AWAY_MS;
    this.botPolicy = deps.botPolicy ?? ruleBasedPolicy;
    this.chat = new ChatService(this.repos, this.now);
  }

  // The engine, built on first use: lobby-only tests never need the content.
  private get ctx(): EngineContext {
    this.engine ??= engineContext(this.registry ?? buildContentRegistry());
    return this.engine;
  }

  // Reloads every live room from the store after a restart. Nobody is
  // connected yet, so every human starts away: lobbies follow the usual host
  // and idle rules, and running games are rebuilt from their stored actions.
  async restore(): Promise<void> {
    const now = this.now();
    const running = new Map((await this.repos.games.listRunning()).map((game) => [game.roomId, game]));
    for (const { room, players } of await this.repos.rooms.listLive()) {
      const members = await Promise.all(players.map(async (player) => memberFrom(player, await this.isRegistered(player), now)));
      const entry = this.track(new Room(room, members, now));
      await entry.queue
        .run(async () => {
          if (room.status === 'playing') await this.restoreGame(entry, running.get(room.id) ?? null);
          else if (entry.room.humans().length === 0) await this.closeRoom(entry, 'idle');
        })
        .catch((err: unknown) => this.logError(err, `Restoring room ${room.id} failed`));
    }
  }

  // Graceful shutdown: no more game timers, and every queued input finishes.
  async stop(): Promise<void> {
    await Promise.all([...this.live.values()].map((entry) => entry.queue.run(async () => entry.runner?.stop()).catch(() => undefined)));
  }

  // Your rooms first, then the other open rooms; newest first within each.
  list(user: UserRecord): RoomList {
    const rooms = [...this.live.values()]
      .map((entry) => entry.room)
      .filter((room) => room.record.visibility === 'open' || room.memberForUser(user.id))
      .sort((a, b) => b.record.createdAt.getTime() - a.record.createdAt.getTime());
    const items = rooms.map((room) => toRoomListItem(room, user.id));
    items.sort((a, b) => Number(b.youAreMember) - Number(a.youAreMember));
    return { rooms: items, seatLimits: { ...this.seatLimits } };
  }

  snapshot(user: UserRecord, roomId: string): RoomSnapshot {
    const entry = this.live.get(roomId);
    if (!entry) throw new RoomError('not_found');
    if (!entry.room.memberForUser(user.id)) throw new RoomError(entry.room.record.visibility === 'open' ? 'not_member' : 'not_found');
    return this.snapshotOf(entry);
  }

  create(user: UserRecord, body: CreateRoomBody): Promise<string> {
    return this.membership.run(async () => {
      if (user.kind !== 'registered') throw new RoomError('host_must_be_registered');
      const name = requireName(body.displayName);
      this.requireSeatCount(body.seatCount, 1);
      this.requireNoOtherRoom(user.id, null);
      const now = this.now();
      const at = new Date(now);
      const rules = rulesFrom(body.rules, body.seatCount);
      const { room, host } = await this.repos.transaction(async (tx) => {
        const created = await tx.rooms.create({ visibility: 'open', seatCount: body.seatCount, rules, now: at });
        const player = await tx.rooms.addPlayer({ roomId: created.id, userId: user.id, kind: 'human', displayName: name, now: at });
        await tx.rooms.update(created.id, { hostPlayerId: player.id }, at);
        return { room: { ...created, hostPlayerId: player.id }, host: player };
      });
      this.track(new Room(room, [memberFrom(host, true, now)], now));
      return room.id;
    });
  }

  join(user: UserRecord, roomId: string, displayName: string): Promise<void> {
    return this.membership.run(() =>
      this.inRoom(roomId, async (entry) => {
        const { room } = entry;
        if (room.record.visibility !== 'open') throw new RoomError('not_found');
        // A member joining again is coming back: they keep their membership and name.
        if (room.memberForUser(user.id)) return;
        if (room.record.status !== 'lobby') throw new RoomError('in_progress');
        if (room.isFull()) throw new RoomError('room_full');
        this.requireNoOtherRoom(user.id, roomId);
        const name = requireName(displayName);
        if (room.nameTaken(name)) throw new RoomError('name_taken');
        const now = this.now();
        const player = await this.addPlayer({ roomId, userId: user.id, kind: 'human', displayName: name, now: new Date(now) });
        room.members.push(memberFrom(player, user.kind === 'registered', now));
        this.touched(entry, now);
      })
    );
  }

  // Play vs Bots (spec "Solo rooms"): an unlisted room with the user and
  // bots, whose game starts at once. One per user. A solo room with no
  // running game is replaced without asking; a running one only with
  // `replace`, which ends its game unfinished.
  createSolo(user: UserRecord, body: SoloRoomBody): Promise<string> {
    return this.membership.run(async () => {
      this.requireSeatCount(body.seatCount, 1);
      const name = requireName(user.displayName);
      const existing = [...this.live.values()].find((entry) => entry.room.record.visibility === 'solo' && entry.room.memberForUser(user.id));
      if (existing) {
        if (existing.room.record.status === 'playing' && !body.replace) throw new RoomError('solo_exists');
        await existing.queue.run(async () => {
          if (this.live.get(existing.room.id) === existing) await this.abortAndClose(existing, 'left');
        });
      }
      const now = this.now();
      const rules = rulesFrom(body.rules, body.seatCount);
      const { room, players } = await this.repos.transaction(async (tx) => {
        const created = await tx.rooms.create({ visibility: 'solo', seatCount: body.seatCount, rules, now: new Date(now) });
        const added = [await tx.rooms.addPlayer({ roomId: created.id, userId: user.id, kind: 'human', displayName: name, now: new Date(now) })];
        for (const [i, botName] of botNamesBeside(name, body.seatCount - 1).entries()) {
          added.push(await tx.rooms.addPlayer({ roomId: created.id, userId: null, kind: 'bot', displayName: botName, now: new Date(now + i + 1) }));
        }
        return { room: created, players: added };
      });
      const members = players.map((player) => memberFrom(player, player.kind === 'human' && user.kind === 'registered', now));
      const entry = this.track(new Room(room, members, now));
      await entry.queue.run(() => this.startGame(entry));
      return room.id;
    });
  }

  // A member's socket said hello. The newest connection wins: an older one is
  // told it was replaced and closed. In a game, a returning member takes their
  // seat back (the others hear first), then gets `welcome` with the game.
  connect(user: UserRecord, roomId: string, connection: MemberConnection): Promise<string> {
    return this.inRoom(roomId, async (entry) => {
      const member = entry.room.memberForUser(user.id);
      if (!member) throw new RoomError('not_member');
      // Read first, so a store error leaves the member as they were.
      const chat = entry.room.record.visibility === 'solo' ? [] : await this.chat.recent(roomId);
      const previous = entry.connections.get(member.id);
      entry.connections.delete(member.id);
      if (previous) {
        previous.send({ type: 'replaced' });
        previous.close();
      }
      member.connected = true;
      member.awaySince = null;
      entry.room.lastActivityAt = this.now();
      const runner = entry.runner;
      runner?.connected(member.id);
      entry.connections.set(member.id, connection);
      connection.send({
        type: 'welcome',
        you: { playerId: member.id, seatId: runner?.seatOf(member.id) ?? null },
        room: this.snapshotOf(entry),
        game: runner?.updateFor(member.id, 0) ?? null,
        chat,
      });
      this.broadcast(entry, member.id);
      return member.id;
    });
  }

  // A socket closed. Ignored unless it is the member's current connection:
  // a replaced connection closes after its successor registered.
  disconnect(roomId: string, playerId: string, connection: MemberConnection): Promise<void> {
    const entry = this.live.get(roomId);
    if (!entry) return Promise.resolve();
    return entry.queue.run(async () => {
      if (entry.connections.get(playerId) !== connection) return;
      entry.connections.delete(playerId);
      const member = entry.room.member(playerId);
      if (!member) return;
      member.connected = false;
      member.awaySince = this.now();
      entry.runner?.disconnected(playerId);
      this.broadcast(entry);
    });
  }

  // A connected member's request. Queued synchronously, so one connection's
  // requests run in the order they arrived.
  command(user: UserRecord, roomId: string, playerId: string, command: RoomCommand): Promise<void> {
    return this.inRoom(roomId, async (entry) => {
      const actor = entry.room.member(playerId);
      if (!actor || actor.userId !== user.id) throw new RoomError('not_member');
      switch (command.type) {
        case 'lobby.addBot':
          return this.addBot(entry, actor);
        case 'lobby.removePlayer':
          return this.removePlayer(entry, actor, command.playerId);
        case 'lobby.setRules':
          return this.setRules(entry, actor, command.seatCount, command.rules);
        case 'lobby.makeHost':
          return this.makeHost(entry, actor, command.playerId);
        case 'lobby.start':
          return this.start(entry, actor);
        case 'room.leave':
          return this.leave(entry, actor);
        case 'game.submit':
          // The schema checks only each action's shape; the runner accepts only offered actions.
          return this.submit(entry, actor, command.gameId, command.baseSeq, command.actions as unknown as Action[]);
        case 'game.resync':
          return this.resync(entry, actor);
        case 'chat.send':
          return this.sendChat(entry, actor, command.body);
      }
    });
  }

  // Timed rules, run every ROOM_TICK_MS. A lobby that is idle closes, and a
  // host away for HOST_AWAY_MS hands the role to a connected registered
  // member. In a game, an away player's seat goes to a bot.
  tick(): Promise<void> {
    const work = [...this.live.values()].map((entry) =>
      entry.queue
        .run(async () => {
          if (this.live.get(entry.room.id) !== entry) return;
          if (entry.room.record.status === 'playing') {
            if (entry.pendingEnd && !entry.runner) return this.storeEnd(entry, entry.pendingEnd);
            return entry.runner?.tick();
          }
          if (entry.room.record.status !== 'lobby') return;
          const now = this.now();
          if (now - entry.room.lastActivityAt >= LOBBY_IDLE_MS) return this.closeRoom(entry, 'idle');
          const host = entry.room.host;
          if (!host || host.connected || host.awaySince === null || now - host.awaySince < HOST_AWAY_MS) return;
          const next = entry.room.successor(true);
          if (!next) return;
          // Not activity: a room nobody touches still closes when idle.
          await this.setHost(entry, next.id, now);
          this.broadcast(entry);
        })
        .catch((err: unknown) => this.logError(err, `Room ${entry.room.id} housekeeping failed`))
    );
    return Promise.all(work).then(() => undefined);
  }

  private async addBot(entry: LiveRoom, actor: RoomMember): Promise<void> {
    this.requireHostInLobby(entry, actor);
    const { room } = entry;
    if (room.isFull()) throw new RoomError('room_full');
    const now = this.now();
    const bot = await this.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: room.nextBotName(), now: new Date(now) });
    room.members.push(memberFrom(bot, false, now));
    this.touched(entry, now);
  }

  private async removePlayer(entry: LiveRoom, actor: RoomMember, playerId: string): Promise<void> {
    this.requireHostInLobby(entry, actor);
    const target = entry.room.member(playerId);
    if (!target) throw new RoomError('not_found');
    // The host leaves with room.leave instead.
    if (target.id === actor.id) throw new RoomError('invalid_message');
    const now = this.now();
    await this.repos.rooms.markLeft(target.id, new Date(now));
    entry.room.remove(target.id);
    this.chat.forget([target.id]);
    this.dropConnection(entry, target.id, 'removed');
    this.touched(entry, now);
  }

  private async setRules(entry: LiveRoom, actor: RoomMember, seatCount: number, rules: GameRules): Promise<void> {
    this.requireHostInLobby(entry, actor);
    this.requireSeatCount(seatCount, entry.room.members.length);
    const now = this.now();
    const clean = rulesFrom(rules, seatCount);
    await this.repos.rooms.update(entry.room.id, { seatCount, rules: clean }, new Date(now));
    entry.room.record = { ...entry.room.record, seatCount, rules: clean, updatedAt: new Date(now) };
    this.touched(entry, now);
  }

  private async makeHost(entry: LiveRoom, actor: RoomMember, playerId: string): Promise<void> {
    this.requireHostInLobby(entry, actor);
    const target = entry.room.member(playerId);
    if (!target) throw new RoomError('not_found');
    if (target.kind !== 'human' || !target.isRegistered) throw new RoomError('host_must_be_registered');
    const now = this.now();
    if (target.id !== actor.id) await this.setHost(entry, target.id, now);
    this.touched(entry, now);
  }

  // Start Game: the host of an open room, or the player of a solo room, once
  // every seat is filled.
  private async start(entry: LiveRoom, actor: RoomMember): Promise<void> {
    const { room } = entry;
    const solo = room.record.visibility === 'solo';
    if (solo ? actor.kind !== 'human' : room.record.hostPlayerId !== actor.id) throw new RoomError('not_host');
    if (room.record.status !== 'lobby') throw new RoomError('in_progress');
    if (room.members.length !== room.record.seatCount) throw new RoomError('not_full');
    this.requireSeatCount(room.record.seatCount, room.members.length);
    await this.startGame(entry);
  }

  // Start Game, step by step (spec "Rules"): the seed, the seats drawn from
  // it, the opening state; then store the game, and run it.
  private async startGame(entry: LiveRoom): Promise<void> {
    const { room } = entry;
    const now = this.now();
    const at = new Date(now);
    const seed = this.randomSeed();
    const seats = drawSeats(
      room.members.map((m) => ({ id: m.id, name: m.name, kind: m.kind })),
      seed
    );
    const state = openingState(this.ctx, seed, seats, room.record.rules);
    const game = await this.repos.transaction(async (tx) => {
      const created = await tx.games.create({ roomId: room.id, seed, seats, rules: room.record.rules, buildId: this.buildId, now: at });
      await tx.rooms.update(room.id, { status: 'playing' }, at);
      return created;
    });
    room.record = { ...room.record, status: 'playing', updatedAt: at };
    room.lastGame = null;
    room.lastActivityAt = now;
    this.run(entry, game, state, 0);
    this.broadcast(entry);
    this.publishGame(entry, 0);
  }

  // Puts a runner on the room and sets its first clock or bot move.
  private run(entry: LiveRoom, game: GameRecord, state: GameState, seq: number): void {
    const runner = new GameRunner(
      {
        record: game,
        state,
        seq,
        connected: new Set(entry.connections.keys()),
        present: new Set(entry.room.members.map((m) => m.id)),
      },
      this.ctx,
      this.runnerHost(entry, game.id),
      { solo: entry.room.record.visibility === 'solo', botDelayMs: this.botDelayMs, takeoverAwayMs: this.takeoverAwayMs, policy: this.botPolicy }
    );
    entry.runner = runner;
    runner.start();
  }

  private runnerHost(entry: LiveRoom, gameId: string): RunnerHost {
    return {
      now: this.now,
      schedule: (delayMs, work) => this.scheduler.schedule(delayMs, () => this.onQueue(entry, work)),
      persist: (actions) => this.repos.transaction((tx) => tx.games.appendActions(gameId, actions[0].seq - 1, actions, new Date(this.now()))),
      publish: (logFrom) => this.publishGame(entry, logFrom),
      seatsChanged: () => this.broadcast(entry),
      finished: () => this.endGame(entry, 'finished'),
      broke: (err) => {
        this.logError(err, `Game ${gameId} broke`);
        return this.endGame(entry, 'broken');
      },
      logError: this.logError,
    };
  }

  // A game timer's work: on the room's queue, and only while the room is live.
  private onQueue(entry: LiveRoom, work: () => Promise<void>): Promise<void> {
    return entry.queue
      .run(async () => {
        if (this.live.get(entry.room.id) === entry) await work();
      })
      .catch((err: unknown) => this.logError(err, `Room ${entry.room.id} game timer failed`));
  }

  private async submit(entry: LiveRoom, actor: RoomMember, gameId: string, baseSeq: number, actions: Action[]): Promise<void> {
    if (!entry.runner) throw new RoomError('no_game');
    entry.room.lastActivityAt = this.now();
    await entry.runner.submit(actor.id, gameId, baseSeq, actions);
  }

  private async resync(entry: LiveRoom, actor: RoomMember): Promise<void> {
    const game = entry.runner?.updateFor(actor.id, 0);
    if (!game) throw new RoomError('no_game');
    entry.connections.get(actor.id)?.send({ type: 'game.update', game });
  }

  // A member's chat message: stored, then sent to everyone connected. It
  // counts as activity, so a lobby where people talk is not idle. Solo rooms
  // have no chat.
  private async sendChat(entry: LiveRoom, actor: RoomMember, body: string): Promise<void> {
    if (entry.room.record.visibility === 'solo') throw new RoomError('chat_unavailable');
    const runner = entry.runner;
    const message = await this.chat.send(
      { roomId: entry.room.id, playerId: actor.id, gameId: runner?.id ?? null, afterSeq: runner ? runner.seq : null },
      body
    );
    entry.room.lastActivityAt = this.now();
    const notice: ServerMessage = { type: 'chat.message', ...message };
    for (const connection of entry.connections.values()) connection.send(notice);
  }

  // The runner's game ended (a result, or a failure): store that, and the room returns to the lobby.
  private async endGame(entry: LiveRoom, outcome: 'finished' | 'broken'): Promise<void> {
    const runner = entry.runner;
    if (!runner) return;
    runner.stop();
    entry.runner = null;
    await this.storeEnd(entry, { game: runner.record, outcome, result: outcome === 'finished' ? runner.state.result : null });
  }

  // Tries to store a game's end. On failure the end stays pending and the
  // room tick retries it; nothing is rethrown, since the move that ended the
  // game is already stored. Memory stays playing until the store succeeds.
  private async storeEnd(entry: LiveRoom, end: PendingEnd): Promise<void> {
    try {
      entry.pendingEnd = null;
      await this.closeGame(entry, end.game, end.outcome, end.result);
    } catch (err) {
      // Only a failure before the room left `playing` needs a retry.
      if (entry.room.record.status === 'playing') entry.pendingEnd = end;
      this.logError(err, `Room ${entry.room.id}: storing the game's end failed; retrying`);
    }
  }

  // Stores how a game ended and returns its room to the lobby with the result
  // shown. An open room left with no host passes the role on, or closes.
  private async closeGame(entry: LiveRoom, game: GameRecord, outcome: GameOutcome, result: GameResult | null): Promise<void> {
    const { room } = entry;
    const now = this.now();
    const at = new Date(now);
    await this.repos.transaction(async (tx) => {
      await tx.games.update(game.id, { status: outcome === 'finished' ? 'finished' : 'broken', result, finishedAt: at });
      await tx.rooms.update(room.id, { status: 'lobby' }, at);
    });
    room.record = { ...room.record, status: 'lobby', updatedAt: at };
    room.lastGame = { gameId: game.id, outcome, result, seats: game.seats.map((s) => ({ seatId: s.seatId, playerId: s.roomPlayerId, name: s.name })) };
    room.lastActivityAt = now;
    // A host away when the game ends gets the lobby's 60 s from now (spec "Host rules").
    for (const member of room.members) if (!member.connected && member.kind === 'human') member.awaySince = now;
    if (room.record.visibility === 'open' && !room.host) {
      const successor = room.successor(false);
      if (!successor) return this.closeRoom(entry, 'host_left');
      await this.setHost(entry, successor.id, now);
    }
    this.broadcast(entry);
  }

  // Rebuilds a room's running game from its stored actions (spec "Restore on
  // startup"). Hashes are checked only when the build changed. A replay that
  // fails, or a hash that differs, stops the game as 'outdated'.
  private async restoreGame(entry: LiveRoom, game: GameRecord | null): Promise<void> {
    const { room } = entry;
    if (!game) {
      // Playing, but its game is gone: back to the lobby.
      const at = new Date(this.now());
      await this.repos.rooms.update(room.id, { status: 'lobby' }, at);
      room.record = { ...room.record, status: 'lobby', updatedAt: at };
      return;
    }
    if (room.humans().length === 0) return this.abortAndClose(entry, 'idle', game);
    const actions = await this.repos.games.listActions(game.id);
    let state: GameState;
    try {
      state = replay(this.ctx, game, actions, game.buildId !== this.buildId);
    } catch (err) {
      this.logError(err, `Game ${game.id} can't continue after an update`);
      return this.closeGame(entry, game, 'outdated', null);
    }
    if (state.result) return this.closeGame(entry, game, 'finished', state.result);
    this.run(entry, game, state, actions.length);
  }

  // Ends the room's running game unfinished (the runner's, or `game`), and
  // closes the room. A game whose end was not stored yet gets it stored now.
  private async abortAndClose(entry: LiveRoom, reason: RoomLeftReason, game: GameRecord | null = entry.runner?.record ?? null): Promise<void> {
    const at = new Date(this.now());
    await this.repos.transaction(async (tx) => {
      if (game) await tx.games.update(game.id, { status: 'aborted', finishedAt: at });
      await storePendingEnd(tx, entry.pendingEnd, at);
      await tx.rooms.update(entry.room.id, { status: 'closed' }, at);
    });
    this.dropRoom(entry, reason);
  }

  private async leave(entry: LiveRoom, actor: RoomMember): Promise<void> {
    if (entry.room.record.status === 'playing') return this.leaveGame(entry, actor);
    const { room } = entry;
    const now = this.now();
    const at = new Date(now);
    // Decide from the room as it is, then persist it all at once, then change memory.
    const lastHuman = room.humans().length === 1;
    const wasHost = room.record.hostPlayerId === actor.id;
    const successor = wasHost && !lastHuman ? room.successor(false) : null;
    const closeReason: RoomLeftReason | null = lastHuman ? 'idle' : wasHost && !successor ? 'host_left' : null;
    await this.repos.transaction(async (tx) => {
      await tx.rooms.markLeft(actor.id, at);
      if (closeReason) await tx.rooms.update(room.id, { status: 'closed' }, at);
      else if (successor) await tx.rooms.update(room.id, { hostPlayerId: successor.id }, at);
    });
    room.remove(actor.id);
    this.chat.forget([actor.id]);
    // The socket layer acks, then closes the leaver's connection.
    entry.connections.delete(actor.id);
    if (closeReason) return this.dropRoom(entry, closeReason);
    if (successor) room.record = { ...room.record, hostPlayerId: successor.id, updatedAt: at };
    this.touched(entry, now);
  }

  // Leaving a running game: a bot plays the seat to the end, and a leaving
  // host passes the role on at once (or to nobody until the game ends). The
  // last human leaving (always so in a solo room) ends the game unfinished
  // and closes the room.
  private async leaveGame(entry: LiveRoom, actor: RoomMember): Promise<void> {
    const { room } = entry;
    const runner = entry.runner;
    const now = this.now();
    const at = new Date(now);
    if (room.humans().length === 1) {
      await this.repos.transaction(async (tx) => {
        await tx.rooms.markLeft(actor.id, at);
        if (runner) await tx.games.update(runner.record.id, { status: 'aborted', finishedAt: at });
        // A game whose end was not stored yet gets it stored now.
        await storePendingEnd(tx, entry.pendingEnd, at);
        await tx.rooms.update(room.id, { status: 'closed' }, at);
      });
      room.remove(actor.id);
      this.chat.forget([actor.id]);
      entry.connections.delete(actor.id);
      return this.dropRoom(entry, 'idle');
    }
    const wasHost = room.record.hostPlayerId === actor.id;
    const successor = wasHost ? room.successor(false) : null;
    await this.repos.transaction(async (tx) => {
      await tx.rooms.markLeft(actor.id, at);
      if (wasHost) await tx.rooms.update(room.id, { hostPlayerId: successor?.id ?? null }, at);
    });
    room.remove(actor.id);
    this.chat.forget([actor.id]);
    entry.connections.delete(actor.id);
    if (wasHost) room.record = { ...room.record, hostPlayerId: successor?.id ?? null, updatedAt: at };
    runner?.left(actor.id);
    this.touched(entry, now);
  }

  private async setHost(entry: LiveRoom, playerId: string, now: number): Promise<void> {
    await this.repos.rooms.update(entry.room.id, { hostPlayerId: playerId }, new Date(now));
    entry.room.record = { ...entry.room.record, hostPlayerId: playerId, updatedAt: new Date(now) };
  }

  private async closeRoom(entry: LiveRoom, reason: RoomLeftReason): Promise<void> {
    await this.repos.rooms.update(entry.room.id, { status: 'closed' }, new Date(this.now()));
    this.dropRoom(entry, reason);
  }

  // The in-memory part of closing: stop the game, forget the room, and tell
  // and close every connection.
  private dropRoom(entry: LiveRoom, reason: RoomLeftReason): void {
    this.chat.forget(entry.room.members.map((m) => m.id));
    entry.runner?.stop();
    entry.runner = null;
    entry.pendingEnd = null;
    this.live.delete(entry.room.id);
    for (const playerId of [...entry.connections.keys()]) this.dropConnection(entry, playerId, reason);
  }

  // Tells a member's connection why it is no longer in the room, and closes it.
  private dropConnection(entry: LiveRoom, playerId: string, reason: RoomLeftReason): void {
    const connection = entry.connections.get(playerId);
    if (!connection) return;
    entry.connections.delete(playerId);
    connection.send({ type: 'room.left', reason });
    connection.close();
  }

  private async addPlayer(input: { roomId: string; userId: string | null; kind: RoomPlayerRecord['kind']; displayName: string; now: Date }): Promise<RoomPlayerRecord> {
    try {
      return await this.repos.rooms.addPlayer(input);
    } catch (err) {
      if (err instanceof NameTakenError) throw new RoomError('name_taken');
      throw err;
    }
  }

  private async isRegistered(player: RoomPlayerRecord): Promise<boolean> {
    if (player.userId === null) return false;
    return (await this.repos.users.findById(player.userId))?.kind === 'registered';
  }

  // Runs work on the room's queue, once the room is still live when its turn comes.
  private inRoom<T>(roomId: string, work: (entry: LiveRoom) => Promise<T>): Promise<T> {
    const entry = this.live.get(roomId);
    if (!entry) return Promise.reject(new RoomError('not_found'));
    return entry.queue.run(async () => {
      if (this.live.get(roomId) !== entry) throw new RoomError('not_found');
      return work(entry);
    });
  }

  private requireHostInLobby(entry: LiveRoom, actor: RoomMember): void {
    if (entry.room.record.hostPlayerId !== actor.id) throw new RoomError('not_host');
    if (entry.room.record.status !== 'lobby') throw new RoomError('in_progress');
  }

  private requireSeatCount(seatCount: number, members: number): void {
    const { min, max } = this.seatLimits;
    if (!Number.isInteger(seatCount) || seatCount < min || seatCount > max || seatCount < members) throw new RoomError('invalid_seat_count');
  }

  // One live open room per user (a solo room doesn't count).
  private requireNoOtherRoom(userId: string, exceptRoomId: string | null): void {
    for (const { room } of this.live.values()) {
      if (room.id !== exceptRoomId && room.record.visibility === 'open' && room.memberForUser(userId)) throw new RoomError('already_in_room');
    }
  }

  private track(room: Room): LiveRoom {
    const entry: LiveRoom = { room, queue: new SerialQueue(), connections: new Map(), runner: null, pendingEnd: null };
    this.live.set(room.id, entry);
    return entry;
  }

  // An input changed the room: it counts as activity, and everyone hears of it.
  private touched(entry: LiveRoom, now: number): void {
    entry.room.lastActivityAt = now;
    this.broadcast(entry);
  }

  private broadcast(entry: LiveRoom, exceptPlayerId?: string): void {
    const message: ServerMessage = { type: 'room.updated', room: this.snapshotOf(entry) };
    for (const [playerId, connection] of entry.connections) if (playerId !== exceptPlayerId) connection.send(message);
  }

  // Each connected member's update: their own view and moves.
  private publishGame(entry: LiveRoom, logFrom: number): void {
    const runner = entry.runner;
    if (!runner) return;
    for (const [playerId, connection] of entry.connections) {
      const game = runner.updateFor(playerId, logFrom);
      if (game) connection.send({ type: 'game.update', game });
    }
  }

  private snapshotOf(entry: LiveRoom): RoomSnapshot {
    return toRoomSnapshot(entry.room, this.seatLimits, entry.runner);
  }
}
