import { buildContentRegistry, kingdomWarMode } from 'content';
import { createGame, getLegalActions, redactStateForSeat, resolve } from 'engine';
import type { Action, GameState } from 'engine';
import type { ChatMessage, GameUpdate, LastGame, RoomSnapshot, ServerMessage } from 'protocol';
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
    { playerId: 'p-ann', name: 'Ann', kind: 'human', seatId: null, isRegistered: true, connected: true, botControlled: false },
    { playerId: 'p-bo', name: 'Bo', kind: 'human', seatId: null, isRegistered: true, connected: true, botControlled: false },
  ],
  lastGame: null,
  seatLimits: { min: 2, max: 8 },
};

export function welcome(room: RoomSnapshot = ROOM, playerId = 'p-ann', game: GameUpdate | null = null, chat: ChatMessage[] = []): ServerMessage {
  const seatId = room.members.find((m) => m.playerId === playerId)?.seatId ?? null;
  return { type: 'welcome', you: { playerId, seatId }, room, game, chat };
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

export const GAME_ID = '9a1e7c52-1b0f-4f7e-8d2a-3c4b5d6e7f80';

// ROOM while a two-seat game runs: Ann on seat-0, Bo on seat-1.
export const PLAYING: RoomSnapshot = {
  ...ROOM,
  status: 'playing',
  seatCount: 2,
  members: ROOM.members.map((m, i) => ({ ...m, seatId: `seat-${i}` })),
};

export const LAST_GAME: LastGame = {
  gameId: GAME_ID,
  outcome: 'finished',
  result: { endedAt: 40, winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] },
  seats: [
    { seatId: 'seat-0', playerId: 'p-ann', name: 'Ann' },
    { seatId: 'seat-1', playerId: 'p-bo', name: 'Bo' },
  ],
};

// What Ann (seat-0) is sent in a two-seat game: at the start, when she
// chooses her Generals first, and after she chose (Bo to choose).
export function gameUpdates(): [GameUpdate, GameUpdate] {
  const registry = buildContentRegistry();
  const created = createGame(kingdomWarMode, registry, ['seat-0', 'seat-1'], 7);
  const opening: GameState = { ...created, players: created.players.map((p) => ({ ...p, kind: 'human' as const, name: p.seatId === 'seat-0' ? 'Ann' : 'Bo' })) };
  const next = resolve(opening, getLegalActions(opening, 'seat-0', registry)[0], { registry, mode: kingdomWarMode }).state;
  const update = (state: GameState, seq: number, logFrom: number, legalActions: Action[]): GameUpdate => {
    const { rng: _rng, log, ...view } = redactStateForSeat(state, 'seat-0');
    return { gameId: GAME_ID, seq, view, legalActions, logFrom, events: log.slice(logFrom), clock: null, paused: false };
  };
  return [update(opening, 0, 0, getLegalActions(opening, 'seat-0', registry)), update(next, 1, opening.log.length, [])];
}
