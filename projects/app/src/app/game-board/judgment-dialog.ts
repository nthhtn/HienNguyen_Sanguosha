import { Component, Signal, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import type { Action } from 'engine';
import { TPipe } from '../i18n/t.pipe';
import { DecisionCountdown } from './decision-countdown';
import { JudgmentDecisionView } from './judgment-decision';
import { JudgmentDescription } from './judgment-description';
import { JudgmentStage } from './judgment-stage';
import { MinimizeButton } from './minimize-button';

export interface JudgmentDialogData {
  // Read live: a replacement, or a language switch, updates the open popup.
  description: Signal<JudgmentDescription | null>;
  // Whether this viewer may close it once settled (someone other than a bot acts on it).
  canClose: Signal<boolean>;
  // Closes the settled judgment (the game then goes on).
  close: () => void;
  // The skill decision the judgment waits on, as this viewer sees it, and what the board does with it.
  decision?: Signal<JudgmentDecisionView | null>;
  // Submits the engine's own action the viewer picked.
  choose?: (action: Action) => void;
  // Told the filled selection whenever enough are picked, so a timeout can use it.
  pickedChanged?: (action: Action) => void;
  // Pass and Play: shows the view of the seat whose player took the device.
  reveal?: (seatId: string) => void;
}

// A judgment, for every seat at the table to see, as a fixed sequence (JudgmentStage): what required it,
// the rule, the card and each replacement of it, a check or cross, and what it does. Continue unlocks when
// the sequence ends; once no skill can change the card the 3 s countdown closes it, or Continue does.
// Informational: it asks nothing of the player. Themed in a force colour by its panel class (openForceDialog).
@Component({
  selector: 'app-judgment-dialog',
  imports: [MatDialogModule, MatButtonModule, JudgmentStage, DecisionCountdown, MinimizeButton, TPipe],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ 'judgment.title' | t }}</h2>
      <app-minimize-button />
    </div>
    @if (data.description(); as d) {
      <mat-dialog-content class="body">
        <app-judgment-stage
          [description]="d"
          [decision]="data.decision?.() ?? null"
          [pickedChanged]="data.pickedChanged"
          (unlocked)="unlocked.set(true)"
          (chosen)="data.choose?.($event)"
          (revealed)="data.reveal?.($event)"
        />
      </mat-dialog-content>
      @if (d.settled) {
        <app-decision-countdown class="timer" />
        <mat-dialog-actions align="end">
          @if (data.canClose()) {
            <button mat-flat-button type="button" class="close" [disabled]="!unlocked()" (click)="data.close()">{{ 'judgment.continue' | t }}</button>
          }
        </mat-dialog-actions>
      }
    }
  `,
  styles: `
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class JudgmentDialog {
  protected readonly data = inject<JudgmentDialogData>(MAT_DIALOG_DATA);
  // The sequence has played out.
  protected readonly unlocked = signal(false);
}
