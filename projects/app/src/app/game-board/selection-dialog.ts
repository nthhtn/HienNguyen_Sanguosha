import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { SelectionPanel } from './selection-panel';
import { DecisionCountdown } from './decision-countdown';
import { MinimizeButton } from './minimize-button';
import { SelectionDescription } from './ability-description';

export interface SelectionDialogData {
  description: SelectionDescription;
  // Told the filled SelectAction whenever enough are picked, so a timeout can use it.
  pickedChanged?: (action: Action) => void;
}

// Picking cards or seats for an ability (Axe's 2 cards, Sky Scorcher's
// targets). Confirms between min and max picks; Cancel when it may be.
@Component({
  selector: 'app-selection-dialog',
  imports: [MatDialogModule, DecisionCountdown, MinimizeButton, SelectionPanel],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ d.title }}</h2>
      <app-minimize-button />
    </div>
    <mat-dialog-content>
      <app-selection-panel [description]="d" [pickedChanged]="data.pickedChanged" (chosen)="dialogRef.close($event)" />
    </mat-dialog-content>
    <app-decision-countdown class="timer" />
  `,
  styles: `
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class SelectionDialog {
  protected readonly data = inject<SelectionDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<SelectionDialog, Action>>(MatDialogRef);
  protected readonly d = this.data.description;
}
