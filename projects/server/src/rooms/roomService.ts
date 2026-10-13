import type { GameRules } from 'engine';
import { normalizeDisplayName } from 'protocol';
import type { CreateRoomBody, RoomCommand, RoomLeftReason, RoomList, RoomSnapshot, SeatLimits, ServerMessage } from 'protocol';
import { RoomPlayerRecord, UserRecord } from '../persistence/records';
import { NameTakenError, Repositories } from '../persistence/repositories';
import { toRoomListItem, toRoomSnapshot } from '../views/room';
import { RoomError } from './errors';
import { memberFrom, Room, RoomMember } from './room';
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
  // Where failures of background work (tick) go.
  logError?: (err: unknown, message: string) => void;
}

interface LiveRoom {
  room: Room;
  queue: SerialQueue;
  // The current connection of each connected human, by player id.
  connections: Map<string, MemberConnection>;
}

// The rules the engine reads. Unknown keys never get stored.
function rulesFrom(rules: GameRules): GameRules {
  return rules.firstRevealDraw === undefined ? {} : { firstRevealDraw: rules.firstRevealDraw };
}

function requireName(raw: string): string {
  const name = normalizeDisplayName(raw);
  if (name === null) throw new RoomError('invalid_name');
  return name;
}

// Every live room, held in memory. Each room's inputs run one at a time on
// its queue: check, persist, commit in memory, publish room.updated.
export class RoomService {
  private readonly repos: Repositories;
  private readonly seatLimits: SeatLimits;
  private readonly now: () => number;
  private readonly logError: (err: unknown, message: string) => void;
  private readonly live = new Map<string, LiveRoom>();
  // Create and join check memberships across rooms, so they run one at a time.
  private readonly membership = new SerialQueue();

  constructor(deps: RoomServiceDeps) {
    this.repos = deps.repos;
    this.seatLimits = deps.seatLimits;
    this.now = deps.now ?? Date.now;
    this.logError = deps.logError ?? ((err, message) => console.error(message, err));
  }

  // Reloads every lobby from the store after a restart. Nobody is connected
  // yet, so every human starts away and the usual host and idle rules apply.
  async restore(): Promise<void> {
    const now = this.now();
    for (const { room, players } of await this.repos.rooms.listLive()) {
      // Rooms with a running game come back with their game in Stage 4.
      if (room.status !== 'lobby') continue;
      const members = await Promise.all(players.map(async (player) => memberFrom(player, await this.isRegistered(player), now)));
      const entry = this.track(new Room(room, members, now));
      if (entry.room.humans().length === 0) await entry.queue.run(() => this.closeRoom(entry, 'idle'));
    }
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
      const rules = rulesFrom(body.rules);
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

  // A member's socket said hello. The newest connection wins: an older one is
  // told it was replaced and closed. Sends `welcome` to the new connection.
  connect(user: UserRecord, roomId: string, connection: MemberConnection): Promise<string> {
    return this.inRoom(roomId, async (entry) => {
      const member = entry.room.memberForUser(user.id);
      if (!member) throw new RoomError('not_member');
      const previous = entry.connections.get(member.id);
      entry.connections.set(member.id, connection);
      if (previous) {
        previous.send({ type: 'replaced' });
        previous.close();
      }
      member.connected = true;
      member.awaySince = null;
      entry.room.lastActivityAt = this.now();
      connection.send({ type: 'welcome', you: { playerId: member.id, seatId: null }, room: this.snapshotOf(entry), game: null });
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
        case 'room.leave':
          return this.leave(entry, actor);
      }
    });
  }

  // Timed rules, run every ROOM_TICK_MS: idle lobbies close, and a host away
  // for HOST_AWAY_MS hands the role to a connected registered member.
  tick(): Promise<void> {
    const work = [...this.live.values()].map((entry) =>
      entry.queue
        .run(async () => {
          if (this.live.get(entry.room.id) !== entry || entry.room.record.status !== 'lobby') return;
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
    this.dropConnection(entry, target.id, 'removed');
    this.touched(entry, now);
  }

  private async setRules(entry: LiveRoom, actor: RoomMember, seatCount: number, rules: GameRules): Promise<void> {
    this.requireHostInLobby(entry, actor);
    this.requireSeatCount(seatCount, entry.room.members.length);
    const now = this.now();
    const clean = rulesFrom(rules);
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

  private async leave(entry: LiveRoom, actor: RoomMember): Promise<void> {
    // Leaving a running game hands the seat to a bot: Stage 4.
    if (entry.room.record.status !== 'lobby') throw new RoomError('in_progress');
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
    // The socket layer acks, then closes the leaver's connection.
    entry.connections.delete(actor.id);
    if (closeReason) return this.dropRoom(entry, closeReason);
    if (successor) room.record = { ...room.record, hostPlayerId: successor.id, updatedAt: at };
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

  // The in-memory part of closing: forget the room, and tell and close every connection.
  private dropRoom(entry: LiveRoom, reason: RoomLeftReason): void {
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
    const entry: LiveRoom = { room, queue: new SerialQueue(), connections: new Map() };
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

  private snapshotOf(entry: LiveRoom): RoomSnapshot {
    return toRoomSnapshot(entry.room, this.seatLimits);
  }
}
