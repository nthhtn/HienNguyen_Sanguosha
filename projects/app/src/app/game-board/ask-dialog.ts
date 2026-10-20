import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { PlayingCard } from './playing-card';
import { CardArt } from './card-art';
import { DecisionCountdown } from './decision-countdown';
import { MinimizeButton } from './minimize-button';
import { AskDescription } from './ability-description';
import { TPipe } from '../i18n/t.pipe';

export interface AskDialogData {
  description: AskDescription;
}

// "May" asks: use an optional ability or not. Closes only through its two
// buttons, with the engine's own ChooseOptionAction.
@Component({
  selector: 'app-ask-dialog',
  imports: [MatDialogModule, MatButtonModule, PlayingCard, CardArt, DecisionCountdown, MinimizeButton, TPipe],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ data.description.title }}</h2>
      <app-minimize-button />
    </div>
    <mat-dialog-content class="body">
      @if (data.description.card; as card) {
        <app-playing-card [card]="card" />
      } @else if (data.description.generalId; as generalId) {
        <app-card-art [skin]="true" [id]="generalId" [label]="data.description.title" size="small" />
      }
      <div class="words">
        <p class="prompt">{{ data.description.prompt }}</p>
        @if (data.description.hint; as hint) {
          <p class="hint">{{ hint }}</p>
        }
      </div>
    </mat-dialog-content>
    <!-- At zero: Don't. -->
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-button type="button" class="decline" (click)="close(data.description.decline)">{{ 'choice.option.decline' | t }}</button>
      <button mat-flat-button type="button" class="use" (click)="close(data.description.use)">{{ data.description.useLabel }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .body { display: flex; gap: 16px; align-items: flex-start; }
    .prompt { margin: 0 0 8px; font: var(--mat-sys-title-medium); }
    .hint { margin: 0; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
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
