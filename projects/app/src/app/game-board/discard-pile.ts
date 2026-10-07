import { Component, Signal, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance } from 'engine';
import { cardIdDisplayName } from '../labels';
import { PlayingCard } from './playing-card';
import { DiscardHistoryEntry } from './discard-history';

export interface DiscardHistoryDialogData {
  // Most recent first (discard-history.ts). A signal, so the dialog keeps up
  // with discards made while it is open (bots keep playing).
  history: Signal<DiscardHistoryEntry[]>;
}

// Every card discarded this game, most recent first. Cards shuffled back into
// the draw pile sit below a reshuffle divider, dimmed.
@Component({
  selector: 'app-discard-history-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, PlayingCard],
  template: `
    <h2 mat-dialog-title>Discard History</h2>
    <mat-dialog-content>
      <p class="summary">{{ inPileCount() }} in the pile · {{ discardCount() }} discarded this game</p>
      <ol class="history">
        @for (entry of data.history(); track $index) {
          @if (entry.kind === 'card') {
            <li class="entry" [class.gone]="!entry.inPile" [attr.data-card-id]="entry.card.instanceId">
              <app-playing-card [card]="entry.card" />
            </li>
          } @else {
            <li class="reshuffle">
              <mat-icon>autorenew</mat-icon>
              {{ entry.cardCount }} {{ entry.cardCount === 1 ? 'card' : 'cards' }} shuffled into the draw pile
            </li>
          }
        }
      </ol>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .summary { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .history { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 12px; }
    .entry { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; }
    .entry.gone { opacity: 0.5; }
    .reshuffle {
      grid-column: 1 / -1; display: flex; align-items: center; gap: 8px;
      padding: 6px 0; border-top: 1px dashed var(--mat-sys-outline); border-bottom: 1px dashed var(--mat-sys-outline);
      font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class DiscardHistoryDialog {
  protected readonly data = inject<DiscardHistoryDialogData>(MAT_DIALOG_DATA);
  protected readonly discardCount = computed(() => this.data.history().filter((e) => e.kind === 'card').length);
  protected readonly inPileCount = computed(() => this.data.history().filter((e) => e.kind === 'card' && e.inPile).length);
}

// The discard pile, kept beside the table: only the top (most recent) card is
// face-up; clicking it opens the whole discard history, newest first.
@Component({
  selector: 'app-discard-pile',
  imports: [PlayingCard],
  template: `
    <div class="label">Discard Pile</div>
    @if (top(); as card) {
      <button type="button" class="pile" (click)="openHistory()" [attr.aria-label]="'Discard pile, ' + cards().length + ' cards. Show discard history'">
        @if (cards().length > 1) {
          <div class="under" aria-hidden="true"></div>
        }
        <app-playing-card [card]="card" />
        <span class="count">{{ cards().length }}</span>
      </button>
      <div class="top-name">{{ name(card) }}</div>
    } @else if (history().length > 0) {
      <!-- Emptied by a reshuffle: the history is still worth a look. -->
      <button type="button" class="pile empty" (click)="openHistory()" aria-label="Discard pile, Empty. Show discard history"></button>
      <div class="top-name">Empty</div>
    } @else {
      <div class="pile empty" aria-label="Discard pile, Empty"></div>
      <div class="top-name">Empty</div>
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

  protected readonly top = computed(() => this.cards().at(-1) ?? null);
  protected readonly name = (card: CardInstance) => cardIdDisplayName(card.definitionId);

  protected openHistory(): void {
    this.dialog.open<DiscardHistoryDialog, DiscardHistoryDialogData>(DiscardHistoryDialog, {
      data: { history: this.history },
      width: 'min(92vw, 640px)',
    });
  }
}
