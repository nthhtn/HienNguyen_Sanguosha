import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DISPLAY_NAME_MAX } from 'protocol';
import { errorMsg } from '../auth/auth.service';
import { TMsgPipe, type Msg } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { RoomsService } from './rooms.service';

export interface JoinRoomDialogData {
  roomId: string;
  hostName: string | null;
  displayName: string;
}

// Asks only for the name to use in this room. A refused name keeps the dialog
// open with the server's message; on success it closes with true.
@Component({
  selector: 'app-join-room-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, TPipe, TMsgPipe],
  template: `
    <h2 mat-dialog-title>{{ 'rooms.joinTitle' | t }}</h2>
    <mat-dialog-content>
      @if (data.hostName) {
        <p class="hosted-by">{{ 'rooms.hostedBy' | t: { name: data.hostName } }}</p>
      }
      <form id="join-room-form" (submit)="$event.preventDefault(); submit()">
        <mat-form-field appearance="outline" class="name-field">
          <mat-label>{{ 'auth.yourName' | t }}</mat-label>
          <input matInput class="name" autocomplete="nickname" [maxLength]="nameMax" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
        </mat-form-field>
        @if (error()) {
          <p class="error" role="alert">{{ error() | tm }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'ui.cancel' | t }}</button>
      <button mat-flat-button type="submit" class="submit" form="join-room-form" [disabled]="busy() || !canSubmit()">{{ 'rooms.join' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .name-field { width: 100%; }
    .hosted-by { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); }
    .error { margin: 0 0 12px; color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
  `,
})
export class JoinRoomDialog {
  protected readonly data = inject<JoinRoomDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<JoinRoomDialog, boolean>>(MatDialogRef);
  private readonly rooms = inject(RoomsService);
  protected readonly nameMax = DISPLAY_NAME_MAX;

  readonly displayName = signal(this.data.displayName);
  readonly error = signal<Msg | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.displayName().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.rooms.join(this.data.roomId, this.displayName());
      this.dialogRef.close(true);
    } catch (err) {
      this.error.set(errorMsg(err));
    } finally {
      this.busy.set(false);
    }
  }
}
