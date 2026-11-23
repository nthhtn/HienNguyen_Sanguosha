import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ActionHistoryEntry } from './action-history';
import { ActionHistoryList } from './action-history-list';
import { DiscardHistoryEntry } from './discard-history';
import { DiscardHistoryList } from './discard-history-list';
import { TPipe } from '../i18n/t.pipe';
import { Layout } from '../layout.service';
import { BoardChatState } from '../online/board-chat-state.service';
import { ChatPanel } from '../online/chat-panel';

// The phone layout's replacement for the two tiles beside the table: the whole action history and discard
// history in tabs. The board slides it over the table from the right. On the phone board it also holds the Draw
// Pile count above the tabs and, in an online room, the chat as a third tab (spec 3e).
@Component({
  selector: 'app-board-panel',
  imports: [MatTabsModule, ActionHistoryList, DiscardHistoryList, ChatPanel, TPipe],
  template: `
    @if (drawPileCount() !== null) {
      <div class="draw-pile">{{ 'phase.drawPile' | t: { n: drawPileCount() } }}</div>
    }
    <mat-tab-group animationDuration="0ms" stretchTabs="true" (selectedIndexChange)="selected.set($event)">
      <mat-tab [label]="'history.title' | t">
        <div class="list"><app-action-history-list [history]="actionHistory()" /></div>
      </mat-tab>
      <mat-tab [label]="'discard.pile' | t">
        <div class="list"><app-discard-history-list [history]="discardHistory()" /></div>
      </mat-tab>
      @if (showChat()) {
        <mat-tab [label]="'lobby.chat' | t">
          <div class="list chat"><app-chat-panel [you]="chat!.you()" [canSend]="chat!.canSend()" /></div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .draw-pile { flex: none; padding: 8px 12px; font: var(--mat-sys-label-large); font-size: 14px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    mat-tab-group { flex: 1 1 auto; min-height: 0; }
    .list { padding: 12px; }
  `,
})
export class BoardPanel {
  // Most recent first (action-history.ts, discard-history.ts).
  readonly actionHistory = input.required<ActionHistoryEntry[]>();
  readonly discardHistory = input.required<DiscardHistoryEntry[]>();
  // The Draw Pile count, for the phone board (the other layouts show it in the phase indicator); null shows none.
  readonly drawPileCount = input<number | null>(null);

  // Present in an online room only (the lobby page provides it).
  protected readonly chat = inject(BoardChatState, { optional: true });
  private readonly layout = inject(Layout);
  protected readonly selected = signal(0);
  protected readonly showChat = computed(() => !!this.chat?.available() && this.layout.toolbarHidden());
  private static readonly CHAT_TAB = 2;

  constructor() {
    // The chat counts as open while its tab is showing, and as closed when the tab or the panel goes away.
    effect(() => {
      const viewing = this.showChat() && this.selected() === BoardPanel.CHAT_TAB;
      if (this.chat && viewing !== this.chat.open()) this.chat.setViewing(viewing);
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.chat?.open()) this.chat.setViewing(false);
    });
  }
}
