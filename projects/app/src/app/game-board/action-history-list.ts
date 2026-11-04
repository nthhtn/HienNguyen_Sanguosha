import { Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance } from 'engine';
import { cardIdDisplayName } from '../labels';
import { CardArt } from './card-art';
import { ActionHistoryEntry } from './action-history';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

// Everything that happened at the table, most recent first, one divider per turn.
// Shown in the action history dialog and in the board panel.
@Component({
  selector: 'app-action-history-list',
  imports: [MatIconModule, CardArt, TPipe],
  template: `
    <ol class="history">
      @for (entry of history(); track $index) {
        @if (entry.kind === 'action') {
          <li class="entry">
            @if (entry.card; as card) {
              <app-card-art size="tiny" [cropped]="true" [id]="card.definitionId" [label]="name(card)" />
            } @else {
              <span class="no-card" aria-hidden="true"></span>
            }
            <span class="text" [class.force-status]="!!entry.force" [attr.data-force]="entry.force ?? null">{{ entry.text }}</span>
          </li>
        } @else {
          <li class="turn">
            <mat-icon>flag</mat-icon>
            {{ 'history.turnMarker' | t: { n: entry.turnNumber, seat: entry.seatName } }}
          </li>
        }
      } @empty {
        <li class="empty">{{ 'history.empty' | t }}</li>
      }
    </ol>
  `,
  styles: `
    .history { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .entry { display: flex; align-items: center; gap: 10px; font: var(--mat-sys-body-medium); }
    .no-card { flex: none; width: 26px; }
    .turn {
      display: flex; align-items: center; gap: 8px; margin-top: 6px;
      padding: 6px 0; border-top: 1px dashed var(--mat-sys-outline); border-bottom: 1px dashed var(--mat-sys-outline);
      font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant);
    }
    .turn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .empty { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class ActionHistoryList {
  // Most recent first (action-history.ts).
  readonly history = input.required<ActionHistoryEntry[]>();
  private readonly i18n = inject(I18n);
  protected readonly name = (card: CardInstance) => cardIdDisplayName(card.definitionId, this.i18n.translator);
}
