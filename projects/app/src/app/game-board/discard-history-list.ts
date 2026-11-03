import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
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
            <app-playing-card [card]="entry.card" />
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
  protected readonly discardCount = computed(() => this.history().filter((e) => e.kind === 'card').length);
  protected readonly inPileCount = computed(() => this.history().filter((e) => e.kind === 'card' && e.inPile).length);
}
