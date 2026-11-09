import type { LastGame, MemberKind } from 'protocol';
import { RoomPlayerRecord, RoomRecord } from '../persistence/records';

export interface RoomMember {
  id: string;
  userId: string | null;
  kind: MemberKind;
  name: string;
  // A bot's name id; null for a person and for a bot added before bot names.
  botNameId: string | null;
  isRegistered: boolean;
  joinedAt: Date;
  // Bots are always connected.
  connected: boolean;
  // When a human last lost (or never had) a connection, in ms; null while connected.
  awaySince: number | null;
}

// A member as loaded or just added: a human has no connection yet.
export function memberFrom(player: RoomPlayerRecord, isRegistered: boolean, now: number): RoomMember {
  const bot = player.kind === 'bot';
  return {
    id: player.id,
    userId: player.userId,
    kind: player.kind,
    name: player.displayName,
    botNameId: player.botNameId,
    isRegistered,
    joinedAt: player.joinedAt,
    connected: bot,
    awaySince: bot ? null : now,
  };
}

// Names are normalized (NFC, trimmed) before they get here.
export const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// A room's live state and the lobby rules that need no I/O. RoomService
// persists each change first, then applies it here.
export class Room {
  // The last input (join, connect, lobby command), in ms.
  lastActivityAt: number;
  // The last game's outcome, until another starts. In memory only.
  lastGame: LastGame | null = null;

  constructor(
    public record: RoomRecord,
    public members: RoomMember[],
    now: number
  ) {
    this.lastActivityAt = now;
  }

  get id(): string {
    return this.record.id;
  }

  get host(): RoomMember | null {
    return this.member(this.record.hostPlayerId ?? '');
  }

  member(id: string): RoomMember | null {
    return this.members.find((m) => m.id === id) ?? null;
  }

  memberForUser(userId: string): RoomMember | null {
    return this.members.find((m) => m.userId === userId) ?? null;
  }

  humans(): RoomMember[] {
    return this.members.filter((m) => m.kind === 'human');
  }

  isFull(): boolean {
    return this.members.length >= this.record.seatCount;
  }

  nameTaken(name: string): boolean {
    return this.members.some((m) => sameName(m.name, name));
  }

  // The name ids the room's bots already have, so a new bot draws another.
  botNameIds(): string[] {
    return this.members.flatMap((m) => (m.botNameId === null ? [] : [m.botNameId]));
  }

  // Who the host role passes to: a registered human other than the host,
  // connected before away, then earliest joined. With `connectedOnly`, away
  // members don't count.
  successor(connectedOnly: boolean): RoomMember | null {
    const candidates = this.members.filter(
      (m) => m.kind === 'human' && m.isRegistered && m.id !== this.record.hostPlayerId && (m.connected || !connectedOnly)
    );
    candidates.sort((a, b) => Number(b.connected) - Number(a.connected) || a.joinedAt.getTime() - b.joinedAt.getTime());
    return candidates[0] ?? null;
  }

  remove(id: string): void {
    this.members = this.members.filter((m) => m.id !== id);
  }
}
