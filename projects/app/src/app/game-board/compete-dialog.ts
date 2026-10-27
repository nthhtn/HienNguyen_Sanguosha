import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { cardFaceLabel } from '../labels';
import { Beat, playBeats } from './beat-player';
import { CardArt } from './card-art';
import { CompeteResult } from './compete-result';
import { PlayingCard } from './playing-card';
import { TPipe } from '../i18n/t.pipe';
import { I18n } from '../i18n/i18n.service';

// Seconds the popup stays once its sequence has played, before it closes itself, so a Compete between
// bots never stalls the table.
export const AUTO_CLOSE_SECONDS = 5;

// The fixed beats of a Compete, in ms from the popup opening (spec: Compete sequence).
const CARDS_DOWN_AT = 800;
const CARDS_UP_AT = 1500;
const RESULT_AT = 2500;
const OUTCOME_AT = 3400;
const UNLOCK_AT = 4200;

// The result of one Compete, for every seat at the table to see, as a fixed sequence: the source skill,
// both players facing each other, both cards turning together, the winner lit and the loser dimmed, then
// what it leads to. Each side wears its own player's Force; the popup's frame is the source General's
// (openForceDialog). Informational: it asks nothing of the player.
@Component({
  selector: 'app-compete-dialog',
  imports: [MatDialogModule, MatIconModule, CardArt, PlayingCard, TPipe],
  template: `
    <h2 mat-dialog-title>{{ 'compete.title' | t }}</h2>
    <mat-dialog-content class="body">
      <section class="source">
        @if (data.generalId; as generalId) {
          <app-card-art [skin]="true" [id]="generalId" [label]="data.generalName" size="small" />
        }
        <div class="words">
          <div class="who"><strong>{{ data.generalName }}</strong> · {{ data.abilityName }}</div>
          @if (data.skillText; as text) {
            <p class="skill-text">{{ text }}</p>
          }
        </div>
      </section>

      <section class="versus" [attr.aria-label]="'compete.players' | t">
        @for (side of sides(); track side.player.seatId; let i = $index) {
          <div class="side" [class.left]="i === 0" [class.right]="i === 1" [class.in]="playersIn()" [class.win]="resultShown() && side.winner" [class.lose]="resultShown() && !side.winner" [attr.data-force]="side.player.force">
            <span class="tag"><mat-icon>emoji_events</mat-icon> {{ 'compete.winner' | t }}</span>
            <div class="player">
              @if (side.player.generalId; as generalId) {
                <app-card-art [skin]="true" [id]="generalId" [label]="side.player.name" size="tiny" />
              }
              <span class="name">{{ side.player.name }}</span>
            </div>
            <div class="slot">
              <div class="pc" [class.in]="cardsDown()" [class.up]="cardsUp()">
                <div class="inner">
                  <div class="back"></div>
                  <div class="face"><app-playing-card [card]="side.player.card" size="normal" /></div>
                </div>
              </div>
            </div>
          </div>
          @if (i === 0) {
            <span class="vs" [class.in]="playersIn()" aria-hidden="true">{{ 'compete.vs' | t }}</span>
          }
        }
      </section>

      <p class="cmp" [class.in]="resultShown()">{{ comparisonText() }}</p>
      <!-- The result in words, for screen readers: the cards turn too fast to be read off the table. -->
      <p class="result">{{ resultText() }}</p>
      @if (data.outcome; as outcome) {
        <section class="outcome rise" [class.in]="outcomeShown()">
          <span class="label">{{ 'compete.outcome' | t }}</span>
          <p>{{ outcome }}</p>
        </section>
      }
    </mat-dialog-content>
    @if (unlocked()) {
      <div class="timer" role="timer" [attr.aria-label]="'countdown.aria' | t: { n: seconds() }">
        <span class="seconds">{{ seconds() }}s</span>
        <span class="bar"><span class="fill" [style.width.%]="(seconds() / total) * 100"></span></span>
      </div>
    }
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 16px; }
    .source { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--force) 12%, transparent); }
    .who { font: var(--mat-sys-title-medium); color: var(--force-text); }
    .skill-text { margin: 4px 0 0; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .versus { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .vs { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--mat-sys-on-surface); color: var(--mat-sys-surface); font: var(--mat-sys-title-small); font-weight: 700; transform: scale(0); transition: transform 0.45s cubic-bezier(0.3, 1.8, 0.5, 1); }
    .vs.in { transform: scale(1); }
    .side {
      position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 14px 14px; border-radius: 14px; border: 2px solid transparent;
      background: var(--mat-sys-surface-container-low); opacity: 0;
      transition: transform 0.5s cubic-bezier(0.3, 1.4, 0.5, 1), opacity 0.4s, filter 0.4s, background 0.4s, border-color 0.4s, box-shadow 0.5s;
    }
    .side.left { transform: translateX(-40px); }
    .side.right { transform: translateX(40px); }
    .side.in { opacity: 1; transform: none; }
    .side.win { transform: scale(1.05); background: color-mix(in srgb, var(--force) 14%, var(--mat-sys-surface-container-low)); border-color: var(--force); box-shadow: 0 0 22px color-mix(in srgb, var(--force) 45%, transparent); }
    .side.lose { opacity: 0.5; filter: grayscale(0.8); transform: scale(0.95) rotate(-3deg); }
    .side.right.lose { transform: scale(0.95) rotate(3deg); }
    .tag { position: absolute; top: -12px; left: 50%; transform: translate(-50%, 6px); display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; background: var(--force); color: #fff; font: var(--mat-sys-label-medium); white-space: nowrap; opacity: 0; transition: opacity 0.35s, transform 0.35s; }
    .tag mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .side.win .tag { opacity: 1; transform: translate(-50%, 0); }
    .player { display: flex; align-items: center; gap: 8px; }
    .name { font: var(--mat-sys-title-small); color: var(--force-text); }
    .slot { position: relative; width: 70px; height: 96px; }
    .pc { position: absolute; inset: 0; perspective: 600px; opacity: 0; transform: translateY(-14px); transition: opacity 0.3s, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .pc.in { opacity: 1; transform: none; }
    .inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.2, 1); transform: rotateY(180deg); }
    .pc.up .inner { transform: none; }
    .back, .face { position: absolute; inset: 0; border-radius: 6px; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
    .back { transform: rotateY(180deg); background: repeating-linear-gradient(45deg, var(--force) 0 6px, color-mix(in srgb, var(--force) 70%, #000) 6px 12px); border: 3px solid #fff; box-shadow: 0 0 0 1px var(--mat-sys-outline-variant); }
    .face { display: grid; place-items: center; }
    .cmp { margin: 0; min-height: 24px; text-align: center; font: var(--mat-sys-title-medium); opacity: 0; transition: opacity 0.3s; }
    .cmp.in { opacity: 1; }
    .result { position: absolute; width: 1px; height: 1px; margin: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .rise { opacity: 0; transform: translateY(8px); transition: opacity 0.35s, transform 0.35s; }
    .rise.in { opacity: 1; transform: none; }
    .outcome { padding: 12px; border-radius: 12px; border-left: 4px solid var(--force); background: color-mix(in srgb, var(--force) 10%, transparent); }
    .outcome .label { font: var(--mat-sys-label-large); color: var(--force-text); }
    .outcome p { margin: 4px 0 0; font: var(--mat-sys-body-large); }
    .timer { display: flex; align-items: center; gap: 8px; padding: 8px 24px 0; font: var(--mat-sys-label-large); color: var(--force-text); }
    .seconds { min-width: 3ch; font-variant-numeric: tabular-nums; }
    .bar { flex: 1; height: 6px; border-radius: 3px; background: var(--mat-sys-surface-container-highest); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--force); transition: width 1s linear; }
    @media (prefers-reduced-motion: reduce) {
      .vs, .side, .tag, .pc, .inner, .cmp, .rise, .fill { transition-duration: 0s !important; transition-delay: 0s !important; }
    }
  `,
})
export class CompeteDialog implements OnInit {
  protected readonly data = inject<CompeteResult>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CompeteDialog>>(MatDialogRef);
  private readonly i18n = inject(I18n);
  protected readonly total = AUTO_CLOSE_SECONDS;
  protected readonly seconds = signal(AUTO_CLOSE_SECONDS);

  protected readonly playersIn = signal(false);
  protected readonly cardsDown = signal(false);
  protected readonly cardsUp = signal(false);
  protected readonly resultShown = signal(false);
  protected readonly outcomeShown = signal(false);
  // The sequence has played out: the countdown to the popup closing itself runs.
  protected readonly unlocked = signal(false);

  private interval: ReturnType<typeof setInterval> | null = null;

  protected readonly sides = () => [
    { player: this.data.user, winner: this.data.won },
    { player: this.data.target, winner: !this.data.won },
  ];

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.playback?.stop();
      if (this.interval !== null) clearInterval(this.interval);
    });
  }

  private playback: { stop(): void } | null = null;

  ngOnInit(): void {
    const beats: Beat[] = [
      { at: 0, run: () => this.playersIn.set(true) },
      { at: CARDS_DOWN_AT, run: () => this.cardsDown.set(true) },
      { at: CARDS_UP_AT, run: () => this.cardsUp.set(true) },
      { at: RESULT_AT, run: () => this.resultShown.set(true) },
      { at: OUTCOME_AT, run: () => this.outcomeShown.set(true) },
      { at: UNLOCK_AT, run: () => this.unlock() },
    ];
    this.playback = playBeats(beats);
  }

  // The countdown to the popup closing itself starts.
  private unlock(): void {
    this.unlocked.set(true);
    this.interval = setInterval(() => {
      this.seconds.update((s) => s - 1);
      if (this.seconds() <= 0) this.close();
    }, 1000);
  }

  protected comparisonText(): string {
    const { comparison, user } = this.data;
    return comparison.tie
      ? this.i18n.t('compete.ties', { rank: comparison.winnerRank, user: user.name })
      : this.i18n.t('compete.beats', { winner: comparison.winnerRank, loser: comparison.loserRank });
  }

  protected resultText(): string {
    const { user, target, tie, winnerName } = this.data;
    const faces = this.i18n.t('compete.faces', { mine: cardFaceLabel(user.card), theirs: cardFaceLabel(target.card) });
    return tie ? this.i18n.t('compete.tied', { faces, winner: winnerName, user: user.name }) : this.i18n.t('compete.result', { faces, winner: winnerName });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
