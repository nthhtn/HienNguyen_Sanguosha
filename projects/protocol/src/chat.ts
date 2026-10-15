// One chat message as every member of the room sees it. `from.playerId` is the
// room player id (the same id `RoomMemberView.playerId` uses), never a user id.
export interface ChatMessage {
  id: number;
  from: { playerId: string; name: string };
  body: string;
  // When the server stored it, in epoch milliseconds.
  at: number;
}

// A message as stored and shown: NFC, every run of whitespace or control
// characters collapsed to one space, trimmed. Empty when nothing is left.
export function normalizeChatBody(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim();
}

// How many characters a message has: code points, so an emoji counts once.
export function chatLength(body: string): number {
  return [...body].length;
}
