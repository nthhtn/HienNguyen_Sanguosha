import { Component, Signal, inject } from '@angular/core';
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
  // The skill decision the judgment waits on, as this viewer sees it, and what the board does with it.
  decision?: Signal<JudgmentDecisionView | null>;
  // Submits the engine's own action the viewer picked.
  choose?: (action: Action) => void;
  // The popup is being rebuilt part-way (the language changed while it was minimized): no replay.
  resumed?: boolean;
  // Pass and Play: shows the view of the seat whose player took the device.
  reveal?: (seatId: string) => void;
}

// A judgment, for every seat at the table to see, as a fixed sequence (JudgmentStage): what required it,
// the rule, the card and each replacement of it, a check or cross, and what it does. Once no skill can
// change the card the 5 s countdown closes it; there is no way to skip it.
// Informational: it asks nothing of the player. Themed in a force colour by its panel class (openForceDialog).
@Component({
  selector: 'app-judgment-dialog',
  imports: [MatDialogModule, JudgmentStage, DecisionCountdown, MinimizeButton, TPipe],
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
          [instant]="data.resumed ?? false"
          (chosen)="data.choose?.($event)"
          (revealed)="data.reveal?.($event)"
        />
      </mat-dialog-content>
      @if (d.settled) {
        <app-decision-countdown class="timer" />
      }
    }
  `,
  styles: `
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class JudgmentDialog {
  protected readonly data = inject<JudgmentDialogData>(MAT_DIALOG_DATA);
}
