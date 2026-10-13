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

// The name column of the Rooms list: the host, or Play vs Bots for your solo room.
export function roomTitle(room: RoomListItem): string {
  return room.visibility === 'solo' ? 'Play vs Bots' : (room.hostName ?? 'Room');
}
