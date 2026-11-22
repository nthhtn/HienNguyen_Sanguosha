import { Injectable, computed, inject, signal } from '@angular/core';
import { ChatService } from './chat.service';

// Whether the board's chat panel is open, and how many messages the player has not seen. Provided by the lobby page,
// so both the board chat and the phone board's centre band (which holds the Chat button there) share it.
// Presentation state only.
@Injectable()
export class BoardChatState {
  private readonly chat = inject(ChatService);
  private readonly _open = signal(false);
  private readonly _available = signal(false);
  private readonly you = signal<string | null>(null);
  // The newest message the player has seen: those at start, and everything up to the moment they opened or closed the panel.
  private readonly seenId = signal(this.latestId());

  readonly open = this._open.asReadonly();
  // A board chat is on screen (a game with other people; a solo game has none).
  readonly available = this._available.asReadonly();
  readonly unread = computed(() =>
    this._open() ? 0 : this.chat.messages().filter((m) => m.id > this.seenId() && m.from.playerId !== this.you()).length
  );

  toggle(): void {
    this.seenId.set(this.latestId());
    this._open.update((open) => !open);
  }

  setYou(playerId: string | null): void {
    this.you.set(playerId);
  }

  setAvailable(on: boolean): void {
    this._available.set(on);
  }

  private latestId(): number {
    return this.chat.messages().at(-1)?.id ?? 0;
  }
}
