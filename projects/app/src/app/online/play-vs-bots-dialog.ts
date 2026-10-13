import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import { ERROR_MESSAGES } from 'protocol';
import type { SeatLimits } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { RoomsService } from './rooms.service';

export interface PlayVsBotsDialogData {
  seatLimits: SeatLimits;
  // Your running game against bots, if there is one.
  existingRoomId: string | null;
}

// The seat count and table rules for a game against bots, played on the
// server. With one already running, it offers that game first. Closes with
// the room to open.
@Component({
  selector: 'app-play-vs-bots-dialog',
  imports: [MatDialogModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule],
  template: `
    <h2 mat-dialog-title>Play vs Bots</h2>
    <mat-dialog-content>
      @if (offerResume()) {
        <p class="in-progress">You have a game against bots in progress</p>
      } @else {
        <form id="play-vs-bots-form" (submit)="$event.preventDefault(); submit()">
          <div class="field">
            <span class="label" id="play-vs-bots-seats">Seats</span>
            <mat-button-toggle-group
              class="seats"
              aria-labelledby="play-vs-bots-seats"
              [hideSingleSelectionIndicator]="true"
              [value]="seatCount()"
              (change)="seatCount.set($event.value)"
            >
              @for (n of seatOptions; track n) {
                <mat-button-toggle [value]="n">{{ n }}</mat-button-toggle>
              }
            </mat-button-toggle-group>
          </div>
          @if (seatCount() >= firstRevealMinSeats) {
            <mat-checkbox class="first-reveal" [checked]="firstRevealDraw()" (change)="firstRevealDraw.set($event.checked)">First Reveal Bonus</mat-checkbox>
            <p class="hint">The first seat to reveal a General draws 2 cards.</p>
          }
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
        </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      @if (offerResume()) {
        <button mat-stroked-button type="button" class="abandon" (click)="startingNew.set(true)">Abandon and Start New</button>
        <button mat-flat-button type="button" class="resume" (click)="resume()">Resume Game</button>
      } @else {
        <button mat-flat-button type="submit" class="submit" form="play-vs-bots-form" [disabled]="busy()">Start Game</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .field { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
    .label { font: var(--mat-sys-title-small); }
    .hint { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
    .error { margin: 0 0 12px; color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
  `,
})
export class PlayVsBotsDialog {
  protected readonly data = inject<PlayVsBotsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PlayVsBotsDialog, string>>(MatDialogRef);
  private readonly rooms = inject(RoomsService);
  protected readonly firstRevealMinSeats = FIRST_REVEAL_MIN_SEATS;
  protected readonly seatOptions = Array.from({ length: this.data.seatLimits.max - this.data.seatLimits.min + 1 }, (_, i) => this.data.seatLimits.min + i);

  readonly seatCount = signal(Math.min(Math.max(4, this.data.seatLimits.min), this.data.seatLimits.max));
  readonly firstRevealDraw = signal(true);
  readonly startingNew = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly offerResume = () => this.data.existingRoomId !== null && !this.startingNew();

  resume(): void {
    if (this.data.existingRoomId) this.dialogRef.close(this.data.existingRoomId);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const seatCount = this.seatCount();
    try {
      const id = await this.rooms.createSolo({
        seatCount,
        rules: seatCount >= FIRST_REVEAL_MIN_SEATS ? { firstRevealDraw: this.firstRevealDraw() } : {},
        ...(this.data.existingRoomId ? { replace: true } : {}),
      });
      this.dialogRef.close(id);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
