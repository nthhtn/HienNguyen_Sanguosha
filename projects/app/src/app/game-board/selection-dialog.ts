import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { PlayingCard } from './playing-card';
import { SelectionPanel } from './selection-panel';
import { DecisionCountdown } from './decision-countdown';
import { MinimizeButton } from './minimize-button';
import { SelectionDescription } from './ability-description';

export interface SelectionDialogData {
  description: SelectionDescription;
  // Told the filled SelectAction whenever enough are picked, so a timeout can use it.
  pickedChanged?: (action: Action) => void;
  // A card the choice is about, shown above the choices (the Blaze card the target revealed), with a caption.
  shown?: { card: CardInstance; caption: string };
}

// Picking cards or seats for an ability (Axe's 2 cards, Sky Scorcher's
// targets). Confirms between min and max picks; Cancel when it may be.
@Component({
  selector: 'app-selection-dialog',
  imports: [MatDialogModule, DecisionCountdown, MinimizeButton, SelectionPanel, PlayingCard],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ d.title }}</h2>
      <app-decision-countdown class="header-timer" />
      <app-minimize-button />
    </div>
    <mat-dialog-content>
      @if (data.shown; as shown) {
        <div class="shown">
          <app-playing-card [card]="shown.card" />
          <span>{{ shown.caption }}</span>
        </div>
      }
      <app-selection-panel [description]="d" [pickedChanged]="data.pickedChanged" (chosen)="dialogRef.close($event)" />
    </mat-dialog-content>
    <app-decision-countdown class="timer" />
  `,
  styles: `
    .shown { display: flex; align-items: center; gap: 12px; margin: 0 0 12px; font: var(--mat-sys-title-small); }
    .shown app-playing-card { width: 72px; flex: none; }
    .timer { display: block; padding: 8px 24px 0; }
    :host-context([data-layout='compact']) .timer { display: none; }
    /* The phone board (spec 3h): the content is a column whose cards scroll, so the buttons never cover them. */
    :host-context([data-layout='compact']) mat-dialog-content { display: flex; flex-direction: column; overflow: hidden; }
    :host-context([data-layout='compact']) app-selection-panel { flex: 1 1 auto; min-height: 0; }
  `,
})
export class SelectionDialog {
  protected readonly data = inject<SelectionDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<SelectionDialog, Action>>(MatDialogRef);
  protected readonly d = this.data.description;
}
