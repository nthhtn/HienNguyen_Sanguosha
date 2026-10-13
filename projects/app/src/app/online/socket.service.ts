import { DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { PROTOCOL_VERSION, SOCKET_PATH } from 'protocol';
import type { ErrorCode, RoomRequest, ServerMessage } from 'protocol';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../auth/auth.service';

export type WebSocketLike = Pick<WebSocket, 'readyState' | 'send' | 'close' | 'onopen' | 'onmessage' | 'onclose'>;

export const WEB_SOCKET_FACTORY = new InjectionToken<(url: string) => WebSocketLike>('WEB_SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new WebSocket(url),
});

// 'connecting' until the first welcome; 'reconnecting' after a drop until the
// next welcome; 'ended' once the server said this connection is over.
export type SocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'ended';

export const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
// Errors, sent unasked, that no reconnect can fix.
const FATAL_ERRORS: ReadonlySet<ErrorCode> = new Set<ErrorCode>(['version', 'not_member', 'not_found']);

export function socketUrl(location: Pick<Location, 'protocol' | 'host'> = window.location): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${SOCKET_PATH}`;
}

// The room socket for one screen: provide it in the component. It says hello
// on every (re)connect, reconnects with backoff, and pairs each request with
// its ack or error. It stops for good when the server ends the connection.
@Injectable()
export class SocketService {
  private readonly createSocket = inject(WEB_SOCKET_FACTORY);
  private readonly _status = signal<SocketStatus>('idle');
  private readonly incoming = new Subject<ServerMessage>();
  private readonly pending = new Map<string, { resolve: () => void; reject: (err: ApiError) => void }>();
  private socket: WebSocketLike | null = null;
  private roomId: string | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private nextReqId = 1;

  readonly status = this._status.asReadonly();
  readonly messages: Observable<ServerMessage> = this.incoming.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.end());
  }

  connect(roomId: string): void {
    this.stop();
    this.roomId = roomId;
    this.attempt = 0;
    this._status.set('connecting');
    this.open();
  }

  request(command: RoomRequest): Promise<void> {
    const socket = this.socket;
    if (!socket || this._status() !== 'open') return Promise.reject(new ApiError('network', NETWORK_ERROR_MESSAGE, 0));
    const reqId = `r${this.nextReqId++}`;
    return new Promise<void>((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      socket.send(JSON.stringify({ ...command, reqId }));
    });
  }

  // The screen is going away: close, and never reconnect.
  end(): void {
    this.stop();
    this.roomId = null;
    this._status.set('idle');
  }

  private open(): void {
    const socket = this.createSocket(socketUrl());
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId: this.roomId }));
    socket.onmessage = (event) => this.receive(event.data);
    socket.onclose = () => this.dropped(socket);
  }

  private receive(data: unknown): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(String(data)) as ServerMessage;
    } catch {
      return;
    }
    if (message.type === 'welcome') {
      this.attempt = 0;
      this._status.set('open');
    } else if (message.type === 'ack') {
      this.settle(message.reqId);
    } else if (message.type === 'error' && message.reqId) {
      this.settle(message.reqId, new ApiError(message.code, message.message, 0));
    }
    const final =
      message.type === 'replaced' || message.type === 'room.left' || (message.type === 'error' && !message.reqId && FATAL_ERRORS.has(message.code));
    if (final) {
      this.stop();
      this._status.set('ended');
    }
    this.incoming.next(message);
  }

  private dropped(socket: WebSocketLike): void {
    if (socket !== this.socket) return;
    this.socket = null;
    this.rejectPending();
    if (this.roomId === null || this._status() === 'ended') return;
    this._status.set('reconnecting');
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.attempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  private settle(reqId: string, error?: ApiError): void {
    const waiter = this.pending.get(reqId);
    if (!waiter) return;
    this.pending.delete(reqId);
    if (error) waiter.reject(error);
    else waiter.resolve();
  }

  private rejectPending(): void {
    for (const waiter of this.pending.values()) waiter.reject(new ApiError('network', NETWORK_ERROR_MESSAGE, 0));
    this.pending.clear();
  }

  // Detaches and closes the socket and cancels any retry; the caller sets the status.
  private stop(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.close();
    }
    this.rejectPending();
  }
}
