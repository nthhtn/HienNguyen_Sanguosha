import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { AskPanel } from './ask-panel';
import { DecisionCountdown } from './decision-countdown';
import { MinimizeButton } from './minimize-button';
import { AskDescription } from './ability-description';

export interface AskDialogData {
  description: AskDescription;
}

// "May" asks: use an optional ability or not. Closes only through its two
// buttons, with the engine's own ChooseOptionAction.
@Component({
  selector: 'app-ask-dialog',
  imports: [MatDialogModule, DecisionCountdown, MinimizeButton, AskPanel],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ data.description.title }}</h2>
      <app-minimize-button />
    </div>
    <mat-dialog-content>
      <app-ask-panel [description]="data.description" (chosen)="close($event)" />
    </mat-dialog-content>
    <!-- At zero: Don't. -->
    <app-decision-countdown class="timer" />
  `,
  styles: `
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class AskDialog {
  protected readonly data = inject<AskDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AskDialog, Action>>(MatDialogRef);

  protected close(action: Action): void {
    this.dialogRef.close(action);
  }
}
