import type { RoomListItem, RoomSnapshot, SeatLimits } from 'protocol';
import { Room } from '../rooms/room';

// What the running game says about each member (a GameRunner is one).
export interface SeatingView {
  seatOf(playerId: string): string | null;
  botControlled(playerId: string): boolean;
}

// The room every member sees. Never user ids: members are known by player id.
export function toRoomSnapshot(room: Room, seatLimits: SeatLimits, seating: SeatingView | null = null): RoomSnapshot {
  const { record } = room;
  return {
    id: record.id,
    visibility: record.visibility,
    status: record.status,
    seatCount: record.seatCount,
    rules: { ...record.rules },
    hostPlayerId: record.hostPlayerId,
    members: room.members.map((m) => ({
      playerId: m.id,
      name: m.name,
      kind: m.kind,
      seatId: seating?.seatOf(m.id) ?? null,
      isRegistered: m.isRegistered,
      connected: m.connected,
      botControlled: seating?.botControlled(m.id) ?? false,
    })),
    lastGame: room.lastGame ? structuredClone(room.lastGame) : null,
    seatLimits: { ...seatLimits },
  };
}

export function toRoomListItem(room: Room, userId: string): RoomListItem {
  const { record } = room;
  return {
    id: record.id,
    visibility: record.visibility,
    hostName: room.host?.name ?? null,
    memberCount: room.members.length,
    capacity: record.seatCount,
    status: record.status,
    youAreMember: room.memberForUser(userId) !== null,
  };
}
