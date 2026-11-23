import { Injectable, computed, inject, signal } from '@angular/core';
import { ChatService } from './chat.service';

// Whether the board's chat panel is open, and how many messages the player has not seen. Provided by the lobby page,
// so the board chat and the phone board (its centre band's History button and the panel's Chat tab) share it.
// Presentation state only.
@Injectable()
export class BoardChatState {
  private readonly chat = inject(ChatService);
  private readonly _open = signal(false);
  private readonly _available = signal(false);
  private readonly _you = signal<string | null>(null);
  private readonly _canSend = signal(true);
  // The newest message the player has seen: those at start, and everything up to the moment they opened or closed the panel.
  private readonly seenId = signal(this.latestId());

  readonly open = this._open.asReadonly();
  // A board chat is on screen (a game with other people; a solo game has none).
  readonly available = this._available.asReadonly();
  readonly you = this._you.asReadonly();
  // Whether the viewer may post (a spectator or a dropped player may not); the phone panel's Chat tab reads it.
  readonly canSend = this._canSend.asReadonly();
  readonly unread = computed(() =>
    this._open() ? 0 : this.chat.messages().filter((m) => m.id > this.seenId() && m.from.playerId !== this._you()).length
  );

  toggle(): void {
    this.seenId.set(this.latestId());
    this._open.update((open) => !open);
  }

  // Closed, and everything said so far seen: a new game's board chat starts here.
  reset(): void {
    this._open.set(false);
    this.seenId.set(this.latestId());
  }

  // The phone panel's Chat tab is on screen (or not): the chat counts as open, and what was said so far as seen.
  setViewing(on: boolean): void {
    this.seenId.set(this.latestId());
    this._open.set(on);
  }

  setYou(playerId: string | null): void {
    this._you.set(playerId);
  }

  setCanSend(on: boolean): void {
    this._canSend.set(on);
  }

  setAvailable(on: boolean): void {
    this._available.set(on);
  }

  private latestId(): number {
    return this.chat.messages().at(-1)?.id ?? 0;
  }
}
