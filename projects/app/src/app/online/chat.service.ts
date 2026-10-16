import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ChatMessage, ServerMessage } from 'protocol';
import { errorMsg } from '../auth/auth.service';
import type { Msg } from '../i18n/msg';
import { SocketService } from './socket.service';

// How many messages the screen keeps; older ones scroll away for good.
export const KEPT_MESSAGES = 300;

// The room's chat, kept from the room socket. Provide it in the Lobby
// component together with SocketService. The server decides every rule (length,
// rate); this only shows what it sends and asks for what the player types.
@Injectable()
export class ChatService {
  private readonly socket = inject(SocketService);
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _error = signal<Msg | null>(null);

  // Oldest first.
  readonly messages = this._messages.asReadonly();
  // The last refused message.
  readonly error = this._error.asReadonly();

  constructor() {
    this.socket.messages.pipe(takeUntilDestroyed()).subscribe((message) => this.receive(message));
  }

  // True once the server accepted the message. It then arrives as a `chat.message` like everyone else's.
  async send(body: string): Promise<boolean> {
    this._error.set(null);
    try {
      await this.socket.request({ type: 'chat.send', body });
      return true;
    } catch (err) {
      this._error.set(errorMsg(err));
      return false;
    }
  }

  private receive(message: ServerMessage): void {
    if (message.type === 'welcome') {
      this._messages.set(message.chat.slice(-KEPT_MESSAGES));
    } else if (message.type === 'chat.message') {
      const { type: _type, ...chat } = message;
      this._messages.update((all) => (all.some((m) => m.id === chat.id) ? all : [...all, chat].slice(-KEPT_MESSAGES)));
    }
  }
}
