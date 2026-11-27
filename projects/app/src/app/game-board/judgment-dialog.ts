import { Component, Signal, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import type { Action } from 'engine';
import { TPipe } from '../i18n/t.pipe';
import { Layout } from '../layout.service';
import { anchor } from '../tutorial/anchors';
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
  // The stage has played the card and the outcome. The board may close after this, not before.
  done?: () => void;
  // The notice countdown. False while this popup is finishing a sequence the table has already left,
  // so a later decision's clock is not shown on it.
  showCountdown?: Signal<boolean>;
}

// A judgment, for every seat at the table to see, as a fixed sequence (JudgmentStage): what required it,
// the rule, the card and each replacement of it, a check or cross, and what it does. Once no skill can
// change the card the 3 s countdown closes it; there is no way to skip it. A chain of judgments (Goddess Luo's) keeps
// this one popup across them, with its cards set aside in view, and waits 5 s at its end.
// Informational: it asks nothing of the player. Themed in a force colour by its panel class (openForceDialog).
@Component({
  selector: 'app-judgment-dialog',
  imports: [MatDialogModule, JudgmentStage, DecisionCountdown, MinimizeButton, TPipe],
  // A flex column, so the host has a box the Tutorial's spotlight can cut a hole around, and on a short
  // screen the body can shrink and scroll under the title (display:contents, Material's default, has no box).
  host: { 'data-tutorial': anchor.judgmentDialog(), style: 'display: flex; flex-direction: column; min-height: 0' },
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ 'judgment.title' | t }}</h2>
      @if (compact() && counting()) {
        <app-decision-countdown class="header-timer" />
      }
      <app-minimize-button />
    </div>
    @if (data.description(); as d) {
      <mat-dialog-content class="body">
        <!-- One stage per judgment: a chain's next judgment plays its sequence afresh in the same popup. -->
        @for (key of [d.key]; track key) {
          <app-judgment-stage
            [description]="d"
            [decision]="data.decision?.() ?? null"
            [instant]="data.resumed ?? false"
            (chosen)="data.choose?.($event)"
            (revealed)="data.reveal?.($event)"
            (unlocked)="data.done?.()"
          />
        }
      </mat-dialog-content>
      @if (d.settled && !d.continuing && counting()) {
        <app-decision-countdown class="timer" />
      }
    }
  `,
  styles: `
    .timer { display: block; padding: 8px 24px 0; }
    /* Phone board: the window stays inside a short landscape screen and the body scrolls, so the title
       stays put and a choice below the fold can still be reached. The height cap is the shared one in
       styles.scss (24 px of margin above and below). */
    :host-context([data-layout='compact']) .title-row { flex: none; }
    :host-context([data-layout='compact']) .title-row h2 { flex: none; }
    :host-context([data-layout='compact']) .title-row h2::before { height: 0; }
    :host-context([data-layout='compact']) .title-row app-minimize-button { flex: none; }
    :host-context([data-layout='compact']) mat-dialog-content {
      flex: 1 1 auto; min-height: 0; overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain;
    }
    /* The clock moves into the title row; the footer copy would be a second one. */
    :host-context([data-layout='compact']) .timer { display: none; }
  `,
})
export class JudgmentDialog {
  protected readonly data = inject<JudgmentDialogData>(MAT_DIALOG_DATA);
  private readonly layout = inject(Layout);
  protected readonly compact = computed(() => this.layout.kind() === 'compact');
  // The notice clock. A sequence the table has already left keeps playing without the next decision's clock.
  protected readonly counting = computed(() => this.data.showCountdown?.() ?? true);
}
