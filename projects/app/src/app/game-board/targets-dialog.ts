import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { GameState, TargetPick } from 'engine';
import { seatName } from '../labels';

export interface TargetsDialogData {
  // What is being played: "Sha".
  title: string;
  pick: TargetPick;
  state: GameState;
}

// Several equal targets chosen in one window (stage 9 spec): toggle up to
// `max` seats, then Confirm. Closes with the seat ids in seat order, or with
// nothing on Cancel. The engine checks the picks again when they are played.
@Component({
  selector: 'app-targets-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Choose Targets</h2>
    <mat-dialog-content>
      <p>{{ prompt }}</p>
      <div class="seats">
        @for (seat of seats; track seat.id) {
          <button
            mat-stroked-button
            type="button"
            [class.picked]="picked().includes(seat.id)"
            [attr.aria-pressed]="picked().includes(seat.id)"
            [disabled]="!picked().includes(seat.id) && full()"
            (click)="toggle(seat.id)"
          >
            {{ seat.label }}
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close()">Cancel</button>
      <button mat-flat-button type="button" [disabled]="picked().length < data.pick.min" (click)="confirm()">Confirm</button>
    </mat-dialog-actions>
  `,
  styles: `
    .seats { display: flex; flex-wrap: wrap; gap: 8px; }
    .picked { background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
  `,
})
export class TargetsDialog {
  protected readonly data = inject<TargetsDialogData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<TargetsDialog, string[]>>(MatDialogRef);
  protected readonly picked = signal<string[]>([]);
  protected readonly full = computed(() => this.picked().length >= this.data.pick.max);
  protected readonly prompt = `Choose ${this.data.pick.min === this.data.pick.max ? '' : 'up to '}${this.data.pick.max} targets for ${this.data.title}`;
  protected readonly seats = this.data.pick.eligibleIds.map((id) => ({ id, label: seatName(this.data.state.players, id) }));

  protected toggle(id: string): void {
    this.picked.update((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  protected confirm(): void {
    const order = this.data.pick.eligibleIds;
    this.ref.close([...this.picked()].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  }
}
