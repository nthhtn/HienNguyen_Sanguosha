import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { PlayingCard } from './playing-card';
import { DecisionCountdown } from './decision-countdown';
import { ChoiceDescription } from './choice-description';

export interface ChoiceDialogOption {
  id: string;
  action: Action;
  // A face-up card; or, for a hand, its size shown on a face-down card.
  card?: CardInstance;
  hiddenCount?: number;
  label: string;
}

export interface ChoiceDialogData {
  description: ChoiceDescription;
  options: ChoiceDialogOption[];
  // Told the picked option's action on every change, so a timeout can use it.
  pickedChanged?: (action: Action) => void;
}

// A Tool's pick (Steal, Break, Harvest): pick one option, then Take or Discard.
// Closes only through that button, with the engine's own ChooseOptionAction.
@Component({
  selector: 'app-choice-dialog',
  imports: [MatDialogModule, MatButtonModule, PlayingCard, DecisionCountdown],
  template: `
    <h2 mat-dialog-title>{{ data.description.title }}</h2>
    <mat-dialog-content>
      <p class="prompt">{{ data.description.prompt }}</p>
      <ul class="options">
        @for (option of data.options; track option.id) {
          <li>
            <button
              type="button"
              class="option"
              [class.picked]="picked() === option.id"
              [attr.aria-pressed]="picked() === option.id"
              [attr.aria-label]="option.label"
              [attr.data-option-id]="option.id"
              (click)="pick(option)"
            >
              @if (option.card; as card) {
                <app-playing-card [card]="card" />
              } @else {
                <span class="card-back"><span class="count">{{ option.hiddenCount }}</span></span>
              }
              <span class="label">{{ option.label }}</span>
            </button>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <!-- At zero: the picked option, else the first. -->
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" class="confirm" [disabled]="!picked()" (click)="confirm()">{{ data.description.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .prompt { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .options { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }
    .option {
      display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%;
      padding: 6px 4px; border: 2px solid transparent; border-radius: 10px; background: none; color: inherit; cursor: pointer;
    }
    .option:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .option.picked { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); }
    .card-back {
      display: flex; align-items: center; justify-content: center; width: 72px; height: 100px; border-radius: 6px;
      background: repeating-linear-gradient(45deg, #7a2e2e, #7a2e2e 6px, #8e3a3a 6px, #8e3a3a 12px); color: #fff;
    }
    .count { font: 700 22px/1 system-ui, sans-serif; text-shadow: 0 1px 2px rgb(0 0 0 / 60%); }
    .label { font: var(--mat-sys-body-small); text-align: center; }
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class ChoiceDialog {
  protected readonly data = inject<ChoiceDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ChoiceDialog, Action>>(MatDialogRef);

  protected readonly picked = signal<string | null>(null);

  protected pick(option: ChoiceDialogOption): void {
    this.picked.set(option.id);
    this.data.pickedChanged?.(option.action);
  }

  protected confirm(): void {
    const option = this.data.options.find((o) => o.id === this.picked());
    if (option) this.dialogRef.close(option.action);
  }
}
