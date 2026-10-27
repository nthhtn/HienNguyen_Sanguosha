import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { SelectionRosterEntry } from '../game.service';
import { TPipe } from '../i18n/t.pipe';

// One seat of the General Selection panel: who it is and whether it has confirmed its Generals.
export interface SelectionRosterRow extends SelectionRosterEntry {
  name: string;
}

// Who has chosen their Generals yet, beside the selection screen of an online game. Presentational: it
// shows only whether a seat is still choosing, never what was dealt or picked.
@Component({
  selector: 'app-selection-roster',
  imports: [MatCardModule, MatIconModule, TPipe],
  template: `
    <mat-card appearance="outlined" class="roster">
      <h3>{{ 'board.selection.players' | t }}</h3>
      <ul>
        @for (row of rows(); track row.seatId) {
          <li [class.ready]="row.ready">
            <mat-icon aria-hidden="true">{{ row.ready ? 'check_circle' : 'hourglass_top' }}</mat-icon>
            <span class="name">{{ row.name }}@if (row.isYou) { <em class="you">{{ 'board.selection.you' | t }}</em> }</span>
            <span class="status">{{ (row.ready ? 'board.selection.ready' : 'board.selection.choosing') | t }}</span>
          </li>
        }
      </ul>
    </mat-card>
  `,
  styles: `
    .roster { padding: 16px; min-width: 220px; }
    h3 { margin: 0 0 8px; font: var(--mat-sys-title-medium); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    li { display: flex; align-items: center; gap: 8px; color: var(--mat-sys-on-surface-variant); }
    li.ready { color: var(--mat-sys-on-surface); }
    li.ready mat-icon { color: var(--mat-sys-primary); }
    .name { flex: 1; overflow-wrap: anywhere; }
    .you { margin-inline-start: 6px; font-size: 0.85em; opacity: 0.7; }
    .status { font: var(--mat-sys-label-large); }
  `,
})
export class SelectionRoster {
  readonly rows = input.required<SelectionRosterRow[]>();
}
