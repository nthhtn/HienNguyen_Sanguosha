import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import type { DeckId } from 'content';
import { DeckPicker } from '../deck-picker';
import { DISPLAY_NAME_MAX } from 'protocol';
import type { SeatLimits } from 'protocol';
import { errorMsg } from '../auth/auth.service';
import { TMsgPipe, type Msg } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { RoomsService } from './rooms.service';

export interface CreateRoomDialogData {
  seatLimits: SeatLimits;
  displayName: string;
}

// Your name, the seat count and the table rules for a new open room. Closes
// with the new room's id.
@Component({
  selector: 'app-create-room-dialog',
  imports: [DeckPicker, MatDialogModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, TPipe, TMsgPipe],
  template: `
    <h2 mat-dialog-title>{{ 'rooms.create' | t }}</h2>
    <mat-dialog-content>
      <form id="create-room-form" (submit)="$event.preventDefault(); submit()">
        <mat-form-field appearance="outline" class="name-field">
          <mat-label>{{ 'auth.yourName' | t }}</mat-label>
          <input matInput class="name" autocomplete="nickname" [maxLength]="nameMax" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
        </mat-form-field>
        <div class="field">
          <span class="label" id="create-room-seats">{{ 'setup.seats' | t }}</span>
          <mat-button-toggle-group
            class="seats"
            aria-labelledby="create-room-seats"
            [hideSingleSelectionIndicator]="true"
            [value]="seatCount()"
            (change)="seatCount.set($event.value)"
          >
            @for (n of seatOptions; track n) {
              <mat-button-toggle [value]="n">{{ n }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
        </div>
        <app-deck-picker [(value)]="deck" />
        @if (seatCount() >= firstRevealMinSeats) {
          <mat-checkbox class="first-reveal" [checked]="firstRevealDraw()" (change)="firstRevealDraw.set($event.checked)">{{ 'setup.firstReveal' | t }}</mat-checkbox>
          <p class="hint">{{ 'setup.firstReveal.hint' | t }}</p>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() | tm }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'ui.cancel' | t }}</button>
      <button mat-flat-button type="submit" class="submit" form="create-room-form" [disabled]="busy() || !canSubmit()">{{ 'rooms.create' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .name-field { width: 100%; }
    .field { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
    .label { font: var(--mat-sys-title-small); }
    .hint { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
    .error { margin: 0 0 12px; color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
  `,
})
export class CreateRoomDialog {
  protected readonly data = inject<CreateRoomDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CreateRoomDialog, string>>(MatDialogRef);
  private readonly rooms = inject(RoomsService);
  protected readonly nameMax = DISPLAY_NAME_MAX;
  protected readonly firstRevealMinSeats = FIRST_REVEAL_MIN_SEATS;
  protected readonly seatOptions = Array.from({ length: this.data.seatLimits.max - this.data.seatLimits.min + 1 }, (_, i) => this.data.seatLimits.min + i);

  readonly displayName = signal(this.data.displayName);
  readonly seatCount = signal(Math.min(Math.max(4, this.data.seatLimits.min), this.data.seatLimits.max));
  readonly firstRevealDraw = signal(true);
  readonly deck = signal<DeckId>('default');
  readonly error = signal<Msg | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.displayName().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    const seatCount = this.seatCount();
    try {
      const id = await this.rooms.create({
        seatCount,
        rules: {
          ...(this.deck() !== 'default' ? { deck: this.deck() } : {}),
          ...(seatCount >= FIRST_REVEAL_MIN_SEATS ? { firstRevealDraw: this.firstRevealDraw() } : {}),
        },
        displayName: this.displayName(),
      });
      this.dialogRef.close(id);
    } catch (err) {
      this.error.set(errorMsg(err));
    } finally {
      this.busy.set(false);
    }
  }
}
