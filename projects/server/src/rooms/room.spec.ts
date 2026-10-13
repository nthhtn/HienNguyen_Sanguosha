import { RoomPlayerRecord, RoomRecord } from '../persistence/records';
import { memberFrom, Room, RoomMember, sameName } from './room';

const NOW = Date.parse('2026-10-13T12:00:00.000Z');
const at = (minutes: number) => new Date(NOW + minutes * 60_000);

const RECORD: RoomRecord = {
  id: 'room-1',
  visibility: 'open',
  status: 'lobby',
  seatCount: 4,
  rules: {},
  hostPlayerId: 'p-ann',
  createdAt: at(0),
  updatedAt: at(0),
};

function member(id: string, name: string, overrides: Partial<RoomMember> = {}): RoomMember {
  return { id, userId: `u-${id}`, kind: 'human', name, isRegistered: true, joinedAt: at(0), connected: true, awaySince: null, ...overrides };
}

const room = (members: RoomMember[], record: Partial<RoomRecord> = {}) => new Room({ ...RECORD, ...record }, members, NOW);

describe('Room', () => {
  it('compares names case-insensitively', () => {
    expect(sameName('Ann', 'aNN')).toBe(true);
    expect(sameName('Ann', 'Anne')).toBe(false);
    const r = room([member('p-ann', 'Ann'), member('p-bot', 'Bot 1', { kind: 'bot', userId: null })]);
    expect(r.nameTaken('ANN')).toBe(true);
    expect(r.nameTaken('bot 1')).toBe(true);
    expect(r.nameTaken('Bo')).toBe(false);
  });

  it('names bots with the first free number', () => {
    expect(room([member('p-ann', 'Ann')]).nextBotName()).toBe('Bot 1');
    expect(room([member('p-ann', 'Ann'), member('b1', 'Bot 1'), member('b3', 'bot 3')]).nextBotName()).toBe('Bot 2');
    expect(room([member('p-ann', 'Ann'), member('b1', 'Bot 1'), member('b2', 'Bot 2')]).nextBotName()).toBe('Bot 3');
  });

  it('is full when it has as many members as seats', () => {
    const r = room([member('p-ann', 'Ann'), member('p-bo', 'Bo')], { seatCount: 2 });
    expect(r.isFull()).toBe(true);
    r.remove('p-bo');
    expect(r.isFull()).toBe(false);
  });

  it('finds members by id and by user, and its host', () => {
    const r = room([member('p-ann', 'Ann'), member('p-bo', 'Bo')]);
    expect(r.member('p-bo')?.name).toBe('Bo');
    expect(r.memberForUser('u-p-ann')?.name).toBe('Ann');
    expect(r.memberForUser('nobody')).toBeNull();
    expect(r.host?.name).toBe('Ann');
    expect(r.humans().map((m) => m.name)).toEqual(['Ann', 'Bo']);
  });

  describe('successor', () => {
    const members = () => [
      member('p-ann', 'Ann', { joinedAt: at(0) }),
      member('p-guest', 'Guest', { joinedAt: at(1), isRegistered: false }),
      member('p-bot', 'Bot 1', { joinedAt: at(2), kind: 'bot', userId: null, isRegistered: false }),
      member('p-bo', 'Bo', { joinedAt: at(3), connected: false, awaySince: NOW }),
      member('p-cy', 'Cy', { joinedAt: at(4) }),
      member('p-di', 'Di', { joinedAt: at(5) }),
    ];

    it('prefers a connected registered human, earliest joined, never a guest or a bot', () => {
      expect(room(members()).successor(false)?.name).toBe('Cy');
      expect(room(members()).successor(true)?.name).toBe('Cy');
    });

    it('falls back to an away registered human only when away members count', () => {
      const awayOnly = members().filter((m) => !['p-cy', 'p-di'].includes(m.id));
      expect(room(awayOnly).successor(false)?.name).toBe('Bo');
      expect(room(awayOnly).successor(true)).toBeNull();
    });

    it('is null when no other registered human is left', () => {
      expect(room(members().filter((m) => m.id === 'p-ann' || !m.isRegistered)).successor(false)).toBeNull();
    });
  });

  it('builds a member from a record: a bot is connected, a human starts away', () => {
    const player: RoomPlayerRecord = { id: 'p1', roomId: 'room-1', userId: 'u1', kind: 'human', displayName: 'Ann', joinedAt: at(0), leftAt: null };
    expect(memberFrom(player, true, NOW)).toEqual({ id: 'p1', userId: 'u1', kind: 'human', name: 'Ann', isRegistered: true, joinedAt: at(0), connected: false, awaySince: NOW });
    expect(memberFrom({ ...player, kind: 'bot', userId: null }, false, NOW)).toMatchObject({ kind: 'bot', connected: true, awaySince: null });
  });
});
