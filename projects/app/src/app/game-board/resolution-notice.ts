import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output } from '@angular/core';
import type { GameState } from 'engine';
import { CARD_BACK_ART_URL, NoticeText, ResolutionNoticeContent } from 'content';
import { abilityDisplayName, cardIdDisplayName, seatForce, seatName } from '../labels';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { CardArt } from './card-art';
import { PlayingCard } from './playing-card';
import { SeatPortrait } from './seat-portrait';

// How long a notice stays, blocking the table, before it has faded away.
export const NOTICE_MS = 5000;

// A Resolution Notice: what a card or skill did, shown to every seat, then gone on its own. It never
// is dismissed only by its own timer: no button, no skip. It is read-only: everything on it comes from the content
// the registry described and the public state.
@Component({
  selector: 'app-resolution-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardArt, PlayingCard, SeatPortrait],
  template: `
    <article class="notice" [attr.data-force]="force()" role="status">
      <header>
        <span class="title">{{ title() }}</span>
        <span class="source">
          @if (sourceArt(); as art) {
            <app-card-art [cropped]="art.cropped" [skin]="!art.cropped" [id]="art.id" [label]="sourceName()" size="tiny" />
          }
          {{ sourceName() }}
        </span>
      </header>
      <div class="body">
        <div class="actors">
          @for (actor of actors(); track actor.id) {
            <div class="actor">
              <app-seat-portrait [generals]="actor.generals" size="small" />
              <span class="name">{{ actor.name }}</span>
            </div>
          }
        </div>
        @if (steps().length) {
          <ul class="steps">
            @for (step of steps(); track $index) {
              <li>{{ step }}</li>
            }
          </ul>
        }
        @if (content().cards.length) {
          <div class="cards">
            @for (c of content().cards; track $index) {
              @if (c.card; as card) {
                <app-playing-card [card]="card" size="small" />
              } @else {
                <img class="card-back" [src]="cardBackUrl" alt="" />
              }
            }
          </div>
        }
        <div class="outcome" [attr.data-tone]="content().outcome.tone">
          <span class="symbol" aria-hidden="true">{{ content().outcome.symbol }}</span>
          <div class="words">
            <b class="headline">{{ headline() }}</b>
            <span class="text">{{ text() }}</span>
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
        </div>
      </div>
      <div class="bar"><i></i></div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .notice {
      --good: #1c8a4b; --bad: #c23a3a;
      width: min(92vw, 360px); max-height: 80vh; overflow: hidden; border-radius: 14px; border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-high); color: var(--mat-sys-on-surface); box-shadow: 0 8px 28px rgb(0 0 0 / 35%);
      animation: notice-fade ${NOTICE_MS}ms ease-in forwards;
    }
    header { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 14px; background: color-mix(in srgb, var(--force) 16%, transparent); }
    .title { font: var(--mat-sys-title-medium); color: var(--force-text); }
    .source { display: flex; align-items: center; gap: 6px; font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); text-align: right; }
    .body { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; }
    .actors { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; }
    .actor { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
    .name { font: var(--mat-sys-label-large); font-weight: 700; max-width: 110px; overflow-wrap: anywhere; text-align: center; }
    .steps { margin: 0; padding-left: 18px; font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
    .card-back { width: 44px; height: 60px; object-fit: cover; border-radius: 4px; }
    .outcome { --tone: var(--mat-sys-on-surface-variant); display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--tone) 50%, transparent); background: color-mix(in srgb, var(--tone) 12%, transparent); }
    .outcome[data-tone='good'] { --tone: var(--good); }
    .outcome[data-tone='bad'] { --tone: var(--bad); }
    .symbol { flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--tone); color: #fff; font-weight: 700; }
    .words { display: flex; flex-direction: column; min-width: 0; }
    .headline { color: var(--tone); }
    .text { font: var(--mat-sys-body-medium); }
    .hp { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); }
    .heart { color: var(--bad); }
    .heart.lost { color: var(--mat-sys-outline-variant); }
    .bar { height: 5px; background: var(--mat-sys-outline-variant); }
    .bar i { display: block; height: 100%; background: var(--force); transform-origin: left; animation: notice-drain ${NOTICE_MS}ms linear forwards; }
    @keyframes notice-fade { 0%, 80% { opacity: 1; } 100% { opacity: 0.15; } }
    @keyframes notice-drain { to { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) { .notice, .bar i { animation: none; } }
  `,
})
export class ResolutionNotice {
  readonly content = input.required<ResolutionNoticeContent>();
  // The public state: names, Generals, force and HP are read from it.
  readonly state = input.required<GameState>();
  // The notice has faded: the board drops it.
  readonly faded = output<void>();

  private readonly i18n = inject(I18n);
  protected readonly cardBackUrl = CARD_BACK_ART_URL;

  constructor() {
    const timer = setTimeout(() => this.faded.emit(), NOTICE_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  // A param named `…Seat` holds a seat id, one named `card` or `…Card` a card id and `skill` a skill id: each is shown by name.
  private text_(t: NoticeText): string {
    const tr = this.i18n.translator;
    const params = Object.fromEntries(
      Object.entries(t.params ?? {}).map(([name, value]) => [
        name,
        /Seat$/.test(name)
          ? seatName(this.state().players, String(value), tr)
          : name === 'card' || /Card$/.test(name)
            ? cardIdDisplayName(String(value), tr)
            : name === 'skill'
              ? abilityDisplayName(String(value), tr)
              : value,
      ])
    );
    return tr(t.key as MessageKey, params);
  }

  protected readonly title = computed(() => this.i18n.translator('notice.title'));
  protected readonly headline = computed(() => this.text_(this.content().outcome.headline));
  protected readonly text = computed(() => this.text_(this.content().outcome.text));
  protected readonly steps = computed(() => this.content().steps.map((s) => this.text_(s)));

  private readonly sourceSeatId = computed(() => {
    const source = this.content().source;
    return source.kind === 'skill' ? source.seatId : this.content().seatIds[0];
  });
  protected readonly force = computed(() => seatForce(this.state().seats.find((s) => s.id === this.sourceSeatId())));

  protected readonly sourceName = computed(() => {
    const source = this.content().source;
    return source.kind === 'card' ? cardIdDisplayName(source.id, this.i18n.translator) : abilityDisplayName(source.id, this.i18n.translator);
  });
  // A card's art, or the skill owner's General skin.
  protected readonly sourceArt = computed<{ id: string; cropped: boolean } | null>(() => {
    const source = this.content().source;
    if (source.kind === 'card') return { id: source.id, cropped: true };
    const general = this.state().seats.find((s) => s.id === source.seatId)?.generals?.main.generalDefinitionId;
    return general && general !== 'hidden' ? { id: general, cropped: false } : null;
  });

  protected readonly actors = computed(() =>
    this.content().seatIds.map((id) => ({
      id,
      name: seatName(this.state().players, id, this.i18n.translator),
      generals: this.state().seats.find((s) => s.id === id)?.generals ?? null,
    }))
  );

  protected readonly hp = computed(() => {
    const change = this.content().outcome.hp;
    const seat = change ? this.state().seats.find((s) => s.id === change.seatId) : undefined;
    if (!change || !seat) return null;
    return { name: seatName(this.state().players, change.seatId, this.i18n.translator), current: seat.combinedHp, hearts: Array.from({ length: seat.maxCombinedHp }, (_, n) => n) };
  });
}
