import { CHAT_BODY_MAX, CHAT_HISTORY, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS, chatLength, normalizeChatBody } from 'protocol';
import type { ChatMessage } from 'protocol';
import { Repositories } from '../persistence/repositories';
import { toChatMessage } from '../views/chat';
import { RoomError } from './errors';

// Who is sending and what the room was doing: `gameId` and `afterSeq` are set
// while a game runs.
export interface ChatSender {
  roomId: string;
  // The sender's room player id.
  playerId: string;
  gameId: string | null;
  afterSeq: number | null;
}

// Validates, rate-limits and stores chat messages (spec "Socket protocol").
// It knows nothing of sockets. RoomService calls it on the room's queue, so
// one member's calls never interleave.
export class ChatService {
  // When each member's accepted messages were sent, newest last, within the window.
  private readonly sent = new Map<string, number[]>();

  constructor(
    private readonly repos: Repositories,
    private readonly now: () => number
  ) {}

  async send(sender: ChatSender, raw: string): Promise<ChatMessage> {
    const body = normalizeChatBody(raw);
    if (body === '') throw new RoomError('chat_empty');
    if (chatLength(body) > CHAT_BODY_MAX) throw new RoomError('chat_too_long');
    const now = this.now();
    const inWindow = (this.sent.get(sender.playerId) ?? []).filter((at) => now - at < CHAT_RATE_WINDOW_MS);
    if (inWindow.length >= CHAT_RATE_LIMIT) {
      this.sent.set(sender.playerId, inWindow);
      throw new RoomError('chat_rate_limited');
    }
    const record = await this.repos.chat.add({ roomId: sender.roomId, gameId: sender.gameId, afterSeq: sender.afterSeq, roomPlayerId: sender.playerId, body, now: new Date(now) });
    this.sent.set(sender.playerId, [...inWindow, now]);
    return toChatMessage(record);
  }

  // The room's last messages, oldest first.
  async recent(roomId: string): Promise<ChatMessage[]> {
    return (await this.repos.chat.listRecent(roomId, CHAT_HISTORY)).map(toChatMessage);
  }

  // Drops the rate windows of members who are gone.
  forget(playerIds: readonly string[]): void {
    for (const id of playerIds) this.sent.delete(id);
  }
}
