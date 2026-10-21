import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import type { DeckId } from 'content';
import { DeckPicker } from '../deck-picker';
import type { SeatLimits } from 'protocol';
import { ApiError, errorMsg } from '../auth/auth.service';
import { TMsgPipe, type Msg } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
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
  imports: [DeckPicker, MatDialogModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, TPipe, TMsgPipe],
  template: `
    <h2 mat-dialog-title>{{ 'setup.mode.bots' | t }}</h2>
    <mat-dialog-content>
      @if (offerResume()) {
        <p class="in-progress">{{ 'rooms.inProgress' | t }}</p>
      } @else {
        <form id="play-vs-bots-form" (submit)="$event.preventDefault(); submit()">
          <div class="field">
            <span class="label" id="play-vs-bots-seats">{{ 'setup.seats' | t }}</span>
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
          <app-deck-picker [(value)]="deck" />
          @if (seatCount() >= firstRevealMinSeats) {
            <mat-checkbox class="first-reveal" [checked]="firstRevealDraw()" (change)="firstRevealDraw.set($event.checked)">{{ 'setup.firstReveal' | t }}</mat-checkbox>
            <p class="hint">{{ 'setup.firstReveal.hint' | t }}</p>
          }
          @if (error()) {
            <p class="error" role="alert">{{ error() | tm }}</p>
          }
        </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'ui.cancel' | t }}</button>
      @if (offerResume()) {
        <button mat-stroked-button type="button" class="abandon" (click)="startingNew.set(true)">{{ 'rooms.abandon' | t }}</button>
        <button mat-flat-button type="button" class="resume" (click)="resume()">{{ 'rooms.resume' | t }}</button>
      } @else {
        <button mat-flat-button type="submit" class="submit" form="play-vs-bots-form" [disabled]="busy()">{{ 'setup.start' | t }}</button>
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
  readonly deck = signal<DeckId>('default');
  readonly startingNew = signal(false);
  readonly error = signal<Msg | null>(null);
  readonly busy = signal(false);
  // Your running game against bots: from the data, or found after Start Game
  // learns of one the room list didn't show yet.
  readonly existingRoomId = signal(this.data.existingRoomId);
  protected readonly offerResume = () => this.existingRoomId() !== null && !this.startingNew();

  resume(): void {
    const id = this.existingRoomId();
    if (id) this.dialogRef.close(id);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const seatCount = this.seatCount();
    try {
      const id = await this.rooms.createSolo({
        seatCount,
        rules: {
          ...(this.deck() !== 'default' ? { deck: this.deck() } : {}),
          ...(seatCount >= FIRST_REVEAL_MIN_SEATS ? { firstRevealDraw: this.firstRevealDraw() } : {}),
        },
        ...(this.existingRoomId() ? { replace: true } : {}),
      });
      this.dialogRef.close(id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'solo_exists' && (await this.findRunning())) return;
      this.error.set(errorMsg(err));
    } finally {
      this.busy.set(false);
    }
  }

  // Offers your running game against bots, if the room list now shows one.
  private async findRunning(): Promise<boolean> {
    await this.rooms.refresh();
    const running = this.rooms.list()?.rooms.find((room) => room.visibility === 'solo' && room.youAreMember && room.status === 'playing');
    if (!running) return false;
    this.existingRoomId.set(running.id);
    this.startingNew.set(false);
    return true;
  }
}
