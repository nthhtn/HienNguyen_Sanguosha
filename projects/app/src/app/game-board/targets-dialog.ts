import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { GameState, pickAllows, TargetPick } from 'engine';
import { seatName } from '../labels';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

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
  imports: [MatButtonModule, MatDialogModule, TPipe],
  template: `
    <h2 mat-dialog-title>{{ 'targets.title' | t }}</h2>
    <mat-dialog-content>
      <p>{{ prompt }}</p>
      <div class="seats">
        @for (seat of seats; track seat.id) {
          <button
            mat-stroked-button
            type="button"
            [class.picked]="picked().includes(seat.id)"
            [attr.aria-pressed]="picked().includes(seat.id)"
            [disabled]="!picked().includes(seat.id) && !allowed(seat.id)"
            (click)="toggle(seat.id)"
          >
            {{ seat.label }}
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close()">{{ 'ui.cancel' | t }}</button>
      <button mat-flat-button type="button" [disabled]="picked().length < data.pick.min" (click)="confirm()">{{ 'ui.confirm' | t }}</button>
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
  private readonly i18n = inject(I18n);
  protected readonly picked = signal<string[]>([]);
  protected readonly prompt = this.i18n.t(this.data.pick.min === this.data.pick.max ? 'targets.prompt' : 'targets.promptUpTo', { count: this.data.pick.max, title: this.data.title });
  protected readonly seats = this.data.pick.eligibleIds.map((id) => ({ id, label: seatName(this.data.state.players, id, this.i18n.translator) }));

  // Whether the seat may join those picked: below the maximum, and within any cap on some seats.
  protected allowed(id: string): boolean {
    return pickAllows(this.data.pick, this.picked(), id);
  }

  protected toggle(id: string): void {
    this.picked.update((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  protected confirm(): void {
    const order = this.data.pick.eligibleIds;
    this.ref.close([...this.picked()].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  }
}
