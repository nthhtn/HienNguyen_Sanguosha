import { Component, Signal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TPipe } from '../i18n/t.pipe';
import { CardArt } from './card-art';
import { DecisionCountdown } from './decision-countdown';
import { JudgmentDescription } from './judgment-description';
import { MinimizeButton } from './minimize-button';
import { PlayingCard } from './playing-card';

export interface JudgmentDialogData {
  // Read live: a replacement, or a language switch, updates the open popup.
  description: Signal<JudgmentDescription | null>;
  // Whether this viewer may close it once settled (someone other than a bot acts on it).
  canClose: Signal<boolean>;
  // Closes the settled judgment (the game then goes on).
  close: () => void;
}

// A judgment, for every seat at the table to see: what required it, the card (and each replacement of it),
// what it will do, and once no skill can change it, a countdown and Close. Informational: it asks
// nothing of the player. Themed in a force colour by its panel class (openForceDialog).
@Component({
  selector: 'app-judgment-dialog',
  imports: [MatDialogModule, MatButtonModule, CardArt, PlayingCard, DecisionCountdown, MinimizeButton, TPipe],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ 'judgment.title' | t }}</h2>
      <app-minimize-button />
    </div>
    @if (data.description(); as d) {
      <mat-dialog-content class="body">
        <section class="source">
          @if (d.source.kind === 'skill') {
            @if (d.source.generalId; as generalId) {
              <app-card-art [skin]="true" [id]="generalId" [label]="d.source.generalName" size="small" />
            }
            <div class="words">
              <div class="who"><strong>{{ d.source.generalName }}</strong> · {{ d.source.abilityName }}</div>
              @if (d.source.skillText; as text) {
                <p class="skill-text">{{ text }}</p>
              }
            </div>
          } @else {
            <div class="words">
              <div class="who">{{ 'judgment.source.card' | t: { card: d.source.cardName, seat: d.source.seatName } }}</div>
            </div>
          }
        </section>

        <section class="judged" [attr.aria-label]="'judgment.card' | t">
          <app-playing-card [card]="d.card" size="normal" />
          @if (d.changes.length > 0) {
            <ul class="changes">
              @for (change of d.changes; track $index) {
                <li class="change">{{ change.text }}</li>
              }
            </ul>
          }
        </section>

        @if (d.waiting; as waiting) {
          <p class="waiting">{{ waiting }}</p>
        }
        @if (d.outcome; as outcome) {
          <section class="outcome">
            <span class="label">{{ 'judgment.outcome' | t }}</span>
            <p>{{ outcome }}</p>
          </section>
        }
      </mat-dialog-content>
      @if (d.settled) {
        <app-decision-countdown class="timer" />
        <mat-dialog-actions align="end">
          @if (data.canClose()) {
            <button mat-flat-button type="button" class="close" (click)="data.close()">{{ 'ui.close' | t }}</button>
          }
        </mat-dialog-actions>
      }
    }
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 16px; }
    .source { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--force) 12%, transparent); }
    .who { font: var(--mat-sys-title-medium); color: var(--force-text); }
    .skill-text { margin: 4px 0 0; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .judged { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .changes { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .waiting { margin: 0; font: var(--mat-sys-body-large); color: var(--force-text); }
    .outcome { padding: 12px; border-radius: 12px; border-left: 4px solid var(--force); background: color-mix(in srgb, var(--force) 10%, transparent); }
    .outcome .label { font: var(--mat-sys-label-large); color: var(--force-text); }
    .outcome p { margin: 4px 0 0; font: var(--mat-sys-body-large); }
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class JudgmentDialog {
  protected readonly data = inject<JudgmentDialogData>(MAT_DIALOG_DATA);
}
