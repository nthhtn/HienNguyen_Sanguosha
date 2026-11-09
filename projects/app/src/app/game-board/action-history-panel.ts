import { Component, Signal, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance } from 'engine';
import { cardIdDisplayName } from '../labels';
import { ActionHistoryList } from './action-history-list';
import { PlayingCard } from './playing-card';
import { ActionHistoryEntry } from './action-history';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

export interface ActionHistoryDialogData {
  // Most recent first (action-history.ts). A signal, so the dialog keeps up
  // with the game while it is open.
  history: Signal<ActionHistoryEntry[]>;
}

// Everything that happened at the table, most recent first, one divider per turn.
@Component({
  selector: 'app-action-history-dialog',
  imports: [MatDialogModule, MatButtonModule, ActionHistoryList, TPipe],
  template: `
    <h2 mat-dialog-title>{{ 'history.title' | t }}</h2>
    <mat-dialog-content>
      <app-action-history-list [history]="data.history()" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">{{ 'ui.close' | t }}</button>
    </mat-dialog-actions>
  `,
})
export class ActionHistoryDialog {
  protected readonly data = inject<ActionHistoryDialogData>(MAT_DIALOG_DATA);
}

// Beside the table, under the discard pile: the latest action, face-up when
// it was a card; clicking opens the whole history, newest first.
@Component({
  selector: 'app-action-history',
  imports: [PlayingCard, MatIconModule, TPipe],
  template: `
    <div class="label">{{ 'history.title' | t }}</div>
    <button type="button" class="latest" (click)="openHistory()" [attr.aria-label]="'history.show' | t">
      @if (latest(); as entry) {
        @if (entry.card; as card) {
          <app-playing-card size="small" [card]="card" />
        } @else {
          <mat-icon class="icon">history</mat-icon>
        }
        <span class="text" [class.force-status]="!!entry.force" [attr.data-force]="entry.force ?? null">{{ entry.text }}</span>
      } @else {
        <mat-icon class="icon">history</mat-icon>
        <span class="text">{{ 'history.nothingYet' | t }}</span>
      }
    </button>
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; border-radius: 12px;
      background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface); }
    .label { font: var(--mat-sys-label-large); }
    .latest {
      display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%;
      padding: 4px; border: none; border-radius: 8px; background: none; color: inherit; cursor: pointer;
    }
    .latest:hover { background: var(--mat-sys-surface-container-high); }
    .text:not(.force-status) { color: var(--mat-sys-on-surface-variant); }
    .latest:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .icon { font-size: 36px; width: 36px; height: 36px; color: var(--mat-sys-on-surface-variant); }
    .text {
      font: var(--mat-sys-label-medium); text-align: center;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
    }
  `,
})
export class ActionHistoryPanel {
  // Most recent first, turn markers included (action-history.ts).
  readonly history = input.required<ActionHistoryEntry[]>();

  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);

  protected readonly latest = computed(
    () => this.history().find((e): e is Extract<ActionHistoryEntry, { kind: 'action' }> => e.kind === 'action') ?? null
  );
  protected readonly name = (card: CardInstance) => cardIdDisplayName(card.definitionId, this.i18n.translator);

  protected openHistory(): void {
    this.dialog.open<ActionHistoryDialog, ActionHistoryDialogData>(ActionHistoryDialog, {
      data: { history: this.history },
      width: 'min(92vw, 560px)',
    });
  }
}
