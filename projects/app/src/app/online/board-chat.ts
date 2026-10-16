import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TPipe } from '../i18n/t.pipe';
import { ChatPanel } from './chat-panel';
import { ChatService } from './chat.service';

// The board's chat: a Chat button (with the count of messages you haven't seen)
// that opens a side panel over the board's edge. Closed by default, so it never
// covers the table. The count is presentation state, kept here.
@Component({
  selector: 'app-board-chat',
  imports: [MatButtonModule, MatIconModule, ChatPanel, TPipe],
  template: `
    @if (open()) {
      <aside class="drawer" [attr.aria-label]="'lobby.chat' | t">
        <header>
          <h2>{{ 'lobby.chat' | t }}</h2>
          <button mat-icon-button type="button" class="close-chat" [attr.aria-label]="'chat.close' | t" (click)="toggle()"><mat-icon>close</mat-icon></button>
        </header>
        <app-chat-panel [you]="you()" [canSend]="canSend()" />
      </aside>
    } @else {
      <button
        mat-flat-button
        type="button"
        class="chat-toggle"
        aria-expanded="false"
        [attr.aria-label]="unread() > 0 ? ('chat.unread' | t: { n: unread() }) : ('lobby.chat' | t)"
        (click)="toggle()"
      >
        <mat-icon>chat</mat-icon> {{ 'lobby.chat' | t }}
        @if (unread() > 0) {
          <span class="unread">{{ unread() }}</span>
        }
      </button>
    }
  `,
  styles: `
    .chat-toggle {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 20;
    }
    .unread {
      min-width: 20px;
      margin-left: 8px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
      font: var(--mat-sys-label-medium);
      line-height: 20px;
      text-align: center;
    }
    .drawer {
      position: fixed;
      top: 64px;
      right: 0;
      bottom: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(360px, 100vw);
      box-sizing: border-box;
      padding: 8px 16px 16px;
      background: var(--mat-sys-surface-container);
      box-shadow: var(--mat-sys-level3);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    app-chat-panel {
      flex: 1;
    }
  `,
})
export class BoardChat {
  private readonly chat = inject(ChatService);
  readonly you = input<string | null>(null);
  readonly canSend = input(true);
  protected readonly open = signal(false);
  // The newest message the player has seen: those at start, and everything up to the moment they opened or closed the panel.
  private readonly seenId = signal(this.latestId());

  protected readonly unread = computed(() =>
    this.open() ? 0 : this.chat.messages().filter((m) => m.id > this.seenId() && m.from.playerId !== this.you()).length
  );

  protected toggle(): void {
    this.seenId.set(this.latestId());
    this.open.update((open) => !open);
  }

  private latestId(): number {
    return this.chat.messages().at(-1)?.id ?? 0;
  }
}
