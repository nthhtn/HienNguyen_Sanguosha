import type { RoomListItem } from 'protocol';

// The status column of the Rooms list.
export function roomStatusLabel(room: RoomListItem): 'Waiting for Players' | 'Full' | 'In Progress' {
  if (room.status === 'playing') return 'In Progress';
  return room.memberCount >= room.capacity ? 'Full' : 'Waiting for Players';
}

// Whether to enable Join. The server decides for real when asked.
export function canJoin(room: RoomListItem): boolean {
  return room.status === 'lobby' && room.memberCount < room.capacity;
}
