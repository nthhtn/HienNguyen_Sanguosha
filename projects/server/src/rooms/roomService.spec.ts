import { randomUUID } from 'node:crypto';
import type { RoomSnapshot, ServerMessage } from 'protocol';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import type { Repositories } from '../persistence/repositories';
import { HOST_AWAY_MS, LOBBY_IDLE_MS, MemberConnection, RoomService } from './roomService';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const LIMITS = { min: 2, max: 6 };

class FakeConnection implements MemberConnection {
  readonly sent: ServerMessage[] = [];
  closed = false;
  send(message: ServerMessage): void {
    this.sent.push(message);
  }
  close(): void {
    this.closed = true;
  }
  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    return [...this.sent].reverse().find((m) => m.type === type) as Extract<ServerMessage, { type: T }> | undefined;
  }
  // The room as this connection last saw it.
  get room(): RoomSnapshot | undefined {
    const message = [...this.sent].reverse().find((m) => m.type === 'room.updated' || m.type === 'welcome');
    return message && (message.type === 'room.updated' || message.type === 'welcome') ? message.room : undefined;
  }
}

async function setup() {
  const repos = createMemoryRepositories();
  let now = T0;
  const logError = jest.fn();
  const rooms = new RoomService({ repos, seatLimits: LIMITS, now: () => now, logError });
  const advance = (ms: number) => {
    now += ms;
  };
  const registered = (name: string) =>
    repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(now) });
  const guest = (name: string) => repos.users.createGuest({ displayName: name, now: new Date(now) });
  const open = (host: UserRecord, seatCount = 4) => rooms.create(host, { seatCount, rules: { firstRevealDraw: true }, displayName: host.displayName });
  const connect = async (user: UserRecord, roomId: string) => {
    const connection = new FakeConnection();
    const playerId = await rooms.connect(user, roomId, connection);
    return { connection, playerId };
  };
  const names = (snapshot: RoomSnapshot | undefined) => snapshot?.members.map((m) => m.name);
  return { repos, rooms, advance, registered, guest, open, connect, names, logError };
}

const code = (code: string) => expect.objectContaining({ code });
// What a synchronous call threw, for comparing with code(…).
const thrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
};

describe('RoomService', () => {
  describe('create', () => {
    it('makes the registered creator the first member and the host', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const snapshot = rooms.snapshot(ann, id);
      expect(snapshot).toEqual({
        id,
        visibility: 'open',
        status: 'lobby',
        seatCount: 4,
        rules: {},
        hostPlayerId: snapshot.members[0].playerId,
        members: [{ playerId: expect.any(String), name: 'Ann', kind: 'human', seatId: null, isRegistered: true, connected: false, botControlled: false }],
        lastGame: null,
        seatLimits: LIMITS,
      });
    });

    it('keeps First Reveal Bonus only from the minimum seat count', async () => {
      const { rooms, registered } = await setup();
      const rulesOf = async (name: string, seatCount: number) => {
        const user = await registered(name);
        const id = await rooms.create(user, { seatCount, rules: { firstRevealDraw: true }, displayName: name });
        return rooms.snapshot(user, id).rules;
      };
      expect(await rulesOf('Ann', 3)).toEqual({});
      expect(await rulesOf('Bo', 5)).toEqual({ firstRevealDraw: true });
    });

    it('stores the room with its host', async () => {
      const { repos, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const stored = (await repos.rooms.listLive()).find((entry) => entry.room.id === id);
      expect(stored?.players.map((p) => [p.displayName, p.userId])).toEqual([['Ann', ann.id]]);
      expect(stored?.room.hostPlayerId).toBe(stored?.players[0].id);
    });

    it('refuses a guest host, a bad seat count and a blank name', async () => {
      const { rooms, registered, guest } = await setup();
      const ann = await registered('Ann');
      await expect(rooms.create(await guest('Gus'), { seatCount: 4, rules: {}, displayName: 'Gus' })).rejects.toEqual(code('host_must_be_registered'));
      await expect(rooms.create(ann, { seatCount: 1, rules: {}, displayName: 'Ann' })).rejects.toEqual(code('invalid_seat_count'));
      await expect(rooms.create(ann, { seatCount: 7, rules: {}, displayName: 'Ann' })).rejects.toEqual(code('invalid_seat_count'));
      await expect(rooms.create(ann, { seatCount: 4, rules: {}, displayName: '   ' })).rejects.toEqual(code('invalid_name'));
    });

    it('refuses a second live room for the same user', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      await open(ann);
      await expect(rooms.create(ann, { seatCount: 4, rules: {}, displayName: 'Ann' })).rejects.toEqual(code('already_in_room'));
    });

    it('of two racing creates by one user, exactly one wins', async () => {
      const { rooms, registered } = await setup();
      const ann = await registered('Ann');
      const body = { seatCount: 4, rules: {}, displayName: 'Ann' };
      const results = await Promise.allSettled([rooms.create(ann, body), rooms.create(ann, body)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });
  });

  describe('join', () => {
    it('adds the member, and connected members see it', async () => {
      const { rooms, registered, guest, open, connect, names } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const gus = await guest('Gus');
      await rooms.join(gus, id, '  Gus  ');
      expect(names(host.connection.room)).toEqual(['Ann', 'Gus']);
      expect(host.connection.room?.members[1]).toMatchObject({ isRegistered: false, connected: false, kind: 'human' });
    });

    it('refuses a name taken in any case, including a bot name (Review Focus 2)', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      await rooms.command(ann, id, host.playerId, { type: 'lobby.addBot' });
      await expect(rooms.join(await registered('Bo'), id, ' ann ')).rejects.toEqual(code('name_taken'));
      await expect(rooms.join(await registered('Cy'), id, 'bot 1')).rejects.toEqual(code('name_taken'));
    });

    it('lets a member rejoin, keeping their name', async () => {
      const { rooms, registered, open, names } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      await rooms.join(bo, id, 'Someone Else');
      expect(names(rooms.snapshot(ann, id))).toEqual(['Ann', 'Bo']);
    });

    it('refuses a full room', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann, 2);
      await rooms.join(await registered('Bo'), id, 'Bo');
      await expect(rooms.join(await registered('Cy'), id, 'Cy')).rejects.toEqual(code('room_full'));
    });

    it('of two racing joins for the last seat, exactly one wins (Review Focus 1)', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann, 2);
      const [bo, cy] = [await registered('Bo'), await registered('Cy')];
      const results = await Promise.allSettled([rooms.join(bo, id, 'Bo'), rooms.join(cy, id, 'Cy')]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toEqual(code('room_full'));
      expect(rooms.snapshot(ann, id).members).toHaveLength(2);
    });

    it('refuses joining while a member of another room, and an unknown room', async () => {
      const { rooms, registered, open } = await setup();
      const first = await open(await registered('Ann'));
      const second = await open(await registered('Bo'));
      const cy = await registered('Cy');
      await rooms.join(cy, first, 'Cy');
      await expect(rooms.join(cy, second, 'Cy')).rejects.toEqual(code('already_in_room'));
      await expect(rooms.join(cy, randomUUID(), 'Cy')).rejects.toEqual(code('not_found'));
    });
  });

  describe('connections', () => {
    it('welcomes a member with their id and the room, and tells the others they are here', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const guestSide = await connect(bo, id);
      expect(guestSide.connection.last('welcome')).toEqual({ type: 'welcome', you: { playerId: guestSide.playerId, seatId: null }, room: expect.any(Object), game: null });
      expect(host.connection.room?.members.map((m) => m.connected)).toEqual([true, true]);
    });

    it('refuses a connection from a non-member, and to an unknown room', async () => {
      const { rooms, registered, open } = await setup();
      const id = await open(await registered('Ann'));
      await expect(rooms.connect(await registered('Bo'), id, new FakeConnection())).rejects.toEqual(code('not_member'));
      await expect(rooms.connect(await registered('Cy'), randomUUID(), new FakeConnection())).rejects.toEqual(code('not_found'));
    });

    it("replaces an older connection, and the older one's late close keeps the member connected (Review Focus 4)", async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const first = await connect(ann, id);
      const second = await connect(ann, id);
      expect(first.connection.last('replaced')).toEqual({ type: 'replaced' });
      expect(first.connection.closed).toBe(true);
      await rooms.disconnect(id, first.playerId, first.connection);
      expect(rooms.snapshot(ann, id).members[0].connected).toBe(true);
      expect(second.connection.closed).toBe(false);
    });

    it('marks a member away when their connection drops', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const other = await connect(bo, id);
      await rooms.disconnect(id, other.playerId, other.connection);
      expect(host.connection.room?.members[1].connected).toBe(false);
    });
  });

  describe('host commands', () => {
    async function lobby() {
      const ctx = await setup();
      const ann = await ctx.registered('Ann');
      const id = await ctx.open(ann);
      const host = await ctx.connect(ann, id);
      const run = (command: Parameters<RoomService['command']>[3]) => ctx.rooms.command(ann, id, host.playerId, command);
      return { ...ctx, ann, id, host, run };
    }

    it('adds bots with the first free name, and refuses when full', async () => {
      const { run, host, names } = await lobby();
      await run({ type: 'lobby.addBot' });
      await run({ type: 'lobby.addBot' });
      const bot1 = host.connection.room!.members[1].playerId;
      await run({ type: 'lobby.removePlayer', playerId: bot1 });
      await run({ type: 'lobby.addBot' });
      expect(names(host.connection.room)).toEqual(['Ann', 'Bot 2', 'Bot 1']);
      await run({ type: 'lobby.addBot' });
      await expect(run({ type: 'lobby.addBot' })).rejects.toEqual(code('room_full'));
    });

    it('refuses every lobby command from a member who is not the host', async () => {
      const { rooms, registered, id, host } = await lobby();
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const boId = await rooms.connect(bo, id, new FakeConnection());
      const hostId = host.playerId;
      for (const command of [
        { type: 'lobby.addBot' } as const,
        { type: 'lobby.removePlayer', playerId: hostId } as const,
        { type: 'lobby.setRules', seatCount: 5, rules: {} } as const,
        { type: 'lobby.makeHost', playerId: boId } as const,
      ]) {
        await expect(rooms.command(bo, id, boId, command)).rejects.toEqual(code('not_host'));
      }
    });

    it("refuses a command for someone else's player id", async () => {
      const { rooms, registered, id, host } = await lobby();
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      await expect(rooms.command(bo, id, host.playerId, { type: 'lobby.addBot' })).rejects.toEqual(code('not_member'));
    });

    it('removes a human: they are told and disconnected, and their name is free again', async () => {
      const { rooms, registered, id, run, host, names } = await lobby();
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const kicked = new FakeConnection();
      const boId = await rooms.connect(bo, id, kicked);
      await run({ type: 'lobby.removePlayer', playerId: boId });
      expect(kicked.last('room.left')).toEqual({ type: 'room.left', reason: 'removed' });
      expect(kicked.closed).toBe(true);
      expect(names(host.connection.room)).toEqual(['Ann']);
      await rooms.join(await registered('Cy'), id, 'bo');
      expect(names(host.connection.room)).toEqual(['Ann', 'bo']);
    });

    it('refuses removing the host, or someone who is not there', async () => {
      const { run, host } = await lobby();
      await expect(run({ type: 'lobby.removePlayer', playerId: host.playerId })).rejects.toEqual(code('invalid_message'));
      await expect(run({ type: 'lobby.removePlayer', playerId: 'nobody' })).rejects.toEqual(code('not_found'));
    });

    it('drops First Reveal Bonus below the minimum seat count, keeps it from there', async () => {
      const { run, host } = await lobby();
      await run({ type: 'lobby.setRules', seatCount: 6, rules: { firstRevealDraw: true } });
      expect(host.connection.room).toMatchObject({ seatCount: 6, rules: { firstRevealDraw: true } });
      await run({ type: 'lobby.setRules', seatCount: 5, rules: { firstRevealDraw: true } });
      expect(host.connection.room?.rules).toEqual({ firstRevealDraw: true });
      await run({ type: 'lobby.setRules', seatCount: 4, rules: { firstRevealDraw: true } });
      expect(host.connection.room).toMatchObject({ seatCount: 4, rules: {} });
      expect(host.connection.room?.rules).toEqual({});
    });

    it('changes the seat count and rules, within the limits and never below the member count', async () => {
      const { run, host } = await lobby();
      await run({ type: 'lobby.setRules', seatCount: 6, rules: { firstRevealDraw: false } });
      expect(host.connection.room).toMatchObject({ seatCount: 6, rules: { firstRevealDraw: false } });
      await run({ type: 'lobby.addBot' });
      await run({ type: 'lobby.addBot' });
      await expect(run({ type: 'lobby.setRules', seatCount: 2, rules: {} })).rejects.toEqual(code('invalid_seat_count'));
      await expect(run({ type: 'lobby.setRules', seatCount: 7, rules: {} })).rejects.toEqual(code('invalid_seat_count'));
      await run({ type: 'lobby.setRules', seatCount: 3, rules: {} });
      expect(host.connection.room?.seatCount).toBe(3);
    });

    it('passes the host role only to a registered human', async () => {
      const { rooms, registered, guest, id, run, host } = await lobby();
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      await rooms.join(await guest('Gus'), id, 'Gus');
      await run({ type: 'lobby.addBot' });
      const [, boMember, gusMember, botMember] = host.connection.room!.members;
      await expect(run({ type: 'lobby.makeHost', playerId: gusMember.playerId })).rejects.toEqual(code('host_must_be_registered'));
      await expect(run({ type: 'lobby.makeHost', playerId: botMember.playerId })).rejects.toEqual(code('host_must_be_registered'));
      await run({ type: 'lobby.makeHost', playerId: boMember.playerId });
      expect(host.connection.room?.hostPlayerId).toBe(boMember.playerId);
      await expect(run({ type: 'lobby.addBot' })).rejects.toEqual(code('not_host'));
    });
  });

  describe('leaving', () => {
    it('drops a member who leaves, for everyone', async () => {
      const { rooms, registered, open, connect, names } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const other = await connect(bo, id);
      await rooms.command(bo, id, other.playerId, { type: 'room.leave' });
      expect(names(host.connection.room)).toEqual(['Ann']);
      // The socket layer closes the leaver's connection; its close changes nothing.
      await rooms.disconnect(id, other.playerId, other.connection);
      expect(names(rooms.snapshot(ann, id))).toEqual(['Ann']);
    });

    it('passes the role to a connected registered member first when the host leaves', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const [bo, cy] = [await registered('Bo'), await registered('Cy')];
      await rooms.join(bo, id, 'Bo');
      await rooms.join(cy, id, 'Cy');
      const cySide = await connect(cy, id);
      await rooms.command(ann, id, host.playerId, { type: 'room.leave' });
      expect(cySide.connection.room?.hostPlayerId).toBe(cySide.playerId);
    });

    it('passes the role to an away registered member when no registered member is connected', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      await rooms.command(ann, id, host.playerId, { type: 'room.leave' });
      const snapshot = rooms.snapshot(bo, id);
      expect(snapshot.members.find((m) => m.playerId === snapshot.hostPlayerId)?.name).toBe('Bo');
    });

    it('closes the room when the host leaves and only guests and bots remain (Review Focus 3)', async () => {
      const { rooms, repos, registered, guest, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      await rooms.command(ann, id, host.playerId, { type: 'lobby.addBot' });
      const gus = await guest('Gus');
      await rooms.join(gus, id, 'Gus');
      const gusSide = await connect(gus, id);
      await rooms.command(ann, id, host.playerId, { type: 'room.leave' });
      expect(gusSide.connection.last('room.left')).toEqual({ type: 'room.left', reason: 'host_left' });
      expect(gusSide.connection.closed).toBe(true);
      expect(rooms.list(gus).rooms).toEqual([]);
      expect((await repos.rooms.listLive()).find((entry) => entry.room.id === id)).toBeUndefined();
      expect(thrown(() => rooms.snapshot(gus, id))).toEqual(code('not_found'));
    });

    it('changes nothing when the store fails while the host leaves', async () => {
      const repos = createMemoryRepositories();
      let failNext = false;
      // Delegates to the real store; only `update` can be made to fail once.
      const failing = (rooms: Repositories['rooms']): Repositories['rooms'] => ({
        create: (input) => rooms.create(input),
        addPlayer: (input) => rooms.addPlayer(input),
        markLeft: (playerId, at) => rooms.markLeft(playerId, at),
        listLive: () => rooms.listLive(),
        update: async (roomId, changes, at) => {
          if (failNext) {
            failNext = false;
            throw new Error('store down');
          }
          return rooms.update(roomId, changes, at);
        },
      });
      const wrapped: Repositories = {
        ...repos,
        rooms: failing(repos.rooms),
        transaction: (work) => repos.transaction((tx) => work({ ...tx, rooms: failing(tx.rooms) })),
      };
      const rooms = new RoomService({ repos: wrapped, seatLimits: LIMITS, now: () => T0 });
      const ann = await repos.users.createRegistered({ email: 'ann@example.com', passwordHash: 'h', displayName: 'Ann', now: new Date(T0) });
      const bo = await repos.users.createRegistered({ email: 'bo@example.com', passwordHash: 'h', displayName: 'Bo', now: new Date(T0) });
      const id = await rooms.create(ann, { seatCount: 4, rules: {}, displayName: 'Ann' });
      await rooms.join(bo, id, 'Bo');
      const before = rooms.snapshot(ann, id);

      failNext = true;
      await expect(rooms.command(ann, id, before.hostPlayerId!, { type: 'room.leave' })).rejects.toThrow('store down');

      expect(rooms.snapshot(ann, id)).toEqual(before);
      const stored = (await repos.rooms.listLive()).find((entry) => entry.room.id === id);
      expect(stored?.players.map((p) => p.displayName)).toEqual(['Ann', 'Bo']);
      expect(stored?.room.hostPlayerId).toBe(before.hostPlayerId);
    });

    it('closes the room when the last human leaves', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      await rooms.command(ann, id, host.playerId, { type: 'lobby.addBot' });
      await rooms.command(ann, id, host.playerId, { type: 'room.leave' });
      expect(rooms.list(ann).rooms).toEqual([]);
    });
  });

  describe('tick', () => {
    async function hostAway() {
      const ctx = await setup();
      const ann = await ctx.registered('Ann');
      const id = await ctx.open(ann);
      const host = await ctx.connect(ann, id);
      const bo = await ctx.registered('Bo');
      await ctx.rooms.join(bo, id, 'Bo');
      const boSide = await ctx.connect(bo, id);
      await ctx.rooms.disconnect(id, host.playerId, host.connection);
      return { ...ctx, ann, bo, id, host, boSide };
    }

    it('keeps the host role while the host has been away for less than 60 s', async () => {
      const { rooms, advance, boSide, host } = await hostAway();
      advance(HOST_AWAY_MS - 1);
      await rooms.tick();
      expect(boSide.connection.room?.hostPlayerId).toBe(host.playerId);
    });

    it('passes the role to the earliest connected registered member after 60 s', async () => {
      const { rooms, advance, boSide } = await hostAway();
      advance(HOST_AWAY_MS);
      await rooms.tick();
      expect(boSide.connection.room?.hostPlayerId).toBe(boSide.playerId);
    });

    it('keeps the role, so the room waits, when no registered member is connected', async () => {
      const { rooms, advance, boSide, host, bo, id } = await hostAway();
      await rooms.disconnect(id, boSide.playerId, boSide.connection);
      advance(HOST_AWAY_MS * 2);
      await rooms.tick();
      expect(rooms.snapshot(bo, id).hostPlayerId).toBe(host.playerId);
    });

    it('closes a lobby with no input for 30 minutes, and tells its members', async () => {
      const { rooms, advance, boSide, bo } = await hostAway();
      advance(LOBBY_IDLE_MS - 1);
      await rooms.tick();
      expect(rooms.list(bo).rooms).toHaveLength(1);
      advance(1);
      await rooms.tick();
      expect(boSide.connection.last('room.left')).toEqual({ type: 'room.left', reason: 'idle' });
      expect(boSide.connection.closed).toBe(true);
      expect(rooms.list(bo).rooms).toEqual([]);
    });

    it('counts a lobby command as activity', async () => {
      const { rooms, advance, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await rooms.connect(ann, id, new FakeConnection());
      advance(LOBBY_IDLE_MS - 1000);
      await rooms.command(ann, id, host, { type: 'lobby.addBot' });
      advance(2000);
      await rooms.tick();
      expect(rooms.list(await registered('Bo')).rooms).toHaveLength(1);
    });
  });

  describe('list and snapshot', () => {
    it("lists open rooms with the host's name, the count and capacity, your rooms first", async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const bo = await registered('Bo');
      const annRoom = await open(ann, 4);
      const boRoom = await open(bo, 6);
      const list = rooms.list(ann);
      expect(list.seatLimits).toEqual(LIMITS);
      expect(list.rooms).toEqual([
        { id: annRoom, visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: true },
        { id: boRoom, visibility: 'open', hostName: 'Bo', memberCount: 1, capacity: 6, status: 'lobby', youAreMember: false },
      ]);
    });

    it('lists the newest open rooms first', async () => {
      const { rooms, registered, open, advance } = await setup();
      const first = await open(await registered('Ann'));
      advance(1000);
      const second = await open(await registered('Bo'));
      expect(rooms.list(await registered('Cy')).rooms.map((r) => r.id)).toEqual([second, first]);
    });

    it('answers not_member to a non-member and not_found to an unknown room', async () => {
      const { rooms, registered, open } = await setup();
      const id = await open(await registered('Ann'));
      const bo = await registered('Bo');
      expect(thrown(() => rooms.snapshot(bo, id))).toEqual(code('not_member'));
      expect(thrown(() => rooms.snapshot(bo, randomUUID()))).toEqual(code('not_found'));
    });

    it('never puts user ids in a snapshot', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      expect(JSON.stringify(rooms.snapshot(ann, id))).not.toContain(ann.id);
    });
  });

  describe('restore', () => {
    it('reloads live lobbies with every human away and bots connected', async () => {
      const { rooms, repos, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      await rooms.command(ann, id, host.playerId, { type: 'lobby.addBot' });

      const restarted = new RoomService({ repos, seatLimits: LIMITS, now: () => T0 + 5000 });
      await restarted.restore();

      const snapshot = restarted.snapshot(ann, id);
      expect(snapshot.members.map((m) => [m.name, m.connected, m.isRegistered])).toEqual([
        ['Ann', false, true],
        ['Bot 1', true, false],
      ]);
      expect(snapshot.hostPlayerId).toBe(host.playerId);
    });

    it('closes a stored room that has no human member', async () => {
      const { repos } = await setup();
      const room = await repos.rooms.create({ visibility: 'open', seatCount: 4, rules: {}, now: new Date(T0) });
      await repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: new Date(T0) });

      const restarted = new RoomService({ repos, seatLimits: LIMITS, now: () => T0 });
      await restarted.restore();

      expect((await repos.rooms.listLive()).find((entry) => entry.room.id === room.id)).toBeUndefined();
    });
  });
});
