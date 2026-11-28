import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance } from 'engine';
import { PlayingCard } from './playing-card';
import { DiscardHistoryEntry } from './discard-history';
import { TPipe } from '../i18n/t.pipe';

// Every card discarded this game, most recent first. Cards shuffled back into
// the draw pile sit below a reshuffle divider, dimmed. Shown in the discard
// history dialog and in the board panel.
@Component({
  selector: 'app-discard-history-list',
  imports: [MatIconModule, PlayingCard, TPipe],
  template: `
    <p class="summary">{{ 'discard.summary' | t: { inPile: inPileCount(), total: discardCount() } }}</p>
    <ol class="history">
      @for (entry of history(); track $index) {
        @if (entry.kind === 'card') {
          <li class="entry" [class.gone]="!entry.inPile" [attr.data-card-id]="entry.card.instanceId">
            @if (selectable()) {
              <button type="button" class="card" [class.selected]="entry.card.instanceId === selectedId()" [attr.aria-pressed]="entry.card.instanceId === selectedId()" (click)="cardSelected.emit(entry.card)">
                <app-playing-card [card]="entry.card" />
              </button>
            } @else {
              <app-playing-card [card]="entry.card" />
            }
          </li>
        } @else {
          <li class="reshuffle">
            <mat-icon>autorenew</mat-icon>
            {{ (entry.cardCount === 1 ? 'discard.reshuffled.one' : 'discard.reshuffled.other') | t: { n: entry.cardCount } }}
          </li>
        }
      }
    </ol>
  `,
  styles: `
    .summary { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .history { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 12px; }
    .entry { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; }
    .entry.gone { opacity: 0.5; }
    .card { padding: 2px; border: 2px solid transparent; border-radius: 8px; background: none; color: inherit; cursor: pointer; }
    .card:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .card.selected { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); }
    .reshuffle {
      grid-column: 1 / -1; display: flex; align-items: center; gap: 8px;
      padding: 6px 0; border-top: 1px dashed var(--mat-sys-outline); border-bottom: 1px dashed var(--mat-sys-outline);
      font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class DiscardHistoryList {
  // Most recent first (discard-history.ts).
  readonly history = input.required<DiscardHistoryEntry[]>();
  // The popup lets a card be chosen to show its info; the board panel does not.
  readonly selectable = input(false);
  readonly selectedId = input<string | null>(null);
  readonly cardSelected = output<CardInstance>();
  protected readonly discardCount = computed(() => this.history().filter((e) => e.kind === 'card').length);
  protected readonly inPileCount = computed(() => this.history().filter((e) => e.kind === 'card' && e.inPile).length);
}
