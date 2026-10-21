import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { ErrorMessage, RoomRequest, RoomRules, RoomSnapshot, ServerMessage } from 'protocol';
import { ApiError, errorMsg } from '../auth/auth.service';
import { msg, type Msg } from '../i18n/msg';
import type { MessageKey } from '../i18n/messages';
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
  private readonly _notice = signal<Msg | null>(null);
  private readonly _ended = signal<Msg | null>(null);
  private readonly _error = signal<Msg | null>(null);

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
    return host && !host.connected ? msg('lobby.waitingForHost', { name: host.name }) : null;
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

  setRules(seatCount: number, rules: RoomRules): Promise<boolean> {
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
      this._error.set(errorMsg(err));
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
        if (message.reason !== 'left') this.notices.show(msg(`roomLeft.${message.reason}` as MessageKey));
        void this.router.navigateByUrl('/rooms');
        return;
      case 'replaced':
        this._ended.set(msg('room.replaced'));
        return;
      case 'error':
        if (!message.reqId) this.refused(message);
        return;
    }
  }

  // An error nobody asked for: the server refused this connection.
  private refused(message: ErrorMessage): void {
    const reason = errorMsg(new ApiError(message.code, message.message, 0));
    if (message.code === 'version') {
      this._ended.set(reason);
    } else if (message.code === 'not_member' || message.code === 'not_found' || message.code === 'invalid_message') {
      this.notices.show(reason);
      void this.router.navigateByUrl('/rooms');
    }
  }

  // What changed hands, as a notice: "Hing is now the host", "Hing is back".
  private noteChanges(before: RoomSnapshot | null, after: RoomSnapshot): void {
    if (!before) return;
    const host = after.hostPlayerId && before.hostPlayerId !== after.hostPlayerId ? after.members.find((m) => m.playerId === after.hostPlayerId) : undefined;
    if (host) return this.announce(msg('lobby.nowHost', { name: host.name }));
    // Only during a game, and only once they are here: when a game ends every
    // seat's bot lets go, even one whose player is still away.
    if (before.status !== 'playing' || after.status !== 'playing') return;
    const back = after.members.find(
      (m) => m.playerId !== this._you() && m.connected && !m.botControlled && before.members.some((b) => b.playerId === m.playerId && b.botControlled)
    );
    if (back) this.announce(msg('lobby.isBack', { name: back.name }));
  }

  private announce(notice: Msg): void {
    this._notice.set(notice);
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
