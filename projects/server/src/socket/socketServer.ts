import { IncomingMessage } from 'node:http';
import { Duplex } from 'node:stream';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { ERROR_MESSAGES, PROTOCOL_VERSION, REQ_ID_MAX, SOCKET_PATH } from 'protocol';
import type { ClientMessage, ErrorCode } from 'protocol';
import { ClientMessageSchema } from 'protocol/schemas';
import { AccountService } from '../auth/accounts';
import { SESSION_COOKIE } from '../http/session';
import { TypedApp } from '../http/types';
import { UserRecord } from '../persistence/records';
import { RoomError } from '../rooms/errors';
import { MemberConnection, RoomService } from '../rooms/roomService';

export const HEARTBEAT_MS = 15_000;
export const HELLO_TIMEOUT_MS = 10_000;
// The largest message a client may send; real ones are a few hundred bytes.
const MAX_PAYLOAD = 16 * 1024;
// WebSocket close codes: 1000 normal, 1008 policy (refused or too slow).
const CLOSE_NORMAL = 1000;
const CLOSE_POLICY = 1008;

export interface SocketOptions {
  heartbeatMs?: number;
  helloTimeoutMs?: number;
}

export interface SocketDeps extends SocketOptions {
  accounts: AccountService;
  rooms: RoomService;
  publicOrigin: string;
}

const clientMessage = TypeCompiler.Compile(ClientMessageSchema);
const NOT_JSON = Symbol('not JSON');

function parse(data: RawData, isBinary: boolean): unknown {
  if (isBinary) return NOT_JSON;
  try {
    return JSON.parse(data.toString());
  } catch {
    return NOT_JSON;
  }
}

// The client's reqId, when it sent a usable one, so even a refused message is answered against it.
function reqIdOf(value: unknown): string | undefined {
  const reqId = (value as { reqId?: unknown } | null)?.reqId;
  return typeof reqId === 'string' && reqId.length >= 1 && reqId.length <= REQ_ID_MAX ? reqId : undefined;
}

// A hello from another protocol version, checked before the schema so a client
// of any version learns it must reload.
function isOtherVersionHello(value: unknown): boolean {
  const message = value as { type?: unknown; protocolVersion?: unknown } | null;
  return message?.type === 'hello' && message.protocolVersion !== PROTOCOL_VERSION;
}

function refuse(socket: Duplex, status: number, text: string): void {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

// The room socket on /api/ws (spec "Socket protocol"): authenticates the
// upgrade with the session cookie and Origin, then routes each member's
// messages to the RoomService.
export function attachSocketServer(app: TypedApp, deps: SocketDeps): void {
  const heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_MS;
  const helloTimeoutMs = deps.helloTimeoutMs ?? HELLO_TIMEOUT_MS;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  const missedPongs = new Map<WebSocket, number>();

  // Node removes its own socket 'error' listener for upgrades and ws adds one only
  // inside handleUpgrade, so without this a reset during authentication or while
  // refusing is an uncaught exception.
  const onSocketError = (err: Error) => app.log.debug(err, 'Upgrade socket error');

  app.server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    socket.on('error', onSocketError);
    upgrade(request, socket, head).catch((err: unknown) => {
      app.log.error(err, 'WebSocket upgrade failed');
      refuse(socket, 500, 'Internal Server Error');
    });
  });

  async function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== SOCKET_PATH) return refuse(socket, 404, 'Not Found');
    if (request.headers.origin !== deps.publicOrigin) return refuse(socket, 403, 'Forbidden');
    const token = app.parseCookie(request.headers.cookie ?? '')[SESSION_COOKIE];
    const auth = token ? await deps.accounts.authenticate(token) : null;
    if (!auth) return refuse(socket, 401, 'Unauthorized');
    socket.removeListener('error', onSocketError);
    wss.handleUpgrade(request, socket, head, (ws) => serve(ws, auth.user));
  }

  function serve(ws: WebSocket, user: UserRecord): void {
    // 'waiting' until a hello arrives, 'joining' while it is handled, then the membership.
    let state: 'waiting' | 'joining' | { roomId: string; playerId: string } = 'waiting';
    const connection: MemberConnection = {
      send: (message) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
      },
      close: () => ws.close(CLOSE_NORMAL),
    };
    const fail = (code: ErrorCode, reqId: string | undefined) =>
      connection.send({ type: 'error', ...(reqId ? { reqId } : {}), code, message: ERROR_MESSAGES[code] });
    const failWith = (err: unknown, reqId: string | undefined) => {
      if (err instanceof RoomError) return fail(err.code, reqId);
      app.log.error(err, 'Room request failed');
      fail('internal', reqId);
    };

    const helloTimer = setTimeout(() => {
      if (typeof state === 'string') ws.close(CLOSE_POLICY);
    }, helloTimeoutMs);
    missedPongs.set(ws, 0);
    ws.on('pong', () => missedPongs.set(ws, 0));
    ws.on('error', (err) => app.log.warn(err, 'WebSocket error'));
    ws.on('close', () => {
      clearTimeout(helloTimer);
      missedPongs.delete(ws);
      if (typeof state !== 'string') void deps.rooms.disconnect(state.roomId, state.playerId, connection).catch((err: unknown) => app.log.error(err, 'Disconnect failed'));
    });

    ws.on('message', (data: RawData, isBinary: boolean) => {
      const value = parse(data, isBinary);
      if (value === NOT_JSON) return fail('invalid_message', undefined);
      const reqId = reqIdOf(value);
      if (isOtherVersionHello(value)) {
        fail('version', reqId);
        return ws.close(CLOSE_POLICY);
      }
      if (!clientMessage.Check(value)) return fail('invalid_message', reqId);
      const message: ClientMessage = value;

      if (message.type === 'hello') {
        if (state !== 'waiting') return fail('invalid_message', reqId);
        state = 'joining';
        deps.rooms.connect(user, message.roomId, connection).then(
          (playerId) => {
            clearTimeout(helloTimer);
            state = { roomId: message.roomId, playerId };
            // The socket closed while the hello was handled: the close
            // handler saw no membership, so release it here.
            if (ws.readyState !== WebSocket.OPEN) void deps.rooms.disconnect(message.roomId, playerId, connection).catch((err: unknown) => app.log.error(err, 'Disconnect failed'));
          },
          (err: unknown) => {
            failWith(err, reqId);
            ws.close(CLOSE_POLICY);
          }
        );
        return;
      }

      if (typeof state === 'string') return fail('invalid_message', reqId);
      deps.rooms.command(user, state.roomId, state.playerId, message).then(
        () => {
          if (reqId) connection.send({ type: 'ack', reqId });
          if (message.type === 'room.leave') ws.close(CLOSE_NORMAL);
        },
        (err: unknown) => failWith(err, reqId)
      );
    });
  }

  // Two pings in a row without a pong: the member is gone.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const missed = missedPongs.get(ws) ?? 0;
      if (missed >= 2) {
        ws.terminate();
        continue;
      }
      missedPongs.set(ws, missed + 1);
      ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();

  app.addHook('preClose', async () => {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  });
}
