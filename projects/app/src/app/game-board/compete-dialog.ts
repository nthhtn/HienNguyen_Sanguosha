import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { cardFaceLabel } from '../labels';
import { CardArt } from './card-art';
import { CompetePlayer, CompeteResult } from './compete-result';
import { PlayingCard } from './playing-card';

// Seconds before the popup closes itself, so a Compete between bots never stalls the table.
export const AUTO_CLOSE_SECONDS = 8;

// The result of one Compete, for every seat at the table to see: the source
// skill, both players and their cards, who won and what that leads to. Themed
// in the source General's Force colour by its panel class (openForceDialog).
@Component({
  selector: 'app-compete-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, CardArt, PlayingCard],
  template: `
    <h2 mat-dialog-title>Compete</h2>
    <mat-dialog-content class="body">
      <section class="source">
        @if (data.generalId; as generalId) {
          <app-card-art [id]="generalId" [label]="data.generalName" size="small" />
        }
        <div class="words">
          <div class="who"><strong>{{ data.generalName }}</strong> · {{ data.abilityName }}</div>
          @if (data.skillText; as text) {
            <p class="skill-text">{{ text }}</p>
          }
        </div>
      </section>

      <section class="versus" aria-label="Competing players">
        @for (side of sides(); track side.player.seatId; let i = $index) {
          <div class="side" [class.winner]="side.winner">
            @if (side.winner) {
              <span class="badge"><mat-icon>emoji_events</mat-icon> Winner</span>
            }
            <div class="player">
              @if (side.player.generalId; as generalId) {
                <app-card-art [id]="generalId" [label]="side.player.name" size="tiny" />
              }
              <span class="name">{{ side.player.name }}</span>
            </div>
            <app-playing-card [card]="side.player.card" size="normal" />
          </div>
          @if (i === 0) {
            <span class="vs" aria-hidden="true">vs</span>
          }
        }
      </section>

      <p class="result">{{ resultText() }}</p>
      @if (data.outcome; as outcome) {
        <section class="outcome">
          <span class="label">Outcome</span>
          <p>{{ outcome }}</p>
        </section>
      }
    </mat-dialog-content>
    <div class="timer" role="timer" [attr.aria-label]="seconds() + ' seconds left'">
      <span class="seconds">{{ seconds() }}s</span>
      <span class="bar"><span class="fill" [style.width.%]="(seconds() / total) * 100"></span></span>
    </div>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" class="continue" (click)="close()">Continue</button>
    </mat-dialog-actions>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 16px; }
    .source { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--force) 12%, transparent); }
    .who { font: var(--mat-sys-title-medium); color: var(--force-text); }
    .skill-text { margin: 4px 0 0; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .versus { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .vs { font: var(--mat-sys-title-large); color: var(--force-text); }
    .side { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 12px 12px; border-radius: 12px; border: 2px solid transparent; background: var(--mat-sys-surface-container-low); }
    .side.winner { border-color: var(--force); background: color-mix(in srgb, var(--force) 14%, var(--mat-sys-surface-container-low)); }
    .badge { position: absolute; top: -12px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 12px; background: var(--force-text); color: #fff; font: var(--mat-sys-label-medium); }
    .badge mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .player { display: flex; align-items: center; gap: 8px; }
    .name { font: var(--mat-sys-title-small); }
    .result { margin: 0; text-align: center; font: var(--mat-sys-title-medium); }
    .outcome { padding: 12px; border-radius: 12px; border-left: 4px solid var(--force); background: color-mix(in srgb, var(--force) 10%, transparent); }
    .outcome .label { font: var(--mat-sys-label-large); color: var(--force-text); }
    .outcome p { margin: 4px 0 0; font: var(--mat-sys-body-large); }
    .timer { display: flex; align-items: center; gap: 8px; padding: 8px 24px 0; font: var(--mat-sys-label-large); color: var(--force-text); }
    .seconds { min-width: 3ch; font-variant-numeric: tabular-nums; }
    .bar { flex: 1; height: 6px; border-radius: 3px; background: var(--mat-sys-surface-container-highest); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--force); transition: width 1s linear; }
  `,
})
export class CompeteDialog {
  protected readonly data = inject<CompeteResult>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CompeteDialog>>(MatDialogRef);
  protected readonly total = AUTO_CLOSE_SECONDS;
  protected readonly seconds = signal(AUTO_CLOSE_SECONDS);

  protected readonly sides = () => [
    { player: this.data.user, winner: this.data.won },
    { player: this.data.target, winner: !this.data.won },
  ] satisfies { player: CompetePlayer; winner: boolean }[];

  constructor() {
    const interval = setInterval(() => {
      this.seconds.update((s) => s - 1);
      if (this.seconds() <= 0) this.close();
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(interval));
  }

  protected resultText(): string {
    const { user, target, tie, winnerName } = this.data;
    const faces = `${cardFaceLabel(user.card)} against ${cardFaceLabel(target.card)}`;
    return tie ? `Tied: ${faces}. ${winnerName} won, as a tie counts as a loss for ${user.name}` : `${faces}, ${winnerName} won`;
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
