import { Component, Signal, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CardInstance } from 'engine';
import { cardIdDisplayName } from '../labels';
import { DiscardHistoryList } from './discard-history-list';
import { PlayingCard } from './playing-card';
import { DiscardHistoryEntry } from './discard-history';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

export interface DiscardHistoryDialogData {
  // Most recent first (discard-history.ts). A signal, so the dialog keeps up
  // with discards made while it is open (bots keep playing).
  history: Signal<DiscardHistoryEntry[]>;
}

// Every card discarded this game, most recent first. Cards shuffled back into
// the draw pile sit below a reshuffle divider, dimmed.
@Component({
  selector: 'app-discard-history-dialog',
  imports: [MatDialogModule, MatButtonModule, DiscardHistoryList, TPipe],
  template: `
    <h2 mat-dialog-title>{{ 'discard.title' | t }}</h2>
    <mat-dialog-content>
      <app-discard-history-list [history]="data.history()" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">{{ 'ui.close' | t }}</button>
    </mat-dialog-actions>
  `,
})
export class DiscardHistoryDialog {
  protected readonly data = inject<DiscardHistoryDialogData>(MAT_DIALOG_DATA);
}

// The discard pile, kept beside the table: only the top (most recent) card is
// face-up; clicking it opens the whole discard history, newest first.
@Component({
  selector: 'app-discard-pile',
  imports: [PlayingCard, TPipe],
  template: `
    <div class="label">{{ 'discard.pile' | t }}</div>
    @if (top(); as card) {
      <button type="button" class="pile" (click)="openHistory()" [attr.aria-label]="'discard.pileAria' | t: { n: cards().length }">
        @if (cards().length > 1) {
          <div class="under" aria-hidden="true"></div>
        }
        <app-playing-card [card]="card" />
        <span class="count">{{ cards().length }}</span>
      </button>
      <div class="top-name">{{ name(card) }}</div>
    } @else if (history().length > 0) {
      <!-- Emptied by a reshuffle: the history is still worth a look. -->
      <button type="button" class="pile empty" (click)="openHistory()" [attr.aria-label]="'discard.emptyShowAria' | t"></button>
      <div class="top-name">{{ 'discard.empty' | t }}</div>
    } @else {
      <div class="pile empty" [attr.aria-label]="'discard.emptyAria' | t"></div>
      <div class="top-name">{{ 'discard.empty' | t }}</div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; border-radius: 12px;
      background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface); }
    .label { font: var(--mat-sys-label-large); }
    .pile { position: relative; display: block; padding: 0; border: none; background: none; cursor: pointer; border-radius: 4px; }
        .pile:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .pile app-playing-card { position: relative; display: block; }
    /* A hint of the cards beneath the top one. */
    .under { position: absolute; inset: 0; transform: translate(4px, 4px); border-radius: 4px; background: #6b6b6b; border: 1px solid #444; }
    .pile.empty { width: 70px; height: 96px; border: 1px dashed var(--mat-sys-outline); box-sizing: border-box; }
    div.pile.empty { cursor: default; }
    .count {
      position: absolute; right: -8px; top: -8px; min-width: 22px; height: 22px; padding: 0 4px; box-sizing: border-box;
      border-radius: 11px; background: var(--mat-sys-primary); color: var(--mat-sys-on-primary);
      font: var(--mat-sys-label-medium); line-height: 22px; text-align: center;
    }
    .top-name { font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); text-align: center; max-width: 90px; }
  `,
})
export class DiscardPile {
  // In pile order: the engine appends, so the last card is the most recent discard.
  readonly cards = input.required<CardInstance[]>();
  // Most recent first, reshuffles included (discard-history.ts).
  readonly history = input.required<DiscardHistoryEntry[]>();

  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);

  protected readonly top = computed(() => this.cards().at(-1) ?? null);
  protected readonly name = (card: CardInstance) => cardIdDisplayName(card.definitionId, this.i18n.translator);

  protected openHistory(): void {
    this.dialog.open<DiscardHistoryDialog, DiscardHistoryDialogData>(DiscardHistoryDialog, {
      data: { history: this.history },
      width: 'min(92vw, 640px)',
    });
  }
}
