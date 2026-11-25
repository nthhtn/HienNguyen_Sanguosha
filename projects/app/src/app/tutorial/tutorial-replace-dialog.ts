import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TPipe } from '../i18n/t.pipe';

// Asked before a lesson replaces the game in progress on this device, which is not restored afterwards. Closes with
// `true` to start the lesson and with `false` (or nothing) to keep the game.
@Component({
  selector: 'app-tutorial-replace-dialog',
  imports: [MatDialogModule, MatButtonModule, TPipe],
  template: `
    <h2 mat-dialog-title>{{ 'tutorial.replaceTitle' | t }}</h2>
    <mat-dialog-content>
      <p>{{ 'tutorial.replaceWarning' | t }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" class="cancel" [mat-dialog-close]="false">{{ 'ui.cancel' | t }}</button>
      <button mat-flat-button type="button" class="confirm" [mat-dialog-close]="true">{{ 'tutorial.start' | t }}</button>
    </mat-dialog-actions>
  `,
})
export class TutorialReplaceDialog {}
