import { Component, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CHAT_BODY_MAX } from 'protocol';
import { TMsgPipe } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { ChatService } from './chat.service';

// The room's messages and the box to write one. It reads and sends through
// ChatService and decides nothing: length and rate are the server's call, and
// the server's reason is shown when it refuses.
@Component({
  selector: 'app-chat-panel',
  imports: [MatButtonModule, MatIconModule, TPipe, TMsgPipe],
  template: `
    <ol class="messages" #list aria-live="polite" [attr.aria-label]="'chat.messages' | t">
      @for (message of chat.messages(); track message.id) {
        <li class="message" [class.mine]="message.from.playerId === you()">
          <span class="author">{{ message.from.name }}</span>
          <span class="body">{{ message.body }}</span>
        </li>
      } @empty {
        <li class="empty">{{ 'chat.empty' | t }}</li>
      }
    </ol>
    @if (chat.error(); as text) {
      <p class="error" role="alert">{{ text | tm }}</p>
    }
    <form class="composer" (submit)="submit($event)">
      <input
        class="draft"
        type="text"
        autocomplete="off"
        [attr.aria-label]="'chat.message' | t"
        [placeholder]="'chat.placeholder' | t"
        [attr.maxlength]="maxLength"
        [value]="draft()"
        [disabled]="!canSend()"
        (input)="onInput($event)"
      />
      <button mat-icon-button type="submit" class="send" [attr.aria-label]="'chat.send' | t" [disabled]="!canSend() || draft().trim() === ''">
        <mat-icon>send</mat-icon>
      </button>
    </form>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
    }
    .messages {
      list-style: none;
      margin: 0;
      padding: 8px;
      flex: 1;
      min-height: 120px;
      max-height: 240px;
      overflow-y: auto;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-lowest);
      font: var(--mat-sys-body-medium);
    }
    :host-context(.drawer) .messages {
      max-height: none;
    }
    .message {
      display: flex;
      gap: 8px;
      padding: 2px 0;
      overflow-wrap: anywhere;
    }
    .author {
      flex: none;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .mine .author {
      color: var(--mat-sys-primary);
    }
    .empty {
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-medium);
    }
    .composer {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .draft {
      flex: 1;
      min-width: 0;
      padding: 8px 12px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 8px;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class ChatPanel {
  protected readonly chat = inject(ChatService);
  // Your player id, to mark your own messages.
  readonly you = input<string | null>(null);
  // False while disconnected or after the connection ended.
  readonly canSend = input(true);
  protected readonly maxLength = CHAT_BODY_MAX;
  protected readonly draft = signal('');
  private readonly sending = signal(false);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  constructor() {
    // Keep the newest message in view.
    effect(() => {
      this.chat.messages();
      const el = this.list()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const body = this.draft().trim();
    if (body === '' || !this.canSend() || this.sending()) return;
    this.sending.set(true);
    try {
      if (await this.chat.send(body)) this.draft.set('');
    } finally {
      this.sending.set(false);
    }
  }
}
