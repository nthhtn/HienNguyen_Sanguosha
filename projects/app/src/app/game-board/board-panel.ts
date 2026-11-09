import { Component, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ActionHistoryEntry } from './action-history';
import { ActionHistoryList } from './action-history-list';
import { DiscardHistoryEntry } from './discard-history';
import { DiscardHistoryList } from './discard-history-list';
import { TPipe } from '../i18n/t.pipe';

// The phone layout's replacement for the two tiles beside the table: the whole action history and discard
// history in tabs. The board slides it over the table from the right.
@Component({
  selector: 'app-board-panel',
  imports: [MatTabsModule, ActionHistoryList, DiscardHistoryList, TPipe],
  template: `
    <mat-tab-group animationDuration="0ms" stretchTabs="true">
      <mat-tab [label]="'history.title' | t">
        <div class="list"><app-action-history-list [history]="actionHistory()" /></div>
      </mat-tab>
      <mat-tab [label]="'discard.pile' | t">
        <div class="list"><app-discard-history-list [history]="discardHistory()" /></div>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 0; }
    mat-tab-group { height: 100%; }
    .list { padding: 12px; }
  `,
})
export class BoardPanel {
  // Most recent first (action-history.ts, discard-history.ts).
  readonly actionHistory = input.required<ActionHistoryEntry[]>();
  readonly discardHistory = input.required<DiscardHistoryEntry[]>();
}
