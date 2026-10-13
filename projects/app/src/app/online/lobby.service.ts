import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ERROR_MESSAGES, REPLACED_MESSAGE, ROOM_LEFT_MESSAGES } from 'protocol';
import type { ErrorMessage, RoomRequest, RoomSnapshot, ServerMessage } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { OnlineNotice } from './online-notice';
import { SocketService } from './socket.service';

// The Lobby's state, kept from the room socket. Provide it in the Lobby
// component together with SocketService. The server decides every rule:
// this only shows its answers and sends what the player asks for.
@Injectable()
export class LobbyService {
  private readonly socket = inject(SocketService);
  private readonly router = inject(Router);
  private readonly notices = inject(OnlineNotice);
  private readonly _room = signal<RoomSnapshot | null>(null);
  private readonly _you = signal<string | null>(null);
  private readonly _notice = signal<string | null>(null);
  private readonly _ended = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly room = this._room.asReadonly();
  // Your player id in this room.
  readonly you = this._you.asReadonly();
  // The latest host change, as "Hing is now the host".
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

  constructor() {
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
        this.noteHostChange(this._room(), message.room);
        this._you.set(message.you.playerId);
        this._room.set(message.room);
        return;
      case 'room.updated':
        this.noteHostChange(this._room(), message.room);
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
    } else if (message.code === 'not_member' || message.code === 'not_found') {
      this.notices.show(message.message);
      void this.router.navigateByUrl('/rooms');
    }
  }

  private noteHostChange(before: RoomSnapshot | null, after: RoomSnapshot): void {
    if (!before || !after.hostPlayerId || before.hostPlayerId === after.hostPlayerId) return;
    const host = after.members.find((m) => m.playerId === after.hostPlayerId);
    if (host) this._notice.set(`${host.name} is now the host`);
  }
}
