import type { ChatMessage } from 'protocol';
import { ChatMessageRecord } from '../persistence/records';

// A stored message as every member sees it: the sender is a room player id, never a user id.
export function toChatMessage(record: ChatMessageRecord): ChatMessage {
  return { id: record.id, from: { playerId: record.roomPlayerId, name: record.name }, body: record.body, at: record.createdAt.getTime() };
}
