import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import type { GameState } from 'engine';
import { CARD_BACK_ART_URL, NoticeText, ResolutionNoticeContent } from 'content';
import { abilityDisplayName, cardIdDisplayName, generalDisplayName, seatForce, seatName } from '../labels';
import type { Force } from '../labels';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TPipe } from '../i18n/t.pipe';
import { CardArt } from './card-art';
import { PlayingCard } from './playing-card';
import { SeatPortrait } from './seat-portrait';

// Seconds a notice stays before it closes itself. There is no button and no skip.
export const NOTICE_SECONDS = 5;

export interface ResolutionNoticeDialogData {
  content: ResolutionNoticeContent;
  // The public state: names, Generals, force and HP are read from it.
  state: GameState;
}

// The force the popup is themed in (openForceDialog): the seat that caused the resolution.
export function noticeForce(content: ResolutionNoticeContent, state: GameState): Force {
  const seatId = content.source.kind === 'skill' ? content.source.seatId : content.seatIds[0];
  return seatForce(state.seats.find((s) => s.id === seatId));
}

// A Resolution Notice, laid out like the Compete and Judgment popups: the source (a card, or a General's
// skill), the seats involved side by side, what happened step by step, the cards that matter, then the
// outcome, with the countdown to closing itself at the foot. Informational: it asks nothing of the player.
// Everything on it comes from the content the registry described and the public state; its frame is the
// source seat's force (openForceDialog).
@Component({
  selector: 'app-resolution-notice-dialog',
  imports: [MatDialogModule, CardArt, PlayingCard, SeatPortrait, TPipe],
  template: `
    <h2 mat-dialog-title>{{ 'notice.title' | t }}</h2>
    <mat-dialog-content class="body">
      <section class="source">
        @if (sourceArt(); as art) {
          <app-card-art [cropped]="art.cropped" [skin]="!art.cropped" [id]="art.id" [label]="sourceTitle()" size="small" />
        }
        <div class="words">
          <div class="who">{{ sourceTitle() }}</div>
        </div>
      </section>

      <section class="actors">
        @for (actor of actors(); track actor.id) {
          <div class="side" [attr.data-force]="actor.force">
            <app-seat-portrait [generals]="actor.generals" />
            <span class="name">{{ actor.name }}</span>
          </div>
        }
      </section>

      @if (steps().length) {
        <ul class="steps rise">
          @for (step of steps(); track $index) {
            <li>{{ step }}</li>
          }
        </ul>
      }
      @if (data.content.cards.length) {
        <div class="cards rise">
          @for (c of data.content.cards; track $index) {
            @if (c.card; as card) {
              <app-playing-card [card]="card" size="small" />
            } @else {
              <img class="card-back" [src]="cardBackUrl" alt="" />
            }
          }
        </div>
      }

      <section class="outcome later" [attr.data-tone]="data.content.outcome.tone">
        <span class="symbol" aria-hidden="true">{{ data.content.outcome.symbol }}</span>
        <div class="words">
          <span class="label headline">{{ headline() }}</span>
          <p class="text">{{ text() }}</p>
        </div>
        @if (hp(); as hp) {
          <div class="hp">
            <span>{{ hp.name }}</span>
            <span class="hearts" aria-hidden="true">
              @for (n of hp.hearts; track n) {
                <span class="heart" [class.lost]="n >= hp.current">♥</span>
              }
            </span>
          </div>
        }
      </section>
    </mat-dialog-content>
    <div class="timer" role="timer" [attr.aria-label]="'countdown.aria' | t: { n: seconds() }">
      <span class="seconds">{{ seconds() }}s</span>
      <span class="bar"><span class="fill" [style.width.%]="(seconds() / total) * 100"></span></span>
    </div>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 16px; --good: #1c8a4b; }
    .source { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--force) 12%, transparent); }
    .who { font: var(--mat-sys-title-medium); color: var(--force-text); }
    .actors { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .side { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 14px; min-width: 0; border-radius: 14px; border: 2px solid transparent; background: var(--mat-sys-surface-container-low); }
    .side[data-force='Wei'] { --force: var(--force-wei); --force-text: var(--force-wei); }
    .side[data-force='Shu'] { --force: var(--force-shu); --force-text: var(--force-shu); }
    .side[data-force='Wu'] { --force: var(--force-wu); --force-text: var(--force-wu); }
    .side[data-force='Qun'] { --force: var(--force-qun); --force-text: var(--force-qun); }
    .side[data-force='Ambitionist'] { --force: var(--force-ambitionist); --force-text: var(--force-ambitionist); }
    .name { font: var(--mat-sys-title-small); color: var(--force-text, inherit); max-width: 140px; overflow-wrap: anywhere; text-align: center; }
    .steps { margin: 0; padding-left: 20px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .card-back { width: 44px; height: 60px; object-fit: cover; border-radius: 6px; }
    .outcome { --tone: var(--force); display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border-left: 4px solid var(--tone); background: color-mix(in srgb, var(--tone) 10%, transparent); }
    .outcome[data-tone='good'] { --tone: var(--good); }
    .outcome[data-tone='bad'] { --tone: var(--mat-sys-error); }
    .symbol { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: var(--tone); color: #fff; font-weight: 700; }
    .outcome .words { min-width: 0; }
    .outcome .label { font: var(--mat-sys-label-large); color: var(--tone); }
    .outcome .text { margin: 2px 0 0; font: var(--mat-sys-body-large); }
    .hp { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); white-space: nowrap; }
    .heart { color: var(--mat-sys-error); }
    .heart.lost { color: var(--mat-sys-outline-variant); }
    .rise { animation: rise 0.35s 0.3s both; }
    .later { animation: rise 0.35s 0.8s both; }
    @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
    .timer { display: flex; align-items: center; gap: 8px; padding: 8px 24px 16px; font: var(--mat-sys-label-large); color: var(--force-text); }
    .seconds { min-width: 3ch; font-variant-numeric: tabular-nums; }
    .bar { flex: 1; height: 6px; border-radius: 3px; background: var(--mat-sys-surface-container-highest); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--force); transition: width 1s linear; }
    @media (prefers-reduced-motion: reduce) { .rise, .later { animation: none; } .fill { transition-duration: 0s; } }
  `,
})
export class ResolutionNoticeDialog {
  protected readonly data = inject<ResolutionNoticeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ResolutionNoticeDialog>>(MatDialogRef);
  private readonly i18n = inject(I18n);
  protected readonly cardBackUrl = CARD_BACK_ART_URL;
  protected readonly total = NOTICE_SECONDS;
  protected readonly seconds = signal(NOTICE_SECONDS);

  constructor() {
    const interval = setInterval(() => {
      this.seconds.update((s) => s - 1);
      if (this.seconds() <= 0) {
        clearInterval(interval);
        this.dialogRef.close();
      }
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(interval));
  }

  // A param named `…Seat` holds a seat id, one named `card` or `…Card` a card id and `skill` a skill id: each is shown by name.
  private line(t: NoticeText): string {
    const tr = this.i18n.translator;
    const params = Object.fromEntries(
      Object.entries(t.params ?? {}).map(([name, value]) => [
        name,
        /Seat$/.test(name)
          ? seatName(this.data.state.players, String(value), tr)
          : name === 'card' || /Card$/.test(name)
            ? cardIdDisplayName(String(value), tr)
            : name === 'skill'
              ? abilityDisplayName(String(value), tr)
              : value,
      ])
    );
    return tr(t.key as MessageKey, params);
  }

  protected readonly headline = computed(() => this.line(this.data.content.outcome.headline));
  protected readonly text = computed(() => this.line(this.data.content.outcome.text));
  protected readonly steps = computed(() => this.data.content.steps.map((s) => this.line(s)));

  private readonly sourceGeneral = computed(() => {
    const source = this.data.content.source;
    if (source.kind !== 'skill') return null;
    const id = this.data.state.seats.find((s) => s.id === source.seatId)?.generals?.main.generalDefinitionId;
    return id && id !== 'hidden' ? id : null;
  });

  protected readonly sourceTitle = computed(() => {
    const source = this.data.content.source;
    const tr = this.i18n.translator;
    if (source.kind === 'card') return cardIdDisplayName(source.id, tr);
    const general = this.sourceGeneral();
    return general ? `${generalDisplayName(general, tr)} · ${abilityDisplayName(source.id, tr)}` : abilityDisplayName(source.id, tr);
  });

  // A card's art, or the skill owner's General skin.
  protected readonly sourceArt = computed<{ id: string; cropped: boolean } | null>(() => {
    const source = this.data.content.source;
    if (source.kind === 'card') return { id: source.id, cropped: true };
    const general = this.sourceGeneral();
    return general ? { id: general, cropped: false } : null;
  });

  protected readonly actors = computed(() =>
    this.data.content.seatIds.map((id) => {
      const seat = this.data.state.seats.find((s) => s.id === id);
      return { id, name: seatName(this.data.state.players, id, this.i18n.translator), generals: seat?.generals ?? null, force: seatForce(seat) };
    })
  );

  protected readonly hp = computed(() => {
    const change = this.data.content.outcome.hp;
    const seat = change ? this.data.state.seats.find((s) => s.id === change.seatId) : undefined;
    if (!change || !seat) return null;
    return { name: seatName(this.data.state.players, change.seatId, this.i18n.translator), current: seat.combinedHp, hearts: Array.from({ length: seat.maxCombinedHp }, (_, n) => n) };
  });
}
