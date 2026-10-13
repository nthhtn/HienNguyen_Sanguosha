import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ERROR_MESSAGES, REPLACED_MESSAGE, ROOM_LEFT_MESSAGES } from 'protocol';
import type { ErrorMessage, RoomRequest, RoomSnapshot, ServerMessage } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { OnlineNotice } from './online-notice';
import { SocketService } from './socket.service';

// How long the host-change notice stays.
export const NOTICE_MS = 6_000;

// The Lobby's state, kept from the room socket. Provide it in the Lobby
// component together with SocketService. The server decides every rule:
// this only shows its answers and sends what the player asks for.
@Injectable()
export class LobbyService {
  private readonly socket = inject(SocketService);
  private readonly router = inject(Router);
  private readonly notices = inject(OnlineNotice);
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _room = signal<RoomSnapshot | null>(null);
  private readonly _you = signal<string | null>(null);
  private readonly _notice = signal<string | null>(null);
  private readonly _ended = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly room = this._room.asReadonly();
  // Your player id in this room.
  readonly you = this._you.asReadonly();
  // The latest change of hands, as "Hing is now the host" or "Hing is back".
  readonly notice = this._notice.asReadonly();
  // Why this connection is over for good, when it is.
  readonly ended = this._ended.asReadonly();
  // The last refused request.
  readonly error = this._error.asReadonly();
  readonly status = this.socket.status;
  readonly canAct = computed(() => this.status() === 'open' && this._ended() === null);
  readonly isHost = computed(() => {
    const room = this._room();
    return room !== null && room.hostPlayerId === this._you();
  });
  readonly host = computed(() => {
    const room = this._room();
    return room?.members.find((m) => m.playerId === room.hostPlayerId) ?? null;
  });
  readonly waitingForHost = computed(() => {
    const host = this.host();
    return host && !host.connected ? `Waiting for ${host.name} to return…` : null;
  });
  readonly isSolo = computed(() => this._room()?.visibility === 'solo');
  // Who may press Start Game: the host, or a solo room's player, in the lobby.
  readonly canStart = computed(() => this._room()?.status === 'lobby' && (this.isHost() || this.isSolo()));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearNoticeTimer());
    this.socket.messages.pipe(takeUntilDestroyed()).subscribe((message) => this.receive(message));
  }

  open(roomId: string): void {
    this.socket.connect(roomId);
  }

  addBot(): Promise<boolean> {
    return this.run({ type: 'lobby.addBot' });
  }

  removePlayer(playerId: string): Promise<boolean> {
    return this.run({ type: 'lobby.removePlayer', playerId });
  }

  makeHost(playerId: string): Promise<boolean> {
    return this.run({ type: 'lobby.makeHost', playerId });
  }

  setRules(seatCount: number, rules: RoomSnapshot['rules']): Promise<boolean> {
    return this.run({ type: 'lobby.setRules', seatCount, rules });
  }

  start(): Promise<boolean> {
    return this.run({ type: 'lobby.start' });
  }

  async leave(): Promise<void> {
    if (!(await this.run({ type: 'room.leave' }))) return;
    this.socket.end();
    await this.router.navigateByUrl('/rooms');
  }

  private async run(command: RoomRequest): Promise<boolean> {
    this._error.set(null);
    try {
      await this.socket.request(command);
      return true;
    } catch (err) {
      this._error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
      return false;
    }
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.noteChanges(this._room(), message.room);
        this._you.set(message.you.playerId);
        this._room.set(message.room);
        return;
      case 'room.updated':
        this.noteChanges(this._room(), message.room);
        this._room.set(message.room);
        return;
      case 'room.left':
        if (message.reason !== 'left') this.notices.show(ROOM_LEFT_MESSAGES[message.reason]);
        void this.router.navigateByUrl('/rooms');
        return;
      case 'replaced':
        this._ended.set(REPLACED_MESSAGE);
        return;
      case 'error':
        if (!message.reqId) this.refused(message);
        return;
    }
  }

  // An error nobody asked for: the server refused this connection.
  private refused(message: ErrorMessage): void {
    if (message.code === 'version') {
      this._ended.set(message.message);
    } else if (message.code === 'not_member' || message.code === 'not_found' || message.code === 'invalid_message') {
      this.notices.show(message.message);
      void this.router.navigateByUrl('/rooms');
    }
  }

  // What changed hands, as a notice: "Hing is now the host", "Hing is back".
  private noteChanges(before: RoomSnapshot | null, after: RoomSnapshot): void {
    if (!before) return;
    const host = after.hostPlayerId && before.hostPlayerId !== after.hostPlayerId ? after.members.find((m) => m.playerId === after.hostPlayerId) : undefined;
    if (host) return this.announce(`${host.name} is now the host`);
    const back = after.members.find(
      (m) => m.playerId !== this._you() && !m.botControlled && before.members.some((b) => b.playerId === m.playerId && b.botControlled)
    );
    if (back) this.announce(`${back.name} is back`);
  }

  private announce(text: string): void {
    this._notice.set(text);
    this.clearNoticeTimer();
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = null;
      this._notice.set(null);
    }, NOTICE_MS);
  }

  private clearNoticeTimer(): void {
    if (this.noticeTimer !== null) clearTimeout(this.noticeTimer);
    this.noticeTimer = null;
  }
}
