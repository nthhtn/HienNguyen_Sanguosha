import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { PlayingCard } from './playing-card';
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
  imports: [MatDialogModule, MatButtonModule, PlayingCard, DecisionCountdown, MinimizeButton],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ d.title }}</h2>
      <app-minimize-button />
    </div>
    <mat-dialog-content>
      <p class="prompt">{{ d.prompt }}</p>
      <ul class="items">
        @for (item of d.items; track item.id) {
          <li>
            <button
              type="button"
              class="item"
              [class.picked]="isPicked(item.id)"
              [attr.aria-pressed]="isPicked(item.id)"
              [attr.aria-label]="item.label"
              [attr.data-item-id]="item.id"
              (click)="toggle(item.id)"
            >
              @if (item.card; as card) {
                <app-playing-card [card]="card" />
              } @else {
                <span class="seat">{{ item.label }}</span>
              }
            </button>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      @if (d.cancel; as cancel) {
        <button mat-button type="button" class="cancel" (click)="dialogRef.close(cancel)">{{ d.cancelLabel }}</button>
      }
      <button mat-flat-button type="button" class="confirm" [disabled]="!ready()" (click)="confirm()">{{ d.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .prompt { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .items { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }
    .item {
      display: flex; flex-direction: column; align-items: center; width: 100%; padding: 6px 4px;
      border: 2px solid transparent; border-radius: 10px; background: none; color: inherit; cursor: pointer;
    }
    .item:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .item.picked { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); }
    .seat { padding: 16px 8px; font: var(--mat-sys-title-small); }
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class SelectionDialog {
  private readonly data = inject<SelectionDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<SelectionDialog, Action>>(MatDialogRef);
  protected readonly d = this.data.description;
  protected readonly picked = signal<string[]>([]);
  protected readonly ready = computed(() => this.picked().length >= this.d.min && this.picked().length <= this.d.max);

  protected isPicked(id: string): boolean {
    return this.picked().includes(id);
  }

  // Pick or unpick; at max, a further pick is ignored (or, picking one,
  // replaces the pick).
  protected toggle(id: string): void {
    const now = this.picked();
    if (now.includes(id)) this.picked.set(now.filter((x) => x !== id));
    else if (now.length < this.d.max) this.picked.set([...now, id]);
    else if (this.d.max === 1) this.picked.set([id]);
    if (this.ready()) this.data.pickedChanged?.({ ...this.d.template, ids: this.picked() });
  }

  protected confirm(): void {
    if (this.ready()) this.dialogRef.close({ ...this.d.template, ids: this.picked() });
  }
}
