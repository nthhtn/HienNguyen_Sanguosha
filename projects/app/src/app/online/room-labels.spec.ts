import type { RoomListItem } from 'protocol';
import { canJoin, roomStatusLabel } from './room-labels';

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
});
