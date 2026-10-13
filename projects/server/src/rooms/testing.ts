import type { GameUpdate, RoomSnapshot, ServerMessage } from 'protocol';
import { MemberConnection } from './roomService';

// A member connection that records what the room sent it.
export class FakeConnection implements MemberConnection {
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

  // The game as this connection last saw it, from a welcome or an update.
  get game(): GameUpdate | undefined {
    for (const message of [...this.sent].reverse()) {
      if (message.type === 'game.update') return message.game;
      if (message.type === 'welcome' && message.game) return message.game;
    }
    return undefined;
  }
}
