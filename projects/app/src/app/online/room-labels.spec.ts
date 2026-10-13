import type { RoomListItem } from 'protocol';
import { canJoin, roomStatusLabel, roomTitle } from './room-labels';

const room = (overrides: Partial<RoomListItem>): RoomListItem => ({
  id: 'r1',
  visibility: 'open',
  hostName: 'Ann',
  memberCount: 2,
  capacity: 4,
  status: 'lobby',
  youAreMember: false,
  ...overrides,
});

describe('room labels', () => {
  it('names the status the way the Rooms list shows it', () => {
    expect(roomStatusLabel(room({}))).toBe('Waiting for Players');
    expect(roomStatusLabel(room({ memberCount: 4 }))).toBe('Full');
    expect(roomStatusLabel(room({ status: 'playing', memberCount: 4 }))).toBe('In Progress');
  });

  it('offers Join only for a lobby with space', () => {
    expect(canJoin(room({}))).toBe(true);
    expect(canJoin(room({ memberCount: 4 }))).toBe(false);
    expect(canJoin(room({ status: 'playing' }))).toBe(false);
  });

  it('names a room by its host, and a solo room as Play vs Bots', () => {
    const r: RoomListItem = { id: 'r', visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: false };
    expect(roomTitle(r)).toBe('Ann');
    expect(roomTitle({ ...r, hostName: null })).toBe('Room');
    expect(roomTitle({ ...r, visibility: 'solo', hostName: null })).toBe('Play vs Bots');
  });
});
