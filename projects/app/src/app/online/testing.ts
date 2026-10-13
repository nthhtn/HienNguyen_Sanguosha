import type { RoomSnapshot, ServerMessage } from 'protocol';
import type { WebSocketLike } from './socket.service';

// Test fixtures for the online screens. `ng build` compiles this file, so it
// must not use Jest APIs; nothing outside tests imports it.

export const ROOM: RoomSnapshot = {
  id: '5b0d6c1e-2f43-4a8e-9a57-0c7d0c4f8e21',
  visibility: 'open',
  status: 'lobby',
  seatCount: 4,
  rules: { firstRevealDraw: true },
  hostPlayerId: 'p-ann',
  members: [
    { playerId: 'p-ann', name: 'Ann', kind: 'human', isRegistered: true, connected: true, botControlled: false },
    { playerId: 'p-bo', name: 'Bo', kind: 'human', isRegistered: true, connected: true, botControlled: false },
  ],
  lastResult: null,
  seatLimits: { min: 2, max: 8 },
};

export function welcome(room: RoomSnapshot = ROOM, playerId = 'p-ann'): ServerMessage {
  return { type: 'welcome', you: { playerId, seatId: null }, room, game: null };
}

// A WebSocket the test drives: it records what the app sends, and the test
// plays the server's side.
export class FakeSocket implements WebSocketLike {
  readyState: WebSocket['readyState'] = WebSocket.CONNECTING;
  onopen: WebSocket['onopen'] = null;
  onmessage: WebSocket['onmessage'] = null;
  onclose: WebSocket['onclose'] = null;
  readonly sent: Record<string, unknown>[] = [];
  closedByApp = false;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.closedByApp = true;
    this.readyState = WebSocket.CLOSED;
  }

  serverOpens(): void {
    this.readyState = WebSocket.OPEN;
    this.onopen?.call(this as unknown as WebSocket, new Event('open'));
  }

  serverSends(message: ServerMessage): void {
    this.onmessage?.call(this as unknown as WebSocket, new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  serverCloses(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.call(this as unknown as WebSocket, new CloseEvent('close'));
  }

  // The last request the app sent, as the server would see it.
  get lastSent(): Record<string, unknown> | undefined {
    return this.sent.at(-1);
  }
}
